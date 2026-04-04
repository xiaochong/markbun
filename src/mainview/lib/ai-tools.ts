/**
 * AI Tool Calls - Editor Integration
 *
 * Registers `window.__markbunAI` with 3 atomic tools:
 *  - read()          → { content } | { error }
 *  - edit(old_text, new_text) → { success, replacements } | { error }
 *  - write(content)  → { success } | { error }
 *
 * All operations work on raw markdown text via getMarkdown/setMarkdown,
 * no dependency on editor focus, cursor position, or selection state.
 */

import type { MilkdownEditorRef } from '../components/editor/types';

/**
 * Register the `window.__markbunAI` bridge.
 * Should be called once after the editor ref is available (useEffect in App).
 */
export function registerAITools(editorRef: React.RefObject<MilkdownEditorRef | null>) {
  (window as any).__markbunAI = {
    read: () => {
      const editor = editorRef.current;
      if (!editor) return { error: 'Editor not ready' };
      return { content: editor.getMarkdown() };
    },

    edit: (args: { old_text: string; new_text: string }) => {
      const editor = editorRef.current;
      if (!editor) return { error: 'Editor not ready' };
      if (!args?.old_text || args.new_text === undefined || args.new_text === null) {
        return { error: 'old_text and new_text are required' };
      }
      const content = editor.getMarkdown();
      if (!content.includes(args.old_text)) {
        return { error: `Text not found: "${args.old_text.substring(0, 80)}"` };
      }
      const replacements = content.split(args.old_text).length - 1;
      const newContent = content.split(args.old_text).join(args.new_text);
      editor.setMarkdown(newContent);
      return { success: true, replacements };
    },

    write: (args: { content: string }) => {
      const editor = editorRef.current;
      if (!editor) return { error: 'Editor not ready' };
      if (args?.content === undefined || args?.content === null) {
        return { error: 'content is required' };
      }
      editor.setMarkdown(args.content);
      return { success: true };
    },
  };
}
