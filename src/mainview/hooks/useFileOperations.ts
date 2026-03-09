import { useState, useCallback, useEffect, useRef } from 'react';
import { electrobun } from '@/lib/electrobun';

interface FileState {
  path: string | null;
  content: string;
  isDirty: boolean;
}

export function useFileOperations() {
  const [fileState, setFileState] = useState<FileState>({
    path: null,
    content: '',
    isDirty: false,
  });
  
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null);
  const fileStateRef = useRef(fileState);
  fileStateRef.current = fileState;

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
    setFileState(prev => ({
      ...prev,
      content: newContent,
      isDirty: prev.path !== null ? newContent !== prev.content : newContent.length > 0,
    }));
  }, []);

  // Open file (triggers native dialog)
  const handleOpen = useCallback(async () => {
    try {
      const result = await electrobun.openFile();
      if (result.success && result.content !== undefined) {
        setFileState({
          path: result.path || null,
          content: result.content,
          isDirty: false,
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
      const result = await electrobun.saveFile(state.content, state.path);
      if (result.success) {
        setFileState(prev => ({ ...prev, isDirty: false }));
        setSaveStatus('saved');
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
  }, []);

  // Save file as (with native dialog)
  const handleSaveAs = useCallback(async () => {
    const state = fileStateRef.current;
    
    setSaveStatus('saving');
    try {
      const result = await electrobun.saveFileAs(state.content);
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
