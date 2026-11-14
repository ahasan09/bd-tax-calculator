import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base: the built site works at /bd-tax-calculator/ on GitHub Pages
// and when dist/index.html is opened straight from disk.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { include: ['tests/**/*.test.ts'] }
});
