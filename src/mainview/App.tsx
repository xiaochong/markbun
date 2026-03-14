import { useRef, useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MilkdownEditor, MilkdownEditorRef } from './components/editor';
import { Toolbar, StatusBar, TitleBar, Sidebar } from './components/layout';
import { FileExplorer } from './components/file-explorer';
import { Outline } from './components/outline';
import { QuickOpen } from './components/quick-open';
import { ImageInsertDialog } from './components/image-insert';
import { useFileOperations } from './hooks/useFileOperations';
import { useTheme } from './hooks/useTheme';
import { useSidebar } from './hooks/useSidebar';
import { useFileExplorer } from './hooks/useFileExplorer';
import { useOutline } from './hooks/useOutline';
import { useQuickOpen } from './hooks/useQuickOpen';
import { useClipboard } from './hooks/useClipboard';
import { electrobun } from './lib/electrobun';
import { processMarkdownImages } from './lib/imageProcessor';
import { imageCache } from './lib/imageCache';
import type { FileNode } from '@/shared/types';

function App() {
  const editorRef = useRef<MilkdownEditorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const [editorContent, setEditorContent] = useState('');

  // Visibility states for UI components (all hidden by default for distraction-free writing)
  const [showTitleBar, setShowTitleBar] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showStatusBar, setShowStatusBar] = useState(false);

  // Image insert dialog state
  const [showImageDialog, setShowImageDialog] = useState(false);

  // Phase 2: Sidebar and file management
  const sidebar = useSidebar();
  const fileExplorer = useFileExplorer();
  const outline = useOutline();
  const quickOpen = useQuickOpen(handleQuickOpenSelect);

  const {
    path,
    content,
    isDirty,
    saveStatus,
    updateContent,
    handleOpen,
    handleSave,
    handleSaveAs,
  } = useFileOperations();

  // Clipboard operations with blob URL handling
  const clipboard = useClipboard(editorRef);

  // Handle editor content changes
  const handleEditorChange = useCallback((markdown: string) => {
    updateContent(markdown);
    setEditorContent(markdown);
    outline.setHeadings(markdown);
  }, [updateContent, outline.setHeadings]);

  // Handle quick open file selection
  function handleQuickOpenSelect(filePath: string) {
    // Open file via IPC
    openFileByPath(filePath);
    // Close quick open dialog
    quickOpen.close();
  }

  // Check if markdown contains local images that need processing
  const hasLocalImages = useCallback((content: string): boolean => {
    // Match ![alt](path) where path is not data:, blob:, or http/https
    return /!\[.*?\]\((?!data:|blob:|https?:\/\/)[^)]+\)/.test(content);
  }, []);

  // Open file by path
  const openFileByPath = useCallback(async (filePath: string) => {
    try {
      const result = await electrobun.readFile({ path: filePath }) as {
        success: boolean;
        path?: string;
        content?: string;
        error?: string;
      };

      if (result.success && result.content !== undefined && result.path) {
        // Auto-set file explorer root to the file's parent directory
        const parentDir = result.path.substring(0, result.path.lastIndexOf('/')) || '/';
        fileExplorer.setRootPath(parentDir);

        // Update selected file in file explorer (highlight current file)
        fileExplorer.selectFile(result.path);

        // Check if content has local images
        const needsImageProcessing = hasLocalImages(result.content);

        if (needsImageProcessing) {
          // Process images first, then render once
          const processedContent = await processMarkdownImages(result.content, result.path);

          if (editorRef.current?.isReady) {
            editorRef.current.setMarkdown(processedContent);
            setEditorContent(processedContent);
            outline.setHeadings(processedContent);
          }
        } else {
          // No local images, render immediately
          if (editorRef.current?.isReady) {
            editorRef.current.setMarkdown(result.content);
            setEditorContent(result.content);
            outline.setHeadings(result.content);
          }
        }

        // Add to recent files
        await electrobun.addRecentFile({ path: result.path });
      }
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }, [fileExplorer.setRootPath, fileExplorer.selectFile, hasLocalImages, outline.setHeadings]);

  // Handle file click in file explorer
  const handleFileClick = useCallback((file: FileNode) => {
    openFileByPath(file.path);
  }, [openFileByPath]);

  // Handle outline heading click
  const handleOutlineClick = useCallback((id: string, text: string) => {
    // Find the editor container
    const editorContainer = containerRef.current;
    if (!editorContainer) return;

    // Find all heading elements in the editor
    const headings = editorContainer.querySelectorAll('h1, h2, h3, h4, h5, h6');

    // Find the heading with matching text
    for (const heading of headings) {
      if (heading.textContent?.trim() === text) {
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
  }, []);

  // Listen for sidebar toggle
  useEffect(() => {
    return electrobun.on('toggle-sidebar', () => {
      sidebar.toggle();
    });
  }, [sidebar.toggle]);

  // Listen for quick open
  useEffect(() => {
    return electrobun.on('open-quick-open', () => {
      quickOpen.open();
    });
  }, [quickOpen.open]);

  // Listen for theme toggle event from main process
  useEffect(() => {
    return electrobun.on('toggle-theme', () => {
      toggleTheme();
    });
  }, [toggleTheme]);

  // Listen for file-opened event to set editor content directly
  useEffect(() => {
    return electrobun.on('file-opened', async (data) => {
      const { path: filePath, content: fileContent } = data as { path: string; content: string };

      // Auto-set file explorer root to the file's parent directory
      const parentDir = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
      fileExplorer.setRootPath(parentDir);

      // Update selected file in file explorer (highlight current file)
      fileExplorer.selectFile(filePath);

      // Check if content has local images
      const needsImageProcessing = hasLocalImages(fileContent);

      const setContent = async () => {
        if (needsImageProcessing) {
          // Process images first, then render once
          const processedContent = await processMarkdownImages(fileContent, filePath);
          if (editorRef.current?.isReady) {
            editorRef.current.setMarkdown(processedContent);
            setEditorContent(processedContent);
            outline.setHeadings(processedContent);
          }
        } else {
          // No local images, render immediately
          if (editorRef.current?.isReady) {
            editorRef.current.setMarkdown(fileContent);
            setEditorContent(fileContent);
            outline.setHeadings(fileContent);
          }
        }
      };

      const loadContent = async () => {
        if (editorRef.current?.isReady) {
          await setContent();
        } else {
          const checkAndSet = () => {
            if (editorRef.current?.isReady) {
              void setContent();
            } else {
              setTimeout(checkAndSet, 50);
            }
          };
          checkAndSet();
        }
      };

      void loadContent();
    });
  }, [outline.setHeadings, fileExplorer.setRootPath, fileExplorer.selectFile, hasLocalImages]);

  // Listen for file-new event to clear editor
  useEffect(() => {
    return electrobun.on('file-new', () => {
      if (editorRef.current?.isReady) {
        editorRef.current.setMarkdown('');
        setEditorContent('');
        outline.setHeadings('');
      }
    });
  }, [outline.setHeadings]);

  // Listen for visibility toggle events
  useEffect(() => {
    return electrobun.on('toggle-titlebar', () => {
      setShowTitleBar(prev => !prev);
    });
  }, []);

  useEffect(() => {
    return electrobun.on('toggle-toolbar', () => {
      setShowToolbar(prev => !prev);
    });
  }, []);

  useEffect(() => {
    return electrobun.on('toggle-statusbar', () => {
      setShowStatusBar(prev => !prev);
    });
  }, []);

  // Menu action handler
  useEffect(() => {
    return electrobun.on('menuAction', async (data) => {
      const { action } = data as { action: string };

      // Format menu actions
      const formatActions: Record<string, () => void> = {
        'format-strong': () => editorRef.current?.toggleBold(),
        'format-emphasis': () => editorRef.current?.toggleItalic(),
        'format-code': () => editorRef.current?.toggleCode(),
        'format-strikethrough': () => editorRef.current?.toggleStrikethrough(),
        'format-link': () => editorRef.current?.toggleLink(),
        'format-image': () => setShowImageDialog(true),
      };

      if (formatActions[action]) {
        formatActions[action]();
        return;
      }

      // Paragraph formatting
      const paragraphActions: Record<string, () => void> = {
        'para-heading-1': () => editorRef.current?.toggleHeading(1),
        'para-heading-2': () => editorRef.current?.toggleHeading(2),
        'para-heading-3': () => editorRef.current?.toggleHeading(3),
        'para-heading-4': () => editorRef.current?.toggleHeading(4),
        'para-heading-5': () => editorRef.current?.toggleHeading(5),
        'para-heading-6': () => editorRef.current?.toggleHeading(6),
        'para-paragraph': () => editorRef.current?.setParagraph(),
        'para-increase-heading': () => editorRef.current?.increaseHeadingLevel(),
        'para-decrease-heading': () => editorRef.current?.decreaseHeadingLevel(),
        'para-math-block': () => editorRef.current?.insertMathBlock(),
        'para-code-block': () => editorRef.current?.insertCodeBlock(),
        'para-quote': () => editorRef.current?.toggleQuote(),
        'para-ordered-list': () => editorRef.current?.toggleOrderedList(),
        'para-unordered-list': () => editorRef.current?.toggleList(),
        'para-task-list': () => editorRef.current?.insertTaskList(),
        'para-insert-above': () => editorRef.current?.insertParagraphAbove(),
        'para-insert-below': () => editorRef.current?.insertParagraphBelow(),
        'para-horizontal-rule': () => editorRef.current?.insertHorizontalRule(),
        'table-insert': () => editorRef.current?.insertTable(),
        'table-insert-row-above': () => editorRef.current?.insertTableRowAbove(),
        'table-insert-row-below': () => editorRef.current?.insertTableRowBelow(),
        'table-insert-col-left': () => editorRef.current?.insertTableColumnLeft(),
        'table-insert-col-right': () => editorRef.current?.insertTableColumnRight(),
        'table-move-row-up': () => editorRef.current?.moveTableRowUp(),
        'table-move-row-down': () => editorRef.current?.moveTableRowDown(),
        'table-move-col-left': () => editorRef.current?.moveTableColumnLeft(),
        'table-move-col-right': () => editorRef.current?.moveTableColumnRight(),
        'table-delete-row': () => editorRef.current?.deleteTableRow(),
        'table-delete-col': () => editorRef.current?.deleteTableColumn(),
        'table-delete': () => editorRef.current?.deleteTable(),
      };

      if (paragraphActions[action]) {
        paragraphActions[action]();
        return;
      }

      // Edit actions
      switch (action) {
        case 'editor-undo':
          editorRef.current?.focus();
          document.execCommand('undo');
          break;
        case 'editor-redo':
          editorRef.current?.focus();
          document.execCommand('redo');
          break;
        case 'editor-cut':
          await clipboard.cut();
          break;
        case 'editor-copy':
          await clipboard.copy();
          break;
        case 'editor-paste':
          editorRef.current?.focus();
          document.execCommand('paste');
          break;
        case 'editor-select-all':
          editorRef.current?.focus();
          document.execCommand('selectAll');
          break;
      }
    });
  }, [clipboard]);

  // Toolbar action handlers
  const handleBold = useCallback(() => editorRef.current?.toggleBold(), []);
  const handleItalic = useCallback(() => editorRef.current?.toggleItalic(), []);
  const handleHeading = useCallback((level: number) => editorRef.current?.toggleHeading(level), []);
  const handleQuote = useCallback(() => editorRef.current?.toggleQuote(), []);
  const handleCode = useCallback(() => editorRef.current?.toggleCode(), []);
  const handleLink = useCallback(() => editorRef.current?.toggleLink(), []);
  const handleList = useCallback(() => editorRef.current?.toggleList(), []);
  const handleOrderedList = useCallback(() => editorRef.current?.toggleOrderedList(), []);

  // Handle image insert
  const handleImageInsert = useCallback(async (src: string, alt: string) => {
    // Insert image at current cursor position
    const editor = editorRef.current;
    if (!editor?.isReady) return;

    let imageUrl = src;

    // Check if it's a local file path (not URL)
    const isLocalFile = !src.startsWith('http://') &&
                        !src.startsWith('https://') &&
                        !src.startsWith('data:') &&
                        !src.startsWith('blob:') &&
                        src.startsWith('/');

    if (isLocalFile) {
      // Check cache first
      const cached = imageCache.get(src);
      if (cached) {
        imageUrl = cached;
      } else {
        // Read image and convert to Blob URL
        try {
          const response = await electrobun.readImageAsBase64(src) as {
            success: boolean;
            dataUrl?: string;
            error?: string;
          };
          if (response.success && response.dataUrl) {
            imageUrl = imageCache.setFromBase64(src, response.dataUrl);
          } else {
            console.error('Failed to read image:', response.error);
          }
        } catch (error) {
          console.error('Failed to read image file:', error);
        }
      }
    }

    // Insert image using Milkdown's insertImageCommand
    editor.insertImage(imageUrl, alt);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (!cmdKey) return;

      switch (e.key.toLowerCase()) {
        case 's':
          e.preventDefault();
          if (e.shiftKey) {
            handleSaveAs();
          } else {
            handleSave();
          }
          break;
        case 'o':
          e.preventDefault();
          handleOpen();
          break;
        case 'n':
          e.preventDefault();
          updateContent('');
          setEditorContent('');
          if (editorRef.current?.isReady) {
            editorRef.current.setMarkdown('');
          }
          break;
        case 'p':
          e.preventDefault();
          quickOpen.open();
          break;
        case 'b':
          e.preventDefault();
          sidebar.toggle();
          break;
        case 'c':
          e.preventDefault();
          void clipboard.copy();
          break;
        case 'x':
          e.preventDefault();
          void clipboard.cut();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSaveAs, handleOpen, updateContent, quickOpen.open, sidebar.toggle, clipboard]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Title Bar */}
      {showTitleBar && (
        <TitleBar
          title={path ? path.split('/').pop() : 'Untitled'}
          isDirty={isDirty}
        />
      )}

      {/* Toolbar */}
      {showToolbar && (
        <Toolbar
          onBold={handleBold}
          onItalic={handleItalic}
          onHeading={handleHeading}
          onQuote={handleQuote}
          onCode={handleCode}
          onLink={handleLink}
          onList={handleList}
          onOrderedList={handleOrderedList}
        />
      )}

      {/* Main Content Area with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebar.isOpen}
          activeTab={sidebar.activeTab}
          width={sidebar.width}
          isResizing={sidebar.isResizing}
          onTabChange={sidebar.setTab}
          onClose={sidebar.close}
          onResizeStart={sidebar.startResize}
          onResizeEnd={sidebar.stopResize}
          onWidthChange={sidebar.setWidth}
        >
          {/* File Explorer - hidden when outline tab is active */}
          <div className={cn('h-full', sidebar.activeTab === 'files' ? 'block' : 'hidden')}>
            <FileExplorer
              nodes={fileExplorer.nodes}
              rootPath={fileExplorer.rootPath}
              expandedPaths={fileExplorer.expandedPaths}
              selectedPath={fileExplorer.selectedPath}
              isLoading={fileExplorer.isLoading}
              error={fileExplorer.error}
              onToggleFolder={fileExplorer.toggleFolder}
              onSelectFile={fileExplorer.selectFile}
              onFileClick={handleFileClick}
            />
          </div>
          {/* Outline - hidden when files tab is active */}
          <div className={cn('h-full', sidebar.activeTab === 'outline' ? 'block' : 'hidden')}>
            <Outline
              headings={outline.headings}
              activeId={outline.activeId}
              onHeadingClick={handleOutlineClick}
            />
          </div>
        </Sidebar>

        {/* Editor */}
        <main ref={containerRef} className="flex-1 overflow-hidden">
          <MilkdownEditor
            ref={editorRef}
            defaultValue={content}
            onChange={handleEditorChange}
            className="h-full"
            darkMode={theme === 'dark'}
          />
        </main>
      </div>

      {/* Status Bar */}
      {showStatusBar && (
        <StatusBar
          filePath={path || undefined}
          isDirty={isDirty}
          content={editorContent}
          onSaveStatus={saveStatus || undefined}
        />
      )}

      {/* Quick Open Dialog */}
      <QuickOpen
        isOpen={quickOpen.isOpen}
        query={quickOpen.query}
        items={quickOpen.items}
        selectedIndex={quickOpen.selectedIndex}
        onQueryChange={quickOpen.setQuery}
        onSelect={handleQuickOpenSelect}
        onClose={quickOpen.close}
        onSelectNext={quickOpen.selectNext}
        onSelectPrevious={quickOpen.selectPrevious}
      />

      {/* Image Insert Dialog */}
      <ImageInsertDialog
        isOpen={showImageDialog}
        onClose={() => setShowImageDialog(false)}
        onInsert={handleImageInsert}
      />
    </div>
  );
}

export default App;
