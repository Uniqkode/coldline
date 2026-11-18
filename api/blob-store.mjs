import { HttpError } from './auth.mjs';

export class BlobStore {
  constructor(client) { this.client = client; }
  async container(name) { const container = this.client.getContainerClient(name); await container.createIfNotExists(); return container; }
  async read(container, name) {
    const blob = (await this.container(container)).getBlockBlobClient(name);
    try { const response = await blob.download(); const chunks = []; for await (const chunk of response.readableStreamBody) chunks.push(chunk); return { data: JSON.parse(Buffer.concat(chunks).toString('utf8')), version: response.etag }; }
    catch (error) { if (error.statusCode === 404) return { data: null, version: null }; throw error; }
  }
  async write(container, name, value, version) {
    const blob = (await this.container(container)).getBlockBlobClient(name);
    try { const response = await blob.uploadData(Buffer.from(JSON.stringify(value)), { conditions: version ? { ifMatch: version } : { ifNoneMatch: '*' }, blobHTTPHeaders: { blobContentType: 'application/json' } }); return response.etag; }
    catch (error) { if ([409, 412].includes(error.statusCode)) throw new HttpError(409, 'The record changed in another session. Reload the workspace before saving again.'); throw error; }
  }
  async getRecords(member) {
    const state = await this.read(`tenant-${member.tenantId}`, 'workspace.json');
    return { records: state.data?.records || [], version: state.version };
  }
  async saveRecords(member, records, version, event) {
    const container = `tenant-${member.tenantId}`, state = await this.read(container, 'workspace.json');
    if (state.version !== version) throw new HttpError(409, 'The record changed in another session. Reload before saving.');
    const pending = state.data?.pendingAudit || [];
    if (pending.length > 500) throw new HttpError(503, 'Audit archiving must recover before more records can be saved.');
    // honey: one workspace ETag is suitable for small teams; use per-record writes when concurrent writers regularly conflict.
    await this.write(container, 'workspace.json', { records, pendingAudit: [...pending, event] }, version);
    try { await this.flushAudit(member, false); } catch { /* The audit event remains durable in the same state write for retry. */ }
    return this.getRecords(member);
  }
  async flushAudit(member, includeReports = true) {
    if (includeReports) {
      const reports = await this.container(`tenant-${member.tenantId}`);
      for await (const blob of reports.listBlobsFlat({ prefix: 'reports/' })) await this.flushReportAudit(member, blob.name);
    }
    const name = `tenant-${member.tenantId}`, state = await this.read(name, 'workspace.json');
    if (!state.data?.pendingAudit?.length) return;
    const archived = new Set();
    for (const event of state.data.pendingAudit.slice(0, 100)) {
      try { await this.write('coldline-audit', `${member.tenantId}/${event.timestamp.slice(0, 10)}/${event.timestamp}-${event.id}.json`, event, null); }
      catch (error) { if (!(error instanceof HttpError && error.status === 409)) throw error; }
      archived.add(event.id);
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      const current = await this.read(name, 'workspace.json');
      try { await this.write(name, 'workspace.json', { ...current.data, pendingAudit: current.data.pendingAudit.filter(event => !archived.has(event.id)) }, current.version); return; }
      catch (error) { if (!(error instanceof HttpError && error.status === 409)) throw error; }
    }
  }
  async listAudit(member) {
    const container = await this.container('coldline-audit'), names = [];
    for await (const blob of container.listBlobsFlat({ prefix: `${member.tenantId}/` })) names.push(blob.name);
    const events = await Promise.all(names.sort().reverse().slice(0, 50).map(async name => (await this.read('coldline-audit', name)).data));
    const state = await this.read(`tenant-${member.tenantId}`, 'workspace.json');
    const pendingReports = (await this.listReports(member)).flatMap(report => report.pendingAudit || []);
    const merged = new Map([...events, ...(state.data?.pendingAudit || []), ...pendingReports].map(event => [event.id, event]));
    return [...merged.values()].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 50);
  }
  async consumeRate(key, bucket, limit) {
    const safe = key.replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 200), name = `limits/${safe}/${bucket}.json`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const state = await this.read('coldline-control', name);
      if ((state.data?.count || 0) >= limit) throw new HttpError(429, 'Too many requests. Please try again later.');
      try { await this.write('coldline-control', name, { count: (state.data?.count || 0) + 1 }, state.version); return; }
      catch (error) { if (!(error instanceof HttpError && error.status === 409)) throw error; }
    }
    throw new HttpError(503, 'Please retry this request.');
  }
  saveEnquiry(enquiry) { return this.write('coldline-control', `enquiries/${enquiry.createdAt.slice(0, 10)}/${enquiry.createdAt}-${enquiry.id}.json`, enquiry, null); }
  async listEnquiries() {
    const container = await this.container('coldline-control'), entries = [];
    for await (const blob of container.listBlobsFlat({ prefix: 'enquiries/' })) entries.push(blob.name);
    const rows = []; for (const name of entries.sort().reverse().slice(0, 100)) rows.push((await this.read('coldline-control', name)).data);
    return rows;
  }
  async saveReport(member, report) {
    const event = { id: report.id, tenantId: member.tenantId, actor: member.userId, timestamp: report.createdAt, action: 'analysis.completed', durationMs: report.durationMs, inputTokens: report.usage?.input_tokens || 0, outputTokens: report.usage?.output_tokens || 0 };
    const name = `reports/${report.id}.json`;
    await this.write(`tenant-${member.tenantId}`, name, { ...report, pendingAudit: [event] }, null);
    try { await this.flushReportAudit(member, name); } catch { /* The report retains its audit event for the timer retry. */ }
  }
  async flushReportAudit(member, name) {
    const container = `tenant-${member.tenantId}`, state = await this.read(container, name);
    if (!state.data?.pendingAudit?.length) return;
    const archived = new Set();
    for (const event of state.data.pendingAudit) {
      try { await this.write('coldline-audit', `${member.tenantId}/${event.timestamp.slice(0, 10)}/${event.timestamp}-${event.id}.json`, event, null); }
      catch (error) { if (!(error instanceof HttpError && error.status === 409)) throw error; }
      archived.add(event.id);
    }
    const latest = await this.read(container, name);
    await this.write(container, name, { ...latest.data, pendingAudit: latest.data.pendingAudit.filter(event => !archived.has(event.id)) }, latest.version);
  }
  async listReports(member) {
    const container = await this.container(`tenant-${member.tenantId}`), names = [];
    for await (const blob of container.listBlobsFlat({ prefix: 'reports/' })) names.push({ name: blob.name, modified: blob.properties.lastModified?.getTime() || 0 });
    const reports = []; for (const item of names.sort((a, b) => b.modified - a.modified).slice(0, 50)) reports.push((await this.read(`tenant-${member.tenantId}`, item.name)).data);
    return reports;
  }
  async acceptReport(member, id, timestamp) {
    const container = `tenant-${member.tenantId}`, name = `reports/${id}.json`, state = await this.read(container, name);
    if (!state.data) throw new HttpError(404, 'Report not found.');
    if (state.data.accepted) return state.data;
    const event = { id: `${id}-accepted`, tenantId: member.tenantId, actor: member.userId, timestamp, action: 'report.accepted', reportId: id };
    const report = { ...state.data, accepted: true, acceptedAt: timestamp, acceptedBy: member.userId, pendingAudit: [...(state.data.pendingAudit || []), event] };
    await this.write(container, name, report, state.version);
    try { await this.flushReportAudit(member, name); } catch { /* Acceptance and its audit event were committed together. */ }
    return report;
  }
  async getUsage(member) {
    const reports = await this.listReports(member), since = Date.now() - 30 * 86400000;
    const recent = reports.filter(report => Date.parse(report.createdAt) >= since);
    return { scope: 'organization', periodDays: 30, reportCount: recent.length, sampleLimit: 50, inputTokens: recent.reduce((n, report) => n + (report.usage?.input_tokens || 0), 0), outputTokens: recent.reduce((n, report) => n + (report.usage?.output_tokens || 0), 0), averageLatencyMs: recent.length ? Math.round(recent.reduce((n, report) => n + report.durationMs, 0) / recent.length) : null, measuredAt: new Date().toISOString() };
  }
}
