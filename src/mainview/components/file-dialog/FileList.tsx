import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileListItem } from './FileListItem';
import type { FileItem, SortField, SortOrder } from './FileDialog.types';

interface FileListProps {
  files: FileItem[];
  selectedFiles: Set<string>;
  activeFile: string | null;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onSelectFile: (file: FileItem, isMultiSelect: boolean) => void;
  onDoubleClick: (file: FileItem) => void;
  onNavigate: (path: string) => void;
  emptyMessage?: string;
}

// Simple SVG icons
const ArrowUpDownIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m21 16-4 4-4-4"/>
    <path d="M17 20V4"/>
    <path d="m3 8 4-4 4 4"/>
    <path d="M7 4v16"/>
  </svg>
);

const ArrowUpIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m18 15-6-6-6 6"/>
  </svg>
);

const ArrowDownIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

function SortIcon({ field, sortField, sortOrder }: { field: SortField; sortField: SortField; sortOrder: SortOrder }) {
  if (field !== sortField) {
    return <ArrowUpDownIcon className="text-muted-foreground/50" />;
  }
  return sortOrder === 'asc'
    ? <ArrowUpIcon className="text-primary" />
    : <ArrowDownIcon className="text-primary" />;
}

export function FileList({
  files,
  selectedFiles,
  activeFile,
  sortField,
  sortOrder,
  onSort,
  onSelectFile,
  onDoubleClick,
  onNavigate,
  emptyMessage,
}: FileListProps) {
  const { t } = useTranslation('dialog');

  const handleHeaderClick = (field: SortField) => {
    onSort(field);
  };

  const handleFileClick = (file: FileItem, event: React.MouseEvent) => {
    const isMultiSelect = event.metaKey || event.ctrlKey;
    onSelectFile(file, isMultiSelect);
  };

  const handleFileDoubleClick = (file: FileItem) => {
    if (file.isDirectory) {
      onNavigate(file.path);
    } else {
      onDoubleClick(file);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-muted/20 text-xs font-medium text-muted-foreground">
        <button
          onClick={() => handleHeaderClick('name')}
          className="flex-1 flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {t('fileDialog.columns.name')}
          <SortIcon field="name" sortField={sortField} sortOrder={sortOrder} />
        </button>
        <button
          onClick={() => handleHeaderClick('size')}
          className="w-20 flex items-center justify-end gap-1 hover:text-foreground transition-colors"
        >
          {t('fileDialog.columns.size')}
          <SortIcon field="size" sortField={sortField} sortOrder={sortOrder} />
        </button>
        <button
          onClick={() => handleHeaderClick('mtime')}
          className="w-32 flex items-center justify-end gap-1 hover:text-foreground transition-colors"
        >
          {t('fileDialog.columns.modified')}
          <SortIcon field="mtime" sortField={sortField} sortOrder={sortOrder} />
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {emptyMessage || t('fileDialog.noFiles')}
          </div>
        ) : (
          files.map((file) => (
            <FileListItem
              key={file.path}
              file={file}
              isSelected={selectedFiles.has(file.path)}
              isActive={activeFile === file.path}
              onClick={(e) => handleFileClick(file, e)}
              onDoubleClick={() => handleFileDoubleClick(file)}
            />
          ))
        )}
      </div>
    </div>
  );
}
