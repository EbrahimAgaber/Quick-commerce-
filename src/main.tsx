import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.tsx';
import { initVersionWatcher } from './utils/versionWatcher.ts';
import './index.css';

// Initialize automatic deployment update watcher and chunk self-healing
initVersionWatcher();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
