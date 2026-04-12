import '../lib/image/electrobun-polyfill';
import { describe, it, expect, beforeAll, mock } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useExport } from '../../../../src/mainview/hooks/useExport';

function setupDocumentStub() {
  const iframeDoc: any = {
    open: () => {},
    close: () => {},
    write: () => {},
    head: { appendChild: () => {} },
    body: {
      appendChild: () => {},
      removeChild: () => {},
      offsetHeight: 100,
    },
    fonts: { ready: Promise.resolve() },
    createElement: () => {
      const el: any = {
        style: {} as Record<string, string>,
        setAttribute: () => {},
        appendChild: () => {},
        textContent: '',
        innerHTML: '',
        className: '',
        onload: null as any,
        onerror: null as any,
        complete: true,
        getBoundingClientRect: () => ({ width: 800, height: 600 }),
      };
      Object.defineProperty(el, 'src', {
        set() {
          if (typeof el.onload === 'function') {
            setTimeout(() => el.onload(), 0);
          }
        },
      });
      Object.defineProperty(el, 'href', {
        set() {
          if (typeof el.onload === 'function') {
            setTimeout(() => el.onload(), 0);
          }
        },
      });
      return el;
    },
    createDocumentFragment: () => ({ appendChild: () => {} }),
    createTextNode: (text: string) => ({ textContent: text }),
    querySelectorAll: () => [],
  };

  const iframe = {
    style: {} as Record<string, string>,
    contentDocument: iframeDoc,
    contentWindow: {
      katex: null,
      mermaid: null,
      requestAnimationFrame: (cb: any) => cb(),
    } as any,
    parentNode: { removeChild: () => {} } as any,
  };

  (globalThis as any).document = {
    documentElement: {
      classList: {
        contains: () => false,
      },
    },
    createElement: () => iframe,
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
  };
}

beforeAll(() => {
  (mock as any).module('marked', () => ({
    marked: {
      parse: async (content: string) => `<p>${content}</p>`,
    },
  }));

  (mock as any).module('html2canvas', () => ({
    __esModule: true,
    default: async () => ({
      toDataURL: () => 'data:image/png;base64,abc123',
    }),
  }));
});

function renderHook<T>(useHook: () => T): { result: T } {
  let result!: T;
  function TestComponent() {
    result = useHook();
    return null;
  }
  renderToString(React.createElement(TestComponent));
  return { result };
}

describe('useExport', () => {
  it('generateHTML returns an HTML string', async () => {
    setupDocumentStub();
    const { result } = renderHook(() => useExport());
    const res = await result.generateHTML('# Hello', '/test.md');

    expect(res).not.toBeNull();
    expect(res!.extension).toBe('html');
    expect(res!.content.includes('<p># Hello</p>')).toBe(true);
  });

  it('generateImage returns a base64 PNG result', async () => {
    setupDocumentStub();
    const { result } = renderHook(() => useExport());
    const res = await result.generateImage('# Hello', '/test.md');

    expect(res).not.toBeNull();
    expect(res!.extension).toBe('png');
    expect(res!.isBase64).toBe(true);
    expect(res!.content).toBe('abc123');
  });
});