// Vite plugin: after the build is written, generate dist/sw.js from
// pwa/sw-template.js with the list of every built file and a version hash
// of their contents. Pure Node — no Workbox; the app is a handful of files.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

const WORKER = 'sw.js';
const TEMPLATE = new URL('./sw-template.js', import.meta.url);

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

// Exported for tests: the worker source for a set of files { path: contents }.
export function buildServiceWorker(template: string, files: Record<string, Buffer | string>): string {
  const paths = Object.keys(files)
    // the worker itself, and dev/test pages that start with "_", aren't app files
    .filter(p => p !== WORKER && !p.split('/').some(part => part.startsWith('_')))
    .sort();
  const hash = createHash('sha256');
  for (const p of paths) hash.update(p).update('\0').update(files[p]).update('\0');
  hash.update(template);
  // "./" as well as "index.html": the page is requested both ways.
  const precache = ['./', ...paths];
  return template
    .replace('__VERSION__', hash.digest('hex').slice(0, 12))
    .replace('__FILES__', JSON.stringify(precache, null, 2));
}

export function offlineServiceWorker(): Plugin {
  return {
    name: 'bdtax-offline-service-worker',
    apply: 'build',
    writeBundle(options) {
      const dir = options.dir ?? 'dist';
      const files = Object.fromEntries(listFiles(dir).map(f =>
        [relative(dir, f).split(sep).join('/'), readFileSync(f)]));
      writeFileSync(join(dir, WORKER), buildServiceWorker(readFileSync(TEMPLATE, 'utf8'), files));
    }
  };
}
