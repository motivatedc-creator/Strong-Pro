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
  onNeedRefresh() {
    toast.info('A new version of Lockd is ready.');
    window.addEventListener(
      'rf-apply-update',
      () => {
        void updateSW(true);
      },
      { once: true },
    );
  },
  onOfflineReady() {
    toast.success('Lockd is ready offline.');
  },
});
