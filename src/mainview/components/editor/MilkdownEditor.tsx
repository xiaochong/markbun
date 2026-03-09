import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState } from 'react';
import { Editor, rootCtx, editorViewCtx, parserCtx, serializerCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/kit/plugin/history';
import { clipboard } from '@milkdown/kit/plugin/clipboard';
import './editor.css';

export interface MilkdownEditorProps {
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  className?: string;
}

export interface MilkdownEditorRef {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  focus: () => void;
  isReady: boolean;
}

export const MilkdownEditor = forwardRef<MilkdownEditorRef, MilkdownEditorProps>(
  ({ defaultValue = '', className = '' }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorDOMRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Editor | null>(null);
    const [isReady, setIsReady] = useState(false);
    const pendingContentRef = useRef<string | null>(null);

    // Initialize editor
    useEffect(() => {
      const domElement = editorDOMRef.current;
      if (!domElement) return;

      let editor: Editor | null = null;
      let destroyed = false;

      const init = async () => {
        try {
          editor = Editor.make()
            .config((ctx) => {
              ctx.set(rootCtx, domElement);
            })
            .use(commonmark)
            .use(gfm)
            .use(history)
            .use(clipboard);

          await editor.create();

          if (destroyed) {
            await editor.destroy();
            return;
          }

          editorRef.current = editor;
          setIsReady(true);

          // Set pending content or default value
          const contentToSet = pendingContentRef.current || defaultValue;
          if (contentToSet) {
            setEditorContent(contentToSet);
            pendingContentRef.current = null;
          }

          console.log('Milkdown editor ready');
        } catch (error) {
          console.error('Failed to create editor:', error);
        }
      };

      init();

      return () => {
        destroyed = true;
        if (editorRef.current) {
          editorRef.current.destroy().catch(console.error);
          editorRef.current = null;
          setIsReady(false);
        }
      };
    }, []);

    // Get content
    const getEditorContent = useCallback((): string => {
      const editor = editorRef.current;
      if (!editor?.ctx) return '';

      try {
        const view = editor.ctx.get(editorViewCtx);
        const serializer = editor.ctx.get(serializerCtx);
        return serializer(view.state.doc);
      } catch (e) {
        console.error('Get content error:', e);
        return '';
      }
    }, []);

    // Set content
    const setEditorContent = useCallback((markdown: string) => {
      const editor = editorRef.current;
      if (!editor?.ctx) {
        pendingContentRef.current = markdown;
        return;
      }

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
    }, []);

    // Focus
    const focusEditor = useCallback(() => {
      const editor = editorRef.current;
      if (!editor?.ctx) return;

      try {
        const view = editor.ctx.get(editorViewCtx);
        view.focus();
      } catch (e) {
        console.error('Focus error:', e);
      }
    }, []);

    useImperativeHandle(ref, () => ({
      getMarkdown: getEditorContent,
      setMarkdown: setEditorContent,
      focus: focusEditor,
      isReady,
    }), [getEditorContent, setEditorContent, focusEditor, isReady]);

    return (
      <div ref={containerRef} className={`milkdown-container ${className}`}>
        <div ref={editorDOMRef} className="milkdown-editor" />
      </div>
    );
  }
);

MilkdownEditor.displayName = 'MilkdownEditor';
