import { createHash, randomUUID } from 'node:crypto';
import { HttpError, principalFrom, membershipFor, requireWriter, requireOrigin } from './auth.mjs';
import { jsonBody, validateRecords, validateEnquiry } from './validation.mjs';
import { validateInputs } from '../service/ai-service.mjs';

export function createHandler({ store, analyze, env = process.env, now = () => Date.now(), log = () => {} }) {
  return async request => {
    const requestId = randomUUID(), started = now();
    const path = new URL(request.url).pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
    const method = request.method.toUpperCase();
    const respond = (status, body, headers = {}) => {
      log({ requestId, route: path, method, status, durationMs: Math.max(0, now() - started) });
      return { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Request-Id': requestId, ...headers }, jsonBody: body };
    };
    try {
      if (method === 'GET' && path === 'health') return respond(200, { service: 'coldline', configured: Boolean(env.AZURE_OPENAI_ENDPOINT && env.AZURE_OPENAI_DEPLOYMENT), storageConfigured: Boolean(env.COLDLINE_STORAGE_ACCOUNT_URL), authentication: 'Microsoft Entra via linked Static Web Apps', release: '5.0.0' });
      if (method === 'POST' && path === 'enquiries') {
        requireOrigin(request, env);
        if (!env.COLDLINE_ENQUIRY_HASH_SALT || env.COLDLINE_ENQUIRY_HASH_SALT.length < 24) throw new HttpError(503, 'The enquiry service is not configured.');
        const input = validateEnquiry(await jsonBody(request, 10000));
        const peer = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
        const bucket = createHash('sha256').update(env.COLDLINE_ENQUIRY_HASH_SALT + peer).digest('hex');
        await store.consumeRate(bucket, Math.floor(now() / 600000), 8);
        const enquiry = { ...input, id: randomUUID(), createdAt: new Date(now()).toISOString(), status: 'Received' };
        await store.saveEnquiry(enquiry);
        return respond(201, { reference: enquiry.id, status: 'Received' });
      }
      const principal = principalFrom(request);
      if (method === 'GET' && path === 'session') {
        const member = membershipFor(principal, env, now());
        return respond(200, { organization: member.organization, userId: member.userId, userDetails: member.userDetails, roles: member.roles, trialEndsAt: member.trialEndsAt, documentIntake: Boolean(env.COLDLINE_DOCUMENT_INTELLIGENCE_ENDPOINT) });
      }
      if (method === 'GET' && path === 'enquiries') {
        const owners = (env.COLDLINE_OWNER_USER_IDS || '').split(',').map(id => id.trim());
        if (!owners.includes(principal.userId)) throw new HttpError(403, 'Only the configured product owner can read enquiries.');
        return respond(200, { enquiries: await store.listEnquiries() });
      }
      const member = membershipFor(principal, env, now());
      if (method === 'GET' && path === 'records') {
        const state = await store.getRecords(member);
        return respond(200, state, state.version ? { ETag: state.version } : {});
      }
      if (method === 'PUT' && path === 'records') {
        requireOrigin(request, env); requireWriter(member);
        const version = request.headers.get('if-match');
        const create = request.headers.get('if-none-match') === '*';
        if (!version && !create) throw new HttpError(428, 'A record version is required to prevent lost updates.');
        const records = validateRecords(await jsonBody(request));
        const state = await store.saveRecords(member, records, create ? null : version, { id: requestId, action: 'records.updated', actor: member.userId, tenantId: member.tenantId, timestamp: new Date(now()).toISOString(), recordCount: records.length });
        return respond(200, state, { ETag: state.version });
      }
      if (method === 'GET' && path === 'audit') return respond(200, { events: await store.listAudit(member) });
      if (method === 'GET' && path === 'reports') return respond(200, { reports: await store.listReports(member) });
      if (method === 'GET' && path === 'usage') return respond(200, await store.getUsage(member));
      if (method === 'POST' && path === 'analyze') {
        requireOrigin(request, env); requireWriter(member);
        await store.consumeRate(`analysis-${member.tenantId}-${member.userId}`, Math.floor(now() / 60000), 12);
        let input;
        try { input = validateInputs(await jsonBody(request, 12 * 1024 * 1024), { allowPdf: Boolean(env.COLDLINE_DOCUMENT_INTELLIGENCE_ENDPOINT) }); } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, error.message); }
        const result = await analyze(input);
        const id = randomUUID(), timestamp = new Date(now()).toISOString();
        const report = { ...result.report, id, mode: 'live', accepted: false, createdAt: timestamp, actor: member.userId, sources: (result.sources || input.inputs).map(source => ({ id: source.id, name: source.name, kind: source.kind, excerpt: source.kind === 'text' ? source.text : 'Image supplied for this analysis. Image bytes are not retained in the report.' })), usage: result.usage, durationMs: Math.max(0, now() - started) };
        await store.saveReport(member, report);
        return respond(200, { report, usage: result.usage, cached: false });
      }
      const acceptance = path.match(/^reports\/([a-f0-9-]{36})\/accept$/);
      if (method === 'POST' && acceptance) {
        requireOrigin(request, env); requireWriter(member);
        return respond(200, { report: await store.acceptReport(member, acceptance[1], new Date(now()).toISOString()) });
      }
      return respond(404, { error: 'Endpoint not found.' });
    } catch (error) {
      if (error instanceof HttpError) return respond(error.status, { error: error.message, requestId });
      if (error.name === 'TimeoutError' || error.name === 'AbortError') return respond(504, { error: 'Analysis took too long. Try a smaller evidence batch.', requestId });
      return respond(503, { error: 'The service could not complete this request. Check the deployment configuration or try again.', requestId });
    }
  };
}
