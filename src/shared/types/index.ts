// Shared types between main and renderer processes

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
