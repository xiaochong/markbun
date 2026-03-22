import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { getDirectoryPath } from '@/lib/image';
import type { FileSystemNode, FolderNode } from '@/shared/types';

interface MoveDialogProps {
  isOpen: boolean;
  sourceNode: FileSystemNode | null;
  rootPath: string | null;
  nodes: FileSystemNode[];
  onClose: () => void;
  onMove: (targetFolderPath: string) => void;
}

interface FolderItem {
  path: string;
  name: string;
  level: number;
}

export function MoveDialog({
  isOpen,
  sourceNode,
  rootPath,
  nodes,
  onClose,
  onMove,
}: MoveDialogProps) {
  const { t: tc } = useTranslation('common');
  const { t: td } = useTranslation('dialog');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [folderList, setFolderList] = useState<FolderItem[]>([]);

  // Flatten folder tree for display
  const flattenFolders = useCallback((
    folderNodes: FileSystemNode[],
    level: number,
    sourcePath: string | null
  ): FolderItem[] => {
    const result: FolderItem[] = [];

    for (const node of folderNodes) {
      if (node.type === 'folder') {
        // Skip the source node itself (can't move into itself)
        if (node.path === sourcePath) continue;
        // Skip children of source node (can't move into its own subtree)
        if (sourcePath && node.path.startsWith(sourcePath + '/')) continue;

        result.push({
          path: node.path,
          name: node.name,
          level,
        });

        // Recursively add children if expanded
        if (expandedPaths.has(node.path) && node.children) {
          result.push(...flattenFolders(node.children, level + 1, sourcePath));
        }
      }
    }

    return result;
  }, [expandedPaths]);

  // Update folder list when nodes or expanded paths change
  useEffect(() => {
    if (!isOpen) return;

    const folders: FolderItem[] = [];

    // Add root folder
    if (rootPath) {
      folders.push({
        path: rootPath,
        name: rootPath.split('/').pop() || rootPath,
        level: 0,
      });
    }

    // Add all other folders
    folders.push(...flattenFolders(nodes, 1, sourceNode?.path || null));
    setFolderList(folders);
  }, [isOpen, nodes, rootPath, sourceNode, flattenFolders]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Toggle folder expansion
  const toggleFolder = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  // Find node by path
  const findNodeByPath = useCallback((
    path: string,
    searchNodes: FileSystemNode[]
  ): FileSystemNode | null => {
    for (const node of searchNodes) {
      if (node.path === path) return node;
      if (node.type === 'folder' && node.children) {
        const found = findNodeByPath(path, node.children);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Handle folder selection with expansion toggle on arrow click
  const handleFolderClick = useCallback((folder: FolderItem, event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    const isArrowClick = target.closest('.folder-arrow');

    if (isArrowClick) {
      toggleFolder(folder.path);
    } else {
      setSelectedPath(folder.path);
    }
  }, [toggleFolder]);

  if (!isOpen || !sourceNode) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[400px] max-w-[90vw] bg-popover border border-border rounded-lg shadow-xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-medium">{td('move.title')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {td('move.description', { name: sourceNode.name })}
          </p>
        </div>

        {/* Folder Tree */}
        <div className="max-h-[300px] overflow-auto py-2">
          {folderList.map((folder) => (
            <div
              key={folder.path}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 text-[13px] cursor-pointer transition-colors',
                'hover:bg-accent/50',
                selectedPath === folder.path && 'bg-accent text-accent-foreground'
              )}
              style={{ paddingLeft: `${12 + folder.level * 16}px` }}
              onClick={(e) => handleFolderClick(folder, e)}
            >
              {/* Expand arrow */}
              <span
                className={cn(
                  'folder-arrow w-4 h-4 flex items-center justify-center flex-shrink-0 text-muted-foreground',
                  'hover:bg-accent rounded transition-transform',
                  expandedPaths.has(folder.path) && 'rotate-90'
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(folder.path);
                }}
              >
                <ChevronIcon />
              </span>

              {/* Folder icon */}
              <FolderIcon />

              {/* Folder name */}
              <span className="truncate">{folder.name}</span>
            </div>
          ))}

          {folderList.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {td('move.noFolders')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] rounded-md hover:bg-accent transition-colors"
          >
            {tc('button.cancel')}
          </button>
          <button
            onClick={() => {
              if (selectedPath) {
                onMove(selectedPath);
              }
            }}
            disabled={!selectedPath || selectedPath === (sourceNode.type === 'folder' ? sourceNode.path : getDirectoryPath(sourceNode.path))}
            className={cn(
              'px-3 py-1.5 text-[13px] rounded-md transition-colors',
              selectedPath
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {tc('button.move')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-4 h-4 text-blue-500/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}
