/**
 * Clipboard hook for handling copy/cut operations with blob URL conversion
 *
 * This hook provides unified clipboard handling that:
 * 1. Gets selected text from the editor or window selection
 * 2. Converts blob URLs back to original paths when copying
 * 3. Uses main process clipboard API for reliable clipboard access
 */

import { useCallback, useRef } from 'react';
import { electrobun } from '@/lib/electrobun';
import { restoreOriginalImagePaths } from '@/lib/imageProcessor';
import type { MilkdownEditorRef } from '@/components/editor';

export interface ClipboardOperations {
  /** Copy current selection to clipboard */
  copy: () => Promise<boolean>;
  /** Cut current selection to clipboard (copy + delete) */
  cut: () => Promise<boolean>;
  /** Check if there's an active selection */
  hasSelection: () => boolean;
}

/**
 * Gets the currently selected text from editor or window
 */
function getSelectedText(editorRef: React.RefObject<MilkdownEditorRef | null>): string | null {
  // Try editor selection first (more accurate for Milkdown)
  const editorSelection = editorRef.current?.getSelectedMarkdown?.();
  if (editorSelection) {
    return editorSelection;
  }

  // Fallback to window selection
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) {
    return selection.toString();
  }

  return null;
}

/**
 * Converts text with blob URLs to original paths if needed
 */
function prepareTextForClipboard(text: string): string {
  return text.includes('blob:http') ? restoreOriginalImagePaths(text) : text;
}

export function useClipboard(
  editorRef: React.RefObject<MilkdownEditorRef | null>
): ClipboardOperations {
  // Use ref to avoid stale closure issues
  const editorRefStable = useRef(editorRef);
  editorRefStable.current = editorRef;

  const copy = useCallback(async (): Promise<boolean> => {
    const selectedText = getSelectedText(editorRefStable.current);
    if (!selectedText) return false;

    const textToCopy = prepareTextForClipboard(selectedText);

    try {
      const result = await electrobun.writeToClipboard(textToCopy) as { success: boolean };
      return result.success;
    } catch (error) {
      console.error('Copy failed:', error);
      return false;
    }
  }, []);

  const cut = useCallback(async (): Promise<boolean> => {
    const selectedText = getSelectedText(editorRefStable.current);
    if (!selectedText) return false;

    const textToCopy = prepareTextForClipboard(selectedText);

    try {
      const result = await electrobun.writeToClipboard(textToCopy) as { success: boolean };
      if (result.success) {
        // Delete the selected content
        document.execCommand('delete');
      }
      return result.success;
    } catch (error) {
      console.error('Cut failed:', error);
      return false;
    }
  }, []);

  const hasSelection = useCallback((): boolean => {
    return getSelectedText(editorRefStable.current) !== null;
  }, []);

  return { copy, cut, hasSelection };
}

// Re-export utility for non-hook usage
export { getSelectedText, prepareTextForClipboard };
