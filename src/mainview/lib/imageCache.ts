/**
 * LRU Cache for processed images to avoid repeated file reads
 */

interface CacheEntry {
  dataUrl: string;
  lastAccessed: number;
}

class LRUImageCache {
  private cache: Map<string, CacheEntry>;
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get cached image data URL
   */
  get(path: string): string | undefined {
    const entry = this.cache.get(path);
    if (entry) {
      // Update last accessed time
      entry.lastAccessed = Date.now();
      return entry.dataUrl;
    }
    return undefined;
  }

  /**
   * Store image data URL in cache
   */
  set(path: string, dataUrl: string): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(path, {
      dataUrl,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Check if path is in cache
   */
  has(path: string): boolean {
    return this.cache.has(path);
  }

  /**
   * Remove specific entry from cache
   */
  delete(path: string): boolean {
    return this.cache.delete(path);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Evict least recently used entry
   */
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

// Singleton instance
const imageCache = new LRUImageCache(50);

export { imageCache, LRUImageCache };
