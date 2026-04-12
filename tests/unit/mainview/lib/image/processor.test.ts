/**
 * Image Processor 单元测试
 */
import './electrobun-polyfill';
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import {
  loadLocalImage,
  processMarkdownImages,
  preloadImages,
  clearCache,
} from '../../../../../src/mainview/lib/image/processor';
import { imageCache } from '../../../../../src/mainview/lib/image/cache';
import { workspaceManager } from '../../../../../src/mainview/lib/image/workspace';
import { electrobun } from '../../../../../src/mainview/lib/electrobun';

let originalReadImageAsBase64: typeof electrobun.readImageAsBase64;

beforeEach(() => {
  clearCache();
  originalReadImageAsBase64 = electrobun.readImageAsBase64;
  (electrobun as any).readImageAsBase64 = async () => ({
    success: true,
    dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  });
});

afterEach(() => {
  (electrobun as any).readImageAsBase64 = originalReadImageAsBase64;
});

describe('loadLocalImage', () => {
  it('should return cached blob URL without calling RPC', async () => {
    imageCache.set('/test/image.png', 'blob://cached');
    let rpcCalled = false;
    (electrobun as any).readImageAsBase64 = async () => {
      rpcCalled = true;
      return { success: true, dataUrl: 'data:image/png;base64,abc' };
    };

    const result = await loadLocalImage('/test/image.png');
    expect(result).toBe('blob://cached');
    expect(rpcCalled).toBe(false);
  });

  it('should return null with already-aborted signal without calling RPC', async () => {
    let rpcCalled = false;
    (electrobun as any).readImageAsBase64 = async () => {
      rpcCalled = true;
      return { success: true, dataUrl: 'data:image/png;base64,abc' };
    };

    const controller = new AbortController();
    controller.abort();

    const result = await loadLocalImage('/test/image.png', undefined, controller.signal);
    expect(result).toBeNull();
    expect(rpcCalled).toBe(false);
  });

  it('should not write to cache if signal aborts after RPC but before writing', async () => {
    const controller = new AbortController();
    (electrobun as any).readImageAsBase64 = async () => {
      controller.abort();
      return { success: true, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
    };

    const result = await loadLocalImage('/test/image.png', undefined, controller.signal);
    expect(result).toBeNull();
    expect(imageCache.has('/test/image.png')).toBe(false);
  });

  it('should return blob URL and cache on successful RPC', async () => {
    const result = await loadLocalImage('/test/image.png');
    expect(typeof result).toBe('string');
    expect(imageCache.has('/test/image.png')).toBe(true);
  });

  it('should return null and log error on RPC failure', async () => {
    (electrobun as any).readImageAsBase64 = async () => {
      return { success: false, error: 'not found' };
    };

    const result = await loadLocalImage('/test/image.png');
    expect(result).toBeNull();
    expect(imageCache.has('/test/image.png')).toBe(false);
  });
});

describe('processMarkdownImages', () => {
  beforeEach(() => {
    workspaceManager.setCurrentFile('/workspace/doc.md');
    workspaceManager.setWorkspaceRoot('/workspace');
  });

  afterEach(() => {
    workspaceManager.clear();
  });

  it('should return processed markdown with blob URLs', async () => {
    const markdown = 'Hello ![alt](./image.png) world';
    const result = await processMarkdownImages(markdown);
    expect(result.includes('blob:')).toBe(true);
    expect(result.includes('alt')).toBe(true);
  });

  it('should return original markdown when signal aborts before replacements', async () => {
    const controller = new AbortController();
    const markdown = 'Hello ![alt](./image.png) world';

    // Pre-populate cache so loadLocalImage returns immediately
    imageCache.set('/workspace/image.png', 'blob://cached');

    controller.abort();
    const result = await processMarkdownImages(markdown, controller.signal);
    expect(result).toBe(markdown);
  });

  it('should short-circuit pending RPCs and not write to cache when aborted mid-flight', async () => {
    const controller = new AbortController();
    const markdown = '![a](./img1.png) ![b](./img2.png)';

    (electrobun as any).readImageAsBase64 = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { success: true, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
    };

    const promise = processMarkdownImages(markdown, controller.signal);
    // Abort after a short delay
    setTimeout(() => controller.abort(), 10);

    await promise;
    // Since abort happened mid-flight, none should be cached after abort.
    expect(imageCache.size).toBe(0);
  });
});

describe('preloadImages', () => {
  beforeEach(() => {
    workspaceManager.setCurrentFile('/workspace/doc.md');
    workspaceManager.setWorkspaceRoot('/workspace');
  });

  afterEach(() => {
    workspaceManager.clear();
  });

  it('should not throw when aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    expect(async () => {
      await preloadImages('![alt](./image.png)', controller.signal);
    }).not.toThrow();
  });

  it('should swallow errors per existing catch behavior', async () => {
    (electrobun as any).readImageAsBase64 = async () => {
      throw new Error('rpc error');
    };

    // preloadImages fires and forgets; awaiting just to let microtasks settle
    await preloadImages('![alt](./image.png)');
    // Give time for the internal catch to run
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});
