import React from 'react';
import { createRoot } from 'react-dom/client';
import { MilkdownProvider } from '@milkdown/react';
import DOMPurify from 'dompurify';
import './index.css';
import './i18n'; // 初始化 i18n（副作用导入）
import App from './App';

// Allow <foreignObject> inside SVG so mermaid node labels render correctly.
// This is a desktop app (Electrobun) so XSS from foreignObject is not a concern.
DOMPurify.addHook('uponSanitizeElement', (node, data) => {
  if (data.tagName === 'foreignobject') {
    data.allowedTags['foreignobject'] = true;
  }
});

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
