import { readFile } from 'node:fs/promises';
const auth = JSON.parse(await readFile(process.argv[2], 'utf8')).properties;
if (auth?.platform?.enabled !== true || auth?.globalValidation?.requireAuthentication !== true || auth?.globalValidation?.unauthenticatedClientAction !== 'Return401' || auth?.identityProviders?.azureStaticWebApps?.enabled !== true || !auth?.identityProviders?.azureStaticWebApps?.registration?.clientId || Object.entries(auth.identityProviders).some(([name, provider]) => name !== 'azureStaticWebApps' && provider?.enabled === true)) throw new Error('The API must require only the linked Static Web Apps identity before its HTTP function is enabled. Review the Azure Functions authentication settings.');
console.log('Linked Static Web Apps authentication is required.');
