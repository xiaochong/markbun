import { useRef, useState, useCallback, useEffect } from 'react';
import { Crepe } from '@milkdown/crepe';
import { useEditor } from '@milkdown/react';
import { editorViewCtx, parserCtx, serializerCtx, schemaCtx, commandsCtx } from '@milkdown/kit/core';
import { InitReady, remarkPluginsCtx, remarkStringifyOptionsCtx } from '@milkdown/core';
import type { MilkdownPlugin } from '@milkdown/ctx';
import { $prose } from '@milkdown/utils';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import remarkBreaks from 'remark-breaks';
import remarkHighlight from '../plugins/remarkHighlight';
import remarkSuperSub from '../plugins/remarkSuperSub';
import { inlineMarksPlugin } from '../plugins/inlineMarksPlugin';
import { NodeSelection } from '@milkdown/kit/prose/state';
import { clipboard } from '@milkdown/plugin-clipboard';
import { history } from '@milkdown/plugin-history';
import { gfm, remarkGFMPlugin } from '@milkdown/preset-gfm';
import { clipboardBlobConverter } from '../plugins/clipboardBlobConverter';
import { createSearchPlugin } from '../plugins/searchPlugin';
import { electrobun } from '@/lib/electrobun';
import { workspaceManager, loadLocalImage, imageCache } from '@/lib/image';
import type { MilkdownEditorProps } from '../types';

// Helper to extract base64 data from data URL
function extractBase64FromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  return match ? match[1] : dataUrl;
}

const SCROLL_HIDE_DELAY = 800;

// Frontmatter conversion utilities
// Convert ---\ncontent\n--- to ```yaml\ncontent\n``` for display
function convertFrontmatterToCodeBlock(markdown: string): string {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;
  const match = markdown.match(frontmatterRegex);

  if (match) {
    const frontmatter = match[1];
    const content = markdown.slice(match[0].length);
    return "```yaml\n" + frontmatter + "\n```\n" + content;
  }

  return markdown;
}

// Convert ```yaml\ncontent\n``` back to ---\ncontent\n--- for saving
function convertCodeBlockToFrontmatter(markdown: string): string {
  // Match yaml code block at the very beginning of the document
  const codeBlockRegex = /^```yaml\s*\n([\s\S]*?)\n```\s*(?:\n|$)/;
  const match = markdown.match(codeBlockRegex);

  if (match) {
    const frontmatter = match[1];
    const content = markdown.slice(match[0].length);
    // Ensure frontmatter ends with newline before closing ---
    const normalizedFrontmatter = frontmatter.endsWith('\n') ? frontmatter : frontmatter + '\n';
    return "---\n" + normalizedFrontmatter + "---\n\n" + content;
  }

  return markdown;
}
// Insert remark-breaks BEFORE remarkLineBreak (commonmark preset) so single \n → <br> not <span>
const breaksPlugin: MilkdownPlugin = (ctx) => async () => {
  await ctx.wait(InitReady);
  ctx.update(remarkPluginsCtx, (rp) => [{ plugin: remarkBreaks, options: {} }, ...rp]);
};

const inlineMarksParsersPlugin: MilkdownPlugin = (ctx) => async () => {
  await ctx.wait(InitReady);
  ctx.update(remarkPluginsCtx, (rp) => [
    ...rp,
    { plugin: remarkHighlight, options: {} },
    { plugin: remarkSuperSub, options: {} },
  ]);
};

