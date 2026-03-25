import { useState, useEffect, useCallback, useMemo } from 'react';
import { electrobun } from '../../lib/electrobun';
import type {
  FileItem,
  FileDialogOptions,
  OpenDialogResult,
  SaveDialogResult,
  SortField,
  SortOrder,
} from './FileDialog.types';
import { sortFiles, matchesFilter, getFileNameFromPath, getDirectoryFromPath, normalizeFileName, joinPaths } from './utils';

export interface UseFileDialogProps {
  options: FileDialogOptions;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: OpenDialogResult | SaveDialogResult) => void;
}

export interface SidebarItem {
  id: string;
  name: string;
  path: string;
  icon: React.ReactNode;
}

export function useFileDialog({ options, isOpen, onClose, onConfirm }: UseFileDialogProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarItems, setSidebarItems] = useState<SidebarItem[]>([]);
  const [fileName, setFileName] = useState('');
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Initialize default path and sidebar
  useEffect(() => {
    if (!isOpen) return;

    const init = async () => {
      // Get common paths for sidebar
      const result = await electrobun.getCommonPaths();
      if (result.success) {
        const paths = result.paths;
        setSidebarItems([
          { id: 'desktop', name: 'Desktop', path: paths.desktop, icon: null as unknown as React.ReactNode },
          { id: 'downloads', name: 'Downloads', path: paths.downloads, icon: null as unknown as React.ReactNode },
          { id: 'documents', name: 'Documents', path: paths.documents, icon: null as unknown as React.ReactNode },
          { id: 'pictures', name: 'Pictures', path: paths.pictures || paths.home, icon: null as unknown as React.ReactNode },
          { id: 'home', name: 'Home', path: paths.home, icon: null as unknown as React.ReactNode },
        ]);

        // Set initial path
        let initialPath = paths.home;
        if (options.defaultPath) {
          const stats = await electrobun.getFileStats({ path: options.defaultPath });
          if (stats.success) {
            if (stats.isDirectory) {
              initialPath = options.defaultPath;
            } else {
              initialPath = getDirectoryFromPath(options.defaultPath);
              setFileName(getFileNameFromPath(options.defaultPath));
            }
          }
        }
        setCurrentPath(initialPath);
      }
    };

    init();
  }, [isOpen, options.defaultPath]);

  // Load folder contents
  useEffect(() => {
    if (!isOpen || !currentPath) return;

    const loadFolder = async () => {
      const startTime = Date.now();
      setIsLoading(true);
      setError(null);

      try {
        const result = await electrobun.listFolder({ path: currentPath }) as { success: boolean; items?: Array<{ name: string; path: string; isDirectory: boolean }>; error?: string };

        // Add minimum delay to prevent flashing for very fast loads
        const elapsed = Date.now() - startTime;
        const minDelay = 150;
        if (elapsed < minDelay) {
          await new Promise(resolve => setTimeout(resolve, minDelay - elapsed));
        }

        if (result.success && result.items) {
          // Filter items first
          const visibleItems = result.items.filter(item => {
            return showHiddenFiles || !item.name.startsWith('.');
          });

          // Fetch stats in parallel for files
          const fileItems = await Promise.all(
            visibleItems.map(async (item) => {
              let size: number | undefined;
              let mtime: number | undefined;

              if (!item.isDirectory) {
                const stats = await electrobun.getFileStats({ path: item.path }) as { success: boolean; size?: number; mtime?: number; isDirectory?: boolean; error?: string };
                if (stats.success) {
                  size = stats.size;
                  mtime = stats.mtime;
                }
              }

              return {
                name: item.name,
                path: item.path,
                isDirectory: item.isDirectory,
                size,
                mtime,
              };
            })
          );

          setFiles(fileItems);
        } else {
          setError(result.error || 'Failed to load folder');
          setFiles([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadFolder();
  }, [isOpen, currentPath, showHiddenFiles, refreshCounter]);

  // Filter and sort files
  const filteredAndSortedFiles = useMemo(() => {
    let filtered = files;

    // Apply file filters in open mode
    if (options.mode === 'open' && options.filters && options.filters.length > 0) {
      const activeFilter = options.filters[0]; // Use first filter by default
      if (!activeFilter.extensions.includes('*')) {
        filtered = files.filter(f =>
          f.isDirectory || matchesFilter(f.name, activeFilter.extensions)
        );
      }
    }

    return sortFiles(filtered, sortField, sortOrder);
  }, [files, options.filters, options.mode, sortField, sortOrder]);

  // Handlers
  const handleNavigate = useCallback((path: string) => {
    setCurrentPath(path);
    setSelectedFiles(new Set());
    setActiveFile(null);
  }, []);

  const handleNavigateUp = useCallback(async () => {
    const result = await electrobun.getParentFolder({ path: currentPath }) as { success: boolean; path?: string; error?: string };
    if (result.success && result.path) {
      handleNavigate(result.path);
    }
  }, [currentPath, handleNavigate]);

  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortOrder(order => order === 'asc' ? 'desc' : 'asc');
        return prev;
      }
      setSortOrder('asc');
      return field;
    });
  }, []);

  const handleSelectFile = useCallback((file: FileItem, isMultiSelect: boolean) => {
    if (isMultiSelect && options.properties?.includes('multiSelections')) {
      setSelectedFiles(prev => {
        const next = new Set(prev);
        if (next.has(file.path)) {
          next.delete(file.path);
        } else {
          next.add(file.path);
        }
        return next;
      });
    } else {
      setSelectedFiles(new Set([file.path]));
      setActiveFile(file.path);
      if (!file.isDirectory && options.mode === 'save') {
        setFileName(file.name);
      }
    }
  }, [options.properties, options.mode]);

  const handleDoubleClick = useCallback((file: FileItem) => {
    if (file.isDirectory) {
      handleNavigate(file.path);
    } else {
      if (options.mode === 'open') {
        onConfirm({ canceled: false, filePaths: [file.path] });
      } else {
        setFileName(file.name);
      }
    }
  }, [handleNavigate, onConfirm, options.mode]);

  const handleConfirm = useCallback(async () => {
    if (options.mode === 'open') {
      const selected = selectedFiles.size > 0
        ? Array.from(selectedFiles).map(path => files.find(f => f.path === path)?.path).filter(Boolean) as string[]
        : activeFile
          ? [activeFile]
          : [];

      if (selected.length === 0) {
        return;
      }

      onConfirm({ canceled: false, filePaths: selected });
    } else {
      // Save mode
      if (!fileName.trim()) {
        return;
      }

      const normalizedName = normalizeFileName(
        fileName,
        options.filters?.[0]?.extensions[0] || 'md'
      );
      const fullPath = joinPaths(currentPath, normalizedName);

      // Check if file exists
      const exists = await electrobun.fileExists({ path: fullPath }) as { exists: boolean; isDirectory?: boolean };
      if (exists.exists && !exists.isDirectory) {
        // Show confirmation dialog
        const confirmed = await electrobun.showConfirmationDialog({
          title: 'File Already Exists',
          message: `"${normalizedName}" already exists.`,
          detail: 'Do you want to replace it?',
          confirmLabel: 'Replace',
          cancelLabel: 'Cancel',
        });
        if (!confirmed.confirmed) {
          return;
        }
      }

      onConfirm({ canceled: false, filePath: fullPath });
    }
  }, [options.mode, selectedFiles, activeFile, files, fileName, currentPath, options.filters, onConfirm]);

  const handleCreateFolder = useCallback(async (folderName: string) => {
    if (!folderName.trim()) return;

    const result = await electrobun.createFolder({ parentPath: currentPath, folderName: folderName.trim() }) as { success: boolean; path?: string; error?: string };
    if (result.success) {
      // Trigger refresh by incrementing counter
      setRefreshCounter(prev => prev + 1);
    }
    setIsCreatingFolder(false);
    setNewFolderName('');
  }, [currentPath]);

  const startCreateFolder = useCallback(() => {
    setIsCreatingFolder(true);
    setNewFolderName('New Folder');
  }, []);

  const cancelCreateFolder = useCallback(() => {
    setIsCreatingFolder(false);
    setNewFolderName('');
  }, []);

  return {
    currentPath,
    files: filteredAndSortedFiles,
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
    onClose,
  };
}
