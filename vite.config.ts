import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { offlineServiceWorker } from './pwa/offline-plugin';

// Relative base: the built site works at /bd-tax-calculator/ on GitHub Pages
// and when dist/index.html is opened straight from disk.
export default defineConfig({
  base: './',
  plugins: [react(), offlineServiceWorker()],
  test: { include: ['tests/**/*.test.ts'] }
});
