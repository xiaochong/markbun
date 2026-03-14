// Folder browsing IPC handlers for Phase 2
import { readdir, stat } from 'fs/promises';
import { join, extname } from 'path';
import type { FileSystemNode, FileNode, FolderNode } from '../../shared/types';

/**
 * Read a folder and return its contents as a tree structure
 */
export async function readFolder(folderPath: string): Promise<{ success: boolean; nodes?: FileSystemNode[]; error?: string }> {
  try {
    const entries = await readdir(folderPath, { withFileTypes: true });

    const nodes: FileSystemNode[] = [];

    for (const entry of entries) {
      const fullPath = join(folderPath, entry.name);

      // Skip hidden files/folders and system directories
      if (isHiddenOrSystemFile(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        const folderNode: FolderNode = {
          type: 'folder',
          name: entry.name,
          path: fullPath,
          children: [], // Lazy load children
          isExpanded: false,
        };
        nodes.push(folderNode);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        // Only show relevant file types
        if (isSupportedFile(ext)) {
          const fileNode: FileNode = {
            type: 'file',
            name: entry.name,
            path: fullPath,
            extension: ext.slice(1), // Remove the dot
          };
          nodes.push(fileNode);
        }
      }
    }

    // Sort: folders first, then files, both alphabetically
    nodes.sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name);
    });

    return { success: true, nodes };
  } catch (error) {
    console.error('Failed to read folder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a file extension is supported
 */
function isSupportedFile(ext: string): boolean {
  const supported = ['.md', '.markdown', '.txt', '.mdx'];
  return supported.includes(ext);
}

/**
 * Check if a file or folder should be hidden
 * - Unix hidden files (starting with .)
 * - Windows system folders (like $RECYCLE.BIN)
 * - macOS system folders
 */
function isHiddenOrSystemFile(name: string): boolean {
  // Unix hidden files
  if (name.startsWith('.')) {
    return true;
  }

  // Windows system folders
  const windowsHidden = [
    '$recycle.bin',
    '$recycle',
    'system volume information',
    'config.msi',
    'msocache',
    'pagefile.sys',
    'swapfile.sys',
    'hiberfil.sys',
    'recycler',
    'thumbs.db',
    'desktop.ini',
    'ntuser.dat',
    'ntuser.ini',
  ];
  if (windowsHidden.includes(name.toLowerCase())) {
    return true;
  }

  // macOS system folders
  const macSystem = [
    '.ds_store',
    '.trashes',
    '.fseventsd',
    '.spotlight-v100',
    '.temporaryitems',
    'desktop.db',
    'desktopdf',
    '.appledb',
    '.appledesktop',
    '.appledouble',
    '._*', // macOS resource fork
  ];
  const lowerName = name.toLowerCase();
  if (macSystem.some(sys => lowerName === sys || lowerName.startsWith(sys.replace('*', '')))) {
    return true;
  }

  return false;
}

/**
 * Expand a folder and load its children
 */
export async function expandFolder(folderPath: string): Promise<{ success: boolean; nodes?: FileSystemNode[]; error?: string }> {
  return readFolder(folderPath);
}

/**
 * Get the workspace root folder (starts from home or recent)
 */
export async function getWorkspaceRoot(): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const { homedir } = await import('os');
    const { join } = await import('path');
    const path = join(homedir(), 'Documents');
    return { success: true, path };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
