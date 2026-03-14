import { useState, useCallback } from 'react';
import { electrobun } from '@/lib/electrobun';
import type { FileSystemNode, FileNode } from '@/shared/types';

export interface UseFileExplorerReturn {
  rootPath: string | null;
  nodes: FileSystemNode[];
  expandedPaths: Set<string>;
  selectedPath: string | null;
  isLoading: boolean;
  error: string | null;
  setRootPath: (path: string | null) => void;
  toggleFolder: (path: string) => void;
  selectFile: (path: string | null) => void;
  refresh: () => void;
}

export function useFileExplorer(): UseFileExplorerReturn {
  const [rootPath, setRootPathState] = useState<string | null>(null);
  const [nodes, setNodes] = useState<FileSystemNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFolder = useCallback(async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await electrobun.readFolder({ path }) as {
        success: boolean;
        nodes?: FileSystemNode[];
        error?: string
      };

      if (result.success && result.nodes) {
        setNodes(prev => mergeNodes(prev, result.nodes!));
      } else {
        setError(result.error || 'Failed to load folder');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setRootPath = useCallback((path: string | null) => {
    // If no path provided, clear everything
    if (!path) {
      setRootPathState(null);
      setNodes([]);
      setExpandedPaths(new Set());
      return;
    }

    // If we already have a rootPath, check if the new path is within the current workspace
    if (rootPath) {
      // If the new path starts with rootPath, it's within the current workspace
      // Don't switch root, just update the selected file
      if (path.startsWith(rootPath)) {
        return;
      }
    }

    // Skip if path hasn't changed
    if (rootPath === path) {
      return;
    }

    // Set new root path and load the folder
    setRootPathState(path);
    loadFolder(path);
    setExpandedPaths(new Set([path]));
  }, [loadFolder, rootPath]);

  const toggleFolder = useCallback(async (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

    const node = findNode(nodes, path);
    if (node?.type === 'folder' && !expandedPaths.has(path)) {
      const result = await electrobun.readFolder({ path }) as {
        success: boolean;
        nodes?: FileSystemNode[];
        error?: string;
      };

      if (result.success && result.nodes) {
        setNodes(prev => updateFolderChildren(prev, path, result.nodes!));
      }
    }
  }, [nodes, expandedPaths]);

  const selectFile = useCallback((path: string | null) => {
    setSelectedPath(path);
  }, []);

  const refresh = useCallback(() => {
    if (rootPath) {
      loadFolder(rootPath);
    }
  }, [rootPath, loadFolder]);

  // Initialize with empty state - no default folder
  // File explorer stays empty until a file is opened

  return {
    rootPath,
    nodes,
    expandedPaths,
    selectedPath,
    isLoading,
    error,
    setRootPath,
    toggleFolder,
    selectFile,
    refresh,
  };
}

function findNode(nodes: FileSystemNode[], path: string): FileSystemNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.type === 'folder') {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

function updateFolderChildren(
  nodes: FileSystemNode[],
  folderPath: string,
  children: FileSystemNode[]
): FileSystemNode[] {
  return nodes.map(node => {
    if (node.path === folderPath && node.type === 'folder') {
      return { ...node, children };
    }
    if (node.type === 'folder') {
      return { ...node, children: updateFolderChildren(node.children, folderPath, children) };
    }
    return node;
  });
}

function mergeNodes(oldNodes: FileSystemNode[], newNodes: FileSystemNode[]): FileSystemNode[] {
  const oldMap = new Map(oldNodes.map(n => [n.path, n]));

  return newNodes.map(newNode => {
    const oldNode = oldMap.get(newNode.path);
    if (oldNode?.type === 'folder' && newNode.type === 'folder') {
      return {
        ...newNode,
        children: mergeNodes(oldNode.children, newNode.children),
      };
    }
    return newNode;
  });
}
