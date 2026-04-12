/**
 * useExport hook tests — focused on TaskQueue integration and cancellation.
 */
import '../lib/image/electrobun-polyfill';
import { describe, it, expect, beforeEach, afterEach, beforeAll, mock } from 'bun:test';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { useExport } from '../../../../src/mainview/hooks/useExport';
import { taskQueue } from '../../../../src/mainview/lib/taskQueue';

let originalSetTimeout: typeof setTimeout;

function installFastTimers() {
  originalSetTimeout = globalThis.setTimeout;
  (globalThis as any).setTimeout = (fn: any, delay: number, ...args: any[]) => {
    if (delay === 10000) {
      // The image export code registers a 10000ms fallback timeout for script loading.
      // Execute it immediately so the test does not wait for the real timer.
      fn(...args);
      return 0;
    }
    return originalSetTimeout(fn, delay, ...args);
  };
}

function restoreTimers() {
  globalThis.setTimeout = originalSetTimeout;
}

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
            el.onload();
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
    contentWindow: { katex: null, mermaid: null } as any,
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
    default: async () => {
      // Yield one microtask so that replacement via taskQueue still races an
      // in-flight export, but we avoid leaving a pending timer that would
      // cause the test runner to hang.
      await Promise.resolve();
      return {
        toDataURL: () => 'data:image/png;base64,abc123',
      };
    },
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
  beforeEach(() => {
    setupDocumentStub();
    installFastTimers();
    taskQueue.abortAll();
  });

  afterEach(() => {
    restoreTimers();
  });

  it('generateHTML returns an HTML string via taskQueue', async () => {
    const { result } = renderHook(() => useExport());
    const res = await result.generateHTML('# Hello', '/test.md');

    expect(res).not.toBeNull();
    expect(res!.extension).toBe('html');
    expect(res!.content.includes('<p># Hello</p>')).toBe(true);
  });

  it('generateImage returns a base64 PNG result via taskQueue', async () => {
    const { result } = renderHook(() => useExport());

    const pending = result.generateImage('# Hello', '/test.md');
    const res = await pending;

    expect(res).not.toBeNull();
    expect(res!.extension).toBe('png');
    expect(res!.isBase64).toBe(true);
    expect(res!.content).toBe('abc123');
  });

  it('rapid double export of same type aborts first silently', async () => {
    const { result } = renderHook(() => useExport());

    const first = result.generateImage('# First', '/first.md');
    const second = result.generateImage('# Second', '/second.md');

    const firstRes = await first;
    const secondRes = await second;

    expect(firstRes).toBeNull();
    expect(secondRes).not.toBeNull();
    expect(secondRes!.extension).toBe('png');
  });

  it('export-html and export-png do not interfere with each other', async () => {
    const { result } = renderHook(() => useExport());

    const htmlPromise = result.generateHTML('# Hello', '/test.md');
    const imgPromise = result.generateImage('# Hello', '/test.md');

    const [htmlRes, imgRes] = await Promise.all([htmlPromise, imgPromise]);

    expect(htmlRes).not.toBeNull();
    expect(htmlRes!.extension).toBe('html');

    expect(imgRes).not.toBeNull();
    expect(imgRes!.extension).toBe('png');
  });
});
