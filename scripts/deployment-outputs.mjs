import { readFile } from 'node:fs/promises';
const outputs = JSON.parse(await readFile(process.argv[2], 'utf8')).properties.outputs;
for (const name of ['staticSiteName', 'functionAppName', 'functionAppId', 'origin']) {
  const value = outputs[name]?.value;
  if (typeof value !== 'string' || /[\r\n]/.test(value)) throw new Error('Invalid deployment output: ' + name);
  console.log(name + '=' + value);
}
