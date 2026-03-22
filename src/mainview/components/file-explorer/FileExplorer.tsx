import {memo, useCallback, useRef, useState} from 'react';
import { useTranslation } from 'react-i18next';
import {electrobun} from '@/lib/electrobun';
import {FileTree} from './FileTree';
import {ContextMenu, type ContextMenuAction} from './ContextMenu';
import {MoveDialog} from './MoveDialog';
import type {FileNode, FileSystemNode} from '@/shared/types';

interface FileExplorerProps {
  nodes: FileSystemNode[];
  rootPath: string | null;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  isLoading: boolean;
  error: string | null;
  onToggleFolder: (path: string) => void;
  onSelectFile: (path: string | null) => void;
  onFileClick: (file: FileNode) => void;
  onRefresh?: () => void;
}

export const FileExplorer = memo(function FileExplorer({
  nodes,
  rootPath,
  expandedPaths,
  selectedPath,
  isLoading,
  error,
  onToggleFolder,
  onSelectFile,
  onFileClick,
  onRefresh,
}: FileExplorerProps) {
  const { t } = useTranslation('file');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    node: FileSystemNode | null;
  }>({ isOpen: false, x: 0, y: 0, node: null });

  // Move dialog state
  const [moveDialog, setMoveDialog] = useState<{
    isOpen: boolean;
    node: FileSystemNode | null;
  }>({ isOpen: false, node: null });

  // Rename state
  const [renamingNode, setRenamingNode] = useState<{ path: string; name: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleFileClick = useCallback((node: FileNode) => {
    onSelectFile(node.path);
    onFileClick(node);
  }, [onSelectFile, onFileClick]);

  // Handle context menu on file/folder
  const handleContextMenu = useCallback((node: FileSystemNode, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      node,
    });
  }, []);

  // Handle context menu on root/empty area
  const handleRootContextMenu = useCallback((event: React.MouseEvent) => {
    if (!rootPath) return;
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      node: null, // null means root context
    });
  }, [rootPath]);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Get parent folder path for a node
  const getParentFolderPath = useCallback((node: FileSystemNode | null): string => {
    if (!node) return rootPath || '';
    if (node.type === 'folder') return node.path;
    // For files, get parent directory
    const lastSlash = node.path.lastIndexOf('/');
    return lastSlash > 0 ? node.path.substring(0, lastSlash) : rootPath || '';
  }, [rootPath]);

  // Handle context menu actions
  const handleContextAction = useCallback(async (action: ContextMenuAction, node: FileSystemNode | null) => {
    switch (action) {
      case 'new-file': {
        const folderPath = getParentFolderPath(node);
        if (!folderPath) return;
        try {
          const result = await electrobun.createFile({ folderPath });
          if (result.success && result.path) {
            // Expand the folder if creating in a folder node
            if (node?.type === 'folder') {
              onToggleFolder(node.path);
            }
            onRefresh?.();
            // Enter rename mode for the new file
            const fileName = result.path.split('/').pop() || '';
            setRenamingNode({ path: result.path, name: fileName });
          } else {
            console.error('Failed to create file:', result.error);
          }
        } catch (err) {
          console.error('Error creating file:', err);
        }
        break;
      }

      case 'new-folder': {
        const parentPath = getParentFolderPath(node);
        if (!parentPath) return;
        try {
          const result = await electrobun.createFolder({ parentPath });
          if (result.success && result.path) {
            // Expand the parent folder
            if (node?.type === 'folder') {
              onToggleFolder(node.path);
            }
            onRefresh?.();
            // Enter rename mode for the new folder
            const folderName = result.path.split('/').pop() || '';
            setRenamingNode({ path: result.path, name: folderName });
          } else {
            console.error('Failed to create folder:', result.error);
          }
        } catch (err) {
          console.error('Error creating folder:', err);
        }
        break;
      }

      case 'delete': {
        if (!node) return;
        // Show confirmation dialog
        const confirmResult = await electrobun.showConfirmationDialog({
          title: 'Confirm Delete',
          message: `Are you sure you want to delete "${node.name}"?`,
          detail: node.type === 'folder' ? 'The folder and all its contents will be permanently deleted.' : 'This action cannot be undone.',
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
        });

        if (!confirmResult.confirmed) return;

        try {
          const result = await electrobun.deleteFile({ path: node.path });
          if (result.success) {
            // If the deleted file was selected, clear selection
            if (selectedPath === node.path) {
              onSelectFile(null);
            }
            onRefresh?.();
          } else {
            console.error('Failed to delete:', result.error);
          }
        } catch (err) {
          console.error('Error deleting:', err);
        }
        break;
      }

      case 'rename': {
        if (!node) return;
        setRenamingNode({ path: node.path, name: node.name });
        break;
      }

      case 'move': {
        if (!node) return;
        setMoveDialog({ isOpen: true, node });
        break;
      }

      case 'refresh': {
        onRefresh?.();
        break;
      }
    }
  }, [getParentFolderPath, onRefresh, onToggleFolder, onSelectFile, selectedPath]);

  // Handle move operation
  const handleMove = useCallback(async (targetFolderPath: string) => {
    if (!moveDialog.node) return;

    try {
      const result = await electrobun.moveFile({
        sourcePath: moveDialog.node.path,
        targetFolderPath,
      });

      if (result.success) {
        // If the moved file was selected, update its path
        if (selectedPath === moveDialog.node.path && result.newPath) {
          onSelectFile(result.newPath);
        }
        onRefresh?.();
      } else {
        console.error('Failed to move:', result.error);
      }
    } catch (err) {
      console.error('Error moving:', err);
    }

    setMoveDialog({ isOpen: false, node: null });
  }, [moveDialog.node, onRefresh, onSelectFile, selectedPath]);

  // Handle rename operation
  const handleRename = useCallback(async (node: FileSystemNode, newName: string) => {
    try {
      const result = await electrobun.renameFile({
        path: node.path,
        newName,
      });

      if (result.success && result.newPath) {
        // Always select the renamed file/folder
        onSelectFile(result.newPath);

        // If it's a file, also open it in the editor
        if (node.type === 'file') {
          const ext = newName.includes('.') ? newName.split('.').pop() || '' : '';
          const renamedFile: FileNode = {
            type: 'file',
            name: newName,
            path: result.newPath,
            extension: ext,
          };
          onFileClick(renamedFile);
        }

        onRefresh?.();
      } else {
        console.error('Failed to rename:', result.error);
      }
    } catch (err) {
      console.error('Error renaming:', err);
    }
    setRenamingNode(null);
  }, [onRefresh, onSelectFile, onFileClick]);

  const handleRenameCancel = useCallback(() => {
    setRenamingNode(null);
  }, []);

  // Get root directory name from path
  const rootName = rootPath ? rootPath.split('/').pop() || rootPath : null;

  return (
    <>
      <div ref={containerRef} className="flex flex-col h-full">
        {/* Content */}
        <div
          className="flex-1 overflow-auto scrollbar-auto"
          onContextMenu={handleRootContextMenu}
        >
          {isLoading && (
            <div className="flex items-center justify-center h-20">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {error && (
            <div className="px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {!isLoading && !error && nodes.length === 0 && (
            <div className="px-4 py-8 text-center text-[12px] text-muted-foreground/70">
              {rootPath ? (
                <>
                  <FolderOpenIcon className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p>{t('explorer.emptyFolder')}</p>
                </>
              ) : (
                <>
                  <FolderClosedIcon className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p>{t('explorer.noFolder')}</p>
                  <p className="text-[10px] mt-1 opacity-60">{t('explorer.noFolderHint')}</p>
                </>
              )}
            </div>
          )}

          {!isLoading && !error && nodes.length > 0 && rootPath && rootName && (
            <div className="select-none">
              {/* Root Directory Name - Typora style */}
              <div
                className="flex items-center gap-[6px] py-[3px] px-3 text-[12.5px] font-medium text-foreground/90 cursor-pointer hover:bg-accent/40 transition-colors"
                onContextMenu={handleRootContextMenu}
              >
                <FolderIcon />
                <span className="truncate">{rootName}</span>
              </div>

              {/* Children - folders and files at same level */}
              <FileTree
                nodes={nodes}
                expandedPaths={expandedPaths}
                selectedPath={selectedPath}
                renamingNode={renamingNode}
                onToggleFolder={onToggleFolder}
                onFileClick={handleFileClick}
                onContextMenu={handleContextMenu}
                onRename={handleRename}
                onRenameCancel={handleRenameCancel}
                level={1}
              />
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu
        node={contextMenu.node}
        x={contextMenu.x}
        y={contextMenu.y}
        isOpen={contextMenu.isOpen}
        onClose={closeContextMenu}
        onAction={handleContextAction}
      />

      {/* Move Dialog */}
      <MoveDialog
        isOpen={moveDialog.isOpen}
        sourceNode={moveDialog.node}
        rootPath={rootPath}
        nodes={nodes}
        onClose={() => setMoveDialog({ isOpen: false, node: null })}
        onMove={handleMove}
      />
    </>
  );
});

// Icons
function FolderOpenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
    </svg>
  );
}

function FolderClosedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

// Folder Icon for root directory (Typora style - outlined)
function FolderIcon() {
  return (
    <svg className="w-4 h-4 text-blue-500/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}
