/**
 * Image Cache Module
 *
 * Manages Blob URLs for local images to avoid repeated file reads.
 * Provides LRU eviction and memory management via URL.revokeObjectURL.
 */

export interface CacheEntry {
  blobUrl: string;
  originalPath: string;  // 用户的原始路径（可能是相对路径）
  resolvedPath: string;  // 解析后的绝对路径（用于缓存查找）
  lastAccessed: number;
}

export interface ImageCacheStats {
  size: number;
  maxSize: number;
  entries: Array<{ path: string; lastAccessed: number }>;
}

export class ImageCache {
  private cache: Map<string, CacheEntry>;
  private blobUrlToPath: Map<string, string>;
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.cache = new Map();
    this.blobUrlToPath = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get cached image Blob URL
   * @returns The blob URL or undefined if not cached
   */
  get(path: string): string | undefined {
    const entry = this.cache.get(path);
    if (entry) {
      entry.lastAccessed = Date.now();
      return entry.blobUrl;
    }
    return undefined;
  }

  /**
   * Store a Blob URL in the cache
   * @param resolvedPath - 解析后的绝对路径（用于缓存查找）
   * @param blobUrl - Blob URL
   * @param originalPath - 可选的原始路径（用户输入的路径）
   */
  set(resolvedPath: string, blobUrl: string, originalPath?: string): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Remove old reverse mapping if exists
    const oldEntry = this.cache.get(resolvedPath);
    if (oldEntry) {
      this.blobUrlToPath.delete(oldEntry.blobUrl);
      URL.revokeObjectURL(oldEntry.blobUrl);
    }

    const actualOriginalPath = originalPath || resolvedPath;

    this.cache.set(resolvedPath, {
      blobUrl,
      originalPath: actualOriginalPath,
      resolvedPath,
      lastAccessed: Date.now(),
    });

    this.blobUrlToPath.set(blobUrl, actualOriginalPath);
  }

  /**
   * Store a Blob URL with explicit original path
   * @param resolvedPath - 解析后的绝对路径（用于缓存查找）
   * @param blobUrl - Blob URL
   * @param originalPath - 用户的原始路径（可能是相对路径）
   * @returns The blob URL
   */
  setWithOriginalPath(resolvedPath: string, blobUrl: string, originalPath: string): string {
    this.set(resolvedPath, blobUrl, originalPath);
    return blobUrl;
  }

  /**
   * Convert base64 data URL to Blob URL and cache it
   * @returns The blob URL
   */
  setFromBase64(path: string, dataUrl: string): string {
    const cached = this.get(path);
    if (cached) {
      return cached;
    }

    const blobUrl = this.dataUrlToBlobUrl(dataUrl);
    this.set(path, blobUrl);
    return blobUrl;
  }

  /**
   * Convert base64 data URL to Blob URL and cache with original path
   * @param resolvedPath - 解析后的绝对路径（用于缓存查找）
   * @param dataUrl - Base64 data URL
   * @param originalPath - 用户的原始路径（可能是相对路径）
   * @returns The blob URL
   */
  setFromBase64WithOriginalPath(resolvedPath: string, dataUrl: string, originalPath: string): string {
    const cached = this.get(resolvedPath);
    if (cached) {
      // 缓存命中时，更新 blobUrlToPath 映射以使用最新的原始路径
      this.blobUrlToPath.set(cached, originalPath);
      // 同时更新缓存条目中的 originalPath
      const entry = this.cache.get(resolvedPath);
      if (entry) {
        entry.originalPath = originalPath;
      }
      return cached;
    }

    const blobUrl = this.dataUrlToBlobUrl(dataUrl);
    this.set(resolvedPath, blobUrl, originalPath);
    return blobUrl;
  }

  /**
   * Get original path from Blob URL
   * @returns The original file path or undefined
   */
  getOriginalPath(blobUrl: string): string | undefined {
    return this.blobUrlToPath.get(blobUrl);
  }

  /**
   * Check if path is in cache
   */
  has(path: string): boolean {
    return this.cache.has(path);
  }

  /**
   * Remove specific entry from cache and revoke Blob URL
   */
  delete(path: string): boolean {
    const entry = this.cache.get(path);
    if (entry) {
      URL.revokeObjectURL(entry.blobUrl);
      this.blobUrlToPath.delete(entry.blobUrl);
    }
    return this.cache.delete(path);
  }

  /**
   * Clear all cached entries and revoke all Blob URLs
   */
  clear(): void {
    for (const entry of this.cache.values()) {
      URL.revokeObjectURL(entry.blobUrl);
    }
    this.cache.clear();
    this.blobUrlToPath.clear();
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): ImageCacheStats {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      entries: Array.from(this.cache.entries()).map(([path, entry]) => ({
        path,
        lastAccessed: entry.lastAccessed,
      })),
    };
  }

  /**
   * Convert data URL to Blob URL for better performance
   */
  private dataUrlToBlobUrl(dataUrl: string): string {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      // Not a valid data URL, return as-is
      return dataUrl;
    }

    const mimeType = match[1];
    const base64Data = match[2];

    // Convert base64 to binary
    const byteCharacters = atob(base64Data);
    const byteArrays: BlobPart[] = [];

    // Process in chunks to avoid stack overflow with large images
    const chunkSize = 8192;
    for (let offset = 0; offset < byteCharacters.length; offset += chunkSize) {
      const chunk = byteCharacters.slice(offset, offset + chunkSize);
      const byteNumbers = new Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        byteNumbers[i] = chunk.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }

    const blob = new Blob(byteArrays, { type: mimeType });
    return URL.createObjectURL(blob);
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
      this.delete(oldestKey);
    }
  }
}

// Singleton instance for application-wide use
export const imageCache = new ImageCache(50);

// Factory function for creating custom cache instances
export function createImageCache(maxSize: number): ImageCache {
  return new ImageCache(maxSize);
}
