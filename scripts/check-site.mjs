import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..'), files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'dist'].includes(entry.name)) continue;
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(file); else if (entry.name.endsWith('.html')) files.push(file);
  }
}
await walk(root);
for (const file of files) {
  const html = await readFile(file, 'utf8');
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: one primary heading`);
  assert.ok(!/calendly(?:\.com|-inline|\.js)/i.test(html), `${file}: no Calendly widget`);
  if (/assets\/app\.js/.test(html)) assert.ok(html.indexOf('workspace-client.js') > 0 && html.indexOf('workspace-client.js') < html.indexOf('assets/app.js'), `${file}: account client loads before workspace code`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${file}: unique IDs`);
  for (const match of html.matchAll(/(?:href|src)="([^"?#]+)(?:[?#][^"]*)?"/g)) {
    const value = match[1]; if (/^[a-z]+:|^\/\//i.test(value) || value.startsWith('#')) continue;
    const target = resolve(value.startsWith('/') ? root : dirname(file), value.replace(/^\//, ''));
    const info = await stat(target).catch(() => null);
    assert.ok(info, `${file}: missing ${value}`);
    if (info.isDirectory()) assert.ok(await stat(resolve(target, 'index.html')).catch(() => null), `${file}: missing index for ${value}`);
  }
  for (const match of html.matchAll(/\bhref="([^"#]*)#([^"?]+)"/g)) {
    if (/^[a-z]+:|^\/\//i.test(match[1])) continue;
    let target = resolve(dirname(file), match[1] || '.');
    if (!match[1]) target = file;
    else if ((await stat(target)).isDirectory()) target = resolve(target, 'index.html');
    const targetHTML = await readFile(target, 'utf8');
    assert.ok(targetHTML.includes(`id="${decodeURIComponent(match[2])}"`), `${file}: missing anchor ${match[0]}`);
  }
}
const home = await readFile(root + '/index.html', 'utf8');
assert.deepEqual([...home.matchAll(/data-home-section="([^"]+)"/g)].map(match => match[1]), ['hero', 'built-for', 'pillars', 'problem', 'how-it-works', 'technology', 'features', 'market', 'traction', 'roadmap', 'team', 'pricing', 'final-cta']);
assert.ok(/<footer\b/.test(home));
console.log(`Checked ${files.length} pages: local links, assets, unique IDs, headings, section order, and no Calendly widget.`);
