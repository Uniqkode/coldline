import { HttpError } from './auth.mjs';

export async function jsonBody(request, limit = 4 * 1024 * 1024) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Send the request as JSON.');
  if (Number(request.headers.get('content-length')) > limit) throw new HttpError(413, 'The request is too large.');
  const text = await request.text();
  if (Buffer.byteLength(text) > limit) throw new HttpError(413, 'The request is too large.');
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'The request is not valid JSON.'); }
}

function text(value, name, maximum, optional = false) {
  if (optional && (value === undefined || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum) throw new HttpError(400, `Enter a valid ${name}.`);
  return value.trim();
}

export function validateRecords(body) {
  if (!body || !Array.isArray(body.records) || body.records.length > 2000) throw new HttpError(400, 'Provide at most 2,000 shipment records.');
  const ids = new Set();
  return body.records.map(record => {
    if (!record || !/^CL-[0-9]{1,12}$/.test(record.id || '') || ids.has(record.id)) throw new HttpError(400, 'Each shipment needs a unique CL reference.');
    ids.add(record.id);
    if (!Number.isFinite(record.value) || record.value <= 0 || record.value > 1000000 || !Number.isFinite(record.score) || record.score < 0 || record.score > 100 || !['Needs review', 'Scheduled', 'Delivered'].includes(record.status)) throw new HttpError(400, 'The shipment quantity, priority, or status is invalid.');
    return { id: record.id, name: text(record.name, 'shipment name', 120), place: text(record.place, 'route', 120), value: record.value, score: record.score, status: record.status, owner: text(record.owner, 'operator', 80), note: text(record.note, 'shipment note', 1500) };
  });
}

export function validateEnquiry(body) {
  if (!body || !['Product demo', '14-day trial', 'Enterprise onboarding', 'Integration discussion'].includes(body.requestType)) throw new HttpError(400, 'Choose a request type.');
  const email = text(body.email, 'work email', 180);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid work email.');
  return { name: text(body.name, 'name', 120), email, organization: text(body.organization, 'organization', 160), requestType: body.requestType, plan: text(body.plan, 'plan', 160, true), preferredTime: text(body.preferredTime, 'preferred time', 160, true), message: text(body.message, 'message', 3000) };
}
