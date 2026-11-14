import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import './mantine-styles';
import './app.css';
import { theme } from './theme';
import { LangProvider } from './i18n/context';
import { App } from './App';

// Offline support (production builds only — the dev server shouldn't cache).
// The worker caches the app's files, never anything the user types.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* still works online */ });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <LangProvider>
        <App />
      </LangProvider>
    </MantineProvider>
  </StrictMode>
);
