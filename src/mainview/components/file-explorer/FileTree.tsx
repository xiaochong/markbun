import { cn } from '@/lib/utils';
import type { FileSystemNode, FileNode } from '@/shared/types';

interface FileTreeProps {
  nodes: FileSystemNode[];
  expandedPaths: Set<string>;
  selectedPath: string | null;
  onToggleFolder: (path: string) => void;
  onFileClick: (file: FileNode) => void;
  level: number;
}

export function FileTree({
  nodes,
  expandedPaths,
  selectedPath,
  onToggleFolder,
  onFileClick,
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
          onToggleFolder={onToggleFolder}
          onFileClick={onFileClick}
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
  onToggleFolder: (path: string) => void;
  onFileClick: (file: FileNode) => void;
  level: number;
}

function FileTreeNode({
  node,
  expandedPaths,
  selectedPath,
  onToggleFolder,
  onFileClick,
  level,
}: FileTreeNodeProps) {
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;
  // Typora style: 12px per level, level 1 starts at 12px (under root folder icon)
  const paddingLeft = level * 12;

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
        >
          <ChevronIcon expanded={isExpanded} />
          <FolderIcon />
          <span className="truncate text-foreground/90">{node.name}</span>
        </div>

        {isExpanded && node.children.length > 0 && (
          <FileTree
            nodes={node.children}
            expandedPaths={expandedPaths}
            selectedPath={selectedPath}
            onToggleFolder={onToggleFolder}
            onFileClick={onFileClick}
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
    >
      <span className="w-4" />
      <FileIcon extension={node.extension} />
      <span className={cn('truncate', isSelected ? 'text-accent-foreground' : 'text-foreground/75')}>
        {node.name}
      </span>
    </div>
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
  const colorClass = getFileColor(extension);

  return (
    <svg className={cn('w-4 h-4 flex-shrink-0', colorClass)} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 3v5h5" />
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
