import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { QueryClientProvider } from './lib/query';
import { ErrorBoundary } from './components/ErrorBoundary';
import './i18n';
import './styles/globals.css';
import { applyTheme, readStoredTheme } from './lib/theme';

// Apply persisted theme before first render to avoid flash.
applyTheme(readStoredTheme());

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root was not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
