import { writeFile } from 'node:fs/promises';
const env = process.env;
for (const name of ['ENTRA_TENANT_ID', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET', 'COLDLINE_ENQUIRY_HASH_SALT']) if (!env[name]) throw new Error(`Missing required deployment secret: ${name}`);
if (env.COLDLINE_ENQUIRY_HASH_SALT.length < 24) throw new Error('The enquiry salt must contain at least 24 random characters.');
JSON.parse(env.COLDLINE_MEMBERSHIPS_JSON || '{}');
const values = { namePrefix: env.NAME_PREFIX || 'coldline', entraTenantId: env.ENTRA_TENANT_ID, entraClientId: env.ENTRA_CLIENT_ID, entraClientSecret: env.ENTRA_CLIENT_SECRET, enquiryHashSalt: env.COLDLINE_ENQUIRY_HASH_SALT, membershipsJson: env.COLDLINE_MEMBERSHIPS_JSON || '{}', ownerUserIds: env.COLDLINE_OWNER_USER_IDS || '', privateNetworking: env.PRIVATE_NETWORKING === 'true', openAIAccountName: env.OPENAI_ACCOUNT_NAME || '', openAIDeployment: env.OPENAI_DEPLOYMENT || '', visionEndpoint: env.COLDLINE_VISION_ENDPOINT || '', inferenceHost: env.COLDLINE_INFERENCE_HOST || '' };
values.documentAccountName = env.DOCUMENT_ACCOUNT_NAME || '';
await writeFile(process.argv[2], JSON.stringify({ $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#', contentVersion: '1.0.0.0', parameters: Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { value }])) }), { mode: 0o600 });
