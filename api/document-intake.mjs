import { setTimeout as wait } from 'node:timers/promises';
import { validateInputs } from '../service/ai-service.mjs';
import { HttpError } from './auth.mjs';

const modelPath = '/documentintelligence/documentModels/prebuilt-read';
const apiVersion = '2024-11-30';

export async function readShipmentDocument(input, credential, endpoint, { fetchImpl = fetch, signal = AbortSignal.timeout(28_000) } = {}) {
  const document = input.inputs.find(source => source.kind === 'pdf');
  if (!document) return { evidence: input, pagesRead: 0 };
  let origin;
  try { origin = new URL(endpoint); } catch { throw new HttpError(503, 'PDF reading requires a configured Document Intelligence resource.'); }
  if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port || origin.search || origin.hash || origin.pathname !== '/' || !origin.hostname.endsWith('.cognitiveservices.azure.com')) {
    throw new HttpError(503, 'Configure the HTTPS Document Intelligence resource origin.');
  }
  const { token } = await credential.getToken('https://cognitiveservices.azure.com/.default', { abortSignal: signal });
  const headers = { Authorization: 'Bearer ' + token };
  const start = await fetchImpl(new URL(modelPath + ':analyze?api-version=' + apiVersion + '&pages=1-10', origin), {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/pdf' }, body: document.bytes, redirect: 'error', signal
  });
  if (start.status !== 202) throw new HttpError(502, 'Document Intelligence could not read this PDF.');
  let operation;
  try { operation = new URL(start.headers.get('Operation-Location')); } catch { throw new HttpError(502, 'Document Intelligence returned no reading status.'); }
  if (operation.origin !== origin.origin || operation.username || operation.password || !operation.pathname.startsWith(modelPath + '/analyzeResults/')) {
    throw new HttpError(502, 'Document Intelligence returned an invalid reading status.');
  }
  while (true) {
    const result = await fetchImpl(operation, { headers, redirect: 'error', signal });
    if (!result.ok) throw new HttpError(502, 'The PDF reading status is unavailable.');
    const { status, analyzeResult } = await result.json();
    if (status === 'succeeded') {
      const content = typeof analyzeResult?.content === 'string' ? analyzeResult.content.trim() : '';
      if (!content || content.length > 30_000) throw new HttpError(422, 'Use a shorter PDF with readable text, or paste a relevant excerpt.');
      const inputs = input.inputs.map(source => source === document
        ? { id: source.id, name: (source.name.slice(0, 137) + ' (extracted PDF text)'), kind: 'text', text: content }
        : source);
      try {
        const pagesRead = Array.isArray(analyzeResult.pages) ? Math.min(analyzeResult.pages.length, 10) : 0;
        return { evidence: validateInputs({ brand: input.brand, inputs }), pagesRead };
      } catch (error) {
        throw new HttpError(422, error.message);
      }
    }
    if (status !== 'running' && status !== 'notStarted') throw new HttpError(422, 'This PDF could not be read. Try a readable PDF or paste a relevant excerpt.');
    await wait(1000, undefined, { signal });
  }
}
