// Shared types and RPC type definitions for MarkBun
import type { RPCSchema } from "electrobun/bun";

// Menu configuration for Windows frontend menu
export interface MenuItemConfig {
  label?: string;
  action?: string;
  accelerator?: string;
  checked?: boolean;
  type?: 'separator' | 'submenu';
  submenu?: MenuItemConfig[];
}

export interface MenuConfig {
  label: string;
  items: MenuItemConfig[];
}

// ============================================================================
// Phase 1: Basic Types
// ============================================================================

export interface FileContent {
  path: string;
  content: string;
  lastModified: number;
}

export interface FileInfo {
  path: string;
  name: string;
  isDirty: boolean;
  lastModified: number;
}

// ============================================================================
// Backup System Types
// ============================================================================

export interface BackupSettings {
  enabled: boolean;
  maxVersions: number;
  retentionDays: number;
  recoveryInterval: number; // ms between periodic recovery writes
}

export interface BackupEntry {
  path: string;
  timestamp: number;
  size: number;
}

export interface RecoveryInfo {
  originalPath: string;
  recoveryPath: string;
  lastModified: number;
  preview: string; // first 200 chars of recovered content
  size: number;
}

// ============================================================================

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  lineHeight: number;
  autoSave: boolean;
  autoSaveInterval: number;
  backup: BackupSettings;
  language: 'en' | 'zh-CN' | 'de' | 'fr' | 'ja' | 'ko' | 'pt' | 'es';
}

export interface EditorStats {
  words: number;
  characters: number;
  lines: number;
}

export type MenuAction =
  | 'file-new'
  | 'file-open'
  | 'file-save'
  | 'file-save-as'
  | 'view-toggle-theme';

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// Phase 2: File Management Types
// ============================================================================

/**
 * File node in the file tree
 */
export interface FileNode {
  type: 'file';
  name: string;
  path: string;
  extension: string;
}

/**
 * Folder node in the file tree
 */
export interface FolderNode {
  type: 'folder';
  name: string;
  path: string;
  children: FileSystemNode[];
  isExpanded: boolean;
}

/**
 * Union type for file system nodes
 */
export type FileSystemNode = FileNode | FolderNode;

/**
 * Recent file entry
 */
export interface RecentFile {
  path: string;
  name: string;
  openedAt: number; // timestamp
}

/**
 * Heading node for outline navigation
 */
export interface OutlineNode {
  id: string;
  level: number;
  text: string;
  line: number;
  children: OutlineNode[];
}

/**
 * Sidebar tab types
 */
export type SidebarTab = 'files' | 'outline' | 'search';

/**
 * Sidebar state
 */
export interface SidebarState {
  isOpen: boolean;
  activeTab: SidebarTab;
  width: number;
}

/**
 * Quick open item
 */
export interface QuickOpenItem {
  path: string;
  name: string;
  isRecent: boolean;
  score?: number; // fuzzy search score
}

/**
 * UI State for persistence
 */
export interface UIState {
  showTitleBar: boolean;
  showToolBar: boolean;
  showStatusBar: boolean;
  showSidebar: boolean;
  sourceMode: boolean;
  sidebarWidth: number;
  sidebarActiveTab: SidebarTab;
  // Window state
  windowX: number;
  windowY: number;
  windowWidth: number;
  windowHeight: number;
  // Display info for multi-monitor support
  displayId?: number;
  displayWidth?: number;
  displayHeight?: number;
}

// ============================================================================
// RPC Type Definitions
// ============================================================================

