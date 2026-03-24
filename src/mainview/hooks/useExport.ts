import { useCallback } from 'react';
import { electrobun } from '../lib/electrobun';
import { processMarkdownImages, getFileName } from '../lib/image';

function getDefaultFileName(filePath: string | null): string {
  if (!filePath) return 'export';
  const name = getFileName(filePath);
  return name.replace(/\.(md|markdown)$/i, '') || 'export';
}

const HTML_STYLE = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 40px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 16px;
    line-height: 1.7;
    color: #24292f;
    background: #ffffff;
  }
  h1, h2, h3, h4, h5, h6 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-weight: 600;
  }
  h1 { font-size: 2em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
  h2 { font-size: 1.5em; border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
  h3 { font-size: 1.25em; }
  h4 { font-size: 1em; }
  h5 { font-size: 0.875em; }
  h6 { font-size: 0.85em; }
  p { margin: 0.8em 0; }
  a { color: #0969da; text-decoration: none; }
  code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
    font-size: 0.875em;
    background: #f6f8fa;
    padding: 0.2em 0.4em;
    border-radius: 4px;
  }
  pre {
    background: #f6f8fa;
    border-radius: 6px;
    padding: 1em 1.2em;
    overflow-x: auto;
    margin: 1em 0;
  }
  pre code { background: none; padding: 0; font-size: 100%; }
  blockquote {
    margin: 1em 0;
    padding: 0.5em 1em;
    border-left: 4px solid #d0d7de;
    color: #656d76;
  }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td {
    border: 1px solid #d0d7de;
    padding: 0.5em 0.75em;
    text-align: left;
  }
  th { background: #f6f8fa; font-weight: 600; }
  tr:nth-child(even) { background: #f6f8fa; }
  img { max-width: 100%; height: auto; }
  ul, ol { padding-left: 1.5em; }
  li { margin: 0.25em 0; }
  hr { border: none; border-top: 1px solid #d0d7de; margin: 1.5em 0; }
  strong { font-weight: 600; }
  em { font-style: italic; }
  del { text-decoration: line-through; }
  input[type="checkbox"] { margin-right: 0.5em; }
  .katex { font-size: 1.1em; }
  .katex-display { margin: 1em 0; overflow-x: auto; }
  /* Dark mode */
  @media (prefers-color-scheme: dark) {
    body { background: #0d1117; color: #e6edf3; }
    h1, h2 { border-bottom-color: #30363d; }
    a { color: #58a6ff; }
    code { background: #161b22; }
    pre { background: #161b22; }
    blockquote { border-left-color: #30363d; color: #8b949e; }
    th, td { border-color: #30363d; }
    th { background: #161b22; }
    tr:nth-child(even) { background: #161b22; }
    hr { border-top-color: #30363d; }
  }
`;

export function useExport() {
  const exportAsHTML = useCallback(async (content: string, filePath: string | null) => {
    try {
      const { marked } = await import('marked');
      const html = await marked.parse(content);
      const fileName = getDefaultFileName(filePath);
      const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${fileName}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>${HTML_STYLE}</style>
</head>
<body>
${html}
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    // Render math
    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(document.body, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
      });
    }
    // Render mermaid
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false });
      mermaid.run({ querySelector: '.language-mermaid, .mermaid' });
    }
  });
</script>
</body>
</html>`;

      await electrobun.saveExportedFile({
        content: fullHtml,
        isBase64: false,
        defaultName: fileName,
        extension: 'html',
      });
    } catch (error) {
      console.error('HTML export failed:', error);
    }
  }, []);

  const exportAsImage = useCallback(async (content: string, filePath: string | null) => {
    // Create isolated iframe for rendering - must be cleaned up in finally
    const iframe = document.createElement('iframe');

    try {
      const { default: html2canvas } = await import('html2canvas');
      const { marked } = await import('marked');

      // Process markdown: convert to HTML with image processing
      const processedContent = await processMarkdownImages(content);
      const html = await marked.parse(processedContent);

      const isDark = document.documentElement.classList.contains('dark');
      const bgColor = isDark ? '#0d1117' : '#ffffff';

      // Setup iframe
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '1200px';
      iframe.style.height = 'auto';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) {
        return;
      }

      // Add doctype to prevent quirks mode (required for KaTeX)
      iframeDoc.open();
      iframeDoc.write('<!DOCTYPE html><html><head></head><body></body></html>');
      iframeDoc.close();

      // Add styles
      const styleEl = iframeDoc.createElement('style');
      styleEl.textContent = HTML_STYLE;
      iframeDoc.head.appendChild(styleEl);

      // Add KaTeX CSS
      const katexCss = iframeDoc.createElement('link');
      katexCss.rel = 'stylesheet';
      katexCss.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
      iframeDoc.head.appendChild(katexCss);

      // Add KaTeX JS
      const katexScript = iframeDoc.createElement('script');
      katexScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
      iframeDoc.head.appendChild(katexScript);

      // Add KaTeX auto-render extension
      const katexAutoScript = iframeDoc.createElement('script');
      katexAutoScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js';
      iframeDoc.head.appendChild(katexAutoScript);

      // Add mermaid
      const mermaidScript = iframeDoc.createElement('script');
      mermaidScript.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      iframeDoc.head.appendChild(mermaidScript);

      // Create content container
      const contentDiv = iframeDoc.createElement('div');
      contentDiv.style.padding = '60px';
      contentDiv.style.maxWidth = '1000px';
      contentDiv.style.margin = '0 auto';
      contentDiv.innerHTML = html;
      iframeDoc.body.appendChild(contentDiv);

      // Wait for all scripts to load
      await new Promise<void>((resolve) => {
        let loaded = 0;
        const checkLoaded = () => {
          loaded++;
          if (loaded >= 3) resolve();
        };

        katexScript.onload = checkLoaded;
        katexAutoScript.onload = checkLoaded;
        mermaidScript.onload = checkLoaded;

        katexScript.onerror = checkLoaded;
        katexAutoScript.onerror = checkLoaded;
        mermaidScript.onerror = checkLoaded;

        setTimeout(resolve, 3000);
      });

      const win = iframe.contentWindow as any;

      // Manual math rendering - scan all text nodes for $...$ and $$...$$
      if (win && win.katex) {
        const katex = win.katex;
        const walkTextNodes = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || '';
            // Check if this text node contains math delimiters
            if (text.includes('$')) {
              const parent = node.parentNode;
              if (!parent) return;

              // Skip if inside code/pre
              let el: Element | null = parent as Element;
              while (el) {
                if (el.tagName === 'CODE' || el.tagName === 'PRE') return;
                el = el.parentElement;
              }

              // Split by math delimiters
              const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$)/g);
              if (parts.length > 1) {
                const fragment = iframeDoc.createDocumentFragment();
                parts.forEach((part: string) => {
                  if (part.startsWith('$$') && part.endsWith('$$')) {
                    // Block math
                    const latex = part.slice(2, -2).trim();
                    const div = iframeDoc.createElement('div');
                    div.className = 'katex-display';
                    try {
                      katex.render(latex, div, { throwOnError: false, displayMode: true });
                    } catch {
                      div.textContent = part;
                    }
                    fragment.appendChild(div);
                  } else if (part.startsWith('$') && part.endsWith('$')) {
                    // Inline math
                    const latex = part.slice(1, -1).trim();
                    const span = iframeDoc.createElement('span');
                    try {
                      katex.render(latex, span, { throwOnError: false, displayMode: false });
                    } catch {
                      span.textContent = part;
                    }
                    fragment.appendChild(span);
                  } else if (part) {
                    fragment.appendChild(iframeDoc.createTextNode(part));
                  }
                });
                parent.replaceChild(fragment, node);
              }
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Skip code blocks and pre elements
            const el = node as Element;
            if (el.tagName !== 'CODE' && el.tagName !== 'PRE') {
              Array.from(node.childNodes).forEach(walkTextNodes);
            }
          }
        };
        walkTextNodes(contentDiv);
      }

      // Render mermaid diagrams
      if (win && win.mermaid) {
        win.mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
        });
        try {
          await win.mermaid.run({
            querySelector: '.language-mermaid, .mermaid',
          });
        } catch {
          // Ignore mermaid errors
        }
      }

      // Wait for images
      const images = Array.from(iframeDoc.querySelectorAll('img'));
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) resolve();
              else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(resolve, 1000);
              }
            })
        )
      );

      // Force layout recalculation to ensure all styles are applied before capture
      void iframeDoc.body.offsetHeight;

      // Calculate dimensions
      const rect = contentDiv.getBoundingClientRect();
      const width = Math.max(rect.width, 800);
      const height = rect.height;

      iframe.style.width = `${width}px`;
      iframe.style.height = `${height}px`;

      // Capture
      const canvas = await html2canvas(contentDiv, {
        backgroundColor: bgColor,
        scale: 2,
        useCORS: true,
        logging: false,
        width: width,
        height: height,
      });

      const base64 = canvas.toDataURL('image/png').split(',')[1];
      const fileName = getDefaultFileName(filePath);

      await electrobun.saveExportedFile({
        content: base64,
        isBase64: true,
        defaultName: fileName,
        extension: 'png',
      });
    } catch (error) {
      console.error('Image export failed:', error);
    } finally {
      // Always cleanup iframe
      if (iframe.parentNode) {
        document.body.removeChild(iframe);
      }
    }
  }, []);

  return { exportAsHTML, exportAsImage };
}
