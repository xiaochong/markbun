import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MilkdownEditor, MilkdownEditorRef } from './components/editor';
import { Toolbar, StatusBar, TitleBar, Sidebar } from './components/layout';
import { FileExplorer } from './components/file-explorer';
import { Outline } from './components/outline';
import { QuickOpen } from './components/quick-open';
import { useFileOperations } from './hooks/useFileOperations';
import { useTheme } from './hooks/useTheme';
import { useSidebar } from './hooks/useSidebar';
import { useFileExplorer } from './hooks/useFileExplorer';
import { useOutline } from './hooks/useOutline';
import { useQuickOpen } from './hooks/useQuickOpen';
import { electrobun } from './lib/electrobun';
import { processMarkdownImages, restoreOriginalImagePaths } from './lib/imageProcessor';
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

  // Paragraph menu event listener - unified handler
  useEffect(() => {
    return electrobun.on('menuAction', async (data) => {
      const { action } = data as { action: string };
      console.log('[App] menuAction received:', action);

      switch (action) {
        case 'para-heading-1':
          editorRef.current?.toggleHeading(1);
          break;
        case 'para-heading-2':
          editorRef.current?.toggleHeading(2);
          break;
        case 'para-heading-3':
          editorRef.current?.toggleHeading(3);
          break;
        case 'para-heading-4':
          editorRef.current?.toggleHeading(4);
          break;
        case 'para-heading-5':
          editorRef.current?.toggleHeading(5);
          break;
        case 'para-heading-6':
          editorRef.current?.toggleHeading(6);
          break;
        case 'para-paragraph':
          editorRef.current?.setParagraph();
          break;
        case 'para-increase-heading':
          editorRef.current?.increaseHeadingLevel();
          break;
        case 'para-decrease-heading':
          editorRef.current?.decreaseHeadingLevel();
          break;
        case 'table-insert':
          editorRef.current?.insertTable();
          break;
        case 'table-insert-row-above':
          editorRef.current?.insertTableRowAbove();
          break;
        case 'table-insert-row-below':
          editorRef.current?.insertTableRowBelow();
          break;
        case 'table-insert-col-left':
          editorRef.current?.insertTableColumnLeft();
          break;
        case 'table-insert-col-right':
          editorRef.current?.insertTableColumnRight();
          break;
        case 'table-move-row-up':
          editorRef.current?.moveTableRowUp();
          break;
        case 'table-move-row-down':
          editorRef.current?.moveTableRowDown();
          break;
        case 'table-move-col-left':
          editorRef.current?.moveTableColumnLeft();
          break;
        case 'table-move-col-right':
          editorRef.current?.moveTableColumnRight();
          break;
        case 'table-delete-row':
          editorRef.current?.deleteTableRow();
          break;
        case 'table-delete-col':
          editorRef.current?.deleteTableColumn();
          break;
        case 'table-delete':
          editorRef.current?.deleteTable();
          break;
        case 'para-math-block':
          editorRef.current?.insertMathBlock();
          break;
        case 'para-code-block':
          editorRef.current?.insertCodeBlock();
          break;
        case 'para-quote':
          editorRef.current?.toggleQuote();
          break;
        case 'para-ordered-list':
          editorRef.current?.toggleOrderedList();
          break;
        case 'para-unordered-list':
          editorRef.current?.toggleList();
          break;
        case 'para-task-list':
          editorRef.current?.insertTaskList();
          break;
        case 'para-insert-above':
          editorRef.current?.insertParagraphAbove();
          break;
        case 'para-insert-below':
          editorRef.current?.insertParagraphBelow();
          break;
        case 'para-horizontal-rule':
          editorRef.current?.insertHorizontalRule();
          break;

        // Context menu / Edit menu editing actions
        case 'editor-undo':
          editorRef.current?.focus();
          document.execCommand('undo');
          break;
        case 'editor-redo':
          editorRef.current?.focus();
          document.execCommand('redo');
          break;
        case 'editor-cut': {
          console.log('[App] editor-cut from menu');
          // Get selection directly
          let selectedText: string | null = null;

          // Try editor selection first
          const editorSelection = editorRef.current?.getSelectedMarkdown?.();
          console.log('[App] editorSelection:', editorSelection?.substring(0, 50));
          if (editorSelection) {
            selectedText = editorSelection;
          }

          // Fallback to window selection
          if (!selectedText) {
            const selection = window.getSelection();
            console.log('[App] window selection:', selection?.toString().substring(0, 50));
            if (selection && !selection.isCollapsed) {
              selectedText = selection.toString();
            }
          }

          console.log('[App] selectedText for cut:', selectedText?.substring(0, 50));

          if (selectedText) {
            const textToCopy = selectedText.includes('blob:http')
              ? restoreOriginalImagePaths(selectedText)
              : selectedText;

            try {
              const result = await electrobun.writeToClipboard(textToCopy) as { success: boolean };
              console.log('[App] Cut result:', result);
              if (result.success) {
                document.execCommand('delete');
              }
            } catch (e) {
              console.error('[App] Cut failed:', e);
            }
          }
          break;
        }
        case 'editor-copy': {
          console.log('[App] editor-copy from menu');
          // Get selection directly
          let selectedText: string | null = null;

          // Try editor selection first
          const editorSelection = editorRef.current?.getSelectedMarkdown?.();
          console.log('[App] editorSelection:', editorSelection?.substring(0, 50));
          if (editorSelection) {
            selectedText = editorSelection;
          }

          // Fallback to window selection
          if (!selectedText) {
            const selection = window.getSelection();
            console.log('[App] window selection:', selection?.toString().substring(0, 50));
            if (selection && !selection.isCollapsed) {
              selectedText = selection.toString();
            }
          }

          console.log('[App] selectedText for copy:', selectedText?.substring(0, 50));

          if (selectedText) {
            const textToCopy = selectedText.includes('blob:http')
              ? restoreOriginalImagePaths(selectedText)
              : selectedText;

            try {
              const result = await electrobun.writeToClipboard(textToCopy);
              console.log('[App] Copy result:', result);
            } catch (e) {
              console.error('[App] Copy failed:', e);
            }
          }
          break;
        }
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
  }, []);

  // Toolbar action handlers
  const handleBold = useCallback(() => editorRef.current?.toggleBold(), []);
  const handleItalic = useCallback(() => editorRef.current?.toggleItalic(), []);
  const handleHeading = useCallback((level: number) => editorRef.current?.toggleHeading(level), []);
  const handleQuote = useCallback(() => editorRef.current?.toggleQuote(), []);
  const handleCode = useCallback(() => editorRef.current?.toggleCode(), []);
  const handleLink = useCallback(() => editorRef.current?.toggleLink(), []);
  const handleList = useCallback(() => editorRef.current?.toggleList(), []);
  const handleOrderedList = useCallback(() => editorRef.current?.toggleOrderedList(), []);

  // Store callbacks in ref to avoid stale closures in keyboard shortcuts
  const callbacksRef = useRef({
    handleSave,
    handleSaveAs,
    handleOpen,
    updateContent,
    setEditorContent,
    quickOpenOpen: quickOpen.open,
    sidebarToggle: sidebar.toggle,
  });

  // Keep callbacksRef up to date
  useEffect(() => {
    callbacksRef.current = {
      handleSave,
      handleSaveAs,
      handleOpen,
      updateContent,
      setEditorContent,
      quickOpenOpen: quickOpen.open,
      sidebarToggle: sidebar.toggle,
    };
  }, [handleSave, handleSaveAs, handleOpen, updateContent, quickOpen.open, sidebar.toggle]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey) {
        const { handleSave, handleSaveAs, handleOpen, updateContent, setEditorContent, quickOpenOpen, sidebarToggle } = callbacksRef.current;

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
            quickOpenOpen();
            break;
          case 'b':
            e.preventDefault();
            sidebarToggle();
            break;
          case 'c': {
            // Intercept Cmd+C to handle blob URL conversion
            e.preventDefault();

            // Get selection directly
            let selectedText: string | null = null;
            const editorSelection = editorRef.current?.getSelectedMarkdown?.();
            if (editorSelection) {
              selectedText = editorSelection;
            }
            if (!selectedText) {
              const selection = window.getSelection();
              if (selection && !selection.isCollapsed) {
                selectedText = selection.toString();
              }
            }
            if (selectedText) {
              const textToCopy = selectedText.includes('blob:http')
                ? restoreOriginalImagePaths(selectedText)
                : selectedText;
              void electrobun.writeToClipboard(textToCopy);
            }
            break;
          }
          case 'x': {
            // Intercept Cmd+X to handle blob URL conversion
            e.preventDefault();

            // Get selection directly
            let selectedText: string | null = null;
            const editorSelection = editorRef.current?.getSelectedMarkdown?.();
            if (editorSelection) {
              selectedText = editorSelection;
            }
            if (!selectedText) {
              const selection = window.getSelection();
              if (selection && !selection.isCollapsed) {
                selectedText = selection.toString();
              }
            }
            if (selectedText) {
              const textToCopy = selectedText.includes('blob:http')
                ? restoreOriginalImagePaths(selectedText)
                : selectedText;
              void electrobun.writeToClipboard(textToCopy).then((result: { success: boolean }) => {
                if (result.success) {
                  document.execCommand('delete');
                }
              });
            }
            break;
          }
          case 'v':
          case 'a':
          case 'z':
            return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    </div>
  );
}

export default App;
