// Shared types and RPC type definitions for PingWrite
import type { RPCSchema } from "electrobun/bun";

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

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: number;
  lineHeight: number;
  autoSave: boolean;
  autoSaveInterval: number;
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

// ============================================================================
// RPC Type Definitions
// ============================================================================

// @ts-ignore - Type complexity issue with RPCSchema resolution
export type PingWriteRPC = {
  bun: RPCSchema<{
    requests: {
      // File operations (Phase 1)
      openFile: { params: {}; response: { success: boolean; path?: string; content?: string; error?: string } };
      saveFile: { params: { content: string; path?: string }; response: { success: boolean; path?: string; error?: string } };
      saveFileAs: { params: { content: string }; response: { success: boolean; path?: string; error?: string } };
      getCurrentFile: { params: {}; response: string | null };
      readImageAsBase64: { params: { path: string }; response: { success: boolean; dataUrl?: string; error?: string } };
      showTableContextMenu: { params: {}; response: { success: boolean } };
      showDefaultContextMenu: { params: {}; response: { success: boolean } };
      writeToClipboard: { params: { text: string }; response: { success: boolean; error?: string } };

      // File management (Phase 2)
      readFile: { params: { path: string }; response: { success: boolean; path?: string; content?: string; error?: string } };
      readFolder: { params: { path: string }; response: { success: boolean; nodes?: FileSystemNode[]; error?: string } };
      getRecentFiles: { params: {}; response: { success: boolean; files?: RecentFile[]; error?: string } };
      addRecentFile: { params: { path: string }; response: { success: boolean; error?: string } };
      removeRecentFile: { params: { path: string }; response: { success: boolean; error?: string } };
      clearRecentFiles: { params: {}; response: { success: boolean; error?: string } };
      quickOpen: { params: {}; response: { success: boolean; items?: QuickOpenItem[]; error?: string } };
      selectImageFile: { params: {}; response: { success: boolean; path?: string; error?: string } };
    };
    messages: {
      fileOpened: { path: string; content: string };
      fileNew: {};
      fileSaveRequest: {};
      fileSaveAsRequest: {};
      toggleTheme: {};
      showAbout: {};
      toggleTitlebar: {};
      toggleToolbar: {};
      toggleStatusbar: {};
      menuAction: { action: string };

      // Phase 2 messages
      toggleSidebar: {};
      openQuickOpen: {};
    };
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {};
  }>;
};
