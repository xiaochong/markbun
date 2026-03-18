/**
 * Clipboard hook for handling copy/cut operations with blob URL conversion
 *
 * This hook provides unified clipboard handling that:
 * 1. Gets selected text from the editor or window selection
 * 2. Converts blob URLs back to original paths when copying (preview mode only)
 * 3. Uses main process clipboard API for reliable clipboard access
 * 4. Processes markdown content including local images (preview mode only)
 *
 * In source mode, copy/paste is pure text without any transformation.
 */

import { useCallback, useRef } from 'react';
import { electrobun } from '@/lib/electrobun';
import { prepareForClipboard, processFromClipboard } from '@/lib/image';
import type { MilkdownEditorRef } from '@/components/editor';

export interface ClipboardOperations {
  /** Copy current selection to clipboard */
  copy: () => Promise<boolean>;
  /** Cut current selection to clipboard (copy + delete) */
  cut: () => Promise<boolean>;
  /** Paste from clipboard to editor */
  paste: () => Promise<boolean>;
  /** Check if there's an active selection */
  hasSelection: () => boolean;
}

/**
 * Gets the currently selected text from editor or window
 */
function getSelectedText(editorRef: React.RefObject<MilkdownEditorRef | null>, isSourceMode: boolean): string | null {
  // In source mode, use window selection directly (pure text)
  if (isSourceMode) {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      return selection.toString();
    }
    return null;
  }

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
function prepareTextForClipboard(text: string, isSourceMode: boolean): string {
  // In source mode, text is already in original form, no conversion needed
  if (isSourceMode) {
    return text;
  }
  return prepareForClipboard(text);
}

export function useClipboard(
  editorRef: React.RefObject<MilkdownEditorRef | null>,
  currentFilePath?: string | null,
  isSourceMode: boolean = false
): ClipboardOperations {
  // Use ref to avoid stale closure issues
  const editorRefStable = useRef(editorRef);
  editorRefStable.current = editorRef;
  const isSourceModeRef = useRef(isSourceMode);
  isSourceModeRef.current = isSourceMode;

  const copy = useCallback(async (): Promise<boolean> => {
    const selectedText = getSelectedText(editorRefStable.current, isSourceModeRef.current);
    if (!selectedText) return false;

    const textToCopy = prepareTextForClipboard(selectedText, isSourceModeRef.current);

    try {
      const result = await electrobun.writeToClipboard(textToCopy) as { success: boolean };
      return result.success;
    } catch (error) {
      console.error('Copy failed:', error);
      return false;
    }
  }, []);

  const cut = useCallback(async (): Promise<boolean> => {
    const selectedText = getSelectedText(editorRefStable.current, isSourceModeRef.current);
    if (!selectedText) return false;

    const textToCopy = prepareTextForClipboard(selectedText, isSourceModeRef.current);

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
    return getSelectedText(editorRefStable.current, isSourceModeRef.current) !== null;
  }, []);

  const paste = useCallback(async (): Promise<boolean> => {
    try {
      const result = await electrobun.readFromClipboard() as { success: boolean; text?: string; error?: string };

      if (result.success && result.text) {
        // In source mode, paste text as-is without processing using native clipboard
        if (isSourceModeRef.current) {
          document.execCommand('insertText', false, result.text);
          return true;
        }

        // In preview mode, process markdown content for local images
        const textToInsert = await processFromClipboard(result.text);

        // Insert text at current cursor position using Milkdown's API
        const editor = editorRefStable.current;
        if (editor?.current?.isReady) {
          editor.current.insertText(textToInsert);
          return true;
        } else {
          // Editor not ready, fallback to execCommand
          document.execCommand('insertText', false, textToInsert);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Paste failed:', error);
      return false;
    }
  }, []);

  return { copy, cut, paste, hasSelection };
}

// Re-export utility for non-hook usage
export { getSelectedText, prepareTextForClipboard };
