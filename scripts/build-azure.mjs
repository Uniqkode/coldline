import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..'), out = resolve(root, 'dist');
const origin = process.env.COLDLINE_RUNTIME_ORIGIN || '';
if (origin && (new URL(origin).protocol !== 'https:' || new URL(origin).origin !== origin)) throw new Error('COLDLINE_RUNTIME_ORIGIN must be an HTTPS origin without a path or trailing slash.');
const tenant = process.env.ENTRA_TENANT_ID || '';
if (origin && !/^[0-9a-f-]{36}$/i.test(tenant)) throw new Error('Set the verified ENTRA_TENANT_ID for a production build.');
await rm(out, { recursive: true, force: true });
await mkdir(out + '/site', { recursive: true });
for (const item of await readdir(root, { withFileTypes: true })) {
  if (item.isFile() && /\.html$|^(robots\.txt|sitemap\.xml|\.nojekyll)$/.test(item.name)) await cp(resolve(root, item.name), resolve(out, 'site', item.name));
  if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'assets') {
    try { await cp(resolve(root, item.name, 'index.html'), resolve(out, 'site', item.name, 'index.html')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (item.name === 'blog') for (const child of await readdir(resolve(root, 'blog'), { withFileTypes: true })) if (child.isDirectory()) await cp(resolve(root, 'blog', child.name), resolve(out, 'site', 'blog', child.name), { recursive: true });
  }
}
await cp(root + '/assets', out + '/site/assets', { recursive: true });
const context = { window: {} }; vm.runInNewContext(await readFile(root + '/assets/site-config.js', 'utf8'), context);
context.window.COLDLINE_SITE.runtime = { origin: origin || null, enabled: Boolean(origin) };
await writeFile(out + '/site/assets/site-config.js', 'window.COLDLINE_SITE=' + JSON.stringify(context.window.COLDLINE_SITE) + ';\n');
const config = JSON.parse(await readFile(root + '/staticwebapp.config.json', 'utf8'));
if (origin) {
  config.auth = { identityProviders: { azureActiveDirectory: { registration: { openIdIssuer: `https://login.microsoftonline.com/${tenant}/v2.0`, clientIdSettingName: 'ENTRA_CLIENT_ID', clientSecretSettingName: 'ENTRA_CLIENT_SECRET' } } } };
  config.routes = [{ route: '/.auth/login/github', statusCode: 404 }, ...['/dashboard', '/dashboard/*', '/api/session', '/api/records', '/api/audit', '/api/reports', '/api/reports/*', '/api/usage'].map(route => ({ route, allowedRoles: ['authenticated'] }))];
  async function canonical(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, item.name);
      if (item.isDirectory()) await canonical(path);
      else if (/\.(html|xml|txt)$/.test(item.name)) await writeFile(path, (await readFile(path, 'utf8')).replaceAll('https://uniqkode.github.io/coldline', origin));
    }
  }
  await canonical(out + '/site');
}
await writeFile(out + '/site/staticwebapp.config.json', JSON.stringify(config, null, 2) + '\n');
await mkdir(out + '/backend/api', { recursive: true });
for (const name of await readdir(root + '/api')) if (name.endsWith('.mjs')) await cp(root + '/api/' + name, out + '/backend/api/' + name);
for (const name of ['package.json', 'package-lock.json', 'host.json']) await cp(root + '/api/' + name, out + '/backend/' + name);
await cp(root + '/service', out + '/backend/service', { recursive: true });
console.log(`Built dist/site and dist/backend. Organization runtime: ${origin ? 'enabled for ' + origin : 'disabled (public demonstration)'}.`);
