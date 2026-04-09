/**
 * App.tsx - Main application component
 *
 * Hook ordering constraint: sidebar/fileExplorer/outline/quickOpen must be declared
 * before any effects that reference them (e.g., the UI state loading effect).
 */

import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
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
import { FileDialog } from './components/file-dialog';
import { RecoveryDialog } from './components/recovery-dialog/RecoveryDialog';
import { FileHistoryDialog } from './components/file-history/FileHistoryDialog';
import { AboutDialog } from './components/about/AboutDialog';
import { MermaidDiagramViewer } from './components/mermaid-viewer';
import { SearchBar } from './components/search-bar/SearchBar';
import { AIChatPanel } from './components/ai-chat/AIChatPanel';
import { dispatchSearchAction, searchPluginKey } from './components/editor/plugins/searchPlugin';
import { useFileOperations } from './hooks/useFileOperations';
import { useTheme } from './hooks/useTheme';
import { useSidebar } from './hooks/useSidebar';
import { useFileExplorer } from './hooks/useFileExplorer';
import { useOutline } from './hooks/useOutline';
import { useQuickOpen } from './hooks/useQuickOpen';
import { useClipboard } from './hooks/useClipboard';
import { useExport } from './hooks/useExport';
import { useSessionSave } from './hooks/useSessionSave';
import { electrobun } from './lib/electrobun';
import { registerAITools } from './lib/ai-tools';
import { setupRendererHandlers, dispatcher } from './lib/commandHandlers';
import type { HandlerContext } from './lib/commandHandlers';
import { getCommand } from '../shared/commandRegistry';
import i18n from './i18n';
import {
  workspaceManager,
  processMarkdownImages,
  hasLocalImages,
  loadLocalImage,
  isLocalFilePath,
  restoreOriginalImagePaths,
  getDirectoryPath,
} from './lib/image';
import type { FileNode, AppSettings, UIState, RecoveryInfo, MenuConfig, MenuItemConfig, SessionState } from '@/shared/types';
import { AppMenuBar } from './components/menu';
import type { AppMenuState } from './components/menu';

// Platform detection (constant at module level to avoid recomputation)
const isWindows = navigator.platform.toLowerCase().includes('win');

