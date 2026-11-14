// The generated service worker: what it precaches and how its version moves.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildServiceWorker } from '../pwa/offline-plugin';

const template = readFileSync(new URL('../pwa/sw-template.js', import.meta.url), 'utf8');
const files = {
  'index.html': '<html>v1</html>',
  'assets/index-abc.js': 'js',
  'assets/index-def.css': 'css',
  'favicon.svg': '<svg/>',
  'sw.js': 'old worker',
  '_audit.html': 'test page'
};
const precacheOf = (sw: string) => JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)![1]) as string[];
const versionOf = (sw: string) => sw.match(/const VERSION = '([0-9a-f]+)'/)![1];

describe('service worker build', () => {
  test('precaches every app file plus "./", but not itself or _test pages', () => {
    expect(precacheOf(buildServiceWorker(template, files)))
      .toEqual(['./', 'assets/index-abc.js', 'assets/index-def.css', 'favicon.svg', 'index.html']);
  });

  test('no placeholders are left behind', () => {
    expect(buildServiceWorker(template, files)).not.toMatch(/__(VERSION|FILES)__/);
  });

  test('version is stable for the same build and changes when any file changes', () => {
    const v1 = versionOf(buildServiceWorker(template, files));
    expect(versionOf(buildServiceWorker(template, { ...files }))).toBe(v1);
    expect(versionOf(buildServiceWorker(template, { ...files, 'index.html': '<html>v2</html>' }))).not.toBe(v1);
    expect(versionOf(buildServiceWorker(template + '\n', files))).not.toBe(v1);
  });
});
