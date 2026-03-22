import { useState, useCallback, useEffect, useRef } from 'react';
import { electrobun } from '@/lib/electrobun';
import { restoreOriginalImagePaths, getDirectoryPath } from '@/lib/image';
import { useAutoSave } from './useAutoSave';

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
}

interface SaveDialogState {
  isOpen: boolean;
  defaultFileName: string;
  initialFolderPath?: string;
}

export function useFileOperations(options: UseFileOperationsOptions = {}) {
  const {
    enableAutoSave = true,
    autoSaveInterval = 2000,
    onSaveSuccess,
    backupEnabled = true,
    recoveryInterval = 30000,
  } = options;

  // Use ref to store callback to avoid dependency issues
  const onSaveSuccessRef = useRef(onSaveSuccess);
  onSaveSuccessRef.current = onSaveSuccess;

  // Recovery write timer (separate from auto-save — always fires even if auto-save is off)
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backupEnabledRef = useRef(backupEnabled);
  backupEnabledRef.current = backupEnabled;

  const [fileState, setFileState] = useState<FileState>({
    path: null,
    content: '',
    isDirty: false,
  });

  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null);

  // Custom save dialog state
  const [saveDialogState, setSaveDialogState] = useState<SaveDialogState>({
    isOpen: false,
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
    console.log('[AutoSave] Triggered for:', state.path, 'isDirty:', state.isDirty);
    if (!state.path || !state.isDirty) return;

    // Record the file we're about to save
    const targetPath = state.path;
    savingFilePathRef.current = targetPath;

    setSaveStatus('saving');
    try {
      // Check again if the file has changed before saving
      if (fileStateRef.current.path !== targetPath) {
        console.log('[AutoSave] Aborting save, file changed from', targetPath, 'to', fileStateRef.current.path);
        setSaveStatus(null);
        return;
      }

      const contentToSave = restoreOriginalImagePaths(state.content);

      // Double-check path before actual save operation
      if (fileStateRef.current.path !== targetPath) {
        console.log('[AutoSave] Aborting save before write, file changed from', targetPath, 'to', fileStateRef.current.path);
        setSaveStatus(null);
        return;
      }

      const result = await electrobun.saveFile(contentToSave, targetPath) as { success: boolean; error?: string };

      // After save completes, verify we're still on the same file before updating state
      if (fileStateRef.current.path !== targetPath) {
        console.log('[AutoSave] File changed during save, ignoring result for:', targetPath);
        setSaveStatus(null);
        return;
      }

      if (result.success) {
        setFileState(prev => ({ ...prev, isDirty: false }));
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

    // Toggle theme event
    unsubscribers.push(
      electrobun.on('toggle-theme', () => {
        document.documentElement.classList.toggle('dark');
      })
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  // Update content
  const updateContent = useCallback((newContent: string) => {
    setFileState(prev => {
      const isDirty = prev.path !== null ? newContent !== prev.content : newContent.length > 0;
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
    console.log('[FileOperations] Resetting file state:', { path: newPath, contentLength: newContent.length });
    setFileState({
      path: newPath,
      content: newContent,
      isDirty: false,
    });
  }, []);

  // Open file (triggers native dialog)
  const handleOpen = useCallback(async () => {
    try {
      const result = await electrobun.openFile() as { success: boolean; path?: string; content?: string; error?: string };

      if (!result) {
        console.error('openFile returned null/undefined');
        return;
      }

      if (result.success && result.content !== undefined) {
        setFileState({
          path: result.path || null,
          content: result.content,
          isDirty: false,
        });

        // Emit event for App.tsx to update editor
        const listeners = (window as any).__electrobunListeners?.['file-opened'] || [];
        listeners.forEach((cb: (data: unknown) => void) => {
          cb({ path: result.path, content: result.content });
        });
      }
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }, []);

  // Save file
  const handleSave = useCallback(async () => {
    const state = fileStateRef.current;

    console.log('[Save] Attempting to save:', {
      path: state.path,
      contentLength: state.content.length,
      isDirty: state.isDirty,
    });

    if (!state.path) {
      await handleSaveAs();
      return;
    }

    if (!state.isDirty) {
      console.log('[Save] File not dirty, skipping save:', state.path);
      return;
    }

    // Record the file we're about to save
    const targetPath = state.path;
    savingFilePathRef.current = targetPath;

    setSaveStatus('saving');
    try {
      // Check again if the file has changed before saving
      if (fileStateRef.current.path !== targetPath) {
        console.log('[Save] Aborting save, file changed from', targetPath, 'to', fileStateRef.current.path);
        setSaveStatus(null);
        return;
      }

      // Convert blob URLs back to original paths before saving
      const contentToSave = restoreOriginalImagePaths(state.content);
      console.log('[Save] Saving content to:', targetPath, 'Content length:', contentToSave.length);

      // Double-check path before actual save operation
      if (fileStateRef.current.path !== targetPath) {
        console.log('[Save] Aborting save before write, file changed from', targetPath, 'to', fileStateRef.current.path);
        setSaveStatus(null);
        return;
      }

      const result = await electrobun.saveFile(contentToSave, targetPath) as { success: boolean; path?: string; error?: string };

      // After save completes, verify we're still on the same file before updating state
      if (fileStateRef.current.path !== targetPath) {
        console.log('[Save] File changed during save, ignoring result for:', targetPath);
        setSaveStatus(null);
        return;
      }

      if (result.success) {
        setFileState(prev => ({ ...prev, isDirty: false }));
        setSaveStatus('saved');
        console.log('[Save] Save successful:', targetPath);
        onSaveSuccessRef.current?.(targetPath);
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus('error');
        console.error('[Save] Save failed:', targetPath, result.error);
        setTimeout(() => setSaveStatus(null), 2002);
      }
    } catch (error) {
      console.error('[Save] Failed to save file:', targetPath, error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2000);
    } finally {
      savingFilePathRef.current = null;
    }
  }, []);

  // Open custom save dialog
  const openSaveDialog = useCallback(() => {
    const state = fileStateRef.current;
    const defaultFileName = state.path
      ? state.path.split('/').pop() || 'Untitled.md'
      : 'Untitled.md';

    setSaveDialogState({
      isOpen: true,
      defaultFileName,
      initialFolderPath: state.path ? getDirectoryPath(state.path) : undefined,
    });
  }, []);

  // Close save dialog
  const closeSaveDialog = useCallback(() => {
    setSaveDialogState(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Handle save from custom dialog
  const handleSaveFromDialog = useCallback(async (folderPath: string, fileName: string) => {
    const state = fileStateRef.current;
    const contentToSave = restoreOriginalImagePaths(state.content);

    // Construct full file path
    const fullPath = `${folderPath}/${fileName}`;

    // Check if file already exists
    const existsResult = await electrobun.fileExists({ path: fullPath }) as { exists: boolean; isDirectory?: boolean };

    if (existsResult.exists && !existsResult.isDirectory) {
      // File exists, show confirmation dialog
      const confirmResult = await electrobun.showConfirmationDialog({
        title: 'File Already Exists',
        message: `"${fileName}" already exists in this location.`,
        detail: 'Do you want to replace it with the new file?',
        confirmLabel: 'Replace',
        cancelLabel: 'Cancel',
      }) as { confirmed: boolean };

      if (!confirmResult.confirmed) {
        // User cancelled, don't save
        return;
      }
    }

    setSaveStatus('saving');
    try {
      const result = await electrobun.saveFileWithPath({
        content: contentToSave,
        folderPath,
        fileName,
      }) as { success: boolean; fullPath?: string; error?: string };

      if (result.success) {
        const savedPath = result.fullPath || null;
        setFileState({
          path: savedPath,
          content: state.content,
          isDirty: false,
        });
        setSaveStatus('saved');
        if (savedPath) {
          onSaveSuccessRef.current?.(savedPath);
        }
        setTimeout(() => setSaveStatus(null), 2000);
        // Close dialog after successful save
        closeSaveDialog();
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(null), 2000);
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  }, [closeSaveDialog]);

  // Save file as (opens custom dialog)
  const handleSaveAs = useCallback(async () => {
    openSaveDialog();
  }, [openSaveDialog]);

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
    saveDialogState,
    updateContent,
    handleOpen,
    handleSave,
    handleSaveAs,
    closeSaveDialog,
    handleSaveFromDialog,
    cancelPendingSave,
    resetFileState,
    clearFile,
  };
}
