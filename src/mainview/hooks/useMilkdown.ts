import { useEffect, useRef, useCallback } from 'react';
import { Editor, editorViewCtx, parserCtx, serializerCtx } from '@milkdown/kit/core';
import { commonmark } from '@milkdown/kit/preset/commonmark';
import { gfm } from '@milkdown/kit/preset/gfm';
import { history } from '@milkdown/plugin-history';
import { clipboard } from '@milkdown/plugin-clipboard';

export interface UseMilkdownOptions {
  defaultValue?: string;
  onChange?: (markdown: string) => void;
}

export interface UseMilkdownReturn {
  editorRef: React.RefObject<HTMLDivElement>;
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  focus: () => void;
  isLoading: boolean;
}

export function useMilkdown(options: UseMilkdownOptions = {}): UseMilkdownReturn {
  const { defaultValue = '', onChange } = options;
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstance = useRef<Editor | null>(null);
  const isLoadingRef = useRef(true);

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) return;

    let mounted = true;

    const createEditor = async () => {
      try {
        const editor = await Editor.make()
          .use(commonmark)
          .use(gfm)
          .use(history)
          .use(clipboard)
          .create();

        if (!mounted) {
          editor.destroy();
          return;
        }

        editorInstance.current = editor;
        isLoadingRef.current = false;

        // Set initial content
        if (defaultValue) {
          setMarkdown(defaultValue);
        }
      } catch (error) {
        console.error('Failed to create Milkdown editor:', error);
      }
    };

    createEditor();

    return () => {
      mounted = false;
      if (editorInstance.current) {
        editorInstance.current.destroy();
        editorInstance.current = null;
      }
    };
  }, []);

  // Get markdown content
  const getMarkdownContent = useCallback((): string => {
    if (!editorInstance.current) return '';
    
    try {
      const ctx = editorInstance.current.ctx;
      const view = ctx.get(editorViewCtx);
      const serializer = ctx.get(serializerCtx);
      return serializer(view.state.doc);
    } catch (error) {
      console.error('Failed to get markdown:', error);
      return '';
    }
  }, []);

  // Set markdown content
  const setMarkdown = useCallback((markdown: string) => {
    if (!editorInstance.current) return;
    
    try {
      const ctx = editorInstance.current.ctx;
      const view = ctx.get(editorViewCtx);
      const parser = ctx.get(parserCtx);
      
      const doc = parser(markdown);
      if (!doc) return;
      
      const state = view.state;
      view.dispatch(
        state.tr.replaceWith(0, state.doc.content.size, doc.content)
      );
    } catch (error) {
      console.error('Failed to set markdown:', error);
    }
  }, []);

  // Focus editor
  const focus = useCallback(() => {
    if (!editorInstance.current) return;
    
    try {
      const ctx = editorInstance.current.ctx;
      const view = ctx.get(editorViewCtx);
      view.focus();
    } catch (error) {
      console.error('Failed to focus editor:', error);
    }
  }, []);

  return {
    editorRef,
    getMarkdown: getMarkdownContent,
    setMarkdown,
    focus,
    isLoading: isLoadingRef.current,
  };
}
