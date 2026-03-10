import React from 'react';
import { createRoot } from 'react-dom/client';
import { MilkdownProvider } from '@milkdown/react';
import './index.css';
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
