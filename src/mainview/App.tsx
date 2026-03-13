import { useRef, useCallback, useEffect, useState } from 'react';
import { MilkdownEditor, MilkdownEditorRef } from './components/editor';
import { Toolbar, StatusBar, TitleBar } from './components/layout';
import { useFileOperations } from './hooks/useFileOperations';
import { useTheme } from './hooks/useTheme';
import { electrobun } from './lib/electrobun';
import { processMarkdownImages } from './lib/imageProcessor';

function App() {
  const editorRef = useRef<MilkdownEditorRef>(null);
  const { theme, toggleTheme } = useTheme();
  const [editorContent, setEditorContent] = useState('');

  // Visibility states for UI components (default: TitleBar hidden, Toolbar hidden, StatusBar shown)
  const [showTitleBar, setShowTitleBar] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showStatusBar, setShowStatusBar] = useState(true);

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
  }, [updateContent]);

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

      // Process images in the markdown content
      const processedContent = await processMarkdownImages(fileContent, filePath);

      // Directly set content to editor when file is opened
      if (editorRef.current?.isReady) {
        editorRef.current.setMarkdown(processedContent);
        setEditorContent(processedContent);
      } else {
        // If editor not ready, wait and try again
        const checkAndSet = () => {
          if (editorRef.current?.isReady) {
            editorRef.current.setMarkdown(processedContent);
            setEditorContent(processedContent);
          } else {
            setTimeout(checkAndSet, 50);
          }
        };
        checkAndSet();
      }
    });
  }, []);

  // Listen for file-new event to clear editor
  useEffect(() => {
    return electrobun.on('file-new', () => {
      if (editorRef.current?.isReady) {
        editorRef.current.setMarkdown('');
        setEditorContent('');
      }
    });
  }, []);

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

  // Toolbar action handlers
  const handleBold = useCallback(() => {
    editorRef.current?.toggleBold();
  }, []);

  const handleItalic = useCallback(() => {
    editorRef.current?.toggleItalic();
  }, []);

  const handleHeading = useCallback((level: number) => {
    editorRef.current?.toggleHeading(level);
  }, []);

  const handleQuote = useCallback(() => {
    editorRef.current?.toggleQuote();
  }, []);

  const handleCode = useCallback(() => {
    editorRef.current?.toggleCode();
  }, []);

  const handleLink = useCallback(() => {
    editorRef.current?.toggleLink();
  }, []);

  const handleList = useCallback(() => {
    editorRef.current?.toggleList();
  }, []);

  const handleOrderedList = useCallback(() => {
    editorRef.current?.toggleOrderedList();
  }, []);

  // Store callbacks in ref to avoid stale closures in keyboard shortcuts
  const callbacksRef = useRef({
    handleSave,
    handleSaveAs,
    handleOpen,
    updateContent,
    setEditorContent,
  });

  // Keep callbacksRef up to date
  useEffect(() => {
    callbacksRef.current = {
      handleSave,
      handleSaveAs,
      handleOpen,
      updateContent,
      setEditorContent,
    };
  }, [handleSave, handleSaveAs, handleOpen, updateContent]);

  // Keyboard shortcuts - stable listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey) {
        const { handleSave, handleSaveAs, handleOpen, updateContent, setEditorContent } = callbacksRef.current;

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
          case 'c':
          case 'v':
          case 'x':
          case 'a':
          case 'z':
            // Let these keys pass through for native/WebView handling
            return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty deps - listener never changes

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

      {/* Editor */}
      <main className="flex-1 overflow-hidden">
        <MilkdownEditor
          ref={editorRef}
          defaultValue={content}
          onChange={handleEditorChange}
          className="h-full"
          darkMode={theme === 'dark'}
        />
      </main>

      {/* Status Bar */}
      {showStatusBar && (
        <StatusBar
          filePath={path || undefined}
          isDirty={isDirty}
          content={editorContent}
          onSaveStatus={saveStatus || undefined}
        />
      )}
    </div>
  );
}

export default App;
