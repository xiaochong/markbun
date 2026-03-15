/**
 * Workspace Manager
 *
 * Manages the working directory and current file context.
 * Provides a unified interface for path resolution.
 *
 * Concepts:
 * - Workspace Root: The base directory for operations
 *   - When a file is opened: file's parent directory
 *   - When no file is open: user's desktop (platform-specific)
 * - Current File: The currently open file (null for new unsaved files)
 */

import { resolveImagePath, getDirectoryPath } from './pathResolver';

export interface Workspace {
  /** Current file path (null for new unsaved files) */
  currentFilePath: string | null;
  /** Workspace root directory */
  rootPath: string;
}

class WorkspaceManager {
  private currentFile: string | null = null;
  private workspaceRoot: string | null = null;

  /**
   * Set the current file path
   * Also updates workspace root to the file's directory
   */
  setCurrentFile(filePath: string | null): void {
    this.currentFile = filePath;

    if (filePath) {
      // Set workspace root to file's directory
      this.workspaceRoot = getDirectoryPath(filePath);
    }
    // If filePath is null, keep the existing workspace root
    // (will be set to desktop on initialization)
  }

  /**
   * Set the workspace root explicitly
   * Used when initializing with desktop path
   */
  setWorkspaceRoot(rootPath: string): void {
    this.workspaceRoot = rootPath;
  }

  /**
   * Get current file path
   */
  getCurrentFile(): string | null {
    return this.currentFile;
  }

  /**
   * Get workspace root directory
   * Returns null if not initialized
   */
  getWorkspaceRoot(): string | null {
    return this.workspaceRoot;
  }

  /**
   * Get complete workspace state
   */
  getWorkspace(): Workspace {
    return {
      currentFilePath: this.currentFile,
      rootPath: this.workspaceRoot ?? '',
    };
  }

  /**
   * Check if workspace is initialized
   */
  isInitialized(): boolean {
    return this.workspaceRoot !== null;
  }

  /**
   * Resolve an image path using current workspace context
   */
  resolvePath(imagePath: string): string {
    return resolveImagePath(imagePath, {
      currentFilePath: this.currentFile,
      workspaceRoot: this.workspaceRoot,
    });
  }

  /**
   * Clear workspace state
   */
  clear(): void {
    this.currentFile = null;
    this.workspaceRoot = null;
  }
}

// Singleton instance
export const workspaceManager = new WorkspaceManager();

// Re-export for convenience
export { resolveImagePath, getDirectoryPath } from './pathResolver';
