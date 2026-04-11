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
 *
 * Image path convention:
 *   - read() returns original file paths (blob URLs restored)
 *   - edit/write accept original paths, convert to blob URLs for display
 */

import type { MilkdownEditorRef } from '../components/editor/types';
import {
  restoreOriginalImagePaths,
  processMarkdownImages,
  hasLocalImages,
} from './image';

export interface AIToolsCallbacks {
  onContentChanged?: (markdown: string) => void;
}

/**
 * Register the `window.__markbunAI` bridge.
 * Should be called once after the editor ref is available (useEffect in App).
 */
export function registerAITools(
  editorRef: React.RefObject<MilkdownEditorRef | null>,
  callbacks?: AIToolsCallbacks,
) {
  const { onContentChanged } = callbacks || {};

  (window as any).__markbunAI = {
    read: () => {
      const editor = editorRef.current;
      if (!editor) return { error: 'Editor not ready' };
      const markdown = editor.getMarkdown();
      return { content: restoreOriginalImagePaths(markdown) };
    },

    edit: async (args: { old_text: string; new_text: string }) => {
      const editor = editorRef.current;
      if (!editor) return { error: 'Editor not ready' };
      if (!args?.old_text || args.new_text === undefined || args.new_text === null) {
        return { error: 'old_text and new_text are required' };
      }

      // Restore original paths so old_text (from read output) can match
      const content = restoreOriginalImagePaths(editor.getMarkdown());
      if (!content.includes(args.old_text)) {
        return { error: `Text not found: "${args.old_text.substring(0, 80)}"` };
      }
      const replacements = content.split(args.old_text).length - 1;
      const newContent = content.split(args.old_text).join(args.new_text);

      // Convert local paths to blob URLs for editor display
      const contentToLoad = hasLocalImages(newContent)
        ? await processMarkdownImages(newContent)
        : newContent;
      editor.setMarkdown(contentToLoad, {
        onContentSet: () => {
          const newMarkdown = editor.getMarkdown();
          onContentChanged?.(newMarkdown);
        },
      });

      return { success: true, replacements };
    },

    write: async (args: { content: string }) => {
      const editor = editorRef.current;
      if (!editor) return { error: 'Editor not ready' };
      if (args?.content === undefined || args?.content === null) {
        return { error: 'content is required' };
      }
      const contentToLoad = hasLocalImages(args.content)
        ? await processMarkdownImages(args.content)
        : args.content;
      editor.setMarkdown(contentToLoad, {
        onContentSet: () => {
          const newMarkdown = editor.getMarkdown();
          onContentChanged?.(newMarkdown);
        },
      });

      return { success: true };
    },
  };
}