// @ts-ignore - Type complexity issue with RPCSchema resolution
export type MarkBunRPC = {
  bun: RPCSchema<{
    requests: {
      // File operations (Phase 1)
      openFile: { params: {}; response: { success: boolean; path?: string; content?: string; error?: string } };
      openFolder: { params: {}; response: { success: boolean; path?: string; error?: string } };
      saveFile: { params: { content: string; path?: string }; response: { success: boolean; path?: string; error?: string } };
      saveFileAs: { params: { content: string }; response: { success: boolean; path?: string; error?: string } };
      getCurrentFile: { params: {}; response: string | null };
      getPendingFile: { params: {}; response: { path: string; content: string; closeSidebar?: boolean } | null };
      readImageAsBase64: { params: { path: string }; response: { success: boolean; dataUrl?: string; error?: string } };
      showTableContextMenu: { params: {}; response: { success: boolean } };
      showDefaultContextMenu: { params: {}; response: { success: boolean } };
      writeToClipboard: { params: { text: string }; response: { success: boolean; error?: string } };
      readFromClipboard: { params: {}; response: { success: boolean; text?: string; error?: string } };

      // Settings (Phase 3)
      getSettings: { params: {}; response: { success: boolean; settings?: AppSettings; error?: string } };
      saveSettings: { params: { settings: AppSettings }; response: { success: boolean; error?: string } };
      getUIState: { params: {}; response: { success: boolean; state?: UIState; error?: string } };
      saveUIState: { params: { state: Partial<UIState> }; response: { success: boolean; error?: string } };
      updateWindowBounds: { params: { x: number; y: number; width: number; height: number }; response: { success: boolean } };

      // File management (Phase 2)
      readFile: { params: { path: string }; response: { success: boolean; path?: string; content?: string; error?: string } };
      readFolder: { params: { path: string; maxDepth?: number }; response: { success: boolean; nodes?: FileSystemNode[]; error?: string } };
      getRecentFiles: { params: {}; response: { success: boolean; files?: RecentFile[]; error?: string } };
      addRecentFile: { params: { path: string }; response: { success: boolean; error?: string } };
      removeRecentFile: { params: { path: string }; response: { success: boolean; error?: string } };
      clearRecentFiles: { params: {}; response: { success: boolean; error?: string } };
      quickOpen: { params: {}; response: { success: boolean; items?: QuickOpenItem[]; error?: string } };
      selectImageFile: { params: {}; response: { success: boolean; path?: string; error?: string } };
      getDesktopPath: { params: {}; response: { success: boolean; path?: string; error?: string } };
      getWorkspaceRoot: { params: {}; response: { success: boolean; path?: string; error?: string } };
      saveDroppedImage: { params: { fileName: string; base64Data: string; workspaceRoot: string }; response: { success: boolean; relativePath?: string; absolutePath?: string; error?: string } };

      // Custom save dialog
      listFolder: { params: { path: string }; response: { success: boolean; items?: Array<{ name: string; path: string; isDirectory: boolean }>; error?: string } };
      getParentFolder: { params: { path: string }; response: { success: boolean; path?: string; error?: string } };
      saveFileWithPath: { params: { content: string; folderPath: string; fileName: string }; response: { success: boolean; fullPath?: string; error?: string } };
      fileExists: { params: { path: string }; response: { exists: boolean; isDirectory?: boolean } };
      showConfirmationDialog: { params: { title: string; message: string; detail?: string; confirmLabel?: string; cancelLabel?: string }; response: { confirmed: boolean } };
      showPromptDialog: { params: { title: string; message?: string; defaultValue?: string; placeholder?: string; confirmLabel?: string; cancelLabel?: string }; response: { confirmed: boolean; value?: string } };
      showUnsavedChangesDialog: { params: { fileName?: string }; response: { action: 'save' | 'discard' | 'cancel' } };

      // File Explorer context menu operations
      createFile: { params: { folderPath: string; fileName?: string }; response: { success: boolean; path?: string; error?: string } };
      createFolder: { params: { parentPath: string; folderName?: string }; response: { success: boolean; path?: string; error?: string } };
      deleteFile: { params: { path: string }; response: { success: boolean; error?: string } };
      moveFile: { params: { sourcePath: string; targetFolderPath: string }; response: { success: boolean; newPath?: string; error?: string } };
      renameFile: { params: { path: string; newName: string }; response: { success: boolean; newPath?: string; error?: string } };
      openInFinder: { params: { path: string }; response: { success: boolean; error?: string } };

      // Backup & Recovery
      checkRecovery: { params: {}; response: { success: boolean; recoveries?: RecoveryInfo[]; error?: string } };
      clearRecovery: { params: { recoveryPath: string }; response: { success: boolean; error?: string } };
      recoverFile: { params: { recoveryPath: string; targetPath?: string }; response: { success: boolean; path?: string; content?: string; error?: string } };
      writeRecovery: { params: { content: string; filePath?: string }; response: { success: boolean; error?: string } };
      getVersionBackups: { params: { filePath: string }; response: { success: boolean; backups?: BackupEntry[]; error?: string } };
      restoreVersionBackup: { params: { backupPath: string }; response: { success: boolean; content?: string; error?: string } };
      deleteVersionBackup: { params: { backupPath: string }; response: { success: boolean; error?: string } };

      // File dialog helpers
      getFileStats: { params: { path: string }; response: { success: boolean; size?: number; mtime?: number; isDirectory?: boolean; error?: string } };
      getCommonPaths: { params: {}; response: { success: boolean; paths?: { home: string; desktop: string; documents: string; downloads: string; pictures?: string; }; error?: string } };

      // Export
      saveExportedFile: { params: { content: string; isBase64: boolean; filePath: string }; response: { success: boolean; path?: string; error?: string } };

      // i18n
      setLanguage: { params: { language: 'en' | 'zh-CN' | 'de' | 'fr' | 'ja' | 'ko' | 'pt' | 'es' }; response: { success: boolean; error?: string } };
      getSystemLanguage: { params: {}; response: { success: boolean; language?: string; error?: string } };

      // Menu configuration (Windows frontend menu)
      getMenuConfig: { params: {}; response: { success: boolean; config?: MenuConfig[]; error?: string } };
      sendMenuAction: { params: { action: string }; response: { success: boolean; error?: string } };

      // External links
      openExternal: { params: { url: string }; response: { success: boolean; error?: string } };
    };
    messages: {
      fileOpened: { path: string; content: string };
      folderOpened: { path: string };
      fileNew: {};
      fileSaveRequest: {};
      fileSaveAsRequest: {};
      fileOpenRequest: {};
      toggleTheme: {};
      showAbout: {};
      toggleTitlebar: {};
      toggleToolbar: {};
      toggleStatusbar: {};
      menuAction: { action: string };

      // Phase 2 messages
      toggleSidebar: {};
      openQuickOpen: {};

      // Phase 3 messages
      openSettings: {};

      // Source mode toggle
      toggleSourceMode: {};

      // File version history
      openFileHistory: {};

      // i18n
      languageChanged: { language: 'en' | 'zh-CN' | 'de' | 'fr' | 'ja' | 'ko' | 'pt' | 'es' };
    };
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {};
  }>;
};
