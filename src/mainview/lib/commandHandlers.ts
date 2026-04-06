// Renderer-side command handler registration.
// Creates a singleton dispatcher and provides a setup function that registers
// all command handlers with references to editor state and callbacks.

import { CommandDispatcher } from '../../shared/commandDispatch';

// Singleton dispatcher instance for the renderer process
export const dispatcher = new CommandDispatcher();

// Type for the handler setup context — all the refs and callbacks handlers need access to
export interface HandlerContext {
  // Editor refs
  editorRef: React.RefObject<any>;
  sourceEditorRef: React.RefObject<any>;
  sourceModeRef: React.RefObject<boolean>;

  // Clipboard
  writeToClipboard: (text: string) => Promise<unknown>;
  clipboardCut: () => void;
  clipboardCopy: () => void;
  clipboardPaste: (shiftKey: boolean) => void;

  // Export
  generateHTML: (content: string, filePath: string | null) => Promise<any>;
  generateImage: (content: string, filePath: string | null) => Promise<any>;

  // UI state callbacks
  setShowImageDialog: (show: boolean) => void;
  setSearchVisible: (visible: boolean) => void;
  setSearchShowReplace: (show: boolean) => void;
  setExportDialogState: (state: any) => void;
  setShowAIPanel: (updater: any) => void;

  // Content
  contentRef: React.RefObject<string>;
  filePath: string | null;
}

/**
 * Register all command handlers with the dispatcher.
 * Should be called once after component mount, with stable refs.
 * Last registration wins — re-calling replaces all handlers.
 */
