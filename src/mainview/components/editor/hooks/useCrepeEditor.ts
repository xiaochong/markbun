import { useRef, useState, useCallback } from 'react';
import { Crepe } from '@milkdown/crepe';
import { useEditor } from '@milkdown/react';
import { editorViewCtx, parserCtx, serializerCtx, schemaCtx } from '@milkdown/kit/core';
import { clipboard } from '@milkdown/plugin-clipboard';
import { history } from '@milkdown/plugin-history';
import { gfm } from '@milkdown/preset-gfm';
import { clipboardBlobConverter } from '../plugins/clipboardBlobConverter';
import type { MilkdownEditorProps } from '../types';

const SCROLL_HIDE_DELAY = 800;

export interface UseCrepeEditorReturn {
  crepeRef: React.RefObject<Crepe | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isReady: boolean;
  loading: boolean;
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  focus: () => void;
  getSelectedMarkdown: () => string | null;
}

export function useCrepeEditor(
  defaultValue: string,
  onChange: ((markdown: string) => void) | undefined,
  setIsReady: (ready: boolean) => void
): UseCrepeEditorReturn {
  const crepeRef = useRef<Crepe | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(defaultValue);

  // Keep onChange callback up to date
  onChangeRef.current = onChange;

  // Scrollbar auto-hide: show only when scrolling
  const setupScrollHide = useCallback((container: HTMLDivElement) => {
    let scrollTimeout: NodeJS.Timeout | null = null;

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

  const { loading } = useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue: initialValueRef.current,
      features: {
        [Crepe.Feature.BlockEdit]: false,
        [Crepe.Feature.LinkTooltip]: true,
        [Crepe.Feature.Toolbar]: false,
        [Crepe.Feature.ImageBlock]: {
          // Handle local image upload - read as base64
          onUpload: async (file: File) => {
            const reader = new FileReader();
            return new Promise((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
          },
          // Proxy URLs (for local files, return as-is)
          proxyDomURL: (url: string) => {
            // If it's a local file path or already a data URL, return as-is
            if (url.startsWith('data:') || url.startsWith('/')) {
              return url;
            }
            return url;
          },
        } as any,
      },
    });

    crepeRef.current = crepe;

    // Enable clipboard plugin for copy/paste
    crepe.editor.use(clipboard);
    // Add blob URL converter (must be after clipboard plugin to override its serializer)
    crepe.editor.use(clipboardBlobConverter);
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

    // Setup scroll hide after editor is created
    const container = containerRef.current;
    if (container) {
      setupScrollHide(container);
    }

    return crepe;
  }, []); // Empty deps - only create once

  const getMarkdown = useCallback(() => {
    return crepeRef.current?.getMarkdown() ?? '';
  }, []);

  const CHUNK_LOAD_LINE_THRESHOLD = 500; // Lines
  const CHUNK_SIZE_LINES = 100; // Lines per chunk

  const setMarkdown = useCallback((markdown: string) => {
    const editor = crepeRef.current?.editor;
    if (!editor?.ctx) return;

    // Reset scroll position to top before setting content
    const container = containerRef.current;
    if (container) {
      container.scrollTop = 0;
    }

    try {
      const lines = markdown.split('\n');
      const totalLines = lines.length;

      // For small files, use direct parsing
      if (totalLines <= CHUNK_LOAD_LINE_THRESHOLD) {
        const view = editor.ctx.get(editorViewCtx);
        const parser = editor.ctx.get(parserCtx);
        const doc = parser(markdown);
        if (!doc) return;

        view.dispatch(
          view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content)
        );

        // Ensure scroll is at top after content is set
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = 0;
          }
          // Also try to scroll the ProseMirror editor element
          const editorElement = container?.querySelector('.ProseMirror') as HTMLElement | null;
          if (editorElement) {
            editorElement.scrollTop = 0;
          }
        });
        return;
      }

      // For large files, use chunked loading
      // First, show the first chunk immediately
      const firstChunk = lines.slice(0, CHUNK_SIZE_LINES).join('\n');
      const view = editor.ctx.get(editorViewCtx);
      const parser = editor.ctx.get(parserCtx);
      const firstDoc = parser(firstChunk);

      if (!firstDoc) return;

      view.dispatch(
        view.state.tr.replaceWith(0, view.state.doc.content.size, firstDoc.content)
      );

      // Then load remaining chunks using requestIdleCallback or setTimeout
      const remainingLines = lines.slice(CHUNK_SIZE_LINES);
      let currentIndex = 0;

      const loadNextChunk = () => {
        if (currentIndex >= remainingLines.length) return;

        const chunkEnd = Math.min(currentIndex + CHUNK_SIZE_LINES, remainingLines.length);
        const chunk = remainingLines.slice(currentIndex, chunkEnd).join('\n');

        try {
          const chunkDoc = parser(chunk);
          if (chunkDoc) {
            const currentSize = view.state.doc.content.size;
            view.dispatch(
              view.state.tr.insert(currentSize, chunkDoc.content)
            );
          }
        } catch (e) {
          console.error('Chunk load error:', e);
        }

        currentIndex = chunkEnd;

        // Schedule next chunk
        if (currentIndex < remainingLines.length) {
          if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => loadNextChunk(), { timeout: 50 });
          } else {
            setTimeout(loadNextChunk, 10);
          }
        }
      };

      // Start loading remaining chunks
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => loadNextChunk(), { timeout: 100 });
      } else {
        setTimeout(loadNextChunk, 50);
      }

      // After all chunks are loaded, ensure scroll is at top
      const resetScrollToTop = () => {
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = 0;
          }
          const editorElement = container?.querySelector('.ProseMirror') as HTMLElement | null;
          if (editorElement) {
            editorElement.scrollTop = 0;
          }
        });
      };

      // Schedule scroll reset after chunks should be loaded (approximate)
      const estimatedLoadTime = Math.ceil(remainingLines.length / CHUNK_SIZE_LINES) * 60;
      setTimeout(resetScrollToTop, estimatedLoadTime);

    } catch (e) {
      console.error('Set content error:', e);
    }
  }, []);

  const focus = useCallback(() => {
    const editorElement = containerRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
    editorElement?.focus();
  }, []);

  const getSelectedMarkdown = useCallback(() => {
    const editor = crepeRef.current?.editor;
    if (!editor?.ctx) return null;

    try {
      const view = editor.ctx.get(editorViewCtx);
      const { from, to, empty } = view.state.selection;

      if (empty || from === to) return null;

      // Get serializer and schema
      const serializer = editor.ctx.get(serializerCtx);
      const schema = editor.ctx.get(schemaCtx);

      // Create a temporary document with the selected content
      const slice = view.state.selection.content();
      const doc = schema.topNodeType.createAndFill(undefined, slice.content);

      if (!doc) return null;

      // Serialize to markdown
      return serializer(doc);
    } catch (e) {
      console.error('Failed to get selected markdown:', e);
      return null;
    }
  }, []);

  return {
    crepeRef,
    containerRef,
    isReady: !loading,
    loading,
    getMarkdown,
    setMarkdown,
    focus,
    getSelectedMarkdown,
  };
}
