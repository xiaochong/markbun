import React from 'react';
import type { FileItem } from './FileDialog.types';
import { formatFileSize, formatDate, getExtension } from './utils';

interface FileListItemProps {
  file: FileItem;
  isSelected: boolean;
  isActive: boolean;
  onClick: (event: React.MouseEvent) => void;
  onDoubleClick: () => void;
  showSize?: boolean;
  showDate?: boolean;
}

// Simple SVG icons
const FolderIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
  </svg>
);

const FileTextIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
    <path d="M10 9H8"/>
    <path d="M16 13H8"/>
    <path d="M16 17H8"/>
  </svg>
);

const FileIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
  </svg>
);

const ImageIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
    <circle cx="9" cy="9" r="2"/>
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
  </svg>
);

const FileCodeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4"/>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
    <path d="m9 18 3-3-3-3"/>
    <path d="m5 12-3 3 3 3"/>
  </svg>
);

function getFileIcon(file: FileItem) {
  if (file.isDirectory) {
    return <FolderIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />;
  }

  const ext = getExtension(file.name);

  switch (ext) {
    case 'md':
    case 'markdown':
      return <FileTextIcon className="w-5 h-5 text-purple-500 flex-shrink-0" />;
    case 'txt':
      return <FileTextIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return <ImageIcon className="w-5 h-5 text-green-500 flex-shrink-0" />;
    case 'js':
    case 'ts':
    case 'jsx':
    case 'tsx':
    case 'json':
    case 'html':
    case 'css':
      return <FileCodeIcon className="w-5 h-5 text-yellow-500 flex-shrink-0" />;
    default:
      return <FileIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />;
  }
}

export function FileListItem({
  file,
  isSelected,
  isActive,
  onClick,
  onDoubleClick,
  showSize = true,
  showDate = true,
}: FileListItemProps) {
  return (
    <div
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`
        flex items-center gap-3 px-3 py-2 cursor-pointer select-none
        transition-colors border-b border-border/50 last:border-b-0
        ${isActive
          ? 'bg-accent text-accent-foreground'
          : isSelected
            ? 'bg-accent/50'
            : 'hover:bg-muted/50'
        }
      `}
    >
      {getFileIcon(file)}

      <span className="flex-1 truncate font-medium text-sm">
        {file.name}
      </span>

      {showSize && (
        <span className="w-20 text-right text-xs text-muted-foreground tabular-nums">
          {file.isDirectory ? '—' : formatFileSize(file.size || 0)}
        </span>
      )}

      {showDate && (
        <span className="w-32 text-right text-xs text-muted-foreground tabular-nums">
          {file.mtime ? formatDate(file.mtime) : '—'}
        </span>
      )}
    </div>
  );
}
