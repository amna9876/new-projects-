// Fails the build when the embed script grows past its gzip budget (see package.json).
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const { sizeBudget } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const bytes = gzipSync(readFileSync(new URL(`../${sizeBudget.file}`, import.meta.url))).length;
const kb = (value) => `${(value / 1024).toFixed(1)} kB`;

console.log(`${sizeBudget.file}: ${kb(bytes)} gzipped (budget ${kb(sizeBudget.maxGzipBytes)})`);
if (bytes > sizeBudget.maxGzipBytes) {
  console.error('The embed script is over its size budget.');
  process.exit(1);
}