function App() {
  const editorRef = useRef<MilkdownEditorRef>(null);
  const sourceEditorRef = useRef<SourceEditorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSwitchingFileRef = useRef(false);
  const [editorContent, setEditorContent] = useState('');
  const [imagePreviewPath, setImagePreviewPath] = useState<string | null>(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [pendingRecoveries, setPendingRecoveries] = useState<RecoveryInfo[]>([]);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Load settings from main process on mount
  useEffect(() => {
    electrobun.getSettings().then(result => {
      if ((result as { success?: boolean })?.success && (result as { settings?: AppSettings }).settings) {
        setSettings((result as { settings: AppSettings }).settings);
      }
    }).catch(console.error);
  }, []);
  const [showFileHistoryDialog, setShowFileHistoryDialog] = useState(false);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [mermaidViewerSource, setMermaidViewerSource] = useState<string | null>(null);

  const { theme, toggleTheme } = useTheme();

  // Windows frontend menu (config only, state is derived below)
  const [menuConfig, setMenuConfig] = useState<MenuConfig[]>([]);

  // UI visibility state
  const [showTitleBar, setShowTitleBar] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showStatusBar, setShowStatusBar] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const sourceModeRef = useRef(sourceMode);

  // Keep ref in sync with state
  useEffect(() => {
    sourceModeRef.current = sourceMode;
  }, [sourceMode]);

  // Search bar state
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchShowReplace, setSearchShowReplace] = useState(false);

  // AI Panel state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPanelWidth, setAIPanelWidth] = useState(360);

  // Phase 2: Sidebar and file management - MUST be declared before any effects that use them
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
  const quickOpen = useQuickOpen(handleQuickOpenSelect, handleCommandSelect);

  // Derive menu state from existing UI state (avoids sync issues)
  // Must be after sidebar and UI state declarations
  const appMenuState = useMemo<AppMenuState>(() => ({
    showSidebar: sidebar.isOpen,
    showTitleBar,
    showToolBar: showToolbar,
    showStatusBar,
    sourceMode,
  }), [sidebar.isOpen, showTitleBar, showToolbar, showStatusBar, sourceMode]);

  // Load menu config from backend (Windows only)
  const loadMenuConfig = useCallback(async () => {
    if (!isWindows) return;
    const result = await electrobun.getMenuConfig() as { success: boolean; config?: Array<Record<string, unknown>> };
    if (result.success && result.config) {
      const transformItems = (items: Array<Record<string, unknown>> | undefined): MenuItemConfig[] => {
        if (!items) return [];
        return items.map(item => ({
          label: item.label as string | undefined,
          action: item.action as string | undefined,
          accelerator: item.accelerator as string | undefined,
          checked: item.checked as boolean | undefined,
          type: item.type === 'separator' ? 'separator' as const : undefined,
          submenu: transformItems(item.submenu as Array<Record<string, unknown>> | undefined),
        }));
      };
      const transformed = result.config.map(menu => ({
        label: menu.label as string,
        items: transformItems(menu.submenu as Array<Record<string, unknown>> | undefined),
      }));
      setMenuConfig(transformed as MenuConfig[]);
    }
  }, [isWindows]);

  // Load menu config on mount
  useEffect(() => {
    void loadMenuConfig();
  }, [loadMenuConfig]);

  // Handle menu action from Windows frontend menu
  const handleMenuAction = useCallback((action: string) => {
    void electrobun.sendMenuAction(action);
  }, []);

  // Image insert dialog state
  const [showImageDialog, setShowImageDialog] = useState(false);

  // Consolidated startup initialization with priority chain:
  // 1. UI state (always)
  // 2. Pending file from CLI/open-url (highest priority)
  // 3. Crash recovery check
  // 4. Session restore (if no pending file and no recovery)
  // 5. Clean workspace + desktop default init
  useEffect(() => {
    const initializeApp = async () => {
      // Step 1: Load UI state
      const uiResult = await electrobun.getUIState() as { success: boolean; state?: UIState };
      if (uiResult.success && uiResult.state) {
        setShowTitleBar(uiResult.state.showTitleBar);
        setShowToolbar(uiResult.state.showToolBar);
        setShowStatusBar(uiResult.state.showStatusBar);
        setSourceMode(uiResult.state.sourceMode ?? false);
        sidebar.setIsOpen(uiResult.state.showSidebar);
        sidebar.setWidth(uiResult.state.sidebarWidth);
        sidebar.setTab(uiResult.state.sidebarActiveTab);
        setShowAIPanel(uiResult.state.showAIPanel ?? false);
        setAIPanelWidth(uiResult.state.aiPanelWidth ?? 360);
      }

      // Step 2: Check for pending file (priority 1)
      const fileResult = await electrobun.getPendingFile() as { path: string; content: string; closeSidebar?: boolean } | null;
      if (fileResult) {
        if (fileResult.closeSidebar) {
          sidebar.setIsOpen(false);
        }
        const listeners = (window as any).__electrobunListeners?.['file-opened'] || [];
        listeners.forEach((cb: (data: unknown) => void) => cb(fileResult));
        // Set workspace root from pending file's parent
        const parentDir = getDirectoryPath(fileResult.path);
        workspaceManager.setWorkspaceRoot(parentDir);
        return; // Pending file takes priority — skip session restore
      }

      // Step 2b: Check for pending folder (when folder is opened in a new window)
      const folderResult = await electrobun.getPendingFolder() as { path: string } | null;
      if (folderResult) {
        workspaceManager.setWorkspaceRoot(folderResult.path);
        fileExplorer.setRootPath(folderResult.path);
        fileExplorer.selectFile(null);
        return;
      }

      // Step 3: Check crash recovery (priority 2)
      const recoveryResult = await electrobun.checkRecovery() as { success: boolean; recoveries?: RecoveryInfo[] };
      if (recoveryResult.success && recoveryResult.recoveries && recoveryResult.recoveries.length > 0) {
        setPendingRecoveries(recoveryResult.recoveries);
        setShowRecoveryDialog(true);
        // Don't return here — user may dismiss the dialog, then we proceed to session restore
        // The recovery dialog flow is handled by existing RecoveryDialog component
        // If user recovers a file, handleRecover callback sets the file state
        // For now, continue to try session restore as well — if user dismisses recovery dialog
        // We'll let the session restore run to give the best UX
      }

      // Step 4: Session restore (priority 3)
      try {
        const sessionResult = await electrobun.getSessionState() as { success: boolean; state?: SessionState };
        if (sessionResult.success && sessionResult.state && sessionResult.state.filePath) {
          const session = sessionResult.state;

          // Check if file still exists
          const statsResult = await electrobun.getFileStats({ path: session.filePath }) as
            | { success: true; mtime: number }
            | { success: false; error: string };

          if (!statsResult.success) {
            // File absent — clean workspace, preserve session data (R7)
            // Fall through to desktop default init
            console.log('[SessionRestore] File absent, falling back to clean workspace');
          } else {
            // File exists — set up workspace and load file
            const parentDir = getDirectoryPath(session.filePath);
            workspaceManager.setWorkspaceRoot(parentDir);

            // Set file explorer root
            fileExplorer.setRootPath(parentDir);

            // Restore expanded paths (if any)
            if (session.expandedPaths.length > 0) {
              await fileExplorer.restoreExpandedPaths(session.expandedPaths);
            }

            // Read file content
            const readResult = await electrobun.readFile({ path: session.filePath }) as {
              success: boolean;
              content?: string;
              path?: string;
            };

            if (readResult.success && readResult.content !== undefined && readResult.path) {
              // Set switching flag to prevent editor change handlers from processing
              isSwitchingFileRef.current = true;

              // Reset file state
              resetFileState(readResult.path, readResult.content);

              // Process images if needed
              const needsImageProcessing = hasLocalImages(readResult.content);
              const contentToLoad = needsImageProcessing
                ? await processMarkdownImages(readResult.content)
                : readResult.content;

              // Load content into editor based on sourceMode from uiState
              // Wait for editor to be ready
              const waitForEditor = async () => {
                for (let i = 0; i < 50; i++) {
                  const editorReady = sourceMode
                    ? sourceEditorRef.current?.isReady
                    : editorRef.current?.isReady;
                  if (editorReady) return true;
                  await new Promise(resolve => setTimeout(resolve, 50));
                }
                return false;
              };

              const ready = await waitForEditor();
              if (!ready) return;

              if (sourceMode && session.sourceMode !== false) {
                // Source mode restore
                sourceEditorRef.current?.setValue(readResult.content);
                setEditorContent(readResult.content);
                outline.setHeadings(readResult.content);

                // Restore cursor and scroll if mtime unchanged (R5)
                if (session.cursor) {
                  sourceEditorRef.current?.setCursor(session.cursor.line, session.cursor.column);
                }
                if (session.scrollTop > 0) {
                  sourceEditorRef.current?.setScrollTop(session.scrollTop);
                }
              } else {
                // WYSIWYG mode restore
                editorRef.current?.setMarkdown(contentToLoad, {
                  onContentSet: () => {
                    if (session.cursor) {
                      editorRef.current?.setCursor(session.cursor.line, session.cursor.column);
                    }
                    if (session.scrollTop > 0) {
                      editorRef.current?.setScrollTop(session.scrollTop);
                    }
                    isSwitchingFileRef.current = false;
                  },
                });
                setEditorContent(contentToLoad);
                outline.setHeadings(contentToLoad);
              }

              // Select file in explorer and add to recent files
              fileExplorer.selectFile(readResult.path);
              await electrobun.addRecentFile({ path: readResult.path });
              console.log('[SessionRestore] Restored:', readResult.path);
              return; // Session restore successful
            }
          }
        }
      } catch (e) {
        console.error('[SessionRestore] Failed:', e);
        isSwitchingFileRef.current = false;
      }

      // Step 5: Clean workspace — set desktop as default workspace root
      const desktopResult = await electrobun.getDesktopPath() as { success: boolean; path?: string };
      if (desktopResult.success && desktopResult.path) {
        workspaceManager.setWorkspaceRoot(desktopResult.path);
      }
    };

    void initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    showAIPanel: boolean;
    aiPanelWidth: number;
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
      showAIPanel,
      aiPanelWidth,
    };

    if (uiStateTimeoutRef.current) {
      clearTimeout(uiStateTimeoutRef.current);
    }
    uiStateTimeoutRef.current = setTimeout(() => {
      void flushUIState();
    }, 300);
  }, [showTitleBar, showToolbar, showStatusBar, sidebar.isOpen, sidebar.width, sidebar.activeTab, flushUIState, sourceMode, showAIPanel, aiPanelWidth]);

  // Save UI state when visibility changes
  useEffect(() => {
    saveUIState();
  }, [showTitleBar, showToolbar, showStatusBar, sourceMode, sidebar.isOpen, sidebar.width, sidebar.activeTab, showAIPanel, aiPanelWidth, saveUIState]);

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
    fileDialogState,
    updateContent,
    handleOpen,
    handleSave,
    handleSaveAs,
    closeFileDialog,
    handleDialogConfirm,
    cancelPendingSave,
    resetFileState,
    clearFile,
  } = useFileOperations({
    enableAutoSave: settings?.autoSave ?? true,
    autoSaveInterval: settings?.autoSaveInterval ?? 2000,
    backupEnabled: settings?.backup?.enabled ?? true,
    recoveryInterval: settings?.backup?.recoveryInterval ?? 30000,
    onSaveSuccess: (savedPath) => {
      // Set root path to the file's parent directory (so new files appear in file explorer)
      const parentDir = getDirectoryPath(savedPath);
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

  // Session save — periodically persists editing context for next launch
  const { scheduleSave } = useSessionSave({
    filePath: path,
    editorRef,
    sourceEditorRef,
    sourceMode,
    expandedPaths: fileExplorer.expandedPaths,
    isReady: editorRef.current?.isReady ?? false,
  });

  // Refs for unsaved-changes guard (avoid stale closures in callbacks)
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const autoSaveEnabledRef = useRef(settings?.autoSave ?? true);
  autoSaveEnabledRef.current = settings?.autoSave ?? true;
  const filePathRef2 = useRef(path);
  filePathRef2.current = path;

  // Check for unsaved changes before switching files or closing.
  // Returns true = proceed, false = user cancelled the action.
  const checkUnsavedChanges = useCallback(async (): Promise<boolean> => {
    if (!isDirtyRef.current) return true;

    if (autoSaveEnabledRef.current) {
      // Auto-save is on: save immediately and proceed
      await handleSave();
      return true;
    }

    // Auto-save is off: ask the user
    const fileName = filePathRef2.current
      ? filePathRef2.current.split('/').pop()
      : undefined;
    const result = await electrobun.showUnsavedChangesDialog({ fileName });
    if (result.action === 'cancel') return false;
    if (result.action === 'save') await handleSave();
    return true;
  }, [handleSave]);

  // Show native "unsaved changes" warning on exit when auto-save is disabled
  useEffect(() => {
    if (autoSaveEnabledRef.current) return; // auto-save handles its own beforeunload

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  // Re-register when autoSave setting changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.autoSave]);

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
    const shouldProceed = await checkUnsavedChanges();
    if (!shouldProceed) return;

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
  }, [checkUnsavedChanges, resetWorkspace, fileExplorer.setRootPath, fileExplorer.selectFile]);

  // File loading cancel token to prevent race conditions
  const loadingCancelTokenRef = useRef<{ cancelled: boolean; path: string } | null>(null);

  // Sync path from useFileOperations to local state and workspace manager
  useEffect(() => {
    setCurrentFilePath(path);
    workspaceManager.setCurrentFile(path);
  }, [path]);

  // Clipboard operations with blob URL handling
  const clipboard = useClipboard(editorRef, sourceEditorRef, currentFilePath, sourceMode);

  // Ref to latest content so export handlers don't need content in their dep array
  const contentRef = useRef(content);
  contentRef.current = content;

  // Export operations
  const { generateHTML, generateImage } = useExport();

  // Export dialog state
  const [exportDialogState, setExportDialogState] = useState<{
    isOpen: boolean;
    mode: 'html' | 'image';
    content: string;
    isBase64: boolean;
    defaultName: string;
    extension: string;
  } | null>(null);

  // Handle export dialog confirm
  const handleExportDialogConfirm = useCallback(async (result: { canceled: boolean; filePath?: string }) => {
    if (!exportDialogState || result.canceled || !result.filePath) {
      setExportDialogState(null);
      return;
    }

    try {
      await electrobun.saveExportedFile({
        content: exportDialogState.content,
        isBase64: exportDialogState.isBase64,
        filePath: result.filePath,
      });
    } catch (error) {
      console.error('Export save failed:', error);
    }
    setExportDialogState(null);
  }, [exportDialogState]);

  const closeExportDialog = useCallback(() => {
    setExportDialogState(null);
  }, []);


  // Handle editor content changes from Milkdown
  const handleEditorChange = useCallback((markdown: string) => {
    // Ignore changes during file switching to prevent race conditions
    if (isSwitchingFileRef.current) return;
    updateContent(markdown);
    setEditorContent(markdown);
    outline.setHeadings(markdown);
    scheduleSave();
  }, [updateContent, outline.setHeadings, scheduleSave]);

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
    scheduleSave();
  }, [updateContent, outline.setHeadings, scheduleSave]);

  // Handle quick open file selection
  function handleQuickOpenSelect(filePath: string) {
    // Open file via IPC
    openFileByPath(filePath);
    // Close quick open dialog
    quickOpen.close();
  }

  // Handle command palette command selection
  function handleCommandSelect(action: string) {
    const entry = getCommand(action);
    // Renderer-only commands: dispatch directly, no IPC round-trip
    if (entry?.executionContext === 'renderer') {
      dispatcher.execute(action);
    } else {
      // Cross-process / main-process commands: route through Bun
      void electrobun.sendMenuAction(action);
    }
    void electrobun.recordCommandUsage(action);
  }

  // Open file by path
  const openFileByPath = useCallback(async (filePath: string) => {
    // Guard: check for unsaved changes before switching
    const shouldProceed = await checkUnsavedChanges();
    if (!shouldProceed) return;

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
        fileExplorer.setRootPath(getDirectoryPath(result.path));

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
            // Use setTimeout(0) instead of requestAnimationFrame — RAF may not fire reliably
            // in Electrobun's WebView during startup when the window isn't visible.
            setTimeout(() => {
              editorRef.current?.setMarkdown(contentToLoad, {
                onContentSet: () => {
                  isSwitchingFileRef.current = false;
                },
              });
              setEditorContent(contentToLoad);
              outline.setHeadings(contentToLoad);
            }, 0);
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
      // Clear the switching flag immediately for error/cancel paths.
      // The success path clears it via onContentSet after setMarkdown completes.
      isSwitchingFileRef.current = false;
      console.log('[FileLoad] File switch flag cleared:', filePath);
    }
  }, [checkUnsavedChanges, fileExplorer.setRootPath, fileExplorer.selectFile, outline.setHeadings, cancelPendingSave, resetFileState, sourceMode]);

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

  const handleToggleSourceMode = useCallback(() => {
    const newMode = !sourceModeRef.current;

    if (newMode) {
      // Switching to source mode: get content from Milkdown and restore original image paths
      // Must read before setSourceMode, because Milkdown unmounts after state change
      const markdown = editorRef.current?.getMarkdown() ?? '';
      const markdownWithOriginalPaths = restoreOriginalImagePaths(markdown);

      setSourceMode(true);

      // Poll until source editor is ready, then set content
      // (useEffect creating the editor may not have run yet)
      const trySetContent = () => {
        if (sourceEditorRef.current?.isReady) {
          sourceEditorRef.current.setValue(markdownWithOriginalPaths);
          sourceEditorRef.current.focus();
        } else {
          requestAnimationFrame(trySetContent);
        }
      };
      requestAnimationFrame(trySetContent);
    } else {
      // Switching to preview mode: get content from source editor
      // Must read before setSourceMode, because SourceEditor unmounts after state change
      const markdown = sourceEditorRef.current?.getValue() ?? '';

      setSourceMode(false);

      // Process images to convert local paths to blob URLs
      void processMarkdownImages(markdown).then((processedMarkdown) => {
        const trySetContent = () => {
          if (editorRef.current?.isReady) {
            editorRef.current.setMarkdown(processedMarkdown);
            editorRef.current.focus();
          } else {
            requestAnimationFrame(trySetContent);
          }
        };
        requestAnimationFrame(trySetContent);
      });
    }
  }, []);

  // Listen for source mode toggle event from main process
  useEffect(() => {
    return electrobun.on('toggle-source-mode', handleToggleSourceMode);
  }, [handleToggleSourceMode]);

  // Listen for file-opened event to set editor content directly
  useEffect(() => {
    return electrobun.on('file-opened', async (data) => {
      const { path: filePath, content: fileContent } = data as { path: string; content: string };

      // Guard: check for unsaved changes before switching
      const shouldProceed = await checkUnsavedChanges();
      if (!shouldProceed) return;

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
      fileExplorer.setRootPath(getDirectoryPath(filePath));

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
            // Use setTimeout(0) instead of requestAnimationFrame — RAF may not fire reliably
            // in Electrobun's WebView during startup when the window isn't visible.
            setTimeout(() => {
              editorRef.current?.setMarkdown(contentToLoad, {
                onContentSet: () => {
                  isSwitchingFileRef.current = false;
                },
              });
              setEditorContent(contentToLoad);
              outline.setHeadings(contentToLoad);
            }, 0);
          }
        } finally {
          // Clear the switching flag immediately for error/cancel paths.
          // The success path clears it via onContentSet after setMarkdown completes.
          isSwitchingFileRef.current = false;
          console.log('[FileLoad] Event file switch flag cleared:', filePath);
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
  }, [checkUnsavedChanges, outline.setHeadings, fileExplorer.setRootPath, fileExplorer.selectFile, cancelPendingSave, resetFileState]);

  // Listen for folder-opened event to set workspace root
  useEffect(() => {
    return electrobun.on('folder-opened', async (data) => {
      const { path: folderPath } = data as { path: string };

      // Guard: check for unsaved changes before switching workspace
      const shouldProceed = await checkUnsavedChanges();
      if (!shouldProceed) return;

      resetWorkspace();

      // Update workspace root
      workspaceManager.setWorkspaceRoot(folderPath);

      // Set file explorer root (this will trigger async folder loading)
      fileExplorer.setRootPath(folderPath);
      fileExplorer.selectFile(null);
    });
  }, [checkUnsavedChanges, resetWorkspace, fileExplorer.setRootPath, fileExplorer.selectFile]);

  // Listen for file-new event to reset to initial state
  useEffect(() => {
    return electrobun.on('file-new', async () => {
      // Guard: check for unsaved changes before creating a new file
      const shouldProceed = await checkUnsavedChanges();
      if (!shouldProceed) return;

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

      // Reset file state (path / content / isDirty)
      clearFile();
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
  }, [checkUnsavedChanges, outline.setHeadings, sourceMode, cancelPendingSave, clearFile, fileExplorer.setRootPath, fileExplorer.selectFile]);

  // Listen for settings dialog open event
  useEffect(() => {
    return electrobun.on('open-settings', () => {
      setShowSettingsDialog(true);
    });
  }, []);

  // Listen for file history dialog open event
  useEffect(() => {
    return electrobun.on('open-file-history', () => {
      setShowFileHistoryDialog(true);
    });
  }, []);

  // Listen for about dialog open event
  useEffect(() => {
    return electrobun.on('show-about', () => {
      setShowAboutDialog(true);
    });
  }, []);

  // Handle recovery restore — load the recovered content into the editor
  const handleRecover = useCallback(async (content: string, recoveredPath: string) => {
    resetFileState(recoveredPath, content);
    // Set workspace before processMarkdownImages resolves relative paths
    workspaceManager.setCurrentFile(recoveredPath);

    if (sourceMode) {
      sourceEditorRef.current?.setValue(content);
      setEditorContent(content);
      outline.setHeadings(content);
    } else {
      // Clear first to force ImageBlock components to fully re-render
      if (editorRef.current?.isReady) editorRef.current.setMarkdown('');
      const contentToLoad = hasLocalImages(content)
        ? await processMarkdownImages(content)
        : content;
      requestAnimationFrame(() => {
        editorRef.current?.setMarkdown(contentToLoad);
        setEditorContent(contentToLoad);
        outline.setHeadings(contentToLoad);
      });
    }
  }, [resetFileState, sourceMode, outline.setHeadings]);

  // Restore a version-backup content into the editor.
  // Dirty state is updated naturally when the editor fires markdownUpdated after setMarkdown.
  const handleRestoreVersion = useCallback(async (content: string) => {
    if (!path) return;
    // workspaceManager is already synced to `path` via useEffect — no need to re-set

    if (sourceMode) {
      sourceEditorRef.current?.setValue(content);
      setEditorContent(content);
      outline.setHeadings(content);
      updateContent(content);
    } else {
      // Clear first to force ImageBlock components to fully re-render
      if (editorRef.current?.isReady) editorRef.current.setMarkdown('');
      const contentToLoad = hasLocalImages(content)
        ? await processMarkdownImages(content)
        : content;
      requestAnimationFrame(() => {
        editorRef.current?.setMarkdown(contentToLoad);
        setEditorContent(contentToLoad);
        outline.setHeadings(contentToLoad);
      });
      updateContent(content);
    }
  }, [path, sourceMode, updateContent, outline.setHeadings]);

  // Handle settings save
  const handleSettingsSave = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    // Notify main process about language change (for menu rebuild)
    if (newSettings.language !== settings?.language) {
      const result = await electrobun.setLanguage(newSettings.language);
      if ((result as { success?: boolean })?.success) {
        void loadMenuConfig();
      }
    }
    // The RPC expects { settings: params }, but our lib wraps it
    const result = await electrobun.saveSettings(newSettings) as { success: boolean; error?: string };
    if (!result.success) {
      console.error('Failed to save settings:', result.error);
    }
  }, [settings?.language, loadMenuConfig]);

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

  // Listen for AI panel toggle
  useEffect(() => {
    return electrobun.on('toggle-ai-panel', () => {
      setShowAIPanel(prev => !prev);
    });
  }, []);

  // Ref for AI content changed callback to avoid stale closures
  const aiContentChangedRef = useRef<(markdown: string) => void>(() => {});
  aiContentChangedRef.current = (markdown: string) => {
    if (isSwitchingFileRef.current) return;
    updateContent(markdown);
    setEditorContent(markdown);
    outline.setHeadings(markdown);
    scheduleSave();
  };

  // Register AI tool calls bridge (window.__markbunAI) for editor integration
  useEffect(() => {
    registerAITools(editorRef, {
      onContentChanged: (markdown) => aiContentChangedRef.current(markdown),
    });
  }, []);

  // Register unified command handlers with the dispatcher
  useEffect(() => {
    const ctx: HandlerContext = {
      editorRef,
      sourceEditorRef,
      sourceModeRef,
      writeToClipboard: (text: string) => electrobun.writeToClipboard(text),
      clipboardCut: () => { void clipboard.cut(); },
      clipboardCopy: () => { void clipboard.copy(); },
      clipboardPaste: (shiftKey: boolean) => { void clipboard.paste(shiftKey); },
      generateHTML,
      generateImage,
      setShowImageDialog,
      setSearchVisible,
      setSearchShowReplace,
      setExportDialogState,
      setShowAIPanel,
      contentRef,
      filePath: currentFilePath,
    };
    setupRendererHandlers(ctx);
  }, [clipboard, generateHTML, generateImage, currentFilePath]);

  // Menu action handler — routes through unified dispatcher
  useEffect(() => {
    return electrobun.on('menuAction', async (data) => {
      const { action } = data as { action: string };

      // Handle Mermaid viewer open via window global (set by useContextMenu before native menu shows)
      if (action === 'mermaid-view-diagram') {
        const source = (window as unknown as Record<string, unknown>).__pendingMermaidSource as string | null;
        (window as unknown as Record<string, unknown>).__pendingMermaidSource = null;
        if (source) {
          setMermaidViewerSource(source);
        }
        return;
      }

      dispatcher.execute(action);
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
  const handleStrikethrough = useCallback(() => editorRef.current?.toggleStrikethrough(), []);
  const handleHighlight = useCallback(() => editorRef.current?.toggleHighlight(), []);
  const handleImage = useCallback(() => setShowImageDialog(true), []);
  const handleTable = useCallback(() => editorRef.current?.insertTable(), []);
  const handleTaskList = useCallback(() => editorRef.current?.insertTaskList(), []);

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

      // When command palette is open, only allow Cmd+P (toggle close) through
      // Block all other Cmd+key shortcuts to prevent editor actions
      if (quickOpen.isOpen && e.key.toLowerCase() !== 'p') return;

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
          if (quickOpen.isOpen) {
            quickOpen.close();
          } else {
            quickOpen.open();
          }
          break;
        case 'b':
          if (e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            sidebar.toggle();
          }
          break;
        case 'a':
          if (e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            setShowAIPanel(prev => !prev);
          }
          break;
        case 'h':
          if (e.shiftKey) {
            e.preventDefault();
            editorRef.current?.toggleHighlight();
          }
          break;
        case 'c': {
          const cTarget = e.target as HTMLElement;
          if (cTarget.tagName === 'INPUT' || cTarget.tagName === 'TEXTAREA') {
            e.preventDefault();
            const el = cTarget as HTMLInputElement | HTMLTextAreaElement;
            const start = el.selectionStart ?? 0;
            const end = el.selectionEnd ?? start;
            if (start === end) break;
            void electrobun.writeToClipboard(el.value.substring(start, end));
          }
          // Editor: native menu intercepts Cmd+C, fires menuAction → execCommand('copy')
          break;
        }
        case 'x': {
          const xTarget = e.target as HTMLElement;
          if (xTarget.tagName === 'INPUT' || xTarget.tagName === 'TEXTAREA') {
            e.preventDefault();
            const el = xTarget as HTMLInputElement | HTMLTextAreaElement;
            const start = el.selectionStart ?? 0;
            const end = el.selectionEnd ?? start;
            if (start === end) break;
            const selectedText = el.value.substring(start, end);
            el.setRangeText('');
            void electrobun.writeToClipboard(selectedText);
          }
          // Editor: native menu intercepts Cmd+X, fires menuAction → execCommand('cut')
          break;
        }
        case 'v': {
          const vTarget = e.target as HTMLElement;
          if (vTarget.tagName === 'INPUT' || vTarget.tagName === 'TEXTAREA') {
            e.preventDefault();
            void electrobun.readFromClipboard().then((result) => {
              const res = result as { success: boolean; text?: string };
              if (res.success && res.text) {
                document.execCommand('insertText', false, res.text);
              }
            });
          } else if (!sourceModeRef.current) {
            // WYSIWYG: paste via IPC (paste events don't fire in WebView)
            // Handles Cmd+Shift+V (not registered as menu accelerator)
            // and is a safety net for Cmd+V if native menu doesn't intercept
            e.preventDefault();
            void clipboard.paste(e.shiftKey);
          }
          // Source mode: let WebView handle natively
          break;
        }
        case 'f':
          if (!sourceModeRef.current) {
            e.preventDefault();
            if (e.altKey) {
              // Cmd+Option+F → Find and Replace
              setSearchVisible(true);
              setSearchShowReplace(true);
            } else {
              // Cmd+F → Find
              setSearchVisible(true);
            }
          }
          break;
        case 'g':
          if (searchVisible) {
            e.preventDefault();
            const view = editorRef.current?.getEditorView?.();
            if (view) {
              if (e.shiftKey) {
                dispatchSearchAction(view, { type: 'prevMatch' });
              } else {
                dispatchSearchAction(view, { type: 'nextMatch' });
              }
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleSave, handleSaveAs, handleOpen, handleOpenFolder, updateContent, quickOpen.open, sidebar.toggle, clipboard, sourceMode, cancelPendingSave, outline.setHeadings, fileExplorer.setRootPath, fileExplorer.selectFile, searchVisible, searchShowReplace]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Windows Frontend Menu Bar */}
      {isWindows && menuConfig.length > 0 && (
        <AppMenuBar
          menuConfig={menuConfig}
          menuState={appMenuState}
          onAction={handleMenuAction}
        />
      )}

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
        <main
          ref={containerRef}
          className="flex-1 flex flex-col overflow-hidden min-w-0"
        >
          {/* Toolbar */}
          {showToolbar && (
            <Toolbar
              sourceMode={sourceMode}
              onToggleSourceMode={handleToggleSourceMode}
              onBold={handleBold}
              onItalic={handleItalic}
              onStrikethrough={handleStrikethrough}
              onHighlight={handleHighlight}
              onHeading={handleHeading}
              onQuote={handleQuote}
              onCode={handleCode}
              onLink={handleLink}
              onImage={handleImage}
              onTable={handleTable}
              onList={handleList}
              onOrderedList={handleOrderedList}
              onTaskList={handleTaskList}
            />
          )}
          {/* Search Bar - only in WYSIWYG mode */}
          {searchVisible && !sourceMode && !imagePreviewPath && (
            <SearchBar
              getEditorView={editorRef.current?.getEditorView ?? null}
              isVisible={searchVisible}
              onClose={() => {
                setSearchVisible(false);
                setSearchShowReplace(false);
              }}
              showReplace={searchShowReplace}
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

        {/* AI Chat Panel */}
        <AIChatPanel
          isOpen={showAIPanel}
          width={aiPanelWidth}
          onWidthChange={setAIPanelWidth}
          onClose={() => setShowAIPanel(false)}
          aiSettings={settings?.ai ?? null}
          onOpenSettings={() => setShowSettingsDialog(true)}
        />
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

      {/* Quick Open / Command Palette Dialog */}
      <QuickOpen
        isOpen={quickOpen.isOpen}
        query={quickOpen.query}
        groupedResults={quickOpen.groupedResults}
        selectedIndex={quickOpen.selectedIndex}
        focusedGroup={quickOpen.focusedGroup}
        onQueryChange={quickOpen.setQuery}
        onSelect={handleQuickOpenSelect}
        onCommandSelect={handleCommandSelect}
        onClose={quickOpen.close}
        onSelectNext={quickOpen.selectNext}
        onSelectPrevious={quickOpen.selectPrevious}
        onTabGroup={quickOpen.onTabGroup}
        onShiftTabGroup={quickOpen.onShiftTabGroup}
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

      {/* File Dialog (Open/Save) */}
      <FileDialog
        isOpen={fileDialogState.isOpen}
        options={{
          mode: fileDialogState.mode,
          title: fileDialogState.mode === 'open' ? 'Open File' : 'Save File',
          defaultPath: fileDialogState.defaultPath || fileDialogState.defaultFileName,
          filters: [
            { name: 'Markdown', extensions: ['md', 'markdown'] },
            { name: 'Text Files', extensions: ['txt'] },
            { name: 'All Files', extensions: ['*'] },
          ],
          properties: fileDialogState.mode === 'open'
            ? ['openFile', 'multiSelections']
            : ['createDirectory'],
        }}
        onClose={closeFileDialog}
        onConfirm={handleDialogConfirm}
      />

      {/* Export Dialog */}
      {exportDialogState && (
        <FileDialog
          isOpen={exportDialogState.isOpen}
          options={{
            mode: 'save',
            title: exportDialogState.mode === 'html' ? 'Export as HTML' : 'Export as Image',
            defaultPath: exportDialogState.defaultName,
            filters: exportDialogState.mode === 'html'
              ? [{ name: 'HTML Files', extensions: ['html', 'htm'] }]
              : [{ name: 'PNG Images', extensions: ['png'] }],
            properties: ['createDirectory'],
          }}
          onClose={closeExportDialog}
          onConfirm={handleExportDialogConfirm}
        />
      )}

      {/* Recovery Dialog */}
      <RecoveryDialog
        isOpen={showRecoveryDialog}
        recoveries={pendingRecoveries}
        onClose={() => setShowRecoveryDialog(false)}
        onRecover={handleRecover}
      />

      {/* File History Dialog */}
      <FileHistoryDialog
        isOpen={showFileHistoryDialog}
        filePath={path}
        onClose={() => setShowFileHistoryDialog(false)}
        onRestore={handleRestoreVersion}
      />

      {/* About Dialog */}
      <AboutDialog
        isOpen={showAboutDialog}
        onClose={() => setShowAboutDialog(false)}
      />

      {/* Mermaid Diagram Viewer */}
      <MermaidDiagramViewer
        isOpen={mermaidViewerSource !== null}
        onClose={() => setMermaidViewerSource(null)}
        mermaidSource={mermaidViewerSource}
      />
    </div>
  );
}

export default App;