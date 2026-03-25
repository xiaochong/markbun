// Utility functions for file dialog

/**
 * Format file size to human readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.floor(Math.log10(bytes) / 3);
  const value = bytes / Math.pow(1000, unitIndex);
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Format timestamp to locale date string
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isSameYear = date.getFullYear() === now.getFullYear();

  if (isSameYear) {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get file extension from filename
 */
export function getExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.slice(lastDot + 1).toLowerCase() : '';
}

/**
 * Check if file matches filter
 */
export function matchesFilter(fileName: string, extensions: string[]): boolean {
  if (extensions.includes('*')) return true;
  const ext = getExtension(fileName);
  return extensions.includes(ext);
}

/**
 * Get default filename from path
 */
export function getFileNameFromPath(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || '';
}

/**
 * Get directory from path
 */
export function getDirectoryFromPath(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash > 0 ? path.slice(0, lastSlash) : path;
}

/**
 * Sort files by field
 */
export function sortFiles(
  files: import('./FileDialog.types').FileItem[],
  field: import('./FileDialog.types').SortField,
  order: import('./FileDialog.types').SortOrder
): import('./FileDialog.types').FileItem[] {
  return [...files].sort((a, b) => {
    // Directories always come first
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }

    let comparison = 0;

    switch (field) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'size':
        comparison = (a.size || 0) - (b.size || 0);
        break;
      case 'mtime':
        comparison = (a.mtime || 0) - (b.mtime || 0);
        break;
    }

    return order === 'asc' ? comparison : -comparison;
  });
}

/**
 * Get path separator for current platform
 */
export function getPathSeparator(): string {
  // In WebView context, we receive paths with forward slashes from the main process
  // The main process normalizes paths before sending
  return '/';
}

/**
 * Join paths
 */
export function joinPaths(...parts: string[]): string {
  return parts
    .map((part, i) => {
      if (i === 0) return part.replace(/\/$/, '');
      return part.replace(/^\//, '').replace(/\/$/, '');
    })
    .join('/');
}

/**
 * Normalize filename for saving
 */
export function normalizeFileName(fileName: string, defaultExt: string): string {
  // Remove invalid characters
  const sanitized = fileName.replace(/[<>:"|?*]/g, '_').trim();

  // Add default extension if not present
  if (defaultExt && !sanitized.includes('.')) {
    return `${sanitized}.${defaultExt}`;
  }

  return sanitized;
}
