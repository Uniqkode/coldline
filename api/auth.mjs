export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function principalFrom(request) {
  const value = request.headers.get('x-ms-client-principal');
  if (!value || value.length > 16000) throw new HttpError(401, 'Sign in with your organization account.');
  let principal;
  try { principal = JSON.parse(Buffer.from(value, 'base64').toString('utf8')); } catch { throw new HttpError(401, 'The identity context is invalid.'); }
  if (principal?.identityProvider !== 'aad' || typeof principal.userId !== 'string' || !/^[a-zA-Z0-9._:-]{1,256}$/.test(principal.userId) || !Array.isArray(principal.userRoles) || !principal.userRoles.includes('authenticated')) {
    throw new HttpError(401, 'A verified Microsoft Entra sign-in is required.');
  }
  return principal;
}

export function membershipFor(principal, env, now = Date.now()) {
  let memberships;
  try { memberships = JSON.parse(env.COLDLINE_MEMBERSHIPS_JSON || '{}'); } catch { throw new HttpError(503, 'Organization access is not configured correctly.'); }
  if (!memberships || typeof memberships !== 'object' || Array.isArray(memberships)) throw new HttpError(503, 'Organization access is not configured correctly.');
  const member = Object.hasOwn(memberships, principal.userId) ? memberships[principal.userId] : null;
  if (!member) throw new HttpError(403, 'Your organization access is awaiting onboarding approval.');
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(member.tenantId || '') || !Array.isArray(member.roles) || !member.roles.length || member.roles.some(role => !['admin', 'operator', 'reviewer', 'viewer'].includes(role))) {
    throw new HttpError(503, 'The organization membership is invalid.');
  }
  if (member.trialEndsAt && (!Number.isFinite(Date.parse(member.trialEndsAt)) || Date.parse(member.trialEndsAt) <= now)) {
    throw new HttpError(403, 'This trial has ended. Contact the team to arrange continued access.');
  }
  return { tenantId: member.tenantId, organization: member.organization || member.tenantId, userId: principal.userId, userDetails: principal.userDetails || '', roles: member.roles, trialEndsAt: member.trialEndsAt || null };
}

export function requireWriter(member) {
  if (!member.roles.some(role => ['admin', 'operator', 'reviewer'].includes(role))) throw new HttpError(403, 'Your role can view records but cannot change them.');
}

export function requireOrigin(request, env) {
  const origin = request.headers.get('origin');
  const expected = env.COLDLINE_PUBLIC_ORIGIN;
  if (!expected) throw new HttpError(503, 'The public website origin is not configured.');
  if (origin !== expected) throw new HttpError(403, 'This request origin is not allowed.');
}
