import React from 'react';
import { createRoot } from 'react-dom/client';
import { MilkdownProvider } from '@milkdown/react';
import './index.css';
import './i18n'; // 初始化 i18n（副作用导入）
import App from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <MilkdownProvider>
        <App />
      </MilkdownProvider>
    </React.StrictMode>
  );
}
