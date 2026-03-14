/**
 * LRU Cache for processed images to avoid repeated file reads
 * Uses Blob URLs for better performance with large images
 */

interface CacheEntry {
  blobUrl: string;
  originalPath: string;
  lastAccessed: number;
}

class LRUImageCache {
  private cache: Map<string, CacheEntry>; // path -> entry
  private blobUrlToPath: Map<string, string>; // blobUrl -> path (reverse lookup)
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.cache = new Map();
    this.blobUrlToPath = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get cached image Blob URL
   */
  get(path: string): string | undefined {
    const entry = this.cache.get(path);
    if (entry) {
      // Update last accessed time
      entry.lastAccessed = Date.now();
      return entry.blobUrl;
    }
    return undefined;
  }

  /**
   * Store image Blob URL in cache
   */
  set(path: string, blobUrl: string): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    // Remove old reverse mapping if exists
    const oldEntry = this.cache.get(path);
    if (oldEntry) {
      this.blobUrlToPath.delete(oldEntry.blobUrl);
    }

    this.cache.set(path, {
      blobUrl,
      originalPath: path,
      lastAccessed: Date.now(),
    });

    // Add reverse mapping
    this.blobUrlToPath.set(blobUrl, path);
  }

  /**
   * Convert base64 data URL to Blob URL and cache it
   */
  setFromBase64(path: string, dataUrl: string): string {
    // Check if already cached
    const cached = this.get(path);
    if (cached) {
      return cached;
    }

    // Convert base64 to Blob URL
    const blobUrl = this.dataUrlToBlobUrl(dataUrl);

    // Store in cache
    this.set(path, blobUrl);

    return blobUrl;
  }

  /**
   * Convert data URL to Blob URL for better performance
   */
  private dataUrlToBlobUrl(dataUrl: string): string {
    // Parse data URL: data:[mimeType];base64,[data]
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

    // Create blob and URL
    const blob = new Blob(byteArrays, { type: mimeType });
    return URL.createObjectURL(blob);
  }

  /**
   * Get original path from Blob URL
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
      // Revoke Blob URL to free memory
      URL.revokeObjectURL(entry.blobUrl);
      // Remove reverse mapping
      this.blobUrlToPath.delete(entry.blobUrl);
    }
    return this.cache.delete(path);
  }

  /**
   * Clear all cached entries and revoke all Blob URLs
   */
  clear(): void {
    // Revoke all Blob URLs to free memory
    for (const entry of this.cache.values()) {
      URL.revokeObjectURL(entry.blobUrl);
    }
    this.cache.clear();
    this.blobUrlToPath.clear();
  }

  /**
   * Get current cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Evict least recently used entry and revoke its Blob URL
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
      const entry = this.cache.get(oldestKey);
      if (entry) {
        URL.revokeObjectURL(entry.blobUrl);
        this.blobUrlToPath.delete(entry.blobUrl);
      }
      this.cache.delete(oldestKey);
    }
  }
}

// Singleton instance
const imageCache = new LRUImageCache(50);

export { imageCache, LRUImageCache };
