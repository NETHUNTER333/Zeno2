import { initFrontendSentry } from './lib/sentry';

// Initialize Sentry SDK loaded as early as possible
initFrontendSentry();

import './lib/apiBase';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import 'katex/dist/katex.min.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
    <Analytics />
  </ErrorBoundary>
);
