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
  isReady: boolean;
}

export function useSessionSave({
  filePath,
  editorRef,
  sourceEditorRef,
  sourceMode,
  expandedPaths,
  isReady,
}: UseSessionSaveOptions) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<{
    filePath: string | null;
    cursor: { line: number; column: number } | null;
    scrollTop: number;
    expandedPaths: string[];
    sourceMode: boolean;
  } | null>(null);

  // Keep latest values in refs to avoid stale closures
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;
  const sourceModeRef = useRef(sourceMode);
  sourceModeRef.current = sourceMode;
  const expandedPathsRef = useRef(expandedPaths);
  expandedPathsRef.current = expandedPaths;
  const isReadyRef = useRef(isReady);
  isReadyRef.current = isReady;

  const captureAndSave = useCallback(async () => {
    const currentFilePath = filePathRef.current;
    const currentSourceMode = sourceModeRef.current;
    const currentExpandedPaths = Array.from(expandedPathsRef.current);

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
      });
    } catch {
      // Silent failure — will retry on next interval
    }
  }, [editorRef, sourceEditorRef]);

  // Debounced save — captures current state and schedules write
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
    void captureAndSave();
  }, [captureAndSave]);

  // Save when file path changes
  useEffect(() => {
    saveNow();
  }, [filePath, saveNow]);

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
