import { useRef, useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { cn } from '@/lib/utils';
import { MilkdownEditor, MilkdownEditorRef, SourceEditor, SourceEditorRef } from './components/editor';
import { Toolbar, StatusBar, TitleBar, Sidebar } from './components/layout';
import { FileExplorer, isImageFile } from './components/file-explorer';
import { Outline } from './components/outline';
import { QuickOpen } from './components/quick-open';
import { ImageInsertDialog } from './components/image-insert';
import { ImageViewer } from './components/image-viewer';
import { SettingsDialog } from './components/settings';
import { SaveDialog } from './components/save-dialog';
import { useFileOperations } from './hooks/useFileOperations';
import { useTheme } from './hooks/useTheme';
import { useSidebar } from './hooks/useSidebar';
import { useFileExplorer } from './hooks/useFileExplorer';
import { useOutline } from './hooks/useOutline';
import { useQuickOpen } from './hooks/useQuickOpen';
import { useClipboard } from './hooks/useClipboard';
import { electrobun } from './lib/electrobun';
import {
  workspaceManager,
  processMarkdownImages,
  hasLocalImages,
  loadLocalImage,
  isLocalFilePath,
  restoreOriginalImagePaths,
} from './lib/image';
import type { FileNode, AppSettings, UIState } from '@/shared/types';

function App() {
  const editorRef = useRef<MilkdownEditorRef>(null);
  const sourceEditorRef = useRef<SourceEditorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [editorContent, setEditorContent] = useState('');

  // Flag to ignore editor changes during file switching
  const isSwitchingFileRef = useRef(false);

  // Image viewer state
  const [imagePreviewPath, setImagePreviewPath] = useState<string | null>(null);

  // Phase 3: Settings
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      const result = await electrobun.getSettings() as { success: boolean; settings?: AppSettings };
      if (result.success && result.settings) {
        setSettings(result.settings);
      }
    };
    void loadSettings();
  }, []);

  // Theme management from settings
  const { theme, toggleTheme } = useTheme({
    initialTheme: settings?.theme ?? 'system',
    onThemeChange: async (newTheme) => {
      if (settings) {
        const newSettings = { ...settings, theme: newTheme };
        setSettings(newSettings);
        await electrobun.saveSettings(newSettings);
      }
    },
  });

  // Visibility states for UI components (loaded from settings or defaults)
  const [showTitleBar, setShowTitleBar] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showStatusBar, setShowStatusBar] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const sourceModeRef = useRef(sourceMode);

  // Keep ref in sync with state
  useEffect(() => {
    sourceModeRef.current = sourceMode;
  }, [sourceMode]);

  // Image insert dialog state
  const [showImageDialog, setShowImageDialog] = useState(false);

  // Phase 2: Sidebar and file management - MUST be declared before UI state effects
  const sidebar = useSidebar();
  const fileExplorer = useFileExplorer({
    enablePolling: true,
    pollingInterval: 5000,
    maxDepth: 3,
  });
  // Use ref to track rootPath for save callback to avoid stale closure
  const fileExplorerRef = useRef(fileExplorer);
  fileExplorerRef.current = fileExplorer;
  const outline = useOutline();
  const quickOpen = useQuickOpen(handleQuickOpenSelect);

  // Load UI state on mount (only once, not when sidebar changes)
  useEffect(() => {
    const loadUIState = async () => {
      const result = await electrobun.getUIState() as { success: boolean; state?: UIState };
      if (result.success && result.state) {
        setShowTitleBar(result.state.showTitleBar);
        setShowToolbar(result.state.showToolBar);
        setShowStatusBar(result.state.showStatusBar);
        setSourceMode(result.state.sourceMode ?? false);
        // Use setIsOpen and setWidth directly to avoid triggering sidebar tab switch
        sidebar.setIsOpen(result.state.showSidebar);
        sidebar.setWidth(result.state.sidebarWidth);
        // Only set tab without opening sidebar
        sidebar.setTab(result.state.sidebarActiveTab);
      }
    };
    void loadUIState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for a file passed via CLI or open-url on startup
  useEffect(() => {
    const checkPendingFile = async () => {
      const result = await electrobun.getPendingFile() as { path: string; content: string } | null;
      if (result) {
        const listeners = (window as any).__electrobunListeners?.['file-opened'] || [];
        listeners.forEach((cb: (data: unknown) => void) => cb(result));
      }
    };
    void checkPendingFile();
  }, []);

  // Debounced UI state save (UI state only, window state is managed by main process)
  const uiStateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUIStateRef = useRef<{
    showTitleBar: boolean;
    showToolBar: boolean;
    showStatusBar: boolean;
    showSidebar: boolean;
    sourceMode: boolean;
    sidebarWidth: number;
    sidebarActiveTab: 'files' | 'outline' | 'search';
  } | null>(null);

  const flushUIState = useCallback(async () => {
    if (pendingUIStateRef.current) {
      await electrobun.saveUIState(pendingUIStateRef.current);
      pendingUIStateRef.current = null;
    }
  }, []);

  const saveUIState = useCallback(() => {
    // Store pending state
    pendingUIStateRef.current = {
      showTitleBar,
      showToolBar: showToolbar,
      showStatusBar,
      showSidebar: sidebar.isOpen,
      sourceMode,
      sidebarWidth: sidebar.width,
      sidebarActiveTab: sidebar.activeTab,
    };

    if (uiStateTimeoutRef.current) {
      clearTimeout(uiStateTimeoutRef.current);
    }
    uiStateTimeoutRef.current = setTimeout(() => {
      void flushUIState();
    }, 300);
  }, [showTitleBar, showToolbar, showStatusBar, sidebar.isOpen, sidebar.width, sidebar.activeTab, flushUIState, sourceMode]);

  // Save UI state when visibility changes
  useEffect(() => {
    saveUIState();
  }, [showTitleBar, showToolbar, showStatusBar, sourceMode, sidebar.isOpen, sidebar.width, sidebar.activeTab, saveUIState]);

  // Save UI state before window closes
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Flush any pending state immediately
      void flushUIState();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushUIState]);


  // Track current file path for image processing
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);

  const {
    path,
    content,
    isDirty,
    saveStatus,
    saveDialogState,
    updateContent,
    handleOpen,
    handleSave,
    handleSaveAs,
    closeSaveDialog,
    handleSaveFromDialog,
    cancelPendingSave,
    resetFileState,
    clearFile,
  } = useFileOperations({
    enableAutoSave: settings?.autoSave ?? true,
    autoSaveInterval: settings?.autoSaveInterval ?? 2000,
    onSaveSuccess: (savedPath) => {
      // Set root path to the file's parent directory (so new files appear in file explorer)
      const parentDir = savedPath.substring(0, savedPath.lastIndexOf('/')) || '/';
      // Check current rootPath using ref to avoid stale closure
      const currentRoot = fileExplorerRef.current.rootPath;
      if (currentRoot === parentDir) {
        // Same directory: setRootPath would skip, so force refresh with specific path
        fileExplorerRef.current.refresh(true, parentDir);
      } else {
        // Different directory or null: setRootPath will load the new directory
        fileExplorerRef.current.setRootPath(parentDir);
      }
      // Select the saved file in file explorer
      fileExplorerRef.current.selectFile(savedPath);
    },
  });

  // Unified workspace reset function
  const resetWorkspace = useCallback((options?: { skipEditorClear?: boolean }) => {
    // Cancel any pending operations first
    cancelPendingSave();

    // Clear editor content
    if (!options?.skipEditorClear) {
      if (sourceMode) {
        sourceEditorRef.current?.setValue('');
      } else {
        editorRef.current?.setMarkdown('');
      }
    }

    // Use flushSync to force immediate state update
    flushSync(() => {
      setEditorContent('');
      outline.setHeadings('');
      workspaceManager.setCurrentFile(null);
      setCurrentFilePath(null);
      setImagePreviewPath(null);
      clearFile();
    });
  }, [sourceMode, outline.setHeadings, cancelPendingSave, clearFile]);

  // Handle open folder
  const handleOpenFolder = useCallback(async () => {
    resetWorkspace();

    try {
      const result = await electrobun.openFolder() as { success: boolean; path?: string; error?: string };

      if (!result?.success || !result.path) {
        return;
      }

      // Update workspace and file explorer
      workspaceManager.setWorkspaceRoot(result.path);
      fileExplorer.setRootPath(result.path);
      fileExplorer.selectFile(null);
    } catch (error) {
      console.error('Failed to open folder:', error);
    }
  }, [resetWorkspace, fileExplorer.setRootPath, fileExplorer.selectFile]);

  // File loading cancel token to prevent race conditions
  const loadingCancelTokenRef = useRef<{ cancelled: boolean; path: string } | null>(null);

  // Sync path from useFileOperations to local state and workspace manager
  useEffect(() => {
    setCurrentFilePath(path);
    workspaceManager.setCurrentFile(path);
  }, [path]);

  // Initialize workspace root on mount (desktop as default)
  useEffect(() => {
    const initWorkspace = async () => {
      const result = await electrobun.getDesktopPath() as { success: boolean; path?: string };
      if (result.success && result.path) {
        workspaceManager.setWorkspaceRoot(result.path);
      }
    };
    void initWorkspace();
  }, []);

  // Clipboard operations with blob URL handling
  const clipboard = useClipboard(editorRef, currentFilePath, sourceMode);

  // Handle editor content changes from Milkdown
  const handleEditorChange = useCallback((markdown: string) => {
    // Ignore changes during file switching to prevent race conditions
    if (isSwitchingFileRef.current) {
      console.log('[Editor] Ignoring change during file switch');
      return;
    }
    updateContent(markdown);
    setEditorContent(markdown);
    outline.setHeadings(markdown);
  }, [updateContent, outline.setHeadings]);

  // Handle editor content changes from SourceEditor
  const handleSourceEditorChange = useCallback((markdown: string) => {
    // Ignore changes during file switching to prevent race conditions
    if (isSwitchingFileRef.current) {
      console.log('[Source Editor] Ignoring change during file switch');
      return;
    }
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

  // Open file by path
  const openFileByPath = useCallback(async (filePath: string) => {
    // Set flag to ignore editor changes during file switch
    isSwitchingFileRef.current = true;

    // Cancel any pending auto-save to prevent saving to wrong file
    cancelPendingSave();

    // Cancel any ongoing file loading to prevent race conditions
    if (loadingCancelTokenRef.current) {
      loadingCancelTokenRef.current.cancelled = true;
    }

    // Create new cancel token for this load operation
    const token = { cancelled: false, path: filePath };
    loadingCancelTokenRef.current = token;

    console.log('[FileLoad] Starting load:', filePath);

    // Clear image preview when opening a file in editor
    setImagePreviewPath(null);

    try {
      const result = await electrobun.readFile({ path: filePath }) as {
        success: boolean;
        path?: string;
        content?: string;
        error?: string;
      };

      // Check if this load operation has been cancelled
      if (token.cancelled) {
        console.log('[FileLoad] Load cancelled for:', filePath);
        return;
      }

      if (result.success && result.content !== undefined && result.path) {
        // Update workspace and file state
        workspaceManager.setCurrentFile(result.path);

        // Auto-set file explorer root to the file's parent directory
        const parentDir = result.path.substring(0, result.path.lastIndexOf('/')) || '/';
        fileExplorer.setRootPath(parentDir);

        // Update selected file in file explorer (highlight current file)
        fileExplorer.selectFile(result.path);

        // Reset file state to prevent auto-save from saving old file
        // This sets isDirty to false so any pending auto-save won't trigger
        resetFileState(result.path, result.content);

        // Check if content has local images
        const needsImageProcessing = hasLocalImages(result.content);

        // Clear editor first to force ImageBlock components to fully re-render
        // This prevents image sizing issues when switching between files with images
        if (editorRef.current?.isReady) {
          editorRef.current.setMarkdown('');
        }

        const contentToLoad = needsImageProcessing
          ? await processMarkdownImages(result.content)
          : result.content;

        // Check again if cancelled after async image processing
        if (token.cancelled || loadingCancelTokenRef.current?.path !== filePath) {
          console.log('[FileLoad] Load cancelled after image processing for:', filePath);
          return;
        }

        // Wait for appropriate editor to be ready and load content
        const waitForEditorAndLoad = async () => {
          // Wait for editor to be ready (use ref to get latest sourceMode)
          while (!token.cancelled) {
            const isSourceMode = sourceModeRef.current;
            const editorReady = isSourceMode
              ? sourceEditorRef.current?.isReady
              : editorRef.current?.isReady;
            if (editorReady) break;
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          if (token.cancelled) return;

          // Load content into appropriate editor (use ref to get latest sourceMode)
          const isSourceMode = sourceModeRef.current;
          if (isSourceMode) {
            // In source mode, load original content (with original file paths, not blob URLs)
            sourceEditorRef.current?.setValue(result.content);
            setEditorContent(result.content);
            outline.setHeadings(result.content);
          } else {
            // In preview mode, load into MilkdownEditor (with blob URLs for image display)
            requestAnimationFrame(() => {
              editorRef.current?.setMarkdown(contentToLoad);
              setEditorContent(contentToLoad);
              outline.setHeadings(contentToLoad);
            });
          }
        };

        await waitForEditorAndLoad();

        // Add to recent files
        await electrobun.addRecentFile({ path: result.path });
        console.log('[FileLoad] Load completed:', filePath);
      }
    } catch (error) {
      console.error('[FileLoad] Failed to open file:', filePath, error);
    } finally {
      // Clear the switching flag after a short delay to ensure all editor events are processed
      setTimeout(() => {
        isSwitchingFileRef.current = false;
        console.log('[FileLoad] File switch flag cleared:', filePath);
      }, 100);
    }
  }, [fileExplorer.setRootPath, fileExplorer.selectFile, outline.setHeadings, cancelPendingSave, resetFileState, sourceMode]);

  // Handle file click in file explorer
  const handleFileClick = useCallback((file: FileNode) => {
    // Check if it's an image file
    if (isImageFile(file.extension)) {
      // Show image preview instead of opening in editor
      setImagePreviewPath(file.path);
      // Update file explorer selection
      fileExplorer.selectFile(file.path);
      return;
    }

    // For non-image files, clear image preview and open in editor
    setImagePreviewPath(null);
    openFileByPath(file.path);
  }, [openFileByPath, fileExplorer.selectFile]);

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

  // Listen for source mode toggle event from main process
  useEffect(() => {
    return electrobun.on('toggle-source-mode', () => {
      setSourceMode(prev => {
        const newMode = !prev;

        // Sync content between editors when switching modes
        if (newMode) {
          // Switching to source mode: get content from Milkdown and restore original image paths
          const markdown = editorRef.current?.getMarkdown() ?? '';
          const markdownWithOriginalPaths = restoreOriginalImagePaths(markdown);
          // Use setTimeout to ensure the source editor is ready
          setTimeout(() => {
            sourceEditorRef.current?.setValue(markdownWithOriginalPaths);
            sourceEditorRef.current?.focus();
          }, 0);
        } else {
          // Switching to preview mode: get content from source editor
          const markdown = sourceEditorRef.current?.getValue() ?? '';
          // Process images to convert local paths to blob URLs
          void processMarkdownImages(markdown).then((processedMarkdown) => {
            // Use setTimeout to ensure the Milkdown editor is ready
            setTimeout(() => {
              editorRef.current?.setMarkdown(processedMarkdown);
              editorRef.current?.focus();
            }, 0);
          });
        }

        return newMode;
      });
    });
  }, []);

  // Listen for file-opened event to set editor content directly
  useEffect(() => {
    return electrobun.on('file-opened', async (data) => {
      const { path: filePath, content: fileContent } = data as { path: string; content: string };

      // Set flag to ignore editor changes during file switch
      isSwitchingFileRef.current = true;

      // Cancel any pending auto-save
      cancelPendingSave();

      // Cancel any ongoing file loading
      if (loadingCancelTokenRef.current) {
        loadingCancelTokenRef.current.cancelled = true;
      }

      // Create new cancel token for this event
      const token = { cancelled: false, path: filePath };
      loadingCancelTokenRef.current = token;

      // Clear image preview when opening a file in editor
      setImagePreviewPath(null);

      // Update workspace and file state
      workspaceManager.setCurrentFile(filePath);
      setCurrentFilePath(filePath);

      // Auto-set file explorer root to the file's parent directory
      const parentDir = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
      fileExplorer.setRootPath(parentDir);

      // Update selected file in file explorer (highlight current file)
      fileExplorer.selectFile(filePath);

      // Reset file state to prevent auto-save from saving old file
      resetFileState(filePath, fileContent);

      // Check if content has local images
      const needsImageProcessing = hasLocalImages(fileContent);

      const setContent = async () => {
        try {
          // Get current source mode (use ref to avoid stale closure)
          const isSourceMode = sourceModeRef.current;

          // Clear editor first to force ImageBlock components to fully re-render
          // This prevents image sizing issues when switching between files with images
          if (!isSourceMode && editorRef.current?.isReady) {
            editorRef.current.setMarkdown('');
          }

          const contentToLoad = needsImageProcessing
            ? await processMarkdownImages(fileContent)
            : fileContent;

          // Check if cancelled after async image processing
          if (token.cancelled || loadingCancelTokenRef.current?.path !== filePath) {
            console.log('[FileLoad] Event load cancelled after image processing for:', filePath);
            return;
          }

          // Wait for appropriate editor to be ready
          while (!token.cancelled) {
            const currentIsSourceMode = sourceModeRef.current;
            const editorReady = currentIsSourceMode
              ? sourceEditorRef.current?.isReady
              : editorRef.current?.isReady;
            if (editorReady) break;
            await new Promise(resolve => setTimeout(resolve, 50));
          }

          if (token.cancelled) return;

          // Load content into appropriate editor (use ref to get latest sourceMode)
          const currentIsSourceMode = sourceModeRef.current;
          if (currentIsSourceMode) {
            // In source mode, load original content (with original file paths, not blob URLs)
            sourceEditorRef.current?.setValue(fileContent);
            setEditorContent(fileContent);
            outline.setHeadings(fileContent);
          } else {
            // In preview mode, load into MilkdownEditor (with blob URLs for image display)
            requestAnimationFrame(() => {
              editorRef.current?.setMarkdown(contentToLoad);
              setEditorContent(contentToLoad);
              outline.setHeadings(contentToLoad);
            });
          }
        } finally {
          // Clear the switching flag after a short delay to ensure all editor events are processed
          setTimeout(() => {
            isSwitchingFileRef.current = false;
            console.log('[FileLoad] Event file switch flag cleared:', filePath);
          }, 100);
        }
      };

      const loadContent = async () => {
        // Check if cancelled before starting
        if (token.cancelled) {
          console.log('[FileLoad] Event load cancelled before starting:', filePath);
          return;
        }

        // Wait for appropriate editor to be ready
        const waitForEditor = () => {
          return new Promise<void>((resolve) => {
            const check = () => {
              if (token.cancelled) {
                resolve();
                return;
              }
              const isSourceMode = sourceMode;
              const editorReady = isSourceMode
                ? sourceEditorRef.current?.isReady
                : editorRef.current?.isReady;
              if (editorReady) {
                resolve();
              } else {
                setTimeout(check, 50);
              }
            };
            check();
          });
        };

        await waitForEditor();
        if (!token.cancelled) {
          await setContent();
        }
      };

      void loadContent();
    });
  }, [outline.setHeadings, fileExplorer.setRootPath, fileExplorer.selectFile, cancelPendingSave, resetFileState]);

  // Listen for folder-opened event to set workspace root
  useEffect(() => {
    return electrobun.on('folder-opened', (data) => {
      const { path: folderPath } = data as { path: string };

      resetWorkspace();

      // Update workspace root
      workspaceManager.setWorkspaceRoot(folderPath);

      // Set file explorer root (this will trigger async folder loading)
      fileExplorer.setRootPath(folderPath);
      fileExplorer.selectFile(null);
    });
  }, [resetWorkspace, fileExplorer.setRootPath, fileExplorer.selectFile]);

  // Listen for file-new event to reset to initial state
  useEffect(() => {
    return electrobun.on('file-new', () => {
      // Cancel any pending operations
      cancelPendingSave();

      // Clear editor content based on current mode
      if (sourceMode) {
        sourceEditorRef.current?.setValue('');
      } else {
        editorRef.current?.setMarkdown('');
      }

      // Reset all editor and UI state to initial values
      setEditorContent('');
      setImagePreviewPath(null);
      outline.setHeadings('');

      // Reset file state
      workspaceManager.setCurrentFile(null);
      setCurrentFilePath(null);

      // Reset file explorer to initial empty state
      fileExplorer.setRootPath(null);
      fileExplorer.selectFile(null);

      // Focus editor after a short delay to ensure content is cleared
      setTimeout(() => {
        if (sourceMode) {
          sourceEditorRef.current?.focus();
        } else {
          editorRef.current?.focus();
        }
      }, 0);
    });
  }, [outline.setHeadings, sourceMode, cancelPendingSave, fileExplorer.setRootPath, fileExplorer.selectFile]);

  // Listen for settings dialog open event
  useEffect(() => {
    return electrobun.on('open-settings', () => {
      setShowSettingsDialog(true);
    });
  }, []);

  // Handle settings save
  const handleSettingsSave = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    // The RPC expects { settings: params }, but our lib wraps it
    const result = await electrobun.saveSettings(newSettings) as { success: boolean; error?: string };
    if (!result.success) {
      console.error('Failed to save settings:', result.error);
    }
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
        'format-highlight': () => editorRef.current?.toggleHighlight(),
        'format-superscript': () => editorRef.current?.toggleSuperscript(),
        'format-subscript': () => editorRef.current?.toggleSubscript(),
        'format-inline-math': () => editorRef.current?.insertInlineMath(),
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
        case 'table-copy-cell': {
          const cellText = window.__pendingTableCellText;
          if (cellText) {
            await electrobun.writeToClipboard(cellText);
            window.__pendingTableCellText = null;
          }
          break;
        }
        case 'editor-cut':
          await clipboard.cut();
          break;
        case 'editor-copy':
          await clipboard.copy();
          break;
        case 'editor-paste':
          await clipboard.paste();
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

  // Handle image insert - using new image module
  const handleImageInsert = useCallback(async (src: string, alt: string) => {
    const editor = editorRef.current;
    if (!editor?.isReady) return;

    let imageUrl = src;

    // Check if it's a local file path
    if (isLocalFilePath(src) && src.startsWith('/')) {
      // Resolve and load through workspace
      const resolvedPath = workspaceManager.resolvePath(src);
      const blobUrl = await loadLocalImage(resolvedPath);
      if (blobUrl) {
        imageUrl = blobUrl;
      }
    }

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
          if (e.shiftKey) {
            // Open folder - handled via native menu, but also support keyboard shortcut
            void handleOpenFolder();
          } else {
            handleOpen();
          }
          break;
        case 'n':
          e.preventDefault();
          // Reset to initial state (same as File -> New menu)
          cancelPendingSave();
          updateContent('');
          setEditorContent('');
          outline.setHeadings('');
          workspaceManager.setCurrentFile(null);
          setCurrentFilePath(null);
          fileExplorer.setRootPath(null);
          fileExplorer.selectFile(null);
          if (sourceMode) {
            sourceEditorRef.current?.setValue('');
            sourceEditorRef.current?.focus();
          } else {
            editorRef.current?.setMarkdown('');
            editorRef.current?.focus();
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
        case 'h':
          if (e.shiftKey) {
            e.preventDefault();
            editorRef.current?.toggleHighlight();
          }
          break;
        case 'c':
          e.preventDefault();
          void clipboard.copy();
          break;
        case 'x':
          e.preventDefault();
          void clipboard.cut();
          break;
        case 'v':
          e.preventDefault();
          void clipboard.paste();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleSaveAs, handleOpen, handleOpenFolder, updateContent, quickOpen.open, sidebar.toggle, clipboard, sourceMode, cancelPendingSave, outline.setHeadings, fileExplorer.setRootPath, fileExplorer.selectFile]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Title Bar */}
      {showTitleBar && (
        <TitleBar
          title={path ? path.split('/').pop() : 'Untitled'}
          isDirty={isDirty}
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
              onRefresh={fileExplorer.refresh}
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
        <main ref={containerRef} className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar - only show in preview mode */}
          {showToolbar && !sourceMode && (
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
          {imagePreviewPath ? (
            <ImageViewer path={imagePreviewPath} className="flex-1" />
          ) : sourceMode ? (
            <SourceEditor
              ref={sourceEditorRef}
              defaultValue={content}
              onChange={handleSourceEditorChange}
              className="flex-1"
              darkMode={theme === 'dark'}
            />
          ) : (
            <MilkdownEditor
              ref={editorRef}
              defaultValue={content}
              onChange={handleEditorChange}
              className="flex-1"
              darkMode={theme === 'dark'}
            />
          )}
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

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={showSettingsDialog}
        settings={settings}
        onClose={() => setShowSettingsDialog(false)}
        onSave={handleSettingsSave}
      />

      {/* Save Dialog */}
      <SaveDialog
        isOpen={saveDialogState.isOpen}
        defaultFileName={saveDialogState.defaultFileName}
        initialFolderPath={saveDialogState.initialFolderPath}
        onClose={closeSaveDialog}
        onSave={handleSaveFromDialog}
      />
    </div>
  );
}

export default App;
