import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { toast } from './app/store';
import './styles/index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element missing');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

const updateSW = registerSW({
  // The waiting service worker only activates when something calls updateSW(true), so the
  // prompt has to carry the action that does it. An informational toast leaves the new
  // build parked in "waiting" forever and the user looking at a stale app — which is
  // exactly what happened before this was wired up.
  onNeedRefresh() {
    toast.action('A new version of Lock’d is ready.', 'Reload', () => {
      void updateSW(true);
    });
  },
  onOfflineReady() {
    toast.success('Lock’d is ready offline.');
  },
});
