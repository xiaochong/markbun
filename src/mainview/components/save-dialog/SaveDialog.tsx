import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { electrobun } from '@/lib/electrobun';

interface SaveDialogProps {
  isOpen: boolean;
  initialFolderPath?: string;
  defaultFileName?: string;
  onClose: () => void;
  onSave: (folderPath: string, fileName: string) => void;
}

interface FolderItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

export function SaveDialog({
  isOpen,
  initialFolderPath,
  defaultFileName = 'Untitled.md',
  onClose,
  onSave,
}: SaveDialogProps) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FolderItem[]>([]);
  const [fileName, setFileName] = useState(defaultFileName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize path when dialog opens
  useEffect(() => {
    if (isOpen) {
      const initPath = async () => {
        if (initialFolderPath) {
          setCurrentPath(initialFolderPath);
        } else {
          try {
            const result = await electrobun.getDesktopPath() as { success: boolean; path?: string };
            setCurrentPath(result.success && result.path ? result.path : '/Users');
          } catch {
            setCurrentPath('/Users');
          }
        }
      };
      void initPath();
      setFileName(defaultFileName);
      setError(null);
    }
  }, [isOpen, initialFolderPath, defaultFileName]);

  // Load folder contents
  useEffect(() => {
    if (!isOpen || !currentPath) return;

    const loadFolder = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await electrobun.listFolder({ path: currentPath }) as {
          success: boolean;
          items?: FolderItem[];
          error?: string;
        };
        if (result.success && result.items) {
          // Only show directories
          setItems(result.items.filter(item => item.isDirectory));
        } else {
          setError(result.error || 'Failed to load folder');
          setItems([]);
        }
      } catch (err) {
        setError('Failed to load folder contents');
        setItems([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadFolder();
  }, [isOpen, currentPath]);

  // Focus filename input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen]);

  const handleNavigateUp = useCallback(async () => {
    try {
      const result = await electrobun.getParentFolder({ path: currentPath }) as {
        success: boolean;
        path?: string;
        error?: string;
      };
      if (result.success && result.path) {
        setCurrentPath(result.path);
      }
    } catch (err) {
      console.error('Failed to navigate up:', err);
    }
  }, [currentPath]);

  const handleNavigateTo = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

  const handleSave = useCallback(() => {
    if (!fileName.trim()) {
      setError('Please enter a file name');
      return;
    }

    // Ensure .md extension
    let finalFileName = fileName.trim();
    if (!finalFileName.endsWith('.md')) {
      finalFileName += '.md';
    }

    onSave(currentPath, finalFileName);
  }, [fileName, currentPath, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.metaKey) {
      handleSave();
    }
  }, [onClose, handleSave]);

  // Parse path for breadcrumb
  const pathParts = currentPath.split('/').filter(Boolean);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-col w-[560px] h-[480px] bg-background rounded-xl shadow-2xl overflow-hidden border">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <h2 className="font-semibold text-sm">Save File</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/20 text-sm">
          <button
            onClick={handleNavigateUp}
            disabled={pathParts.length <= 1}
            className={cn(
              'p-1.5 rounded-md transition-colors',
              pathParts.length > 1
                ? 'hover:bg-muted text-foreground'
                : 'text-muted-foreground cursor-not-allowed'
            )}
            title="Go to parent folder"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
          <span className="text-muted-foreground">/</span>
          <div className="flex items-center gap-1 overflow-hidden">
            {pathParts.slice(-3).map((part, index, arr) => {
              const isLast = index === arr.length - 1;
              return (
                <span key={index} className="flex items-center gap-1">
                  <span
                    className={cn(
                      'truncate max-w-[100px]',
                      isLast ? 'text-foreground font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {part}
                  </span>
                  {!isLast && <span className="text-muted-foreground">/</span>}
                </span>
              );
            })}
          </div>
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="animate-spin mr-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              Loading...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <svg className="w-12 h-12 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-sm">No folders in this directory</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigateTo(item.path)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted/80 transition-colors text-left group"
                >
                  <svg
                    className="w-5 h-5 text-amber-500 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  <span className="truncate flex-1">{item.name}</span>
                  <svg
                    className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-4 py-2 bg-red-50 dark:bg-red-950/30 border-y border-red-100 dark:border-red-900">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 space-y-3">
          {/* Filename Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              File Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={fileName}
              onChange={(e) => {
                setFileName(e.target.value);
                setError(null);
              }}
              placeholder="Enter file name..."
              className="w-full px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!fileName.trim()}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                fileName.trim()
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
