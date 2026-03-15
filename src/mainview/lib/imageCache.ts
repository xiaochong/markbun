/**
 * @deprecated Use '@/lib/image' instead
 * This file is kept for backward compatibility and re-exports from the new module.
 */

import { ImageCache, createImageCache, imageCache } from './image/cache';

// Re-export with old name for backward compatibility
export { imageCache, ImageCache as LRUImageCache, createImageCache };
