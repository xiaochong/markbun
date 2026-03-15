import { useRef, useState, useCallback, useEffect } from 'react';
import { Crepe } from '@milkdown/crepe';
import { useEditor } from '@milkdown/react';
import { editorViewCtx, parserCtx, serializerCtx, schemaCtx, commandsCtx } from '@milkdown/kit/core';
import { clipboard } from '@milkdown/plugin-clipboard';
import { history } from '@milkdown/plugin-history';
import { gfm } from '@milkdown/preset-gfm';
import { clipboardBlobConverter } from '../plugins/clipboardBlobConverter';
import { electrobun } from '@/lib/electrobun';
import { workspaceManager, loadLocalImage, imageCache } from '@/lib/image';
import type { MilkdownEditorProps } from '../types';

// Helper to extract base64 data from data URL
function extractBase64FromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  return match ? match[1] : dataUrl;
}

const SCROLL_HIDE_DELAY = 800;

export interface UseCrepeEditorReturn {
  crepeRef: React.RefObject<Crepe | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isReady: boolean;
  loading: boolean;
  isDraggingOver: boolean;
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
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

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

  // Image drag and drop handlers
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;

      // Check if files are being dragged
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDraggingOver(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;

      if (dragCounterRef.current === 0) {
        setIsDraggingOver(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Allow drop
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDraggingOver(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) {
        return;
      }

      // Filter image files
      const imageFiles = Array.from(files).filter(file =>
        file.type.startsWith('image/')
      );

      if (imageFiles.length === 0) {
        return;
      }

      // Get workspace root for saving images
      const workspaceRoot = workspaceManager.getWorkspaceRoot();
      if (!workspaceRoot) {
        console.error('[Drop] No workspace root set, cannot save images');
        return;
      }

      // Process each image
      for (const file of imageFiles) {
        try {
          // Step 1: Read file as base64
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (e) => reject(new Error('FileReader error: ' + e));
            reader.readAsDataURL(file);
          });

          // Step 2: Extract base64 data and save to workspace via Bun process
          const base64Data = extractBase64FromDataUrl(dataUrl);
          const saveResult = await electrobun.saveDroppedImage(
            file.name,
            base64Data,
            workspaceRoot
          ) as {
            success: boolean;
            relativePath?: string;
            absolutePath?: string;
            error?: string;
          };

          if (!saveResult.success || !saveResult.relativePath || !saveResult.absolutePath) {
            console.error('[Drop] Failed to save image:', saveResult.error);
            continue;
          }

          // Step 3: Load the saved image and get blob URL for display
          const blobUrl = await loadLocalImage(saveResult.absolutePath);
          if (!blobUrl) {
            console.error('[Drop] Failed to load saved image');
            continue;
          }

          // Step 4: Insert image into editor with blob URL (for display)
          // but use relative path in the actual markdown structure
          const crepe = crepeRef.current;
          if (crepe?.editor.ctx) {
            // Get drop position from mouse coordinates
            const dropPos = crepe.editor.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              // Use ProseMirror's posAtCoords to get document position
              const pos = view.posAtCoords({ left: e.clientX, top: e.clientY });
              return pos?.pos ?? null;
            });

            if (dropPos === null) {
              console.error('[Drop] Could not determine drop position');
              continue;
            }

            // Use markdown parser with blob URL for immediate display
            // The blob URL is cached and mapped to the absolute path
            // When saving, the blob URL will be converted back to the relative path
            const altText = file.name.replace(/\.[^/.]+$/, '');
            const markdown = `\n![${altText}](${blobUrl})\n`;

            try {
              crepe.editor.action((ctx) => {
                const view = ctx.get(editorViewCtx);
                const parser = ctx.get(parserCtx);
                const doc = parser(markdown);
                if (doc && doc.content.size > 0) {
                  // Insert at the drop position
                  const tr = view.state.tr.replaceWith(dropPos, dropPos, doc.content);
                  view.dispatch(tr);
                }
              });
            } catch (err) {
              console.error('[Drop] Failed to insert image:', err);
            }
          } else {
            console.error('[Drop] Editor not ready');
          }
        } catch (error) {
          console.error('[Drop] Failed to process dropped image:', error);
        }
      }
    };

    container.addEventListener('dragenter', handleDragEnter);
    container.addEventListener('dragleave', handleDragLeave);
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('dragenter', handleDragEnter);
      container.removeEventListener('dragleave', handleDragLeave);
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
  }, []);

  return {
    crepeRef,
    containerRef,
    isReady: !loading,
    loading,
    isDraggingOver,
    getMarkdown,
    setMarkdown,
    focus,
    getSelectedMarkdown,
  };
}
