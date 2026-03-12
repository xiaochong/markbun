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
  createCodeBlockCommand,
  toggleLinkCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
} from '@milkdown/preset-commonmark';

// Import Crepe base styles (always needed)
import '@milkdown/crepe/theme/common/style.css';

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
        },
      });

      crepeRef.current = crepe;

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
      toggleCode: () => execCommand(createCodeBlockCommand),
      toggleLink: (href?: string, title?: string) => execCommand(toggleLinkCommand, { href, title }),
      toggleList: () => execCommand(wrapInBulletListCommand),
      toggleOrderedList: () => execCommand(wrapInOrderedListCommand),
    }), [isReady, loading, execCommand]);

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
