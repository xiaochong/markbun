import { useRef, useCallback, useEffect, useState } from 'react';
import { MilkdownEditor, MilkdownEditorRef } from './components/editor';
import { Toolbar, StatusBar, TitleBar } from './components/layout';
import { useFileOperations } from './hooks/useFileOperations';
import { useTheme } from './hooks/useTheme';
import { electrobun } from './lib/electrobun';

function App() {
  const editorRef = useRef<MilkdownEditorRef>(null);
  const { toggleTheme } = useTheme();
  const [editorContent, setEditorContent] = useState('');
  
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

  // Update editor when content changes from file operations
  useEffect(() => {
    if (editorRef.current?.isReady) {
      const currentContent = editorRef.current.getMarkdown();
      if (currentContent !== content) {
        editorRef.current.setMarkdown(content);
        setEditorContent(content);
      }
    }
  }, [content]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      if (cmdKey) {
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
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSaveAs, handleOpen, updateContent]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Title Bar */}
      <TitleBar 
        title={path ? path.split('/').pop() : 'Untitled'}
        isDirty={isDirty}
      />

      {/* Toolbar */}
      <Toolbar />

      {/* Editor */}
      <main className="flex-1 overflow-hidden">
        <MilkdownEditor
          ref={editorRef}
          defaultValue={content}
          onChange={handleEditorChange}
          className="h-full"
        />
      </main>

      {/* Status Bar */}
      <StatusBar
        filePath={path || undefined}
        isDirty={isDirty}
        content={editorContent}
        onSaveStatus={saveStatus || undefined}
      />
    </div>
  );
}

export default App;
