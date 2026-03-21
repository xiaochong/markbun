/**
 * Image Processor
 *
 * Central module for all image processing operations:
 * - Loading local images as blob URLs
 * - Processing markdown content for display
 * - Restoring original paths for save/copy
 * - Handling clipboard operations
 */

import { imageCache } from './cache';
import { workspaceManager } from './workspace';
import {
  isLocalFilePath,
  isBlobUrl,
  resolveImagePath,
  getFileName,
} from './pathResolver';
import { electrobun } from '../electrobun';

// Regex to match markdown image syntax: ![alt](path)
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

// Regex to match blob URLs
const BLOB_URL_REGEX = /blob:https?:\/\/[^/]+\/([a-f0-9-]+)/i;

export interface ProcessResult {
  success: boolean;
  error?: string;
}

export interface ImageInfo {
  fullMatch: string;
  alt: string;
  path: string;
}

/**
 * Parse markdown and extract all local image references
 */
export function parseImageReferences(markdown: string): ImageInfo[] {
  const images: ImageInfo[] = [];
  let match;

  while ((match = IMAGE_REGEX.exec(markdown)) !== null) {
    const [fullMatch, alt, encodedPath] = match;
    const path = decodeURIComponent(encodedPath);

    if (isLocalFilePath(path)) {
      images.push({ fullMatch, alt, path });
    }
  }

  return images;
}

/**
 * Check if markdown contains local images that need processing
 */
export function hasLocalImages(markdown: string): boolean {
  return parseImageReferences(markdown).length > 0;
}

/**
 * Load a local image and return its blob URL
 *
 * @param imagePath - Absolute path to the image
 * @param originalPath - 可选的原始路径（用户输入的路径，用于恢复）
 * @returns Blob URL or null if failed
 */
export async function loadLocalImage(imagePath: string, originalPath?: string): Promise<string | null> {
  // Check cache first
  const cached = imageCache.get(imagePath);
  if (cached) {
    return cached;
  }

  try {
    const response = await electrobun.readImageAsBase64(imagePath) as {
      success: boolean;
      dataUrl?: string;
      error?: string;
    };

    if (response.success && response.dataUrl) {
      if (originalPath) {
        const blobUrl = imageCache.setFromBase64WithOriginalPath(imagePath, response.dataUrl, originalPath);
        return blobUrl;
      } else {
        const blobUrl = imageCache.setFromBase64(imagePath, response.dataUrl);
        return blobUrl;
      }
    }

    console.error(`Failed to load image ${imagePath}:`, response.error);
    return null;
  } catch (error) {
    console.error(`Failed to load image ${imagePath}:`, error);
    return null;
  }
}

/**
 * Process markdown content for display
 * Converts local image paths to blob URLs
 *
 * @param markdown - The markdown content
 * @returns Processed markdown with blob URLs
 */
export async function processMarkdownImages(markdown: string): Promise<string> {
  const images = parseImageReferences(markdown);

  if (images.length === 0) {
    return markdown;
  }

  // Resolve all paths first
  const resolvedImages = images.map(img => ({
    ...img,
    resolvedPath: workspaceManager.resolvePath(img.path),
  }));

  // Load all images in parallel
  const loadResults = await Promise.all(
    resolvedImages.map(async (img) => {
      // 使用绝对路径加载图片，但传递原始路径用于缓存
      const blobUrl = await loadLocalImage(img.resolvedPath, img.path);
      return {
        originalMatch: img.fullMatch,
        alt: img.alt,
        blobUrl,
      };
    })
  );

  // Apply replacements in reverse order to maintain indices
  let result = markdown;
  for (let i = loadResults.length - 1; i >= 0; i--) {
    const { originalMatch, alt, blobUrl } = loadResults[i];
    if (blobUrl) {
      const replacement = `![${alt}](${blobUrl})`;
      result = result.replace(originalMatch, replacement);
    }
  }

  return result;
}

/**
 * Restore original paths from blob URLs
 * Used when saving or copying markdown content
 *
 * @param markdown - The markdown content (may contain blob URLs)
 * @returns Markdown with original file paths
 */
export function restoreOriginalImagePaths(markdown: string): string {
  return markdown.replace(IMAGE_REGEX, (match, alt, url) => {
    // Try the URL as-is first
    if (isBlobUrl(url)) {
      const originalPath = imageCache.getOriginalPath(url);
      if (originalPath) {
        return `![${alt}](${originalPath})`;
      }
    }
    // Try decoding the URL (Milkdown may encode URLs in markdown output)
    try {
      const decodedUrl = decodeURIComponent(url);
      if (isBlobUrl(decodedUrl)) {
        const originalPath = imageCache.getOriginalPath(decodedUrl);
        if (originalPath) {
          return `![${alt}](${originalPath})`;
        }
      }
    } catch {
      // decodeURIComponent may throw for invalid URLs, ignore
    }
    return match;
  });
}

/**
 * Convert blob URLs to relative paths (for portable markdown)
 *
 * @param markdown - The markdown content
 * @param basePath - The base path to make relative to
 * @returns Markdown with relative paths
 */
export async function convertToRelativePaths(markdown: string, basePath: string): Promise<string> {
  const { toRelativePath } = await import('./pathResolver');

  return markdown.replace(IMAGE_REGEX, (match, alt, url) => {
    if (isBlobUrl(url)) {
      const originalPath = imageCache.getOriginalPath(url);
      if (originalPath) {
        const relativePath = toRelativePath(originalPath, basePath);
        return `![${alt}](${relativePath})`;
      }
    }
    return match;
  });
}

/**
 * Insert an image at the specified path
 * Handles loading and caching automatically
 *
 * @param imagePath - Local file path or URL
 * @param altText - Alt text for the image
 * @returns Markdown image syntax or null if failed
 */
export async function createImageMarkdown(
  imagePath: string,
  altText: string = ''
): Promise<string | null> {
  // If it's a URL, use directly
  if (!isLocalFilePath(imagePath)) {
    return `![${altText || 'image'}](${imagePath})`;
  }

  // For local files, resolve and load
  const resolvedPath = workspaceManager.resolvePath(imagePath);
  const blobUrl = await loadLocalImage(resolvedPath);

  if (!blobUrl) {
    return null;
  }

  return `![${altText || getFileName(imagePath)}](${blobUrl})`;
}

/**
 * Preload images for better perceived performance
 *
 * @param markdown - Markdown content to preload images from
 */
export async function preloadImages(markdown: string): Promise<void> {
  const images = parseImageReferences(markdown);

  // Load all images in parallel (don't wait for results)
  Promise.all(
    images.map(async (img) => {
      const resolvedPath = workspaceManager.resolvePath(img.path);
      await loadLocalImage(resolvedPath);
    })
  ).catch(console.error);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return imageCache.getStats();
}

/**
 * Clear image cache
 */
export function clearCache(): void {
  imageCache.clear();
}
