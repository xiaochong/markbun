/**
 * AI Tool Calls - Editor Integration
 *
 * Registers `window.__markbunAI` with tool functions that the Bun main process
 * calls via RPC during AI streaming.
 *
 * Tools:
 *  - readDocument()  -> { content: string }
 *  - readSelection() -> { selection: string } | { error: string }
 *  - insertAtCursor(text)  -> { success: true } | { error: string }
 *  - replaceSelection(text) -> { success: true } | { error: string }
 *  - replaceInDocument(oldText, newText) -> { success: true, replacements } | { error: string }
 */

import type { MilkdownEditorRef } from '../components/editor/types';

/**
 * Register the `window.__markbunAI` bridge.
 * Should be called once after the editor ref is available (useEffect in App).
 */
export function registerAITools(editorRef: React.RefObject<MilkdownEditorRef | null>) {
  (window as any).__markbunAI = {
    readDocument: () => {
      const editor = editorRef.current;
      if (!editor) return { error: 'Editor not ready' };
      const markdown = editor.getMarkdown();
      return { content: markdown };
    },

    readSelection: () => {
      const editor = editorRef.current;
      if (!editor) return { error: 'Editor not ready' };
      const selection = editor.getSelectedMarkdown();
      if (!selection) return { error: 'No text selected' };
      return { selection };
    },

    insertAtCursor: (args: { text: string }) => {
      const editor = editorRef.current;
      if (!editor) return { error: 'Editor not ready' };
      const text = typeof args === 'string' ? args : args?.text;
      if (!text) return { error: 'text is required' };
      // When AI panel is open, editor likely has no focus.
      // Use setMarkdown directly to ensure content is written reliably.
      const content = editor.getMarkdown();
      const separator = content.endsWith('\n') ? '' : '\n';
      editor.setMarkdown(content + separator + text);
      return { success: true, appended: true };
    },

    replaceSelection: (args: { text: string }) => {
      const editor = editorRef.current;
      if (!editor) return { error: 'Editor not ready' };
      const text = typeof args === 'string' ? args : args?.text;
      if (!text) return { error: 'text is required' };
      // Verify there is a selection to replace
      if (!editor.hasSelection()) return { error: 'No text selected' };
      const ok = editor.insertText(text);
      if (!ok) return { error: 'Replace failed' };
      return { success: true };
    },

    replaceInDocument: (args: { oldText: string; newText: string }) => {
      const editor = editorRef.current;
      if (!editor) return { error: 'Editor not ready' };
      if (!args?.oldText || args.newText === undefined || args.newText === null) {
        return { error: 'oldText and newText are required' };
      }
      const content = editor.getMarkdown();
      if (!content.includes(args.oldText)) {
        return { error: `Text not found in document: "${args.oldText.substring(0, 50)}"` };
      }
      const newContent = content.split(args.oldText).join(args.newText);
      const replacements = content.split(args.oldText).length - 1;
      editor.setMarkdown(newContent);
      return { success: true, replacements };
    },
  };
}
