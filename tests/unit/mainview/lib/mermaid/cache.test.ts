/**
 * Mermaid Cache 单元测试
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { MermaidCache, createMermaidCache, type MermaidRenderConfig } from '../../../../../src/mainview/lib/mermaid/cache';

describe('MermaidCache', () => {
  let cache: MermaidCache;

  beforeEach(() => {
    cache = createMermaidCache(5);
  });

  describe('get and set', () => {
    it('should store and retrieve svg', () => {
      const config: MermaidRenderConfig = { startOnLoad: false, theme: 'default' };
      cache.set('graph TD; A-->B;', 'default', config, '<svg></svg>');
      const svg = cache.get('graph TD; A-->B;', 'default', config);
      expect(svg).toBe('<svg></svg>');
    });

    it('should return undefined for non-existent key', () => {
      const config: MermaidRenderConfig = { startOnLoad: false, theme: 'default' };
      const svg = cache.get('unknown', 'default', config);
      expect(svg).toBeUndefined();
    });

    it('should update lastAccessed on get', () => {
      const config: MermaidRenderConfig = { startOnLoad: false, theme: 'default' };
      cache.set('graph TD; A-->B;', 'default', config, '<svg></svg>');
      expect(cache.has('graph TD; A-->B;', 'default', config)).toBe(true);
    });
  });

  describe('has', () => {
    it('should return true for cached entry', () => {
      const config: MermaidRenderConfig = { startOnLoad: false, theme: 'default' };
      cache.set('graph TD; A-->B;', 'default', config, '<svg></svg>');
      expect(cache.has('graph TD; A-->B;', 'default', config)).toBe(true);
    });

    it('should return false for uncached entry', () => {
      const config: MermaidRenderConfig = { startOnLoad: false, theme: 'default' };
      expect(cache.has('unknown', 'default', config)).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove entry and return true', () => {
      const config: MermaidRenderConfig = { startOnLoad: false, theme: 'default' };
      cache.set('graph TD; A-->B;', 'default', config, '<svg></svg>');
      const result = cache.delete('graph TD; A-->B;', 'default', config);
      expect(result).toBe(true);
      expect(cache.has('graph TD; A-->B;', 'default', config)).toBe(false);
    });

    it('should return false for non-existent key', () => {
      const config: MermaidRenderConfig = { startOnLoad: false, theme: 'default' };
      const result = cache.delete('unknown', 'default', config);
      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      const config: MermaidRenderConfig = { startOnLoad: false, theme: 'default' };
      cache.set('graph1', 'default', config, '<svg>1</svg>');
      cache.set('graph2', 'default', config, '<svg>2</svg>');
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has('graph1', 'default', config)).toBe(false);
      expect(cache.has('graph2', 'default', config)).toBe(false);
    });
  });

  describe('size', () => {
    it('should return current cache size', () => {
      const config: MermaidRenderConfig = { startOnLoad: false, theme: 'default' };
      expect(cache.size).toBe(0);
      cache.set('graph1', 'default', config, '<svg>1</svg>');
      expect(cache.size).toBe(1);
      cache.set('graph2', 'default', config, '<svg>2</svg>');
      expect(cache.size).toBe(2);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      const config: MermaidRenderConfig = { startOnLoad: false, theme: 'default' };
      cache.set('graph1', 'default', config, '<svg>1</svg>');
      cache.set('graph2', 'default', config, '<svg>2</svg>');
      cache.set('graph3', 'default', config, '<svg>3</svg>');
      cache.set('graph4', 'default', config, '<svg>4</svg>');
      cache.set('graph5', 'default', config, '<svg>5</svg>');
      expect(cache.size).toBe(5);

      cache.set('graph6', 'default', config, '<svg>6</svg>');
      expect(cache.size).toBe(5);
      expect(cache.has('graph1', 'default', config)).toBe(false);
      expect(cache.has('graph6', 'default', config)).toBe(true);
    });

    it('should not evict recently accessed entries', () => {
      const config: MermaidRenderConfig = { startOnLoad: false, theme: 'default' };
      cache.set('graph1', 'default', config, '<svg>1</svg>');
      cache.set('graph2', 'default', config, '<svg>2</svg>');
      cache.set('graph3', 'default', config, '<svg>3</svg>');
      cache.set('graph4', 'default', config, '<svg>4</svg>');
      cache.set('graph5', 'default', config, '<svg>5</svg>');

      // Access graph1 to bump its LRU position
      cache.get('graph1', 'default', config);

      cache.set('graph6', 'default', config, '<svg>6</svg>');
      expect(cache.has('graph1', 'default', config)).toBe(true);
      expect(cache.has('graph2', 'default', config)).toBe(false);
    });
  });

  describe('config-sensitive keys', () => {
    it('should treat different htmlLabels values as different keys', () => {
      const source = 'graph TD; A-->B;';
      const theme = 'default';
      const configTrue: MermaidRenderConfig = { startOnLoad: false, theme, htmlLabels: true };
      const configFalse: MermaidRenderConfig = { startOnLoad: false, theme, htmlLabels: false };

      cache.set(source, theme, configTrue, '<svg>true</svg>');
      cache.set(source, theme, configFalse, '<svg>false</svg>');

      expect(cache.get(source, theme, configTrue)).toBe('<svg>true</svg>');
      expect(cache.get(source, theme, configFalse)).toBe('<svg>false</svg>');
    });

    it('should treat different themes as different keys', () => {
      const source = 'graph TD; A-->B;';
      const config: MermaidRenderConfig = { startOnLoad: false, theme: 'default' };

      cache.set(source, 'default', config, '<svg>default</svg>');
      cache.set(source, 'dark', config, '<svg>dark</svg>');

      expect(cache.get(source, 'default', config)).toBe('<svg>default</svg>');
      expect(cache.get(source, 'dark', config)).toBe('<svg>dark</svg>');
    });
  });
});

describe('createMermaidCache', () => {
  it('should create cache with custom max size', () => {
    const customCache = createMermaidCache(10);
    const stats = customCache.getStats();
    expect(stats.maxSize).toBe(10);
  });
});
