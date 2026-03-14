import { forwardRef, useImperativeHandle, useEffect, useRef, useState, useCallback } from 'react';
import { Crepe } from '@milkdown/crepe';
import { Milkdown, useEditor } from '@milkdown/react';
import { editorViewCtx, parserCtx } from '@milkdown/kit/core';
import { callCommand } from '@milkdown/utils';
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  codeBlockSchema,
  linkSchema,
  paragraphSchema,
} from '@milkdown/preset-commonmark';
import { linkTooltipAPI } from '@milkdown/kit/component/link-tooltip';
import { clipboard } from '@milkdown/plugin-clipboard';
import { history } from '@milkdown/plugin-history';
import { TextSelection, NodeSelection } from '@milkdown/prose/state';
import { setBlockType } from '@milkdown/prose/commands';
import { gfm } from '@milkdown/preset-gfm';
import { electrobun } from '../../lib/electrobun';

// Import Crepe base styles (always needed)
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/common/link-tooltip.css';

export interface MilkdownEditorProps {
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  className?: string;
  darkMode?: boolean;
}

export interface MilkdownEditorRef {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  focus: () => void;
  isReady: boolean;
  // Formatting commands
  toggleBold: () => boolean;
  toggleItalic: () => boolean;
  toggleHeading: (level: number) => boolean;
  toggleQuote: () => boolean;
  toggleCode: () => boolean;
  toggleLink: (href?: string, title?: string) => boolean;
  toggleList: () => boolean;
  toggleOrderedList: () => boolean;
  // Paragraph menu commands
  setParagraph: () => boolean;
  increaseHeadingLevel: () => boolean;
  decreaseHeadingLevel: () => boolean;
  insertTable: () => boolean;
  insertMathBlock: () => boolean;
  insertCodeBlock: () => boolean;
  insertTaskList: () => boolean;
  insertHorizontalRule: () => boolean;
  insertParagraphAbove: () => boolean;
  insertParagraphBelow: () => boolean;
  // Table operations
  insertTableRowAbove: () => boolean;
  insertTableRowBelow: () => boolean;
  insertTableColumnLeft: () => boolean;
  insertTableColumnRight: () => boolean;
  moveTableRowUp: () => boolean;
  moveTableRowDown: () => boolean;
  moveTableColumnLeft: () => boolean;
  moveTableColumnRight: () => boolean;
  deleteTableRow: () => boolean;
  deleteTableColumn: () => boolean;
  deleteTable: () => boolean;
  // Selection
  hasSelection: () => boolean;
}

