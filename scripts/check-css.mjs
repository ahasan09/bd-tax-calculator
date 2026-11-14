// After `vite build`: every Mantine class the bundled JS can use must be
// styled in the bundled CSS. Mantine components use fixed class names
// (m_xxxxxxxx); a class that the full @mantine/core/styles.css styles but our
// trimmed import list (src/mantine-styles.ts) doesn't is a missing stylesheet.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist/assets';
const files = readdirSync(dist);
const read = ext => files.filter(f => f.endsWith(ext)).map(f => readFileSync(join(dist, f), 'utf8')).join('\n');
const classes = (text, re) => new Set([...text.matchAll(re)].map(m => m[1]));

const usedByJs = classes(read('.js'), /["'`\s.](m_[0-9a-f]{8})\b/g);
const styledFull = classes(readFileSync('node_modules/@mantine/core/styles.css', 'utf8'), /\.(m_[0-9a-f]{8})\b/g);
const styledOurs = classes(read('.css'), /\.(m_[0-9a-f]{8})\b/g);

const missing = [...usedByJs].filter(c => styledFull.has(c) && !styledOurs.has(c));
if (missing.length) {
  // Name the Mantine stylesheet(s) that define each missing class.
  const dir = 'node_modules/@mantine/core/styles';
  const owners = readdirSync(dir).filter(f => f.endsWith('.css') && !f.includes('.layer.'))
    .filter(f => missing.some(c => readFileSync(join(dir, f), 'utf8').includes('.' + c)));
  console.error(`Missing Mantine styles for ${missing.length} class(es): ${missing.join(', ')}`);
  console.error(`Add to src/mantine-styles.ts: ${owners.join(', ')}`);
  process.exit(1);
}
console.log(`CSS check: all ${[...usedByJs].filter(c => styledFull.has(c)).length} Mantine classes used by the app are styled.`);
