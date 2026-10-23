import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startNetworkMonitor } from './lib/environment';
import './index.css';

// 尽早开始记录网络请求，自检页显示外部请求数（应为 0）
startNetworkMonitor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
