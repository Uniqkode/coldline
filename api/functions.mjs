import { app } from '@azure/functions';
import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient } from '@azure/storage-blob';
import { createHandler } from './handlers.mjs';
import { BlobStore } from './blob-store.mjs';
import { callProvider } from '../service/ai-service.mjs';
import { resolveProviderConfiguration } from '../service/provider-config.mjs';
import { sectorObservations } from './sector-vision.mjs';

const credential = new DefaultAzureCredential();
let store;
function storage() {
  if (!process.env.COLDLINE_STORAGE_ACCOUNT_URL) throw new Error('Storage is not configured.');
  return store ||= new BlobStore(new BlobServiceClient(process.env.COLDLINE_STORAGE_ACCOUNT_URL, credential));
}
const proxyStore = new Proxy({}, { get: (_, name) => (...args) => storage()[name](...args) });
async function analyze(input) {
  if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_DEPLOYMENT) throw new Error('Azure AI is not configured.');
  const token = await credential.getToken('https://cognitiveservices.azure.com/.default');
  const providerConfig = resolveProviderConfiguration({ ...process.env, AI_PROVIDER: 'azure', AZURE_OPENAI_AUTH_TOKEN: token.token });
  const evidence = await sectorObservations(input, credential);
  const result = await callProvider({ ...evidence, providerConfig });
  return { ...result, sources: evidence.inputs };
}

app.http('workspace', { route: '{*path}', methods: ['GET', 'POST', 'PUT'], authLevel: 'anonymous', handler: (request, context) => createHandler({ store: proxyStore, analyze, log: entry => context.log(JSON.stringify(entry)) })(request) });
app.timer('flushAudit', { schedule: '0 */5 * * * *', handler: async (_, context) => {
  const memberships = JSON.parse(process.env.COLDLINE_MEMBERSHIPS_JSON || '{}');
  for (const tenantId of new Set(Object.values(memberships).map(member => member.tenantId))) {
    if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(tenantId || '')) continue;
    try { await storage().flushAudit({ tenantId }); } catch { context.error('Audit archive retry failed for a configured tenant.'); }
  }
} });
