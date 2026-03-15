import { forwardRef, useImperativeHandle, useState, useCallback, memo } from 'react';
import { Milkdown } from '@milkdown/react';
import type { MilkdownEditorProps, MilkdownEditorRef } from './types';
import { useCrepeEditor, useThemeLoader, useContextMenu } from './hooks';
import { hasSelection } from './utils/editorActions';
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
    } = useCrepeEditor(defaultValue, onChange, setIsReady);

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

      // Paragraph menu commands
      setParagraph: () => paragraph.setParagraph(crepeRef),
      increaseHeadingLevel: () => paragraph.increaseHeadingLevel(crepeRef),
      decreaseHeadingLevel: () => paragraph.decreaseHeadingLevel(crepeRef),
      insertTable: () => paragraph.insertTable(crepeRef),
      insertMathBlock: () => paragraph.insertMathBlock(crepeRef),
      insertCodeBlock: () => paragraph.insertCodeBlock(crepeRef),
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

      // Selection
      hasSelection: () => hasSelection(crepeRef),

      // Insert image
      insertImage: (src: string, alt?: string, title?: string) =>
        formatting.insertImage(crepeRef, src, alt, title),

      // Insert text
      insertText: (text: string) => textCommands.insertText(crepeRef, text),
    }), [
      isReady,
      loading,
      getMarkdown,
      setMarkdown,
      focus,
      getSelectedMarkdown,
      crepeRef,
    ]);

    // NOTE: We intentionally do NOT have a useEffect to update content when defaultValue changes.
    // The parent component should use the ref's setMarkdown method when switching files.

    return (
      <div
        ref={containerRef}
        className={`milkdown-crepe-container relative ${className}`}
      >
        <Milkdown />
      </div>
    );
  }
));

MilkdownEditor.displayName = 'MilkdownEditor';