export function setupRendererHandlers(ctx: HandlerContext): void {
  const { editorRef, sourceEditorRef, sourceModeRef } = ctx;

  // ── Format commands (renderer-only) ──────────────────────────────────────
  dispatcher.registerHandler('format-strong', () => editorRef.current?.toggleBold());
  dispatcher.registerHandler('format-emphasis', () => editorRef.current?.toggleItalic());
  dispatcher.registerHandler('format-code', () => editorRef.current?.toggleCode());
  dispatcher.registerHandler('format-strikethrough', () => editorRef.current?.toggleStrikethrough());
  dispatcher.registerHandler('format-highlight', () => editorRef.current?.toggleHighlight());
  dispatcher.registerHandler('format-superscript', () => editorRef.current?.toggleSuperscript());
  dispatcher.registerHandler('format-subscript', () => editorRef.current?.toggleSubscript());
  dispatcher.registerHandler('format-inline-math', () => editorRef.current?.insertInlineMath());
  dispatcher.registerHandler('format-link', () => editorRef.current?.toggleLink());
  dispatcher.registerHandler('format-image', () => ctx.setShowImageDialog(true));

  // ── Paragraph commands (renderer-only) ───────────────────────────────────
  dispatcher.registerHandler('para-heading-1', () => editorRef.current?.toggleHeading(1));
  dispatcher.registerHandler('para-heading-2', () => editorRef.current?.toggleHeading(2));
  dispatcher.registerHandler('para-heading-3', () => editorRef.current?.toggleHeading(3));
  dispatcher.registerHandler('para-heading-4', () => editorRef.current?.toggleHeading(4));
  dispatcher.registerHandler('para-heading-5', () => editorRef.current?.toggleHeading(5));
  dispatcher.registerHandler('para-heading-6', () => editorRef.current?.toggleHeading(6));
  dispatcher.registerHandler('para-paragraph', () => editorRef.current?.setParagraph());
  dispatcher.registerHandler('para-increase-heading', () => editorRef.current?.increaseHeadingLevel());
  dispatcher.registerHandler('para-decrease-heading', () => editorRef.current?.decreaseHeadingLevel());
  dispatcher.registerHandler('para-math-block', () => editorRef.current?.insertMathBlock());
  dispatcher.registerHandler('para-code-block', () => editorRef.current?.insertCodeBlock());
  dispatcher.registerHandler('para-quote', () => editorRef.current?.toggleQuote());
  dispatcher.registerHandler('para-ordered-list', () => editorRef.current?.toggleOrderedList());
  dispatcher.registerHandler('para-unordered-list', () => editorRef.current?.toggleList());
  dispatcher.registerHandler('para-task-list', () => editorRef.current?.insertTaskList());
  dispatcher.registerHandler('para-insert-above', () => editorRef.current?.insertParagraphAbove());
  dispatcher.registerHandler('para-insert-below', () => editorRef.current?.insertParagraphBelow());
  dispatcher.registerHandler('para-horizontal-rule', () => editorRef.current?.insertHorizontalRule());

  // ── Table commands (renderer-only) ───────────────────────────────────────
  dispatcher.registerHandler('table-insert', () => editorRef.current?.insertTable());
  dispatcher.registerHandler('table-insert-row-above', () => editorRef.current?.insertTableRowAbove());
  dispatcher.registerHandler('table-insert-row-below', () => editorRef.current?.insertTableRowBelow());
  dispatcher.registerHandler('table-insert-col-left', () => editorRef.current?.insertTableColumnLeft());
  dispatcher.registerHandler('table-insert-col-right', () => editorRef.current?.insertTableColumnRight());
  dispatcher.registerHandler('table-move-row-up', () => editorRef.current?.moveTableRowUp());
  dispatcher.registerHandler('table-move-row-down', () => editorRef.current?.moveTableRowDown());
  dispatcher.registerHandler('table-move-col-left', () => editorRef.current?.moveTableColumnLeft());
  dispatcher.registerHandler('table-move-col-right', () => editorRef.current?.moveTableColumnRight());
  dispatcher.registerHandler('table-delete-row', () => editorRef.current?.deleteTableRow());
  dispatcher.registerHandler('table-delete-col', () => editorRef.current?.deleteTableColumn());
  dispatcher.registerHandler('table-delete', () => editorRef.current?.deleteTable());
  dispatcher.registerHandler('table-copy-cell', async () => {
    const cellText = (window as any).__pendingTableCellText;
    if (cellText) {
      await ctx.writeToClipboard(cellText);
      (window as any).__pendingTableCellText = null;
    }
  });

  // ── Edit commands (renderer-only, with source mode branching) ─────────
  dispatcher.registerHandler('editor-undo', () => {
    if (sourceModeRef.current) {
      sourceEditorRef.current?.undo();
    } else {
      editorRef.current?.undo();
    }
  });
  dispatcher.registerHandler('editor-redo', () => {
    if (sourceModeRef.current) {
      sourceEditorRef.current?.redo();
    } else {
      editorRef.current?.redo();
    }
  });
  dispatcher.registerHandler('editor-cut', () => {
    if (sourceModeRef.current) {
      const selectedText = sourceEditorRef.current?.getSelectedText?.();
      if (selectedText) {
        sourceEditorRef.current?.insertText('');
        void ctx.writeToClipboard(selectedText);
      }
    } else {
      ctx.clipboardCut();
    }
  });
  dispatcher.registerHandler('editor-copy', async () => {
    if (sourceModeRef.current) {
      const selectedText = sourceEditorRef.current?.getSelectedText?.();
      if (selectedText) {
        await ctx.writeToClipboard(selectedText);
      }
    } else {
      ctx.clipboardCopy();
    }
  });
  dispatcher.registerHandler('editor-paste', () => {
    if (sourceModeRef.current) {
      sourceEditorRef.current?.focus();
    }
    ctx.clipboardPaste(false);
  });
  dispatcher.registerHandler('editor-select-all', () => {
    if (sourceModeRef.current) {
      sourceEditorRef.current?.focus();
      sourceEditorRef.current?.selectAll();
    } else {
      editorRef.current?.focus();
      document.execCommand('selectAll');
    }
  });

  // ── Search commands (renderer-only) ─────────────────────────────────────
  dispatcher.registerHandler('edit-find', () => {
    if (!sourceModeRef.current) {
      ctx.setSearchVisible(true);
      ctx.setSearchShowReplace(false);
    }
  });
  dispatcher.registerHandler('edit-find-and-replace', () => {
    if (!sourceModeRef.current) {
      ctx.setSearchVisible(true);
      ctx.setSearchShowReplace(true);
    }
  });

  // ── Export commands (renderer-only) ─────────────────────────────────────
  dispatcher.registerHandler('file-export-html', async () => {
    const result = await ctx.generateHTML(ctx.contentRef.current, ctx.filePath);
    if (result) {
      ctx.setExportDialogState({
        isOpen: true,
        mode: 'html',
        content: result.content,
        isBase64: result.isBase64,
        defaultName: result.defaultName,
        extension: result.extension,
      });
    }
  });
  dispatcher.registerHandler('file-export-image', async () => {
    const result = await ctx.generateImage(ctx.contentRef.current, ctx.filePath);
    if (result) {
      ctx.setExportDialogState({
        isOpen: true,
        mode: 'image',
        content: result.content,
        isBase64: result.isBase64,
        defaultName: result.defaultName,
        extension: result.extension,
      });
    }
  });

  // ── View commands (renderer-only) ──────────────────────────────────────
  dispatcher.registerHandler('toggle-ai-panel', () => {
    ctx.setShowAIPanel((prev: boolean) => !prev);
  });
}

/**
 * Convenience: execute a command action through the unified dispatcher.
 */
export function executeCommand(actionId: string): boolean {
  return dispatcher.execute(actionId);
}

/**
 * Convenience: check if a command can be executed.
 */
export function canExecuteCommand(actionId: string): boolean {
  return dispatcher.canExecute(actionId);
}
