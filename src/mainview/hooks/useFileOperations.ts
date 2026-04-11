import { useState, useCallback, useEffect, useRef } from 'react';
import { electrobun } from '@/lib/electrobun';
import { restoreOriginalImagePaths, getDirectoryPath } from '@/lib/image';
import { useAutoSave } from './useAutoSave';
import type { OpenDialogResult, SaveDialogResult } from '@/components/file-dialog/FileDialog.types';

interface FileState {
  path: string | null;
  content: string;
  isDirty: boolean;
}

interface UseFileOperationsOptions {
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
  onSaveSuccess?: (path: string) => void;
  backupEnabled?: boolean;
  recoveryInterval?: number; // ms between periodic recovery writes (default 30 000)
  getContent?: () => string; // Live content fetcher for save paths
}

interface FileDialogState {
  isOpen: boolean;
  mode: 'open' | 'save';
  defaultPath?: string;
  defaultFileName?: string;
}

export function useFileOperations(options: UseFileOperationsOptions = {}) {
  const {
    enableAutoSave = true,
    autoSaveInterval = 2000,
    onSaveSuccess,
    backupEnabled = true,
    recoveryInterval = 30000,
    getContent,
  } = options;

  // Use ref to store callback to avoid dependency issues
  const onSaveSuccessRef = useRef(onSaveSuccess);
  onSaveSuccessRef.current = onSaveSuccess;

  // Recovery write timer (separate from auto-save — always fires even if auto-save is off)
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupEnabledRef = useRef(backupEnabled);
  backupEnabledRef.current = backupEnabled;
  const getContentRef = useRef(getContent);
  getContentRef.current = getContent;

  const [fileState, setFileState] = useState<FileState>({
    path: null,
    content: '',
    isDirty: false,
  });

  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null);

  // Custom file dialog state (replaces save dialog)
  const [fileDialogState, setFileDialogState] = useState<FileDialogState>({
    isOpen: false,
    mode: 'save',
    defaultFileName: 'Untitled.md',
  });
  const fileStateRef = useRef(fileState);
  fileStateRef.current = fileState;

  // Track the file being saved to prevent saving to wrong file
  const savingFilePathRef = useRef<string | null>(null);

  // Schedule a debounced recovery write (max once per `recoveryInterval` ms)
  const scheduleRecoveryWrite = useCallback(() => {
    if (!backupEnabledRef.current) return;
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = setTimeout(() => {
      const state = fileStateRef.current;
      if (state.path && state.isDirty) {
        void electrobun.writeRecovery(state.content, state.path).catch(() => {
          // Recovery writes are best-effort; do not surface errors
        });
      }
    }, Math.min(recoveryInterval, 5000)); // debounce: fire after 5 s of inactivity, max once per interval
  }, [recoveryInterval]);

  // Cleanup recovery timer on unmount
  useEffect(() => {
    return () => {
      if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    };
  }, []);

  // Auto-save callback
  const handleAutoSave = useCallback(async () => {
    const state = fileStateRef.current;
    if (!state.path || !state.isDirty) return;

    // Record the file we're about to save
    const targetPath = state.path;
    savingFilePathRef.current = targetPath;

    setSaveStatus('saving');
    try {
      // Check again if the file has changed before saving
      if (fileStateRef.current.path !== targetPath) {
        setSaveStatus(null);
        return;
      }

      // Re-read latest content before actual save to avoid saving stale data
      // in case edits came in after this callback started.
      const latestState = fileStateRef.current;
      if (latestState.path !== targetPath) {
        setSaveStatus(null);
        return;
      }
      const contentToSave = restoreOriginalImagePaths(getContentRef.current?.() ?? latestState.content);

      const result = await electrobun.saveFile(contentToSave, targetPath) as { success: boolean; error?: string };

      // After save completes, verify we're still on the same file before updating state
      if (fileStateRef.current.path !== targetPath) {
        setSaveStatus(null);
        return;
      }

      if (result.success) {
        const savedContent = latestState.content;
        setFileState(prev => ({
          ...prev,
          isDirty: savedContent === fileStateRef.current.content ? false : true,
        }));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(null), 2000);
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2000);
    } finally {
      savingFilePathRef.current = null;
    }
  }, []);

  // Setup auto-save
  const { triggerSave: triggerAutoSave, cancelPendingSave } = useAutoSave({
    enabled: enableAutoSave && !!fileState.path,
    interval: autoSaveInterval,
    onSave: handleAutoSave,
    isDirty: fileState.isDirty,
  });

  // Update content
  const updateContent = useCallback((newContent: string) => {
    setFileState(prev => {
      // Only change isDirty when content actually changes.
      // If content is the same, keep the previous isDirty value.
      // This prevents spurious ProseMirror dispatches (e.g., normalization)
      // from resetting isDirty to false.
      const contentChanged = newContent !== prev.content;
      const isDirty = prev.path !== null
        ? (contentChanged ? true : prev.isDirty)
        : newContent.length > 0;
      return {
        ...prev,
        content: newContent,
        isDirty,
      };
    });

    // Trigger auto-save on content change
    if (enableAutoSave && fileStateRef.current.path) {
      triggerAutoSave();
    }

    // Schedule a recovery write (independent of auto-save, also covers auto-save=off)
    if (fileStateRef.current.path) {
      scheduleRecoveryWrite();
    }
  }, [enableAutoSave, triggerAutoSave, scheduleRecoveryWrite]);

  // Reset file state for file switching - clears dirty flag to prevent auto-save race
  const resetFileState = useCallback((newPath: string | null, newContent: string) => {
    setFileState({
      path: newPath,
      content: newContent,
      isDirty: false,
    });
  }, []);

  // Open save dialog
  const openSaveDialog = useCallback(() => {
    const state = fileStateRef.current;
    const defaultFileName = state.path
      ? state.path.split('/').pop() || 'Untitled.md'
      : 'Untitled.md';

    setFileDialogState({
      isOpen: true,
      mode: 'save',
      defaultFileName,
      defaultPath: state.path ? getDirectoryPath(state.path) : undefined,
    });
  }, []);

  // Save file (direct save to current path)
  const handleSave = useCallback(async () => {
    const state = fileStateRef.current;
    if (!state.path) {
      // No path set, open save dialog
      openSaveDialog();
      return;
    }

    setSaveStatus('saving');
    try {
      // Re-read latest state right before save to avoid race where
      // React hasn't flushed the pending state update yet (e.g. rapid edit + switch file).
      const latestState = fileStateRef.current;
      if (!latestState.path) {
        setSaveStatus(null);
        openSaveDialog();
        return;
      }

      const contentToSave = restoreOriginalImagePaths(getContentRef.current?.() ?? latestState.content);
      const result = await electrobun.saveFile(contentToSave, latestState.path) as { success: boolean; error?: string };

      if (result.success) {
        const savedContent = latestState.content;
        setFileState(prev => ({
          ...prev,
          isDirty: savedContent === fileStateRef.current.content ? false : true,
        }));
        setSaveStatus('saved');
        onSaveSuccessRef.current?.(latestState.path);
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(null), 2000);
      }
    } catch (error) {
      console.error('Save failed:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  }, [openSaveDialog]);

  // Open file using custom dialog
  const handleOpen = useCallback(async () => {
    setFileDialogState({
      isOpen: true,
      mode: 'open',
      defaultPath: fileStateRef.current.path || undefined,
    });
  }, []);

  // Save file as (opens custom dialog)
  const handleSaveAs = useCallback(async () => {
    openSaveDialog();
  }, [openSaveDialog]);

  // Listen for events from main process
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Save request event (from menu)
    unsubscribers.push(
      electrobun.on('file-save-request', () => {
        handleSave();
      })
    );

    // Save as request event (from menu)
    unsubscribers.push(
      electrobun.on('file-save-as-request', () => {
        handleSaveAs();
      })
    );

    // Open file request event (from menu)
    unsubscribers.push(
      electrobun.on('file-open-request', () => {
        handleOpen();
      })
    );

    // Toggle theme event
    unsubscribers.push(
      electrobun.on('toggle-theme', () => {
        document.documentElement.classList.toggle('dark');
      })
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [handleSave, handleSaveAs, handleOpen]);

  // Handle file selection from dialog
  const handleDialogConfirm = useCallback(async (result: OpenDialogResult | SaveDialogResult) => {
    if (result.canceled) {
      setFileDialogState(prev => ({ ...prev, isOpen: false }));
      return;
    }

    if (fileDialogState.mode === 'open') {
      // Open mode
      const openResult = result as OpenDialogResult;
      if (openResult.filePaths.length > 0) {
        const selectedPath = openResult.filePaths[0];
        if (fileStateRef.current.path) {
          // A file is already open in this window: open in a new window instead
          try {
            await electrobun.openFileInNewWindow({ path: selectedPath });
          } catch (error) {
            console.error('Failed to open file in new window:', error);
          }
        } else {
          try {
            const fileResult = await electrobun.readFile({ path: selectedPath }) as { success: boolean; path?: string; content?: string; error?: string };
            if (fileResult.success && fileResult.content !== undefined) {
              setFileState({
                path: fileResult.path || null,
                content: fileResult.content,
                isDirty: false,
              });

              // Emit event for App.tsx to update editor
              const listeners = (window as any).__electrobunListeners?.['file-opened'] || [];
              listeners.forEach((cb: (data: unknown) => void) => {
                cb({ path: fileResult.path, content: fileResult.content });
              });
            }
          } catch (error) {
            console.error('Failed to open file:', error);
          }
        }
      }
    } else {
      // Save mode
      const saveResult = result as SaveDialogResult;
      if (saveResult.filePath) {
        const state = fileStateRef.current;
        const contentToSave = restoreOriginalImagePaths(getContentRef.current?.() ?? state.content);

        setSaveStatus('saving');
        try {
          const result = await electrobun.saveFile(contentToSave, saveResult.filePath) as { success: boolean; path?: string; error?: string };
          if (result.success) {
            setFileState(prev => ({ ...prev, path: saveResult.filePath || null, isDirty: false }));
            setSaveStatus('saved');
            if (saveResult.filePath) {
              onSaveSuccessRef.current?.(saveResult.filePath);
            }
            setTimeout(() => setSaveStatus(null), 2000);
          } else {
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(null), 2000);
          }
        } catch (error) {
          console.error('Failed to save file:', error);
          setSaveStatus('error');
          setTimeout(() => setSaveStatus(null), 2000);
        }
      }
    }

    setFileDialogState(prev => ({ ...prev, isOpen: false }));
  }, [fileDialogState.mode]);

  // Close file dialog
  const closeFileDialog = useCallback(() => {
    setFileDialogState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Legacy function for compatibility
  const closeSaveDialog = useCallback(() => {
    closeFileDialog();
  }, [closeFileDialog]);

  // Legacy function for compatibility
  const handleSaveFromDialog = useCallback(async (folderPath: string, fileName: string) => {
    const fullPath = `${folderPath}/${fileName}`;
    await handleDialogConfirm({ canceled: false, filePath: fullPath });
  }, [handleDialogConfirm]);

  // Clear file state (for new file or open folder)
  const clearFile = useCallback(() => {
    setFileState({
      path: null,
      content: '',
      isDirty: false,
    });
  }, []);

  return {
    ...fileState,
    saveStatus,
    fileDialogState,
    saveDialogState: fileDialogState, // For backward compatibility
    updateContent,
    handleOpen,
    handleSave,
    handleSaveAs,
    closeFileDialog,
    closeSaveDialog, // For backward compatibility
    handleDialogConfirm,
    handleSaveFromDialog, // For backward compatibility
    cancelPendingSave,
    resetFileState,
    clearFile,
  };
}
