/**
 * Path Resolver Service
 *
 * Handles all path-related operations for images:
 * - Resolves relative paths against workspace/current file
 * - Normalizes paths for cross-platform compatibility
 * - Determines if a path is local, absolute, or remote
 */

/**
 * Check if a path is a remote URL (http/https)
 */
export function isRemoteUrl(path: string): boolean {
  return path.startsWith('http://') || path.startsWith('https://');
}

/**
 * Check if a path is a data URL
 */
export function isDataUrl(path: string): boolean {
  return path.startsWith('data:');
}

/**
 * Check if a path is a blob URL
 */
export function isBlobUrl(path: string): boolean {
  return path.startsWith('blob:');
}

/**
 * Check if a path is an absolute file path
 * - Unix: starts with /
 * - Windows: starts with drive letter (C:, D:, etc.)
 */
export function isAbsolutePath(path: string): boolean {
  if (path.startsWith('/')) return true;
  // Windows absolute path: C:\ or C:/
  if (/^[a-zA-Z]:[\\/]/.test(path)) return true;
  return false;
}

/**
 * Check if a path is a local file path (not remote, not data/blob URL)
 */
export function isLocalFilePath(path: string): boolean {
  return !isRemoteUrl(path) && !isDataUrl(path) && !isBlobUrl(path);
}

/**
 * Normalize path separators to forward slashes
 */
export function normalizeSeparators(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Resolve a relative path against a base directory
 *
 * @param relativePath - The relative path (e.g., "./image.png", "../assets/img.png")
 * @param baseDir - The base directory to resolve against
 * @returns The resolved absolute path
 */
export function resolveRelativePath(relativePath: string, baseDir: string): string {
  // Remove leading ./ if present
  const cleanPath = relativePath.replace(/^\.\//, '');

  // Split paths into components
  const baseParts = baseDir.split('/').filter(p => p.length > 0);
  const pathParts = cleanPath.split('/').filter(p => p.length > 0);

  const resolved: string[] = [...baseParts];

  for (const part of pathParts) {
    if (part === '..') {
      // Go up one directory
      resolved.pop();
    } else if (part !== '.') {
      // Normal path component
      resolved.push(part);
    }
  }

  // Windows drive letter (e.g. C:) — don't prepend /
  if (resolved.length > 0 && /^[a-zA-Z]:$/.test(resolved[0])) {
    return resolved.join('/');
  }
  return '/' + resolved.join('/');
}

/**
 * Resolve an image path to an absolute path
 *
 * Resolution order:
 * 1. If already absolute, return as-is
 * 2. If relative and basePath (current file) provided, resolve against its directory
 * 3. If relative and workspaceRoot provided, resolve against workspace
 * 4. Return as-is (may fail later)
 *
 * @param imagePath - The image path from markdown
 * @param options - Resolution options
 * @returns The resolved absolute path
 */
export interface ResolveOptions {
  /** Path of the current markdown file (for relative resolution) */
  currentFilePath?: string | null;
  /** Workspace root directory (fallback for new unsaved files) */
  workspaceRoot?: string | null;
}

export function resolveImagePath(imagePath: string, options: ResolveOptions = {}): string {
  // Normalize path separators first
  const normalizedPath = normalizeSeparators(imagePath);

  // If already absolute, return as-is
  if (isAbsolutePath(normalizedPath)) {
    return normalizedPath;
  }

  // Try to resolve against current file's directory
  if (options.currentFilePath) {
    const currentDir = getDirectoryPath(options.currentFilePath);
    return resolveRelativePath(normalizedPath, currentDir);
  }

  // Fall back to workspace root
  if (options.workspaceRoot) {
    return resolveRelativePath(normalizedPath, options.workspaceRoot);
  }

  // Cannot resolve, return as-is
  return normalizedPath;
}

/**
 * Get the directory path from a file path
 */
export function getDirectoryPath(filePath: string): string {
  const normalized = normalizeSeparators(filePath);
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) {
    return '/';
  }
  return normalized.substring(0, lastSlash);
}

/**
 * Get the filename from a path
 */
export function getFileName(filePath: string): string {
  const normalized = normalizeSeparators(filePath);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
}

/**
 * Convert an absolute path to relative path (for display/copy)
 *
 * @param absolutePath - The absolute path
 * @param basePath - The base path to make relative to
 * @returns The relative path, or original if cannot make relative
 */
export function toRelativePath(absolutePath: string, basePath: string): string {
  const absNormalized = normalizeSeparators(absolutePath);
  const baseNormalized = normalizeSeparators(basePath);

  const absParts = absNormalized.split('/').filter(p => p);
  const baseParts = baseNormalized.split('/').filter(p => p);

  // Find common prefix
  let commonLength = 0;
  while (commonLength < absParts.length &&
         commonLength < baseParts.length &&
         absParts[commonLength] === baseParts[commonLength]) {
    commonLength++;
  }

  if (commonLength === 0) {
    // No common prefix, return absolute
    return absolutePath;
  }

  // Calculate how many ../ needed
  const parentCount = baseParts.length - commonLength;
  const remainingParts = absParts.slice(commonLength);

  const relativeParts: string[] = [];
  for (let i = 0; i < parentCount; i++) {
    relativeParts.push('..');
  }
  relativeParts.push(...remainingParts);

  return relativeParts.join('/');
}
