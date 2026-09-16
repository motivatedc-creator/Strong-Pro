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

// Service worker: prompt rather than reload under the user's hands mid-set.
const updateSW = registerSW({
  onNeedRefresh() {
    toast.info('A new version of RepForge is ready.');
    // The update applies on the next launch; never interrupt an in-progress session.
    window.addEventListener(
      'rf-apply-update',
      () => {
        void updateSW(true);
      },
      { once: true },
    );
  },
  onOfflineReady() {
    toast.success('RepForge is ready to work offline.');
  },
});
