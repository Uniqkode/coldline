// Produces an entry for a verified /.auth/me userId. It does not grant access by itself.
const [userId, tenantId, organization] = process.argv.slice(2);
if (!/^[a-zA-Z0-9._:-]{1,256}$/.test(userId || '') || !/^[a-z0-9][a-z0-9-]{2,47}$/.test(tenantId || '') || !organization?.trim() || organization.length > 160) {
  console.error('Usage: node scripts/trial-member.mjs VERIFIED_SWA_USER_ID tenant-slug "Organization name"'); process.exit(1);
}
console.log(JSON.stringify({ [userId]: { tenantId, organization, roles: ['operator'], trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString() } }, null, 2));
