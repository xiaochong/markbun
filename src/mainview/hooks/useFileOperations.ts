import { useState, useCallback, useEffect, useRef } from 'react';
import { electrobun } from '@/lib/electrobun';
import { restoreOriginalImagePaths } from '@/lib/image';
import { useAutoSave } from './useAutoSave';

interface FileState {
  path: string | null;
  content: string;
  isDirty: boolean;
}

interface UseFileOperationsOptions {
  enableAutoSave?: boolean;
  autoSaveInterval?: number;
}

export function useFileOperations(options: UseFileOperationsOptions = {}) {
  const { enableAutoSave = true, autoSaveInterval = 2000 } = options;

  const [fileState, setFileState] = useState<FileState>({
    path: null,
    content: '',
    isDirty: false,
  });

  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null);
  const fileStateRef = useRef(fileState);
  fileStateRef.current = fileState;

  // Auto-save callback
  const handleAutoSave = useCallback(async () => {
    const state = fileStateRef.current;
    if (!state.path || !state.isDirty) return;

    setSaveStatus('saving');
    try {
      const contentToSave = restoreOriginalImagePaths(state.content);
      const result = await electrobun.saveFile(contentToSave, state.path) as { success: boolean; error?: string };

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
    }
  }, []);

  // Setup auto-save
  const { triggerSave: triggerAutoSave } = useAutoSave({
    enabled: enableAutoSave && !!fileState.path,
    interval: autoSaveInterval,
    onSave: handleAutoSave,
    isDirty: fileState.isDirty,
  });

  // Listen for events from main process
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // File opened event (from menu)
    unsubscribers.push(
      electrobun.on('file-opened', (data) => {
        const { path, content } = data as { path: string; content: string };
        setFileState({
          path,
          content,
          isDirty: false,
        });
      })
    );

    // New file event (from menu)
    unsubscribers.push(
      electrobun.on('file-new', () => {
        setFileState({
          path: null,
          content: '',
          isDirty: false,
        });
      })
    );

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
  }, [enableAutoSave, triggerAutoSave]);

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

    if (!state.path) {
      await handleSaveAs();
      return;
    }

    setSaveStatus('saving');
    try {
      // Convert blob URLs back to original paths before saving
      const contentToSave = restoreOriginalImagePaths(state.content);
      const result = await electrobun.saveFile(contentToSave, state.path) as { success: boolean; path?: string; error?: string };

      if (result.success) {
        setFileState(prev => ({ ...prev, isDirty: false }));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(null), 2002);
      }
    } catch (error) {
      console.error('Failed to save file:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  }, []);

  // Save file as (with native dialog)
  const handleSaveAs = useCallback(async () => {
    const state = fileStateRef.current;

    setSaveStatus('saving');
    try {
      // Convert blob URLs back to original paths before saving
      const contentToSave = restoreOriginalImagePaths(state.content);
      const result = await electrobun.saveFileAs(contentToSave) as { success: boolean; path?: string; error?: string };

      if (result.success) {
        setFileState({
          path: result.path || null,
          content: state.content,
          isDirty: false,
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(null), 2000);
      }
    } catch (error) {
      console.error('Failed to save file as:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  }, []);

  return {
    ...fileState,
    saveStatus,
    updateContent,
    handleOpen,
    handleSave,
    handleSaveAs,
  };
}
