import { electrobun } from './electrobun';
import { imageCache } from './imageCache';

// Regex to match markdown image syntax: ![alt](path)
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

// Check if a path is a local file path (not URL)
function isLocalFilePath(path: string): boolean {
  // Skip if it's already a data URL, blob URL, or http/https URL
  if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http://') || path.startsWith('https://')) {
    return false;
  }
  // Check if it's an absolute path (starts with / on Unix or drive letter on Windows)
  return path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path);
}

// Resolve relative path against base path
function resolvePath(relativePath: string, basePath: string): string {
  if (relativePath.startsWith('/')) {
    return relativePath; // Already absolute
  }

  const baseDir = basePath.substring(0, basePath.lastIndexOf('/'));
  const parts = (baseDir + '/' + relativePath).split('/');
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      resolved.pop();
    } else if (part !== '.' && part !== '') {
      resolved.push(part);
    }
  }

  return '/' + resolved.join('/');
}

// Process markdown content and convert local images to Blob URLs
// Uses Blob URLs instead of base64 data URLs for better performance with large images
export async function processMarkdownImages(
  markdown: string,
  currentFilePath: string | null
): Promise<string> {
  const matches: { fullMatch: string; alt: string; path: string; index: number }[] = [];

  // Find all image references
  let match;
  while ((match = IMAGE_REGEX.exec(markdown)) !== null) {
    const [fullMatch, alt, encodedPath] = match;
    // URL decode the path (handle spaces encoded as %20)
    const path = decodeURIComponent(encodedPath);
    if (isLocalFilePath(path)) {
      matches.push({ fullMatch, alt, path, index: match.index });
    }
  }

  if (matches.length === 0) {
    return markdown;
  }

  // Process all images in parallel for better performance
  const processedImages = await Promise.all(
    matches.map(async ({ fullMatch, alt, path }) => {
      // Resolve relative path
      const absolutePath = currentFilePath ? resolvePath(path, currentFilePath) : path;

      // Check cache first
      const cached = imageCache.get(absolutePath);
      if (cached) {
        const replacement = `![${alt}](${cached})`;
        return { fullMatch, replacement };
      }

      try {
        const response = await electrobun.readImageAsBase64(absolutePath) as {
          success: boolean;
          dataUrl?: string;
          error?: string;
        };

        if (response.success && response.dataUrl) {
          // Convert base64 to Blob URL for better performance
          const blobUrl = imageCache.setFromBase64(absolutePath, response.dataUrl);

          const replacement = `![${alt}](${blobUrl})`;
          return { fullMatch, replacement };
        }
      } catch (error) {
        console.error(`Failed to process image ${path}:`, error);
      }
      return null;
    })
  );

  // Apply replacements in reverse order to maintain indices
  let result = markdown;
  for (let i = processedImages.length - 1; i >= 0; i--) {
    const processed = processedImages[i];
    if (processed) {
      result = result.replace(processed.fullMatch, processed.replacement);
    }
  }

  return result;
}