export const MilkdownEditor = forwardRef<MilkdownEditorRef, MilkdownEditorProps>(
  ({ defaultValue = '', onChange, className = '', darkMode = false }, ref) => {
    const crepeRef = useRef<Crepe | null>(null);
    const onChangeRef = useRef(onChange);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isReady, setIsReady] = useState(false);

    // Keep onChange callback up to date
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    // Scrollbar auto-hide: show only when scrolling
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let scrollTimeout: NodeJS.Timeout | null = null;
      const SCROLL_HIDE_DELAY = 800; // Hide scrollbar 800ms after scroll stops

      const handleScroll = () => {
        container.classList.add('is-scrolling');

        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }

        scrollTimeout = setTimeout(() => {
          container.classList.remove('is-scrolling');
        }, SCROLL_HIDE_DELAY);
      };

      container.addEventListener('scroll', handleScroll, { passive: true });

      return () => {
        container.removeEventListener('scroll', handleScroll);
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }
      };
    }, []);

    // Store initial value in a ref so it doesn't change on re-renders
    const initialValueRef = useRef(defaultValue);

    // Dynamic theme CSS loading - runs on initial render and when darkMode changes
    useEffect(() => {
      const loadTheme = async () => {
        const styleId = 'milkdown-theme';
        let style = document.getElementById(styleId) as HTMLStyleElement | null;
        if (!style) {
          style = document.createElement('style');
          style.id = styleId;
          document.head.appendChild(style);
        }

        try {
          if (darkMode) {
            // @ts-ignore
            const module = await import('@milkdown/crepe/theme/frame-dark.css?inline');
            style.textContent = module.default || '';
          } else {
            // @ts-ignore
            const module = await import('@milkdown/crepe/theme/frame.css?inline');
            style.textContent = module.default || '';
          }
        } catch (e) {
          console.error('Failed to load theme:', e);
        }
      };

      loadTheme();
    }, [darkMode]);

    const { loading } = useEditor((root) => {
      const crepe = new Crepe({
        root,
        defaultValue: initialValueRef.current,
        features: {
          [Crepe.Feature.BlockEdit]: false,
          [Crepe.Feature.LinkTooltip]: true,
          [Crepe.Feature.Toolbar]: false,
        },
      });

      crepeRef.current = crepe;

      // Enable clipboard plugin for copy/paste
      crepe.editor.use(clipboard);
      // Enable history plugin for undo/redo
      crepe.editor.use(history);
      // Enable GFM (GitHub Flavored Markdown) for table support
      crepe.editor.use(gfm);

      // Listen for content changes
      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            onChangeRef.current?.(markdown);
          }
        });
      });

      // Mark as ready after creation
      requestAnimationFrame(() => setIsReady(true));

      return crepe;
    }, []); // Empty deps - only create once

    // Handle right-click context menu
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleContextMenu = (e: MouseEvent) => {
        const editor = crepeRef.current?.editor;
        if (!editor?.ctx) return;

        // Check if click is inside the editor
        const target = e.target as HTMLElement;
        if (!target.closest('.ProseMirror')) return;

        // Use the click position to check if it's inside a table
        const isInTableAtClick = editor.action(ctx => {
          const view = ctx.get(editorViewCtx);

          // Get document position at click coordinates
          const coords = { left: e.clientX, top: e.clientY };
          const posAtCoords = view.posAtCoords(coords);
          if (!posAtCoords) return false;

          const { pos } = posAtCoords;
          const $pos = view.state.doc.resolve(pos);

          // Traverse up to find table node
          for (let d = $pos.depth; d >= 0; d--) {
            const node = $pos.node(d);
            if (node.type.name === 'table') {
              return true;
            }
          }
          return false;
        });

        if (isInTableAtClick) {
          e.preventDefault();
          electrobun.showTableContextMenu();
        }
        // Otherwise, let the default browser context menu show
      };

      container.addEventListener('contextmenu', handleContextMenu);
      return () => {
        container.removeEventListener('contextmenu', handleContextMenu);
      };
    }, []);

    // Helper to execute a command
    const execCommand = useCallback(<T,>(command: { key: any }, payload?: T): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;
      return editor.action(ctx => callCommand(command.key, payload)(ctx));
    }, []);

    // Custom toggleCode that wraps selected lines into a single code block
    const toggleCodeBlock = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        const { selection } = state;
        const { from, to } = selection;

        // Get the code block node type
        const codeBlockType = codeBlockSchema.type(ctx);

        // Check if we're already inside a code block
        let inCodeBlock = false;
        state.doc.nodesBetween(from, to, (node) => {
          if (node.type === codeBlockType) {
            inCodeBlock = true;
            return false;
          }
        });

        if (inCodeBlock) {
          // If already in code block, convert back to paragraph
          const paragraphType = state.schema.nodes.paragraph;
          if (!paragraphType) return false;
          return setBlockType(paragraphType)(state, view.dispatch.bind(view));
        }

        // Collect all text content from selected blocks
        const lines: string[] = [];
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.isBlock && node.textContent) {
            lines.push(node.textContent);
          } else if (node.isBlock && node.isTextblock) {
            lines.push('');
          }
        });

        // Join lines with newlines
        const codeContent = lines.join('\n');

        // Find the start and end positions for block-level replacement
        let startPos = from;
        let endPos = to;

        // Expand selection to full block boundaries
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.isBlock) {
            if (startPos > pos) startPos = pos;
            if (endPos < pos + node.nodeSize) endPos = pos + node.nodeSize;
          }
        });

        // Adjust to cover all selected blocks
        const $from = state.doc.resolve(from);
        const $to = state.doc.resolve(to);
        const startBlockPos = $from.before($from.depth);
        const endBlockPos = $to.after($to.depth);

        // Create the code block with the collected text
        const codeBlockNode = codeBlockType.create(
          { language: '' },
          state.schema.text(codeContent)
        );

        // Replace the selected range with the code block
        const tr = state.tr.replaceRangeWith(startBlockPos, endBlockPos, codeBlockNode);

        // Set selection inside the code block
        const newPos = tr.mapping.map(startBlockPos) + 1;
        tr.setSelection(TextSelection.create(tr.doc, newPos));

        view.dispatch(tr);
        return true;
      });
    }, []);

    // Set paragraph
    const setParagraph = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        const paragraphType = paragraphSchema.type(ctx);
        if (!paragraphType) return false;
        return setBlockType(paragraphType)(state, view.dispatch.bind(view));
      });
    }, []);

    // Increase heading level
    const increaseHeadingLevel = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        const { from, to } = state.selection;

        // Find current heading level
        let currentLevel = 0;
        state.doc.nodesBetween(from, to, (node) => {
          if (node.type.name.startsWith('heading')) {
            currentLevel = node.attrs.level || 0;
            return false;
          }
        });

        const newLevel = currentLevel > 0 ? Math.min(currentLevel + 1, 6) : 1;
        return callCommand(wrapInHeadingCommand.key, newLevel)(ctx);
      });
    }, []);

    // Decrease heading level
    const decreaseHeadingLevel = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        const { from, to } = state.selection;

        // Find current heading level
        let currentLevel = 0;
        state.doc.nodesBetween(from, to, (node) => {
          if (node.type.name.startsWith('heading')) {
            currentLevel = node.attrs.level || 0;
            return false;
          }
        });

        if (currentLevel <= 1) {
          // Convert to paragraph
          const paragraphType = paragraphSchema.type(ctx);
          if (!paragraphType) return false;
          return setBlockType(paragraphType)(state, view.dispatch.bind(view));
        }

        const newLevel = currentLevel - 1;
        return callCommand(wrapInHeadingCommand.key, newLevel)(ctx);
      });
    }, []);

    // Helper to check if current position is at an empty paragraph
    const isAtEmptyParagraph = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        const { from } = state.selection;

        // Find the current block node
        const $pos = state.doc.resolve(from);
        const blockPos = $pos.before($pos.depth);
        const blockNode = state.doc.nodeAt(blockPos);

        // Check if it's an empty paragraph
        return blockNode?.type.name === 'paragraph' && blockNode.textContent === '';
      });
    }, []);

    // Helper to insert parsed markdown nodes
    // If current paragraph is empty, replaces it; otherwise inserts after
    // For editable blocks (code, math), cursor goes inside
    // For structural blocks (table, hr), cursor goes after
    const insertParsedMarkdown = useCallback((markdown: string, cursorInside: boolean = false): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const parser = ctx.get(parserCtx);
        const { state } = view;
        const { from } = state.selection;

        // Parse the markdown
        const doc = parser(markdown);
        if (!doc || doc.content.size === 0) {
          return false;
        }

        // Get current block info
        const $pos = state.doc.resolve(from);
        const currentBlockPos = $pos.before($pos.depth);
        const currentBlockEnd = $pos.after($pos.depth);
        const currentBlock = state.doc.nodeAt(currentBlockPos);
        const isEmptyParagraph = currentBlock?.type.name === 'paragraph' && currentBlock.textContent === '';

        // Build transaction
        let tr = state.tr;
        let cursorPos: number;

        if (isEmptyParagraph) {
          // Replace empty paragraph with new content
          tr = tr.replaceWith(currentBlockPos, currentBlockEnd, doc.content);

          if (cursorInside) {
            // Cursor inside the first block (for code, math, etc.)
            cursorPos = currentBlockPos + 1;
          } else {
            // Cursor after the inserted content (for table, hr, etc.)
            // Position at end of inserted content
            const insertedSize = doc.content.size;
            cursorPos = currentBlockPos + insertedSize + 1; // +1 for the newline after
          }
        } else {
          // Insert after current block
          tr = tr.insert(currentBlockEnd, doc.content);

          if (cursorInside) {
            // Cursor inside the new block
            cursorPos = currentBlockEnd + 1;
          } else {
            // Cursor after the inserted content
            const insertedSize = doc.content.size;
            cursorPos = currentBlockEnd + insertedSize + 1;
          }
        }

        // Ensure cursor position is valid
        cursorPos = Math.min(cursorPos, tr.doc.content.size);

        try {
          tr = tr.setSelection(TextSelection.create(tr.doc, cursorPos));
        } catch (e) {
          // If selection fails, try to place cursor at end of document
          tr = tr.setSelection(TextSelection.create(tr.doc, tr.doc.content.size));
        }

        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, []);

    // Insert table (using markdown syntax) - cursor goes after table
    const insertTable = useCallback((): boolean => {
      return insertParsedMarkdown('\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n|          |          |          |\n', false);
    }, [insertParsedMarkdown]);

    // Insert math block - cursor goes inside
    const insertMathBlock = useCallback((): boolean => {
      return insertParsedMarkdown('\n$$\n\n$$\n', true);
    }, [insertParsedMarkdown]);

    // Insert code block (for paragraph menu) - cursor goes inside
    const insertCodeBlock = useCallback((): boolean => {
      return insertParsedMarkdown('\n```\n\n```\n', true);
    }, [insertParsedMarkdown]);

    // Insert task list - cursor goes after
    const insertTaskList = useCallback((): boolean => {
      return insertParsedMarkdown('- [ ] Task item\n', false);
    }, [insertParsedMarkdown]);

    // Insert horizontal rule - cursor goes after
    const insertHorizontalRule = useCallback((): boolean => {
      return insertParsedMarkdown('\n---\n', false);
    }, [insertParsedMarkdown]);

    // Insert paragraph above
    const insertParagraphAbove = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        const { from } = state.selection;

        const $pos = state.doc.resolve(from);
        const blockStart = $pos.before($pos.depth);

        // Insert paragraph and move cursor to it
        const tr = state.tr.insert(blockStart, state.schema.nodes.paragraph.create());
        // Position cursor inside the new paragraph (blockStart + 1)
        const newPos = blockStart + 1;
        tr.setSelection(TextSelection.create(tr.doc, newPos));
        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, []);

    // Insert paragraph below
    const insertParagraphBelow = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        const { from } = state.selection;

        const $pos = state.doc.resolve(from);
        const blockEnd = $pos.after($pos.depth);

        // Insert paragraph and move cursor to it
        const tr = state.tr.insert(blockEnd, state.schema.nodes.paragraph.create());
        // Position cursor inside the new paragraph (blockEnd + 1)
        const newPos = blockEnd + 1;
        tr.setSelection(TextSelection.create(tr.doc, newPos));
        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, []);

    // ===== Table Operations =====
    // Helper to find table node and position
    const findTableNode = useCallback((state: any): { node: any; pos: number } | null => {
      const { from } = state.selection;

      // Look for table node by traversing up from current position
      const $pos = state.doc.resolve(from);
      for (let d = $pos.depth; d >= 0; d--) {
        const node = $pos.node(d);
        if (node.type.name === 'table') {
          return { node, pos: $pos.before(d) };
        }
      }

      return null;
    }, []);

    // Helper to check if a node is a table cell (including header)
    const isTableCell = (node: any): boolean => {
      return node && (node.type.name === 'table_cell' || node.type.name === 'table_header');
    };

    // Helper to find current cell in table
    const findCurrentCell = useCallback((state: any): { row: number; col: number; cellPos: number; isHeader: boolean } | null => {
      const { from } = state.selection;
      const $pos = state.doc.resolve(from);

      // Traverse up to find table structure
      for (let d = $pos.depth; d >= 0; d--) {
        const node = $pos.node(d);

        if (isTableCell(node)) {
          const isHeader = node.type.name === 'table_header';

          // Find row and table parents
          const rowNode = $pos.node(d - 1);
          const tableNode = $pos.node(d - 2);

          if (rowNode?.type.name === 'table_row' && tableNode?.type.name === 'table') {
            // Find row index by iterating through table rows
            let rowIndex = -1;
            const rowStartPos = $pos.before(d - 1);
            for (let i = 0; i < tableNode.childCount; i++) {
              const childRow = tableNode.child(i);
              // Calculate position of this row
              let calcPos = $pos.before(d - 2);
              for (let j = 0; j < i; j++) {
                calcPos += tableNode.child(j).nodeSize;
              }
              calcPos += 1; // +1 for row open token
              if (calcPos === rowStartPos) {
                rowIndex = i;
                break;
              }
            }

            // Find column index
            let colIndex = -1;
            const cellStartPos = $pos.before(d);
            for (let i = 0; i < rowNode.childCount; i++) {
              let calcPos = $pos.before(d - 1) + 1; // +1 for row open token
              for (let j = 0; j < i; j++) {
                calcPos += rowNode.child(j).nodeSize;
              }
              if (calcPos === cellStartPos) {
                colIndex = i;
                break;
              }
            }

            if (rowIndex >= 0 && colIndex >= 0) {
              return { row: rowIndex, col: colIndex, cellPos: $pos.start(d), isHeader };
            }
          }
          break;
        }
      }

      return null;
    }, []);

    // Insert row above
    const insertTableRowAbove = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;

        const cellInfo = findCurrentCell(state);
        if (!cellInfo) return false;

        const tableInfo = findTableNode(state);
        if (!tableInfo) return false;

        const { node: tableNode, pos: tablePos } = tableInfo;
        const { row } = cellInfo;

        // Get number of columns from first row
        const firstRow = tableNode.child(0);
        const colCount = firstRow.childCount;

        // Create new row with empty cells
        const newCells: any[] = [];
        for (let i = 0; i < colCount; i++) {
          // Use table_cell for data rows, table_header only for header row (row 0)
          const cellType = row === 0 ? state.schema.nodes.table_header : state.schema.nodes.table_cell;
          newCells.push(cellType.create(null, state.schema.nodes.paragraph.create()));
        }
        const newRow = state.schema.nodes.table_row.create(null, newCells);

        // Calculate position to insert (before current row)
        let insertPos = tablePos + 1;
        for (let i = 0; i < row; i++) {
          insertPos += tableNode.child(i).nodeSize;
        }

        const tr = state.tr.insert(insertPos, newRow);
        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, [findCurrentCell, findTableNode]);

    // Insert row below
    const insertTableRowBelow = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;

        const cellInfo = findCurrentCell(state);
        if (!cellInfo) return false;

        const tableInfo = findTableNode(state);
        if (!tableInfo) return false;

        const { node: tableNode, pos: tablePos } = tableInfo;
        const { row } = cellInfo;

        // Get number of columns from first row
        const firstRow = tableNode.child(0);
        const colCount = firstRow.childCount;

        // Create new row with empty cells (always use table_cell for new rows)
        const newCells: any[] = [];
        for (let i = 0; i < colCount; i++) {
          newCells.push(state.schema.nodes.table_cell.create(null, state.schema.nodes.paragraph.create()));
        }
        const newRow = state.schema.nodes.table_row.create(null, newCells);

        // Calculate position to insert (after current row)
        let insertPos = tablePos + 1;
        for (let i = 0; i <= row; i++) {
          insertPos += tableNode.child(i).nodeSize;
        }

        const tr = state.tr.insert(insertPos, newRow);
        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, [findCurrentCell, findTableNode]);

    // Insert column left
    const insertTableColumnLeft = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;

        const cellInfo = findCurrentCell(state);
        if (!cellInfo) return false;

        const tableInfo = findTableNode(state);
        if (!tableInfo) return false;

        const { node: tableNode, pos: tablePos } = tableInfo;
        const { col } = cellInfo;

        // Build new rows with inserted column
        const newRows: any[] = [];
        for (let rowIdx = 0; rowIdx < tableNode.childCount; rowIdx++) {
          const rowNode = tableNode.child(rowIdx);
          const newCells: any[] = [];

          for (let cellIdx = 0; cellIdx < rowNode.childCount; cellIdx++) {
            // Insert new cell before current column
            if (cellIdx === col) {
              // Use table_header for header row (row 0), table_cell for others
              const cellType = rowIdx === 0 ? state.schema.nodes.table_header : state.schema.nodes.table_cell;
              newCells.push(cellType.create(null, state.schema.nodes.paragraph.create()));
            }
            newCells.push(rowNode.child(cellIdx));
          }

          newRows.push(state.schema.nodes.table_row.create(null, newCells));
        }

        // Replace the entire table
        const newTable = tableNode.type.create(tableNode.attrs, newRows);
        const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, [findCurrentCell, findTableNode]);

    // Insert column right
    const insertTableColumnRight = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;

        const cellInfo = findCurrentCell(state);
        if (!cellInfo) return false;

        const tableInfo = findTableNode(state);
        if (!tableInfo) return false;

        const { node: tableNode, pos: tablePos } = tableInfo;
        const { col } = cellInfo;

        // Build new rows with inserted column
        const newRows: any[] = [];
        for (let rowIdx = 0; rowIdx < tableNode.childCount; rowIdx++) {
          const rowNode = tableNode.child(rowIdx);
          const newCells: any[] = [];

          for (let cellIdx = 0; cellIdx < rowNode.childCount; cellIdx++) {
            newCells.push(rowNode.child(cellIdx));
            // Insert new cell after current column
            if (cellIdx === col) {
              // Use table_header for header row (row 0), table_cell for others
              const cellType = rowIdx === 0 ? state.schema.nodes.table_header : state.schema.nodes.table_cell;
              newCells.push(cellType.create(null, state.schema.nodes.paragraph.create()));
            }
          }

          newRows.push(state.schema.nodes.table_row.create(null, newCells));
        }

        // Replace the entire table
        const newTable = tableNode.type.create(tableNode.attrs, newRows);
        const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, [findCurrentCell, findTableNode]);

    // Move row up
    const moveTableRowUp = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;

        const cellInfo = findCurrentCell(state);
        if (!cellInfo || cellInfo.row === 0) return false;

        const tableInfo = findTableNode(state);
        if (!tableInfo) return false;

        const { node: tableNode, pos: tablePos } = tableInfo;
        const { row } = cellInfo;

        // Get the two rows to swap
        const currentRow = tableNode.child(row);
        const prevRow = tableNode.child(row - 1);

        // Calculate positions
        let currentRowPos = tablePos + 1;
        for (let i = 0; i < row; i++) {
          currentRowPos += tableNode.child(i).nodeSize;
        }
        let prevRowPos = tablePos + 1;
        for (let i = 0; i < row - 1; i++) {
          prevRowPos += tableNode.child(i).nodeSize;
        }

        // Create a fragment with swapped rows
        const rows: any[] = [];
        for (let i = 0; i < tableNode.childCount; i++) {
          if (i === row - 1) {
            rows.push(currentRow);
          } else if (i === row) {
            rows.push(prevRow);
          } else {
            rows.push(tableNode.child(i));
          }
        }

        // Replace the entire table content
        const newTable = tableNode.type.create(tableNode.attrs, rows);
        const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, [findCurrentCell, findTableNode]);

    // Move row down
    const moveTableRowDown = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;

        const cellInfo = findCurrentCell(state);
        if (!cellInfo) return false;

        const tableInfo = findTableNode(state);
        if (!tableInfo) return false;

        const { node: tableNode, pos: tablePos } = tableInfo;
        const { row } = cellInfo;

        if (row >= tableNode.childCount - 1) return false;

        // Get the two rows to swap
        const currentRow = tableNode.child(row);
        const nextRow = tableNode.child(row + 1);

        // Create a fragment with swapped rows
        const rows: any[] = [];
        for (let i = 0; i < tableNode.childCount; i++) {
          if (i === row) {
            rows.push(nextRow);
          } else if (i === row + 1) {
            rows.push(currentRow);
          } else {
            rows.push(tableNode.child(i));
          }
        }

        // Replace the entire table content
        const newTable = tableNode.type.create(tableNode.attrs, rows);
        const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, [findCurrentCell, findTableNode]);

    // Move column left
    const moveTableColumnLeft = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;

        const cellInfo = findCurrentCell(state);
        if (!cellInfo || cellInfo.col === 0) return false;

        const tableInfo = findTableNode(state);
        if (!tableInfo) return false;

        const { node: tableNode, pos: tablePos } = tableInfo;
        const { col } = cellInfo;

        // Build new rows with swapped columns
        const newRows: any[] = [];
        for (let rowIdx = 0; rowIdx < tableNode.childCount; rowIdx++) {
          const rowNode = tableNode.child(rowIdx);
          const newCells: any[] = [];

          for (let cellIdx = 0; cellIdx < rowNode.childCount; cellIdx++) {
            if (cellIdx === col - 1) {
              newCells.push(rowNode.child(col)); // Current column moves left
            } else if (cellIdx === col) {
              newCells.push(rowNode.child(col - 1)); // Previous column moves right
            } else {
              newCells.push(rowNode.child(cellIdx));
            }
          }

          newRows.push(state.schema.nodes.table_row.create(null, newCells));
        }

        // Replace the entire table
        const newTable = tableNode.type.create(tableNode.attrs, newRows);
        const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, [findCurrentCell, findTableNode]);

    // Move column right
    const moveTableColumnRight = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;

        const cellInfo = findCurrentCell(state);
        if (!cellInfo) return false;

        const tableInfo = findTableNode(state);
        if (!tableInfo) return false;

        const { node: tableNode, pos: tablePos } = tableInfo;
        const { col } = cellInfo;

        if (col >= tableNode.child(0).childCount - 1) return false;

        // Build new rows with swapped columns
        const newRows: any[] = [];
        for (let rowIdx = 0; rowIdx < tableNode.childCount; rowIdx++) {
          const rowNode = tableNode.child(rowIdx);
          const newCells: any[] = [];

          for (let cellIdx = 0; cellIdx < rowNode.childCount; cellIdx++) {
            if (cellIdx === col) {
              newCells.push(rowNode.child(col + 1)); // Next column moves left
            } else if (cellIdx === col + 1) {
              newCells.push(rowNode.child(col)); // Current column moves right
            } else {
              newCells.push(rowNode.child(cellIdx));
            }
          }

          newRows.push(state.schema.nodes.table_row.create(null, newCells));
        }

        // Replace the entire table
        const newTable = tableNode.type.create(tableNode.attrs, newRows);
        const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, [findCurrentCell, findTableNode]);

    // Delete current row
    const deleteTableRow = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        const { $from } = state.selection;

        // Traverse up to find table_row and table
        let tableNode: any = null;
        let tablePos = -1;
        let rowNode: any = null;
        let rowPos = -1;
        let rowIndex = -1;

        for (let d = $from.depth; d >= 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'table') {
            tableNode = node;
            tablePos = $from.before(d);
            break;
          }
        }

        if (!tableNode) return false;

        for (let d = $from.depth; d >= 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'table_row') {
            rowNode = node;
            rowPos = $from.before(d);
            break;
          }
        }

        if (!rowNode) return false;

        // Calculate row index
        for (let i = 0; i < tableNode.childCount; i++) {
          let calcPos = tablePos + 1;
          for (let j = 0; j < i; j++) {
            calcPos += tableNode.child(j).nodeSize;
          }
          if (calcPos === rowPos) {
            rowIndex = i;
            break;
          }
        }

        if (rowIndex === -1) return false;

        // If table has only one row, delete the entire table
        if (tableNode.childCount <= 1) {
          const tr = state.tr.delete(tablePos, tablePos + tableNode.nodeSize);
          view.dispatch(tr);
          view.focus();
          return true;
        }

        // Delete the row
        const tr = state.tr.delete(rowPos, rowPos + rowNode.nodeSize);
        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, []);

    // Delete current column
    const deleteTableColumn = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;
        const { $from } = state.selection;

        // Traverse up to find table_cell, table_row and table
        let tableNode: any = null;
        let tablePos = -1;
        let rowNode: any = null;
        let cellNode: any = null;
        let colIndex = -1;

        for (let d = $from.depth; d >= 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'table') {
            tableNode = node;
            tablePos = $from.before(d);
            break;
          }
        }

        if (!tableNode) return false;

        for (let d = $from.depth; d >= 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'table_row') {
            rowNode = node;
            break;
          }
        }

        if (!rowNode) return false;

        for (let d = $from.depth; d >= 0; d--) {
          const node = $from.node(d);
          if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
            cellNode = node;
            // Calculate column index
            const cellPos = $from.before(d);
            for (let i = 0; i < rowNode.childCount; i++) {
              let calcPos = $from.before(d - 1) + 1; // +1 for row open token
              for (let j = 0; j < i; j++) {
                calcPos += rowNode.child(j).nodeSize;
              }
              if (calcPos === cellPos) {
                colIndex = i;
                break;
              }
            }
            break;
          }
        }

        if (colIndex === -1) return false;

        // Get number of columns
        const colCount = rowNode.childCount;

        // If table has only one column, delete the entire table
        if (colCount <= 1) {
          const tr = state.tr.delete(tablePos, tablePos + tableNode.nodeSize);
          view.dispatch(tr);
          view.focus();
          return true;
        }

        // Build new rows without the deleted column
        const newRows: any[] = [];
        for (let rowIdx = 0; rowIdx < tableNode.childCount; rowIdx++) {
          const currentRowNode = tableNode.child(rowIdx);
          const newCells: any[] = [];

          for (let cellIdx = 0; cellIdx < currentRowNode.childCount; cellIdx++) {
            if (cellIdx !== colIndex) {
              newCells.push(currentRowNode.child(cellIdx));
            }
          }

          newRows.push(state.schema.nodes.table_row.create(null, newCells));
        }

        // Replace the entire table
        const newTable = tableNode.type.create(tableNode.attrs, newRows);
        const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, []);

    // Delete entire table
    const deleteTable = useCallback((): boolean => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return false;

      return editor.action(ctx => {
        const view = ctx.get(editorViewCtx);
        const { state } = view;

        const tableInfo = findTableNode(state);
        if (!tableInfo) return false;

        const { node: tableNode, pos: tablePos } = tableInfo;

        // Delete the entire table
        const tr = state.tr.delete(tablePos, tablePos + tableNode.nodeSize);
        view.dispatch(tr);
        view.focus();
        return true;
      });
    }, [findTableNode]);

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      getMarkdown: () => crepeRef.current?.getMarkdown() ?? '',
      setMarkdown: (markdown: string) => {
        const editor = crepeRef.current?.editor;
        if (!editor?.ctx) return;

        try {
          const view = editor.ctx.get(editorViewCtx);
          const parser = editor.ctx.get(parserCtx);
          const doc = parser(markdown);
          if (!doc) return;

          view.dispatch(
            view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content)
          );
        } catch (e) {
          console.error('Set content error:', e);
        }
      },
      focus: () => {
        const editorElement = containerRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
        editorElement?.focus();
      },
      isReady: isReady && !loading,
      // Formatting commands
      toggleBold: () => execCommand(toggleStrongCommand),
      toggleItalic: () => execCommand(toggleEmphasisCommand),
      toggleHeading: (level: number) => execCommand(wrapInHeadingCommand, level),
      toggleQuote: () => execCommand(wrapInBlockquoteCommand),
      toggleCode: toggleCodeBlock,
      toggleLink: () => {
        const editor = crepeRef.current?.editor;
        if (!editor?.ctx) return false;

        return editor.action(ctx => {
          const view = ctx.get(editorViewCtx);
          const { state } = view;
          const { selection } = state;
          const { from, to } = selection;

          // Check if there's a selection
          if (from === to) return false;

          // Check if selection has link
          const mark = linkSchema.type(ctx);
          const hasLink = state.doc.rangeHasMark(from, to, mark);

          const api = ctx.get(linkTooltipAPI.key);
          if (hasLink) {
            api.removeLink(from, to);
          } else {
            api.addLink(from, to);
          }
          return true;
        });
      },
      toggleList: () => execCommand(wrapInBulletListCommand),
      toggleOrderedList: () => execCommand(wrapInOrderedListCommand),
      // Paragraph menu commands
      setParagraph,
      increaseHeadingLevel,
      decreaseHeadingLevel,
      insertTable,
      insertMathBlock,
      insertCodeBlock,
      insertTaskList,
      insertHorizontalRule,
      insertParagraphAbove,
      insertParagraphBelow,
      // Table operations
      insertTableRowAbove,
      insertTableRowBelow,
      insertTableColumnLeft,
      insertTableColumnRight,
      moveTableRowUp,
      moveTableRowDown,
      moveTableColumnLeft,
      moveTableColumnRight,
      deleteTableRow,
      deleteTableColumn,
      deleteTable,
      // Check if there's text selected
      hasSelection: () => {
        const editor = crepeRef.current?.editor;
        if (!editor?.ctx) return false;
        return editor.action(ctx => {
          const view = ctx.get(editorViewCtx);
          const { from, to } = view.state.selection;
          return from !== to;
        });
      },
    }), [isReady, loading, execCommand, toggleCodeBlock, setParagraph, increaseHeadingLevel, decreaseHeadingLevel, insertTable, insertMathBlock, insertCodeBlock, insertTaskList, insertHorizontalRule, insertParagraphAbove, insertParagraphBelow, insertParsedMarkdown, insertTableRowAbove, insertTableRowBelow, insertTableColumnLeft, insertTableColumnRight, moveTableRowUp, moveTableRowDown, moveTableColumnLeft, moveTableColumnRight, deleteTableRow, deleteTableColumn, deleteTable]);

    // NOTE: We intentionally do NOT have a useEffect to update content when defaultValue changes.
    // The parent component should use the ref's setMarkdown method when switching files.

    return (
      <div ref={containerRef} className={`milkdown-crepe-container ${className}`}>
        <Milkdown />
      </div>
    );
  }
);

MilkdownEditor.displayName = 'MilkdownEditor';
