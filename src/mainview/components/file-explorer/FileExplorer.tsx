import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { FileTree } from './FileTree';
import type { FileSystemNode, FileNode } from '@/shared/types';

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
}: FileExplorerProps) {
  const handleFileClick = useCallback((node: FileNode) => {
    onSelectFile(node.path);
    onFileClick(node);
  }, [onSelectFile, onFileClick]);

  // Get root directory name from path
  const rootName = rootPath ? rootPath.split('/').pop() || rootPath : null;

  return (
    <div className="flex flex-col h-full">
      {/* Content */}
      <div className="flex-1 overflow-auto scrollbar-auto">
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
                <p>Empty folder</p>
              </>
            ) : (
              <>
                <FolderClosedIcon className="w-6 h-6 mx-auto mb-2 opacity-40" />
                <p>No folder open</p>
                <p className="text-[10px] mt-1 opacity-60">Open a file to view its folder</p>
              </>
            )}
          </div>
        )}

        {!isLoading && !error && nodes.length > 0 && rootPath && rootName && (
          <div className="select-none">
            {/* Root Directory Name - Typora style */}
            <div className="flex items-center gap-[6px] py-[3px] px-3 text-[12.5px] font-medium text-foreground/90">
              <FolderIcon />
              <span className="truncate">{rootName}</span>
            </div>

            {/* Children - folders and files at same level */}
            <FileTree
              nodes={nodes}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              onToggleFolder={onToggleFolder}
              onFileClick={handleFileClick}
              level={1}
            />
          </div>
        )}
      </div>
    </div>
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
