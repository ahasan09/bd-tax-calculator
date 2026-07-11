import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const dir = dirname(fileURLToPath(import.meta.url));
const load = f => readFileSync(join(dir, f), 'utf8');
const fn = new Function(load('tax.js') + '\n;globalThis.BDTax = BDTax;\n' + load('tests.js'));
fn();
const results = globalThis.__results;
let passed = 0;
for (const r of results) {
  console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : ' — ' + r.err));
  if (r.ok) passed++;
}
console.log(`${passed}/${results.length} passing`);
process.exit(passed === results.length ? 0 : 1);
