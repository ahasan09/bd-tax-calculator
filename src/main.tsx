import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import './app.css';
import { theme } from './theme';
import { LangProvider } from './i18n/context';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <LangProvider>
        <App />
      </LangProvider>
    </MantineProvider>
  </StrictMode>
);
