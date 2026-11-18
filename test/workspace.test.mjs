import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHandler } from '../api/handlers.mjs';
import { BlobStore } from '../api/blob-store.mjs';
import { validateInputs, callProvider } from '../service/ai-service.mjs';
import { sectorObservations } from '../api/sector-vision.mjs';

const origin = 'https://coldline.example';
const timestamp = Date.parse('2026-11-18T10:00:00Z');
const record = { id: 'CL-1', name: 'Tomato shipment', place: 'Farm → Depot', value: 12, score: 70, status: 'Needs review', owner: 'Quality team', note: 'Review the temperature trace.' };
const membership = (tenantId, roles = ['operator']) => ({ tenantId, organization: tenantId, roles });
const env = { COLDLINE_PUBLIC_ORIGIN: origin, COLDLINE_ENQUIRY_HASH_SALT: 'a-long-random-test-salt-not-a-production-secret', COLDLINE_MEMBERSHIPS_JSON: JSON.stringify({ alice: membership('org-alpha'), bob: membership('org-beta'), viewer: membership('org-alpha', ['viewer']), expired: { ...membership('org-alpha'), trialEndsAt: '2026-11-01T00:00:00Z' } }), COLDLINE_OWNER_USER_IDS: 'owner' };
const principal = userId => Buffer.from(JSON.stringify({ identityProvider: 'aad', userId, userDetails: `${userId}@example.test`, userRoles: ['anonymous', 'authenticated'] })).toString('base64');
function request(path, { user = 'alice', method = 'GET', body, headers = {} } = {}) {
  return new Request(origin + '/api/' + path, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...(user ? { 'x-ms-client-principal': principal(user) } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function memoryBlobs() {
  const data = new Map(); let revision = 0, failArchive = false;
  return {
    data, set failArchive(value) { failArchive = value; },
    getContainerClient(container) {
      return {
        async createIfNotExists() {},
        async *listBlobsFlat({ prefix }) {
          for (const [key, value] of [...data].sort()) if (key.startsWith(container + '/' + prefix)) yield { name: key.slice(container.length + 1), properties: { lastModified: new Date(value.modified) } };
        },
        getBlockBlobClient(name) {
          const key = container + '/' + name;
          return {
            async download() { const value = data.get(key); if (!value) throw { statusCode: 404 }; return { readableStreamBody: Readable.from([Buffer.from(value.text)]), etag: value.etag }; },
            async uploadData(bytes, { conditions }) {
              if (container === 'coldline-audit' && failArchive) throw new Error('Archive temporarily unavailable');
              const previous = data.get(key);
              if ((conditions.ifNoneMatch && previous) || (conditions.ifMatch && previous?.etag !== conditions.ifMatch)) throw { statusCode: 412 };
              const etag = `"revision-${++revision}"`; data.set(key, { text: bytes.toString(), etag, modified: timestamp + revision }); return { etag };
            }
          };
        }
      };
    }
  };
}
function setup() {
  const blobs = memoryBlobs(), store = new BlobStore(blobs), logs = [];
  const analyze = async () => ({ report: { title: 'Temperature review', summary: 'Check the supplied trace.', findings: [{ title: 'Trace requires review', level: 'Review', source: 'S1', quote: '6.8 C', action: 'Ask the quality lead to verify the trace.' }] }, usage: { input_tokens: 120, output_tokens: 60 } });
  return { blobs, store, logs, handle: createHandler({ store, analyze, env, now: () => timestamp, log: entry => logs.push(entry) }) };
}

test('organization identity is required and trials expire on the server', async () => {
  const { handle } = setup();
  for (const [user, status] of [[null, 401], ['unknown', 403], ['expired', 403], ['alice', 200]]) assert.equal((await handle(request('session', { user }))).status, status);
  const forged = Buffer.from(JSON.stringify({ userId: 'alice', identityProvider: 'github', userRoles: ['authenticated'] })).toString('base64');
  assert.equal((await handle(request('records', { headers: { 'x-ms-client-principal': forged } }))).status, 401);
});

test('writes require a role, matching origin, valid records, and a current version', async () => {
  const { handle } = setup(); const options = { method: 'PUT', body: { records: [record] }, headers: { 'If-None-Match': '*' } };
  assert.equal((await handle(request('records', { ...options, user: 'viewer' }))).status, 403);
  assert.equal((await handle(request('records', { ...options, headers: { Origin: 'https://attacker.example', 'If-None-Match': '*' } }))).status, 403);
  assert.equal((await handle(request('records', { ...options, headers: {} }))).status, 428);
  assert.equal((await handle(request('records', { ...options, body: { records: [record, record] } }))).status, 400);
  const saved = await handle(request('records', options)); assert.equal(saved.status, 200);
  assert.equal((await handle(request('records', options))).status, 409);
  assert.equal((await handle(request('records', { ...options, headers: { 'If-Match': 'stale' } }))).status, 409);
  assert.equal((await handle(request('records', { ...options, headers: { 'If-Match': saved.jsonBody.version } }))).status, 200);
});

test('records, reports, and audit events never cross organization boundaries', async () => {
  const { handle } = setup();
  await handle(request('records', { method: 'PUT', headers: { 'If-None-Match': '*' }, body: { records: [record] } }));
  assert.equal((await handle(request('records', { user: 'bob' }))).jsonBody.records.length, 0);
  assert.equal((await handle(request('audit', { user: 'bob' }))).jsonBody.events.length, 0);
  const result = await handle(request('analyze', { method: 'POST', body: { brand: 'coldline', inputs: [{ id: 'S1', name: 'Trace', kind: 'text', text: 'Recorded temperature 6.8 C.' }] } }));
  assert.equal(result.status, 200); assert.match(result.jsonBody.report.id, /^[a-f0-9-]{36}$/);
  assert.equal(result.jsonBody.report.usage.input_tokens, 120);
  assert.equal((await handle(request('reports', { user: 'bob' }))).jsonBody.reports.length, 0);
  assert.equal((await handle(request(`reports/${result.jsonBody.report.id}/accept`, { user: 'bob', method: 'POST' }))).status, 404);
  assert.equal((await handle(request(`reports/${result.jsonBody.report.id}/accept`, { method: 'POST' }))).jsonBody.report.accepted, true);
});

test('audit events survive archive failures for record writes and report acceptance', async () => {
  const { blobs, store, handle } = setup(); blobs.failArchive = true;
  const result = await handle(request('records', { method: 'PUT', headers: { 'If-None-Match': '*' }, body: { records: [record] } }));
  assert.equal(result.status, 200); assert.equal((await store.read('tenant-org-alpha', 'workspace.json')).data.pendingAudit.length, 1);
  const report = (await handle(request('analyze', { method: 'POST', body: { brand: 'coldline', inputs: [{ id: 'S1', kind: 'text', text: '6.8 C' }] } }))).jsonBody.report;
  assert.equal((await handle(request(`reports/${report.id}/accept`, { method: 'POST' }))).status, 200);
  assert.equal((await store.read('tenant-org-alpha', `reports/${report.id}.json`)).data.pendingAudit.length, 2);
  assert.equal((await handle(request('audit'))).jsonBody.events.length, 3);
  blobs.failArchive = false; await store.flushAudit({ tenantId: 'org-alpha' });
  assert.equal((await store.read('tenant-org-alpha', 'workspace.json')).data.pendingAudit.length, 0);
  assert.equal((await store.read('tenant-org-alpha', `reports/${report.id}.json`)).data.pendingAudit.length, 0);
  assert.equal((await handle(request('audit'))).jsonBody.events.length, 3);
});

test('free-form enquiries are private, validated, rate limited, and only acknowledged after storage', async () => {
  const { handle, store, logs } = setup();
  const body = { name: 'Test requester', email: 'requester@example.test', organization: 'Test farm', requestType: '14-day trial', message: 'Please arrange an onboarding conversation.' };
  assert.equal((await handle(request('enquiries', { user: null, method: 'POST', body: { ...body, email: 'invalid' } }))).status, 400);
  for (let i = 0; i < 8; i++) assert.equal((await handle(request('enquiries', { user: null, method: 'POST', body }))).status, 201);
  assert.equal((await handle(request('enquiries', { user: null, method: 'POST', body }))).status, 429);
  assert.equal((await handle(request('enquiries'))).status, 403);
  assert.equal((await handle(request('enquiries', { user: 'owner' }))).jsonBody.enquiries.length, 8);
  assert.ok(!JSON.stringify(logs).includes(body.email));
  store.saveEnquiry = async () => { throw new Error('storage offline'); };
  const failed = await handle(request('enquiries', { user: null, method: 'POST', body, headers: { 'x-forwarded-for': '192.0.2.1' } }));
  assert.equal(failed.status, 503); assert.equal(failed.jsonBody.reference, undefined);
});

test('evidence validation rejects duplicate references and fabricated image formats', () => {
  assert.throws(() => validateInputs({ brand: 'coldline', inputs: [{ id: 'S1', kind: 'text', text: 'one' }, { id: 'S1', kind: 'text', text: 'two' }] }), /unique reference/);
  assert.throws(() => validateInputs({ brand: 'coldline', inputs: [{ id: 'I1', kind: 'image', image: 'data:image/png;base64,' + Buffer.from('not an actual png image').toString('base64') }] }), /does not match/);
});

test('the AI adapter rejects a quotation that is absent from the cited source', async () => {
  const providerConfig = { configured: true, url: 'https://example.test', headers: {}, model: 'test', provider: 'azure' };
  const report = { title: 'Review', summary: 'Review evidence.', findings: [{ title: 'Risk', level: 'Review', source: 'S1', quote: 'invented temperature', action: 'Check source.' }] };
  await assert.rejects(callProvider({ brand: 'coldline', inputs: [{ id: 'S1', name: 'Trace', kind: 'text', text: 'Temperature is 6.8 C.' }], providerConfig, fetchImpl: async () => ({ ok: true, json: async () => ({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(report) }] }] }) }) }), /could not be found/);
});

test('optional sector inference validates its host and source image references', async () => {
  const input = { brand: 'coldline', inputs: [{ id: 'I1', kind: 'image', image: 'test-image-bytes' }] };
  const credential = { getToken: async () => ({ token: 'test-token' }) };
  const env = { COLDLINE_VISION_ENDPOINT: 'https://test.region.inference.ml.azure.com/score' };
  const fetchImpl = async () => ({ ok: true, json: async () => ({ observations: [{ source: 'I1', observation: 'Visible surface change.' }] }) });
  const result = await sectorObservations(input, credential, env, fetchImpl);
  assert.equal(result.inputs.length, 2); assert.match(result.inputs[1].text, /^Image I1:/);
  await assert.rejects(sectorObservations(input, credential, { COLDLINE_VISION_ENDPOINT: 'http://untrusted.example/score' }, fetchImpl), /configured HTTPS/);
  await assert.rejects(sectorObservations(input, credential, env, async () => ({ ok: true, json: async () => ({ observations: [{ source: 'I2', observation: 'Invented source.' }] }) })), /valid source image/);
});
