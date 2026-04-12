/**
 * Image Clipboard Utilities
 *
 * Handles clipboard operations for markdown content with images:
 * - Prepares content for copying (converts blob URLs to original paths)
 * - Processes pasted content (converts local paths to blob URLs)
 */

import { restoreOriginalImagePaths, processMarkdownImages } from './processor';
import { isBlobUrl } from './pathResolver';

/**
 * Check if markdown content contains blob URLs
 */
export function containsBlobUrls(markdown: string): boolean {
  return isBlobUrl(markdown) || markdown.includes('blob:http');
}

/**
 * Prepare markdown for clipboard (copy/cut)
 * Converts blob URLs back to original file paths
 *
 * @param markdown - The markdown content
 * @returns Content ready for clipboard
 */
export function prepareForClipboard(markdown: string): string {
  if (!containsBlobUrls(markdown)) {
    return markdown;
  }
  return restoreOriginalImagePaths(markdown);
}

/**
 * Process markdown from clipboard (paste)
 * Converts local image paths to blob URLs for display
 *
 * @param markdown - The pasted markdown content
 * @returns Processed content ready for insertion
 */
export async function processFromClipboard(markdown: string): Promise<string> {
  // NOTE: Intentionally not wrapped with the TaskQueue — clipboard paste is a
  // short, user-initiated operation and does not race with file switches.
  return await processMarkdownImages(markdown);
}

/**
 * Extract image paths from markdown
 * Returns both local and remote image URLs
 *
 * @param markdown - The markdown content
 * @returns Array of image paths
 */
export function extractImagePaths(markdown: string): string[] {
  const regex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const paths: string[] = [];
  let match;

  while ((match = regex.exec(markdown)) !== null) {
    paths.push(match[2]);
  }

  return paths;
}
