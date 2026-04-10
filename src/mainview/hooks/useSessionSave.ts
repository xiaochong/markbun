/**
 * Session Save Hook — Periodically captures and persists session state
 *
 * Debounced save (2s) is primary mechanism. beforeunload flush is a safety net.
 * Only the active mode's cursor is captured.
 */

import { useEffect, useRef, useCallback } from 'react';
import { electrobun } from '@/lib/electrobun';
import type { MilkdownEditorRef } from '@/components/editor/types';
import type { SourceEditorRef } from '@/components/editor/SourceEditor';

interface UseSessionSaveOptions {
  filePath: string | null;
  editorRef: React.RefObject<MilkdownEditorRef | null>;
  sourceEditorRef: React.RefObject<SourceEditorRef | null>;
  sourceMode: boolean;
  expandedPaths: Set<string>;
  rootPath: string | null;
  isReady: boolean;
}

export function useSessionSave({
  filePath,
  editorRef,
  sourceEditorRef,
  sourceMode,
  expandedPaths,
  rootPath,
  isReady,
}: UseSessionSaveOptions) {
  // Keep latest values in refs to avoid stale closures
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;
  const sourceModeRef = useRef(sourceMode);
  sourceModeRef.current = sourceMode;
  const expandedPathsRef = useRef(expandedPaths);
  expandedPathsRef.current = expandedPaths;
  const rootPathRef = useRef(rootPath);
  rootPathRef.current = rootPath;
  const isReadyRef = useRef(isReady);
  isReadyRef.current = isReady;

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const captureAndSave = useCallback(async () => {
    const currentFilePath = filePathRef.current;
    // Don't save when no file is open — prevents overwriting previous session data
    if (!currentFilePath) return;

    const currentSourceMode = sourceModeRef.current;
    const currentExpandedPaths = Array.from(expandedPathsRef.current);
    const currentRootPath = rootPathRef.current;

    // Read cursor and scroll from active editor
    let cursor: { line: number; column: number } | null = null;
    let scrollTop = 0;

    if (isReadyRef.current) {
      if (currentSourceMode) {
        cursor = sourceEditorRef.current?.getCursor() ?? null;
        scrollTop = sourceEditorRef.current?.getScrollTop() ?? 0;
      } else {
        cursor = editorRef.current?.getCursor() ?? null;
        scrollTop = editorRef.current?.getScrollTop() ?? 0;
      }
    }

    try {
      await electrobun.saveSessionState({
        filePath: currentFilePath,
        cursor,
        scrollTop,
        expandedPaths: currentExpandedPaths,
        sourceMode: currentSourceMode,
        rootPath: currentRootPath,
      });
    } catch {
      // Silent failure — will retry on next trigger
    }
  }, [editorRef, sourceEditorRef]);

  // Debounced save — for content changes
  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      void captureAndSave();
    }, 2000);
  }, [captureAndSave]);

  // Immediate save for file path changes (open/close/new)
  const saveNow = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    void captureAndSave();
  }, [captureAndSave]);

  // Save when file path changes
  useEffect(() => {
    saveNow();
  }, [filePath, saveNow]);

  // Save when workspace root changes
  useEffect(() => {
    saveNow();
  }, [rootPath, saveNow]);

  // Flush on beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      void captureAndSave();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [captureAndSave]);

  return { scheduleSave };
}
