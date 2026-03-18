import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { FileSystemNode, FileNode } from '@/shared/types';

interface FileTreeProps {
  nodes: FileSystemNode[];
  expandedPaths: Set<string>;
  selectedPath: string | null;
  renamingNode: { path: string; name: string } | null;
  onToggleFolder: (path: string) => void;
  onFileClick: (file: FileNode) => void;
  onContextMenu?: (node: FileSystemNode, event: React.MouseEvent) => void;
  onRename?: (node: FileSystemNode, newName: string) => void;
  onRenameCancel?: () => void;
  level: number;
}

export function FileTree({
  nodes,
  expandedPaths,
  selectedPath,
  renamingNode,
  onToggleFolder,
  onFileClick,
  onContextMenu,
  onRename,
  onRenameCancel,
  level,
}: FileTreeProps) {
  return (
    <div className="select-none">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          expandedPaths={expandedPaths}
          selectedPath={selectedPath}
          renamingNode={renamingNode}
          onToggleFolder={onToggleFolder}
          onFileClick={onFileClick}
          onContextMenu={onContextMenu}
          onRename={onRename}
          onRenameCancel={onRenameCancel}
          level={level}
        />
      ))}
    </div>
  );
}

interface FileTreeNodeProps {
  node: FileSystemNode;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  renamingNode: { path: string; name: string } | null;
  onToggleFolder: (path: string) => void;
  onFileClick: (file: FileNode) => void;
  onContextMenu?: (node: FileSystemNode, event: React.MouseEvent) => void;
  onRename?: (node: FileSystemNode, newName: string) => void;
  onRenameCancel?: () => void;
  level: number;
}

function FileTreeNode({
  node,
  expandedPaths,
  selectedPath,
  renamingNode,
  onToggleFolder,
  onFileClick,
  onContextMenu,
  onRename,
  onRenameCancel,
  level,
}: FileTreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  const isRenaming = renamingNode?.path === node.path;
  // Typora style: 12px per level, level 1 starts at 12px (under root folder icon)
  const paddingLeft = level * 12;

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu?.(node, event);
  };

  if (node.type === 'folder') {
    return (
      <div>
        <div
          className={cn(
            'flex items-center gap-[6px] py-[2px] pr-2 text-[12.5px] cursor-pointer hover:bg-accent/40 transition-colors leading-tight',
            isSelected && 'bg-accent/60'
          )}
          style={{ paddingLeft }}
          onClick={() => onToggleFolder(node.path)}
          onContextMenu={handleContextMenu}
        >
          <ChevronIcon expanded={isExpanded} />
          <FolderIcon />
          {isRenaming ? (
            <RenameInput
              initialName={renamingNode.name}
              isFile={false}
              onSubmit={(newName) => onRename?.(node, newName)}
              onCancel={onRenameCancel}
            />
          ) : (
            <span className="truncate text-foreground/90">{node.name}</span>
          )}
        </div>

        {isExpanded && node.children.length > 0 && (
          <FileTree
            nodes={node.children}
            expandedPaths={expandedPaths}
            selectedPath={selectedPath}
            renamingNode={renamingNode}
            onToggleFolder={onToggleFolder}
            onFileClick={onFileClick}
            onContextMenu={onContextMenu}
            onRename={onRename}
            onRenameCancel={onRenameCancel}
            level={level + 1}
          />
        )}
      </div>
    );
  }

  // File node
  return (
    <div
      className={cn(
        'flex items-center gap-[6px] py-[2px] pr-2 text-[12.5px] cursor-pointer hover:bg-accent/40 transition-colors leading-tight',
        isSelected && 'bg-accent text-accent-foreground'
      )}
      style={{ paddingLeft }}
      onClick={() => onFileClick(node)}
      onContextMenu={handleContextMenu}
    >
      <span className="w-4" />
      <FileIcon extension={node.extension} />
      {isRenaming ? (
        <RenameInput
          initialName={renamingNode.name}
          isFile={true}
          onSubmit={(newName) => onRename?.(node, newName)}
          onCancel={onRenameCancel}
        />
      ) : (
        <span className={cn('truncate', isSelected ? 'text-accent-foreground' : 'text-foreground/75')}>
          {node.name}
        </span>
      )}
    </div>
  );
}

// Rename input component
interface RenameInputProps {
  initialName: string;
  isFile: boolean;
  onSubmit: (newName: string) => void;
  onCancel?: () => void;
}

function RenameInput({ initialName, isFile, onSubmit, onCancel }: RenameInputProps) {
  const [value, setValue] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    // Focus and select name part (without extension for files)
    input.focus();
    if (isFile) {
      const dotIndex = initialName.lastIndexOf('.');
      if (dotIndex > 0) {
        input.setSelectionRange(0, dotIndex);
      } else {
        input.select();
      }
    } else {
      input.select();
    }
  }, [initialName, isFile]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const trimmed = value.trim();
      if (trimmed && trimmed !== initialName) {
        onSubmit(trimmed);
      } else {
        onCancel?.();
      }
    } else if (e.key === 'Escape') {
      onCancel?.();
    }
  };

  const handleBlur = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== initialName) {
      onSubmit(trimmed);
    } else {
      onCancel?.();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className="flex-1 min-w-0 px-1 py-0 text-[12.5px] bg-background border border-primary rounded outline-none"
      style={{ height: '18px', lineHeight: '16px' }}
    />
  );
}

// Chevron Icon - same width as file placeholder for alignment
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={cn('w-4 h-3 text-muted-foreground/70 transition-transform flex-shrink-0', expanded && 'rotate-90')}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// Folder Icon (Typora style - outlined)
function FolderIcon() {
  return (
    <svg className="w-4 h-4 text-blue-500/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

// File Icon with extension-based colors (outlined style)
function FileIcon({ extension }: { extension: string }) {
  if (isImageFile(extension)) {
    return <ImageIcon />;
  }

  if (isMarkdownFile(extension)) {
    return <MarkdownIcon />;
  }

  const colorClass = getFileColor(extension);

  return (
    <svg className={cn('w-4 h-4 flex-shrink-0', colorClass)} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

// Image Icon (for image files)
function ImageIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0 text-purple-500/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function getFileColor(extension: string): string {
  const colors: Record<string, string> = {
    md: 'text-gray-600 dark:text-gray-400',
    markdown: 'text-gray-600 dark:text-gray-400',
    mdx: 'text-yellow-600 dark:text-yellow-400',
    txt: 'text-slate-500 dark:text-slate-400',
  };
  return colors[extension.toLowerCase()] || 'text-gray-500';
}

// Check if extension is an image
export function isImageFile(extension: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
  return imageExtensions.includes(extension.toLowerCase());
}

// Check if extension is a markdown file
function isMarkdownFile(extension: string): boolean {
  const markdownExtensions = ['md', 'markdown', 'mdx'];
  return markdownExtensions.includes(extension.toLowerCase());
}

// Markdown Icon (with MD text)
function MarkdownIcon() {
  return (
    <div className="w-4 h-4 flex-shrink-0 relative">
      <svg className="w-4 h-4 text-blue-500/80" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
        <path d="M14 3v5h5" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[6px] font-bold text-blue-600/90 pt-0.5">
        MD
      </span>
    </div>
  );
}
