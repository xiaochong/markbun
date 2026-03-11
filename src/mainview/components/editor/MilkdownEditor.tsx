import { forwardRef, useImperativeHandle, useEffect, useRef, useState } from 'react';
import { Crepe } from '@milkdown/crepe';
import { Milkdown, useEditor } from '@milkdown/react';
import { editorViewCtx, parserCtx } from '@milkdown/kit/core';

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

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        const crepe = crepeRef.current;
        if (!crepe) return '';
        return crepe.getMarkdown();
      },
      setMarkdown: (markdown: string) => {
        const crepe = crepeRef.current;
        if (!crepe) return;

        // Use the underlying editor's action to set content
        const editor = crepe.editor;
        if (!editor?.ctx) return;

        try {
          const view = editor.ctx.get(editorViewCtx);
          const parser = editor.ctx.get(parserCtx);
          const doc = parser(markdown);

          if (!doc) return;

          const state = view.state;
          view.dispatch(
            state.tr.replaceWith(0, state.doc.content.size, doc.content)
          );
        } catch (e) {
          console.error('Set content error:', e);
        }
      },
      focus: () => {
        // Find the ProseMirror editor element and focus it
        const container = containerRef.current;
        if (!container) return;
        const editorElement = container.querySelector('.ProseMirror') as HTMLElement;
        if (editorElement) {
          editorElement.focus();
        }
      },
      isReady: isReady && !loading,
    }), [isReady, loading]);

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