// Split markdown lines into chunks of approximately `chunkSize` lines each,
// but never break inside a fenced code block (``` or ~~~).
// Breaking mid-fence causes the chunk parser to mis-interpret the indented
// content inside the code block as indented-code-blocks, splitting it at
// every blank line.
function splitAtCodeBlockBoundaries(lines: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let inCodeBlock = false;
  let fenceChar = '';
  let fenceLen = 0;

  for (const line of lines) {
    if (!inCodeBlock) {
      const m = line.match(/^(`{3,}|~{3,})/);
      if (m) {
        inCodeBlock = true;
        fenceChar = m[1][0];
        fenceLen = m[1].length;
      }
    } else {
      // A closing fence: same character, at least as many chars, optional trailing spaces
      const m = line.match(/^(`+|~+)\s*$/);
      if (m && m[1][0] === fenceChar && m[1].length >= fenceLen) {
        inCodeBlock = false;
      }
    }

    current.push(line);

    // Only split when we are outside a code block
    if (current.length >= chunkSize && !inCodeBlock) {
      chunks.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export interface UseCrepeEditorReturn {
  crepeRef: React.RefObject<Crepe | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isReady: boolean;
  loading: boolean;
  isDraggingOver: boolean;
  getMarkdown: () => string;
  setMarkdown: (markdown: string, options?: { onContentSet?: () => void }) => void;
  focus: () => void;
  getSelectedMarkdown: () => string | null;
}

export function useCrepeEditor(
  defaultValue: string,
  onChange: ((markdown: string) => void) | undefined,
  setIsReady: (ready: boolean) => void,
  darkMode: boolean = false
): UseCrepeEditorReturn {
  const crepeRef = useRef<Crepe | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  // Convert frontmatter to yaml code block for display
  const initialValueRef = useRef(convertFrontmatterToCodeBlock(defaultValue));
  const darkModeRef = useRef(darkMode);
  darkModeRef.current = darkMode;
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
      featureConfigs: {
        [Crepe.Feature.CodeMirror]: {
          renderPreview: (language: string, content: string, applyPreview: (value: null | string | HTMLElement) => void) => {
            if (language.toLowerCase() !== 'mermaid' || !content.trim()) return null;

            const code = content.trim();
            const id = `mermaid-svg-${Math.random().toString(36).slice(2)}`;

            import('mermaid').then(({ default: mermaid }) => {
              mermaid.initialize({
                startOnLoad: false,
                theme: darkModeRef.current ? 'dark' : 'default',
                suppressErrorRendering: true,
              });
              mermaid.render(id, code)
                .then(({ svg }) => {
                  // WebKit (Electrobun) cannot auto-compute SVG height when width="100%"
                  // and no explicit height attribute. Fix by removing width="100%" so
                  // the SVG uses its intrinsic viewBox dimensions instead.
                  const fixedSvg = svg.replace(/\swidth="100%"/, '');
                  applyPreview(fixedSvg);
                })
                .catch((err) => {
                  console.error('[Mermaid] render error:', err);
                  applyPreview('<div class="mermaid-error">Mermaid syntax error</div>');
                });
            });

            return null;
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
    // Enable highlight (==text==), superscript (^text^), subscript (~text~)
    crepe.editor.use(inlineMarksPlugin);
    // Enable soft line breaks as hard line breaks (like Typora)
    crepe.editor.use(breaksPlugin);
    // Register remark parsers for highlight/superscript/subscript
    crepe.editor.use(inlineMarksParsersPlugin);
    // Enable search & replace plugin for find/replace functionality
    crepe.editor.use(createSearchPlugin());
    // Serialize hardbreaks back to plain \n (not \\ or trailing spaces)
    crepe.editor.config((ctx) => {
      // Disable single-tilde strikethrough so ~text~ can be used as subscript
      ctx.set(remarkGFMPlugin.options.key, { singleTilde: false });
      ctx.update(remarkStringifyOptionsCtx, (options) => ({
        ...options,
        handlers: {
          ...options.handlers,
          break: () => '\n',
          highlight: (node: any, _parent: any, state: any, info: any) => {
            const value = state.containerPhrasing(node, { ...info, before: '=', after: '=' });
            return `==${value}==`;
          },
          superscript: (node: any, _parent: any, state: any, info: any) => {
            const value = state.containerPhrasing(node, { ...info, before: '^', after: '^' });
            return `^${value}^`;
          },
          subscript: (node: any, _parent: any, state: any, info: any) => {
            const value = state.containerPhrasing(node, { ...info, before: '~', after: '~' });
            return `~${value}~`;
          },
        },
      }));
    });

    // Listen for content changes via ProseMirror plugin (Crepe's markdownUpdated is unreliable)
    // Deduplicate change notifications: ProseMirror may dispatch multiple transactions
    // (e.g., normalization) that produce the same serialized markdown. Only notify
    // when the serialized content actually changes to prevent spurious isDirty resets.
    let lastSerializedMarkdown = '';
    const changeListenerPlugin = $prose((ctx) => {
      return new Plugin({
        key: new PluginKey('markbun-change-listener'),
        view: () => ({
          update: (view, prevState) => {
            if (!view.state.doc.eq(prevState.doc)) {
              try {
                const serializer = ctx.get(serializerCtx);
                const markdown = serializer(view.state.doc);
                if (markdown !== lastSerializedMarkdown) {
                  lastSerializedMarkdown = markdown;
                  // Convert yaml code block back to frontmatter format for onChange callback
                  onChangeRef.current?.(convertCodeBlockToFrontmatter(markdown));
                }
              } catch (e) {
                console.error('[ChangeListener] Serialization failed:', e);
              }
            }
          },
        }),
      });
    });
    crepe.editor.use(changeListenerPlugin);

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
    const content = crepeRef.current?.getMarkdown() ?? '';
    return convertCodeBlockToFrontmatter(content);
  }, []);

  const CHUNK_LOAD_LINE_THRESHOLD = 500; // Lines
  const CHUNK_SIZE_LINES = 100; // Lines per chunk

  const setMarkdown = useCallback((markdown: string, options?: { onContentSet?: () => void }) => {
    const editor = crepeRef.current?.editor;
    if (!editor?.ctx) return;

    const onContentSet = options?.onContentSet;

    // Reset scroll position to top before setting content (skip if caller will handle it)
    const container = containerRef.current;
    if (!onContentSet && container) {
      container.scrollTop = 0;
    }

    try {
      // Convert frontmatter to yaml code block for display
      const convertedMarkdown = convertFrontmatterToCodeBlock(markdown);

      const lines = convertedMarkdown.split('\n');
      const totalLines = lines.length;

      // For small files, use direct parsing
      if (totalLines <= CHUNK_LOAD_LINE_THRESHOLD) {
        const view = editor.ctx.get(editorViewCtx);
        const parser = editor.ctx.get(parserCtx);
        const doc = parser(convertedMarkdown);
        if (!doc) return;

        const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content);
        tr.setMeta("addToHistory", false);  // 不添加到历史记录
        view.dispatch(tr);

        if (onContentSet) {
          // Fire callback after layout completes
          requestAnimationFrame(() => onContentSet());
        } else {
          // Ensure scroll is at top after content is set
          requestAnimationFrame(() => {
            if (container) {
              container.scrollTop = 0;
            }
            const editorElement = container?.querySelector('.ProseMirror') as HTMLElement | null;
            if (editorElement) {
              editorElement.scrollTop = 0;
            }
          });
        }
        return;
      }

      // For large files, use chunked loading.
      const chunks = splitAtCodeBlockBoundaries(lines, CHUNK_SIZE_LINES);

      const view = editor.ctx.get(editorViewCtx);
      const parser = editor.ctx.get(parserCtx);

      // First chunk — show immediately
      const firstDoc = parser(chunks[0].join('\n'));
      if (!firstDoc) return;

      const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, firstDoc.content);
      tr.setMeta("addToHistory", false);
      view.dispatch(tr);

      // Then load remaining chunks
      let currentChunkIndex = 1;

      const loadNextChunk = () => {
        if (currentChunkIndex >= chunks.length) {
          // All chunks loaded
          if (onContentSet) {
            requestAnimationFrame(() => onContentSet());
          }
          return;
        }

        const chunk = chunks[currentChunkIndex].join('\n');
        currentChunkIndex++;

        try {
          const chunkDoc = parser(chunk);
          if (chunkDoc) {
            const currentSize = view.state.doc.content.size;
            const tr = view.state.tr.insert(currentSize, chunkDoc.content);
            tr.setMeta("addToHistory", false);
            view.dispatch(tr);
          }
        } catch (e) {
          console.error('Chunk load error:', e);
        }

        // Schedule next chunk
        if (currentChunkIndex < chunks.length) {
          if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => loadNextChunk(), { timeout: 50 });
          } else {
            setTimeout(loadNextChunk, 10);
          }
        } else {
          // Last chunk loaded
          if (onContentSet) {
            requestAnimationFrame(() => onContentSet());
          }
        }
      };

      // Start loading remaining chunks
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => loadNextChunk(), { timeout: 100 });
      } else {
        setTimeout(loadNextChunk, 50);
      }

      if (!onContentSet) {
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
        const estimatedLoadTime = Math.ceil((chunks.length - 1)) * 60;
        setTimeout(resetScrollToTop, estimatedLoadTime);
      }

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

  // LaTeX code block: auto-detect language and add data-lang attribute
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateLatexCodeBlocks = () => {
      const codeBlocks = container.querySelectorAll('.milkdown-code-block');
      codeBlocks.forEach((block) => {
        const langButton = block.querySelector('.language-button');
        if (langButton) {
          const lang = langButton.textContent?.trim().toLowerCase() || '';
          const prevLang = (block as HTMLElement).dataset.lang;

          // Set data-lang attribute for CSS targeting
          (block as HTMLElement).dataset.lang = lang;

          // If language changed from latex/mermaid to something else, remove selected class
          if ((prevLang === 'latex' || prevLang === 'mermaid') && lang !== prevLang) {
            block.classList.remove('selected');
          }
        }
      });
    };

    // Initial update
    updateLatexCodeBlocks();

    // Watch for changes
    const observer = new MutationObserver(() => {
      updateLatexCodeBlocks();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  // LaTeX code block: handle click to enter/exit edit mode
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const codeBlock = target.closest('.milkdown-code-block') as HTMLElement | null;

      // Check if we clicked inside a LaTeX code block
      if (codeBlock) {
        const lang = codeBlock.dataset.lang;
        if (lang !== 'latex' && lang !== 'LaTeX' && lang !== 'mermaid') return;

        // Don't handle clicks on the language button or picker
        if (target.closest('.language-button') || target.closest('.language-picker')) {
          return;
        }

        // If already selected, do nothing
        if (codeBlock.classList.contains('selected')) return;

        e.preventDefault();
        e.stopPropagation();

        // Get the editor instance
        const editor = crepeRef.current?.editor;
        if (!editor?.ctx) return;

        // Find the code block node position in ProseMirror
        const view = editor.ctx.get(editorViewCtx);

        // Try to find the position of this code block
        let pos: number | null = null;

        // Method 1: Use posAtDOM with the code block element
        try {
          pos = view.posAtDOM(codeBlock, 0);
        } catch {
          pos = null;
        }

        // Method 2: If that fails, search through the document
        if (pos === null) {
          view.state.doc.descendants((node, nodePos) => {
            if (node.type.name === 'code_block' && pos === null) {
              const domAtPos = view.nodeDOM(nodePos);
              if (domAtPos === codeBlock || (domAtPos instanceof HTMLElement && domAtPos.contains(codeBlock))) {
                pos = nodePos;
                return false;
              }
            }
            return true;
          });
        }

        if (pos !== null) {
          // Add selected class to enable edit mode
          codeBlock.classList.add('selected');

          // Select the node in ProseMirror
          view.dispatch(
            view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos))
          );

          // Focus the CodeMirror editor inside this code block
          const cmEditor = codeBlock.querySelector('.cm-editor') as HTMLElement | null;
          if (cmEditor) {
            // Use setTimeout to allow the CSS transition to complete
            setTimeout(() => {
              const cmContent = cmEditor.querySelector('.cm-content') as HTMLElement | null;
              cmContent?.focus();
            }, 50);
          }
        }
      } else {
        // Clicked outside any code block - deselect all LaTeX/mermaid code blocks
        const selectedLatexBlocks = container.querySelectorAll(
          '.milkdown-code-block[data-lang="latex"].selected, ' +
          '.milkdown-code-block[data-lang="LaTeX"].selected, ' +
          '.milkdown-code-block[data-lang="mermaid"].selected'
        );
        selectedLatexBlocks.forEach((block) => {
          block.classList.remove('selected');
        });
      }
    };

    container.addEventListener('click', handleClick, true);
    return () => container.removeEventListener('click', handleClick, true);
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
