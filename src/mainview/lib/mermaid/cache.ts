/**
 * Mermaid Render Cache Module
 *
 * Caches Mermaid SVG renders by content hash to avoid re-rendering
 * unchanged diagrams across editor preview, viewer, and export flows.
 */

export interface MermaidCacheEntry {
  svg: string;
  lastAccessed: number;
}

export interface MermaidCacheStats {
  size: number;
  maxSize: number;
}

export interface MermaidRenderConfig {
  startOnLoad: boolean;
  theme: string;
  suppressErrorRendering?: boolean;
  htmlLabels?: boolean;
  [key: string]: unknown;
}

/**
 * Simple djb2 string hash for synchronous cache keys.
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function buildCacheKey(source: string, theme: string, config: MermaidRenderConfig): string {
  // Sort config keys for stable serialization
  const sortedConfig = Object.keys(config)
    .sort()
    .reduce((acc, key) => {
      acc[key] = config[key];
      return acc;
    }, {} as Record<string, unknown>);

  return hashString(`${source}::${theme}::${JSON.stringify(sortedConfig)}`);
}

export class MermaidCache {
  private cache: Map<string, MermaidCacheEntry>;
  private maxSize: number;
  private accessCounter: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.accessCounter = 0;
  }

  /**
   * Get cached SVG for the given source, theme, and config.
   */
  get(source: string, theme: string, config: MermaidRenderConfig): string | undefined {
    const key = buildCacheKey(source, theme, config);
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccessed = ++this.accessCounter;
      return entry.svg;
    }
    return undefined;
  }

  /**
   * Store a rendered SVG in the cache.
   */
  set(source: string, theme: string, config: MermaidRenderConfig, svg: string): void {
    const key = buildCacheKey(source, theme, config);

    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      svg,
      lastAccessed: ++this.accessCounter,
    });
  }

  /**
   * Check if a source/theme/config combination is cached.
   */
  has(source: string, theme: string, config: MermaidRenderConfig): boolean {
    const key = buildCacheKey(source, theme, config);
    return this.cache.has(key);
  }

  /**
   * Remove a specific entry from the cache.
   */
  delete(source: string, theme: string, config: MermaidRenderConfig): boolean {
    const key = buildCacheKey(source, theme, config);
    return this.cache.delete(key);
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics.
   */
  getStats(): MermaidCacheStats {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
}

/**
 * Singleton instance for application-wide use.
 */
export const mermaidCache = new MermaidCache(100);

/**
 * Factory function for creating custom cache instances (e.g. for tests).
 */
export function createMermaidCache(maxSize: number): MermaidCache {
  return new MermaidCache(maxSize);
}
