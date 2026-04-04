/**
 * Clipboard hook for handling copy/cut/paste operations
 *
 * Copy/Cut: Triggered via menu actions → document.execCommand('copy'/'cut')
 *   ProseMirror handles the native clipboard events, writing both text/html and text/plain.
 *   clipboardTextSerializer (clipboardBlobConverter) produces clean markdown with blob URLs
 *   resolved and frontmatter converted.
 *
 * Paste: Triggered via menu action (Cmd+V) or keyboard handler (Cmd+Shift+V).
 *   Reads clipboard via IPC (paste events don't fire in Electrobun WebView).
 *   Smart paste: HTML → turndown → markdown, with self-copy detection.
 *
 * In source mode, copy/paste is pure text without any transformation.
 */

import { useCallback, useRef } from 'react';
import { electrobun } from '@/lib/electrobun';
import { processFromClipboard, loadLocalImage, workspaceManager } from '@/lib/image';
import { convertFrontmatterToCodeBlock } from '@/lib/frontmatter';
import { turndownService } from '@/lib/turndown';
import type { MilkdownEditorRef } from '@/components/editor';

export interface ClipboardOperations {
  /** Copy current selection to clipboard */
  copy: () => Promise<boolean>;
  /** Cut current selection to clipboard (copy + delete) */
  cut: () => Promise<boolean>;
  /** Paste from clipboard to editor. plainText=true for Cmd+Shift+V */
  paste: (plainText?: boolean) => Promise<boolean>;
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
  // blob URL conversion is now handled by clipboardBlobConverter plugin
  return text;
}

/**
 * Check if text looks like markdown serialized by our clipboardTextSerializer.
 * When both HTML and text are available, prefer text for self-copies to avoid
 * lossy HTML→markdown round-trips.
 */
function looksLikeMarkdown(text: string): boolean {
  const patterns = [
    /^#{1,6}\s/m,        // Headers
    /^---\s*\n/m,         // Frontmatter or horizontal rule
    /^[-*+]\s/m,          // Unordered lists
    /^>\s/m,              // Blockquotes
    /^\d+\.\s/m,          // Ordered lists
    /!\[.*?\]\(.*?\)/m,   // Images
    /\[.*?\]\(.*?\)/m,    // Links
  ];
  return patterns.some(p => p.test(text));
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

  const paste = useCallback(async (plainText?: boolean): Promise<boolean> => {
    try {
      const result = await electrobun.readFromClipboard({
        html: !plainText,
        image: !plainText,
      }) as {
        success: boolean;
        text?: string;
        html?: string;
        imageData?: string;
        imageFormat?: string;
        error?: string;
      };

      if (!result.success) return false;

      // Image paste: check image data before HTML/text
      if (result.imageData) {
        const root = workspaceManager.getWorkspaceRoot();
        if (!root) {
          console.error('[Clipboard] No workspace root, cannot save pasted image');
          return false;
        }

        const filename = `clipboard-${Date.now()}.png`;
        try {
          const saveResult = await electrobun.saveDroppedImage(
            filename,
            result.imageData,
            root
          ) as {
            success: boolean;
            relativePath?: string;
            absolutePath?: string;
            error?: string;
          };

          if (!saveResult.success || !saveResult.relativePath || !saveResult.absolutePath) {
            console.error('[Clipboard] Failed to save pasted image:', saveResult.error);
            return false;
          }

          const blobUrl = await loadLocalImage(saveResult.absolutePath);
          if (!blobUrl) {
            console.error('[Clipboard] Failed to load saved image');
            return false;
          }

          const imageMarkdown = `\n![](${blobUrl})\n`;
          const editor = editorRefStable.current;
          if (editor?.current?.insertMarkdown) {
            return editor.current.insertMarkdown(imageMarkdown);
          }
          document.execCommand('insertText', false, imageMarkdown);
          return true;
        } catch (error) {
          console.error('[Clipboard] Image paste failed:', error);
          return false;
        }
      }

      // Source mode: paste as plain text via execCommand
      if (isSourceModeRef.current) {
        if (result.text) {
          document.execCommand('insertText', false, result.text);
          return true;
        }
        return false;
      }

      // Plain text paste (Cmd+Shift+V)
      if (plainText) {
        if (result.text) {
          const editor = editorRefStable.current;
          if (editor?.current?.isReady) {
            editor.current.insertText(result.text);
            return true;
          }
          document.execCommand('insertText', false, result.text);
          return true;
        }
        return false;
      }

      // Smart paste: prefer text/plain if it looks like self-copy markdown
      if (result.text && result.html && looksLikeMarkdown(result.text)) {
        // Self-copy: use text/plain directly (already clean markdown)
        const processed = await processFromClipboard(result.text);
        const forEditor = convertFrontmatterToCodeBlock(processed);
        const editor = editorRefStable.current;
        if (editor?.current?.insertMarkdown) {
          return editor.current.insertMarkdown(forEditor);
        }
        if (editor?.current?.isReady) {
          editor.current.insertText(forEditor);
          return true;
        }
        document.execCommand('insertText', false, forEditor);
        return true;
      }

      // HTML paste: convert via turndown
      if (result.html) {
        const markdown = turndownService.turndown(result.html);
        const processed = await processFromClipboard(markdown);
        const forEditor = convertFrontmatterToCodeBlock(processed);
        const editor = editorRefStable.current;
        if (editor?.current?.insertMarkdown) {
          return editor.current.insertMarkdown(forEditor);
        }
        if (editor?.current?.isReady) {
          editor.current.insertText(forEditor);
          return true;
        }
        document.execCommand('insertText', false, forEditor);
        return true;
      }

      // Text-only paste: process and insert as markdown
      if (result.text) {
        const processed = await processFromClipboard(result.text);
        const forEditor = convertFrontmatterToCodeBlock(processed);
        const editor = editorRefStable.current;
        if (editor?.current?.insertMarkdown) {
          return editor.current.insertMarkdown(forEditor);
        }
        if (editor?.current?.isReady) {
          editor.current.insertText(forEditor);
          return true;
        }
        document.execCommand('insertText', false, forEditor);
        return true;
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
