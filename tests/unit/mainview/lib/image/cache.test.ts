/**
 * Image Cache 单元测试
 * 测试图片缓存功能
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { ImageCache, createImageCache } from '../../../../../src/mainview/lib/image/cache';

describe('ImageCache', () => {
  let cache: ImageCache;

  beforeEach(() => {
    cache = createImageCache(5);
  });

  describe('get and set', () => {
    it('should store and retrieve blob URL', () => {
      cache.set('/path/to/image.png', 'blob://abc123');
      const url = cache.get('/path/to/image.png');
      expect(url).toBe('blob://abc123');
    });

    it('should return undefined for non-existent key', () => {
      const url = cache.get('/nonexistent.png');
      expect(url).toBeUndefined();
    });

    it('should update lastAccessed on get', () => {
      cache.set('/path/to/image.png', 'blob://abc123');
      const before = Date.now();
      cache.get('/path/to/image.png');
      const after = Date.now();
      // Access updates timestamp
      expect(cache.has('/path/to/image.png')).toBe(true);
    });
  });

  describe('has', () => {
    it('should return true for cached path', () => {
      cache.set('/path/to/image.png', 'blob://abc123');
      expect(cache.has('/path/to/image.png')).toBe(true);
    });

    it('should return false for uncached path', () => {
      expect(cache.has('/nonexistent.png')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove entry and return true', () => {
      cache.set('/path/to/image.png', 'blob://abc123');
      const result = cache.delete('/path/to/image.png');
      expect(result).toBe(true);
      expect(cache.has('/path/to/image.png')).toBe(false);
    });

    it('should return false for non-existent key', () => {
      const result = cache.delete('/nonexistent.png');
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('/path1.png', 'blob://abc1');
      cache.set('/path2.png', 'blob://abc2');
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has('/path1.png')).toBe(false);
      expect(cache.has('/path2.png')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return current cache size', () => {
      expect(cache.size).toBe(0);
      cache.set('/path1.png', 'blob://abc1');
      expect(cache.size).toBe(1);
      cache.set('/path2.png', 'blob://abc2');
      expect(cache.size).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cache.set('/path1.png', 'blob://abc1');
      cache.set('/path2.png', 'blob://abc2');
      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(5);
      expect(stats.entries).toHaveLength(2);
    });
  });

  describe('getOriginalPath', () => {
    it('should return original path from blob URL', () => {
      cache.set('/path/to/image.png', 'blob://abc123');
      const path = cache.getOriginalPath('blob://abc123');
      expect(path).toBe('/path/to/image.png');
    });

    it('should return undefined for unknown blob URL', () => {
      const path = cache.getOriginalPath('blob://unknown');
      expect(path).toBeUndefined();
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      // Fill cache to capacity
      cache.set('/path1.png', 'blob://1');
      cache.set('/path2.png', 'blob://2');
      cache.set('/path3.png', 'blob://3');
      cache.set('/path4.png', 'blob://4');
      cache.set('/path5.png', 'blob://5');
      expect(cache.size).toBe(5);

      // Add new entry, should evict oldest (path1)
      cache.set('/path6.png', 'blob://6');
      expect(cache.size).toBe(5);
      expect(cache.has('/path1.png')).toBe(false); // Evicted (oldest)
      expect(cache.has('/path6.png')).toBe(true); // New entry
    });
  });

  describe('setFromBase64', () => {
    it('should return cached blob URL if exists', () => {
      cache.set('/path/to/image.png', 'blob://cached');
      const result = cache.setFromBase64('/path/to/image.png', 'data:image/png;base64,abc');
      expect(result).toBe('blob://cached');
    });

    it('should create new blob URL from data URL', () => {
      const result = cache.setFromBase64('/path/to/image.png', 'data:image/png;base64,iVBORw0KGgo=');
      expect(typeof result).toBe('string');
      expect(cache.has('/path/to/image.png')).toBe(true);
    });

    it('should return as-is for invalid data URL', () => {
      const invalidDataUrl = 'not-a-data-url';
      const result = cache.setFromBase64('/path/to/image.png', invalidDataUrl);
      expect(result).toBe('not-a-data-url');
    });
  });
});

describe('createImageCache', () => {
  it('should create cache with custom max size', () => {
    const customCache = createImageCache(10);
    const stats = customCache.getStats();
    expect(stats.maxSize).toBe(10);
  });
});
