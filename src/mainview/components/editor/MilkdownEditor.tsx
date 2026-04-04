import { forwardRef, useImperativeHandle, useState, useCallback, memo } from 'react';
import { Milkdown } from '@milkdown/react';
import { editorViewCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/prose/state';
import type { MilkdownEditorProps, MilkdownEditorRef } from './types';
import { useCrepeEditor, useThemeLoader, useContextMenu } from './hooks';
import { hasSelection, execCommand } from './utils/editorActions';
import { undoCommand, redoCommand } from '@milkdown/plugin-history';
import * as formatting from './commands/formatting';
import * as paragraph from './commands/paragraph';
import * as table from './commands/table';
import * as textCommands from './commands/text';

// Import Crepe base styles (always needed)
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/common/link-tooltip.css';

export const MilkdownEditor = memo(forwardRef<MilkdownEditorRef, MilkdownEditorProps>(
  ({ defaultValue = '', onChange, className = '', darkMode = false }, ref) => {
    const [isReady, setIsReady] = useState(false);

    // Editor core hook
    const {
      crepeRef,
      containerRef,
      loading,
      getMarkdown,
      setMarkdown,
      focus,
      getSelectedMarkdown,
    } = useCrepeEditor(defaultValue, onChange, setIsReady, darkMode);

    // Theme loading hook
    useThemeLoader(darkMode);

    // Context menu hook
    useContextMenu(crepeRef, containerRef);

    // Helper to wrap commands with crepeRef
    const wrapCommand = useCallback(
      <T extends unknown[]>(fn: (ref: typeof crepeRef, ...args: T) => boolean) => {
        return (...args: T) => fn(crepeRef, ...args);
      },
      [crepeRef]
    );

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      getMarkdown,
      setMarkdown,
      focus,
      getSelectedMarkdown,
      isReady: isReady && !loading,

      // Formatting commands
      toggleBold: () => formatting.toggleBold(crepeRef),
      toggleItalic: () => formatting.toggleItalic(crepeRef),
      toggleHeading: (level: number) => formatting.toggleHeading(crepeRef, level),
      toggleQuote: () => formatting.toggleQuote(crepeRef),
      toggleCode: () => formatting.toggleCode(crepeRef),
      toggleLink: () => formatting.toggleLink(crepeRef),
      toggleList: () => formatting.toggleList(crepeRef),
      toggleOrderedList: () => formatting.toggleOrderedList(crepeRef),
      // Extended formatting commands (GFM)
      toggleStrikethrough: () => formatting.toggleStrikethrough(crepeRef),
      toggleHighlight: () => formatting.toggleHighlight(crepeRef),
      toggleSuperscript: () => formatting.toggleSuperscript(crepeRef),
      toggleSubscript: () => formatting.toggleSubscript(crepeRef),
      insertInlineMath: () => formatting.insertInlineMath(crepeRef),

      // Paragraph menu commands
      setParagraph: () => paragraph.setParagraph(crepeRef),
      increaseHeadingLevel: () => paragraph.increaseHeadingLevel(crepeRef),
      decreaseHeadingLevel: () => paragraph.decreaseHeadingLevel(crepeRef),
      insertTable: () => paragraph.insertTable(crepeRef),
      insertMathBlock: () => paragraph.insertMathBlock(crepeRef),
      insertCodeBlock: () => paragraph.insertCodeBlock(crepeRef),
      insertMermaidBlock: () => paragraph.insertMermaidBlock(crepeRef),
      insertTaskList: () => paragraph.insertTaskList(crepeRef),
      insertHorizontalRule: () => paragraph.insertHorizontalRule(crepeRef),
      insertParagraphAbove: () => paragraph.insertParagraphAbove(crepeRef),
      insertParagraphBelow: () => paragraph.insertParagraphBelow(crepeRef),

      // Table operations
      insertTableRowAbove: () => table.insertTableRowAbove(crepeRef),
      insertTableRowBelow: () => table.insertTableRowBelow(crepeRef),
      insertTableColumnLeft: () => table.insertTableColumnLeft(crepeRef),
      insertTableColumnRight: () => table.insertTableColumnRight(crepeRef),
      moveTableRowUp: () => table.moveTableRowUp(crepeRef),
      moveTableRowDown: () => table.moveTableRowDown(crepeRef),
      moveTableColumnLeft: () => table.moveTableColumnLeft(crepeRef),
      moveTableColumnRight: () => table.moveTableColumnRight(crepeRef),
      deleteTableRow: () => table.deleteTableRow(crepeRef),
      deleteTableColumn: () => table.deleteTableColumn(crepeRef),
      deleteTable: () => table.deleteTable(crepeRef),

      // History
      undo: () => execCommand(crepeRef, undoCommand),
      redo: () => execCommand(crepeRef, redoCommand),

      // Selection
      hasSelection: () => hasSelection(crepeRef),

      // Insert image
      insertImage: (src: string, alt?: string, title?: string) =>
        formatting.insertImage(crepeRef, src, alt, title),

      // Insert text
      insertText: (text: string) => textCommands.insertText(crepeRef, text),

      // Search integration — expose EditorView
      getEditorView: () => {
        const editor = crepeRef.current?.editor;
        if (!editor?.ctx) return null;
        try {
          return editor.ctx.get(editorViewCtx);
        } catch {
          return null;
        }
      },

      // Cursor position (line:column)
      getCursor: () => {
        const editor = crepeRef.current?.editor;
        if (!editor?.ctx) return null;
        try {
          const view = editor.ctx.get(editorViewCtx);
          const pos = view.state.selection.from;
          const textBefore = view.state.doc.textBetween(0, pos, '\n');
          const lines = textBefore.split('\n');
          return { line: lines.length, column: lines[lines.length - 1].length + 1 };
        } catch {
          return null;
        }
      },
      setCursor: (line: number, column: number) => {
        const editor = crepeRef.current?.editor;
        if (!editor?.ctx) return;
        try {
          const view = editor.ctx.get(editorViewCtx);
          const doc = view.state.doc;
          // Resolve line:column to ProseMirror offset
          let currentLine = 1;
          let offset = 0;
          doc.descendants((node, nodePos) => {
            if (currentLine >= line) return false;
            if (node.isText) {
              const text = node.text!;
              for (let i = 0; i < text.length; i++) {
                if (text[i] === '\n') {
                  currentLine++;
                  if (currentLine >= line) {
                    offset = nodePos + i + 1;
                    break;
                  }
                }
              }
            } else if (node.type.isBlock && nodePos > 0) {
              // Block boundaries count as newlines
              currentLine++;
              if (currentLine >= line) {
                offset = nodePos;
              }
            }
            return true;
          });
          // Clamp column
          // Find the text content of the target line to know its length
          const remainingText = doc.textBetween(offset, doc.content.size, '\n');
          const lineText = remainingText.split('\n')[0] ?? '';
          const col = Math.min(column, lineText.length + 1);
          const finalPos = Math.min(offset + col - 1, doc.content.size - 1);
          const selection = TextSelection.create(doc, Math.max(0, finalPos));
          view.dispatch(view.state.tr.setSelection(selection));
        } catch (e) {
          console.error('[MilkdownEditor] setCursor failed:', e);
        }
      },

      // Scroll position
      getScrollTop: () => {
        const container = containerRef.current;
        if (!container) return 0;
        const proseMirror = container.querySelector('.ProseMirror') as HTMLElement | null;
        return proseMirror?.scrollTop ?? 0;
      },
      setScrollTop: (top: number) => {
        const container = containerRef.current;
        if (!container) return;
        requestAnimationFrame(() => {
          const proseMirror = container.querySelector('.ProseMirror') as HTMLElement | null;
          if (proseMirror) {
            proseMirror.scrollTop = top;
          }
        });
      },
    }), [
      isReady,
      loading,
      getMarkdown,
      setMarkdown,
      focus,
      getSelectedMarkdown,
      crepeRef,
      containerRef,
    ]);

    // NOTE: We intentionally do NOT have a useEffect to update content when defaultValue changes.
    // The parent component should use the ref's setMarkdown method when switching files.

    return (
      <div
        ref={containerRef}
        className={`milkdown-crepe-container relative ${className}`}
        spellCheck={false}
      >
        <Milkdown />
      </div>
    );
  }
));

MilkdownEditor.displayName = 'MilkdownEditor';
