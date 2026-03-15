/**
 * Image Module
 *
 * Centralized image handling for MarkBun editor.
 * Provides a clean API for image loading, caching, and path resolution.
 *
 * Usage:
 *   import { processMarkdownImages, workspaceManager } from '@/lib/image';
 *
 *   // Set up workspace
 *   workspaceManager.setWorkspaceRoot('/Users/xiaochong/Desktop');
 *   workspaceManager.setCurrentFile('/Users/xiaochong/Documents/file.md');
 *
 *   // Process markdown for display
 *   const processed = await processMarkdownImages(markdown);
 *
 *   // Save - convert blob URLs back to paths
 *   const original = restoreOriginalImagePaths(processed);
 */

// Cache
export { imageCache, createImageCache, type ImageCacheStats } from './cache';

// Path Resolution
export {
  isRemoteUrl,
  isDataUrl,
  isBlobUrl,
  isAbsolutePath,
  isLocalFilePath,
  normalizeSeparators,
  resolveRelativePath,
  resolveImagePath,
  getDirectoryPath,
  getFileName,
  toRelativePath,
  type ResolveOptions,
} from './pathResolver';

// Workspace
export {
  workspaceManager,
  type Workspace,
} from './workspace';

// Processor
export {
  parseImageReferences,
  hasLocalImages,
  loadLocalImage,
  processMarkdownImages,
  restoreOriginalImagePaths,
  convertToRelativePaths,
  createImageMarkdown,
  preloadImages,
  getCacheStats,
  clearCache,
  type ImageInfo,
  type ProcessResult,
} from './processor';

// Clipboard
export {
  containsBlobUrls,
  prepareForClipboard,
  processFromClipboard,
  extractImagePaths,
} from './clipboard';
