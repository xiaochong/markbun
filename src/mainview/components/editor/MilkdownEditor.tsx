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
} from '@milkdown/preset-commonmark';
import { linkTooltipAPI } from '@milkdown/kit/component/link-tooltip';
import { clipboard } from '@milkdown/plugin-clipboard';
import { history } from '@milkdown/plugin-history';
import { TextSelection } from '@milkdown/prose/state';
import { setBlockType } from '@milkdown/prose/commands';

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

    // Store initial value in a ref so it doesn't change on re-renders
    const initialValueRef = useRef(defaultValue);

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
    }), [isReady, loading, execCommand, toggleCodeBlock]);

    // Dynamic theme loading
    useEffect(() => {
      // Load the appropriate theme CSS
      if (darkMode) {
        // @ts-ignore
        import('@milkdown/crepe/theme/frame-dark.css');
      } else {
        // @ts-ignore
        import('@milkdown/crepe/theme/frame.css');
      }
    }, [darkMode]);

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
