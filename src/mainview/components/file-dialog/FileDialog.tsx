import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './Sidebar';
import { Breadcrumb } from './Breadcrumb';
import { FileList } from './FileList';
import { useFileDialog } from './useFileDialog';
import type {
  FileDialogOptions,
  OpenDialogResult,
  SaveDialogResult,
} from './FileDialog.types';

// Simple SVG icons
const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

const FolderPlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
    <line x1="12" x2="12" y1="11" y2="17"/>
    <line x1="9" x2="15" y1="14" y2="14"/>
  </svg>
);

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7c.78 0 1.53-.09 2.24-.26"/>
    <path d="M2 2l20 20"/>
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
  </svg>
);

const LoaderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg>
);

interface FileDialogProps {
  isOpen: boolean;
  options: FileDialogOptions;
  onClose: () => void;
  onConfirm: (result: OpenDialogResult | SaveDialogResult) => void;
}

export function FileDialog({ isOpen, options, onClose, onConfirm }: FileDialogProps) {
  const { t: td } = useTranslation('dialog');

  const {
    currentPath,
    files,
    selectedFiles,
    activeFile,
    sortField,
    sortOrder,
    isLoading,
    error,
    sidebarItems,
    fileName,
    showHiddenFiles,
    setFileName,
    setShowHiddenFiles,
    handleNavigate,
    handleNavigateUp,
    handleSort,
    handleSelectFile,
    handleDoubleClick,
    handleConfirm,
    handleCreateFolder,
    startCreateFolder,
    cancelCreateFolder,
    isCreatingFolder,
    newFolderName,
    setNewFolderName,
  } = useFileDialog({ options, isOpen, onClose, onConfirm });

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleFileNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(e.target.value);
  }, [setFileName]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter') {
      handleConfirm();
    }
  }, [handleClose, handleConfirm]);

  if (!isOpen) return null;

  const title = options.title || (options.mode === 'open' ? td('fileDialog.openTitle') : td('fileDialog.saveTitle'));
  const buttonLabel = options.buttonLabel || (options.mode === 'open' ? td('fileDialog.openButton') : td('fileDialog.saveButton'));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-col w-[800px] h-[500px] rounded-lg bg-background shadow-lg border border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            onClick={handleClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/50">
          <button
            onClick={handleNavigateUp}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
            title="Go up"
          >
            <ChevronLeftIcon />
          </button>
          <Breadcrumb path={currentPath} onNavigate={handleNavigate} homePath={sidebarItems.find(i => i.id === 'home')?.path || '/'} />
          <div className="flex-1" />
          <button
            onClick={startCreateFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
            title={td('fileDialog.newFolder')}
          >
            <FolderPlusIcon />
            <span className="hidden sm:inline">{td('fileDialog.newFolder')}</span>
          </button>
          <button
            onClick={() => setShowHiddenFiles(!showHiddenFiles)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
            title={showHiddenFiles ? td('fileDialog.hideHidden') : td('fileDialog.showHidden')}
          >
            {showHiddenFiles ? <EyeOffIcon /> : <EyeIcon />}
            <span className="hidden sm:inline">
              {showHiddenFiles ? td('fileDialog.hideHidden') : td('fileDialog.showHidden')}
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <Sidebar items={sidebarItems} onSelect={handleNavigate} currentPath={currentPath} />

          {/* File list */}
          <div className="flex-1 flex flex-col min-w-0 relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
                <LoaderIcon />
              </div>
            )}

            {error ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <p className="text-destructive mb-4 text-center">{error}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleNavigate(currentPath)}
                    className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Retry
                  </button>
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
                  >
                    {td('fileDialog.cancelButton')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {/* New folder input */}
                {isCreatingFolder && (
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-primary/5">
                    <FolderPlusIcon />
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateFolder(newFolderName);
                        } else if (e.key === 'Escape') {
                          cancelCreateFolder();
                        }
                      }}
                      placeholder={td('fileDialog.folderNamePlaceholder')}
                      className="flex-1 px-3 py-1.5 text-sm text-foreground bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      autoFocus
                    />
                    <button
                      onClick={() => handleCreateFolder(newFolderName)}
                      className="px-3 py-1.5 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors"
                    >
                      {td('fileDialog.createButton')}
                    </button>
                    <button
                      onClick={cancelCreateFolder}
                      className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
                    >
                      {td('fileDialog.cancelButton')}
                    </button>
                  </div>
                )}
                <FileList
                  files={files}
                  selectedFiles={selectedFiles}
                  activeFile={activeFile}
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  onSelectFile={handleSelectFile}
                  onDoubleClick={handleDoubleClick}
                  onNavigate={handleNavigate}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-3 border-t border-border bg-secondary/50">
          {/* Filename input (save mode only) */}
          {options.mode === 'save' && (
            <div className="flex items-center gap-2 flex-1">
              <label className="text-sm text-muted-foreground whitespace-nowrap">
                {td('fileDialog.fileName')}
              </label>
              <input
                type="text"
                value={fileName}
                onChange={handleFileNameChange}
                placeholder={td('fileDialog.fileNamePlaceholder')}
                className="flex-1 px-3 py-1.5 text-sm text-foreground bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* Filter selector (open mode only) */}
          {options.mode === 'open' && options.filters && options.filters.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">{td('fileDialog.filters.allFiles')}</label>
              <select className="px-3 py-1.5 text-sm text-foreground bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                {options.filters.map((filter, index) => (
                  <option key={index} value={filter.extensions.join(',')}>
                    {filter.name} ({filter.extensions.map(e => `*.${e}`).join(', ')})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1" />

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
            >
              {td('fileDialog.cancelButton')}
            </button>
            <button
              onClick={handleConfirm}
              disabled={options.mode === 'save' ? !fileName.trim() : selectedFiles.size === 0 && !activeFile}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
