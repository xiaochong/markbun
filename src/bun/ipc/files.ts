// File operations IPC handlers
import { Utils } from 'electrobun/bun';
import { readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface FileOpenResult {
  success: boolean;
  path?: string;
  content?: string;
  error?: string;
}

export interface FileSaveResult {
  success: boolean;
  path?: string;
  error?: string;
}

// Current file state
let currentFilePath: string | null = null;

export function getCurrentFilePath(): string | null {
  return currentFilePath;
}

export function setCurrentFilePath(path: string | null): void {
  currentFilePath = path;
}

// Open file with native dialog
export async function openFile(): Promise<FileOpenResult> {
  try {
    // @ts-ignore - Utils types
    const chosenPaths = await Utils.openFileDialog({
      startingFolder: join(homedir(), 'Desktop'),
      allowedFileTypes: 'md,markdown,txt',
      canChooseFiles: true,
      canChooseDirectory: false,
      allowsMultipleSelection: false,
    });

    if (!chosenPaths || chosenPaths.length === 0) {
      return { success: false };
    }

    const filePath = chosenPaths[0];
    const content = await readFile(filePath, 'utf-8');
    currentFilePath = filePath;

    return {
      success: true,
      path: filePath,
      content,
    };
  } catch (error) {
    console.error('Failed to open file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Save file (uses current path or requires path)
export async function saveFile(content: string, path?: string): Promise<FileSaveResult> {
  try {
    const filePath = path || currentFilePath;

    if (!filePath) {
      return {
        success: false,
        error: 'No file path specified',
      };
    }

    await writeFile(filePath, content, 'utf-8');
    currentFilePath = filePath;

    return {
      success: true,
      path: filePath,
    };
  } catch (error) {
    console.error('Failed to save file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Save file as - use open dialog as workaround
export async function saveFileAs(content: string, suggestedName: string = 'Untitled.md'): Promise<FileSaveResult> {
  try {
    // Show info message
    // @ts-ignore - Utils types
    await Utils.showMessageBox({
      type: 'info',
      title: 'Save File',
      message: 'Please select a location to save the file.',
      detail: `The file will be saved as "${suggestedName}" in the selected location.`,
      buttons: ['OK'],
    });

    // Use open dialog to let user select where to save
    // @ts-ignore - Utils types
    const chosenPaths = await Utils.openFileDialog({
      startingFolder: currentFilePath || join(homedir(), 'Desktop'),
      allowedFileTypes: 'md,markdown',
      canChooseFiles: true,
      canChooseDirectory: true,
      allowsMultipleSelection: false,
    });

    if (!chosenPaths || chosenPaths.length === 0) {
      return { success: false };
    }

    let filePath = chosenPaths[0];
    
    // If user selected a directory, append the filename
    try {
      const s = await stat(filePath);
      if (s.isDirectory()) {
        filePath = join(filePath, suggestedName);
      }
    } catch {
      // If we can't stat, assume it's a file path
    }

    await writeFile(filePath, content, 'utf-8');
    currentFilePath = filePath;

    return {
      success: true,
      path: filePath,
    };
  } catch (error) {
    console.error('Failed to save file as:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Create new file
export function newFile(): void {
  currentFilePath = null;
}

// Open folder with native dialog
export async function openFolder(): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    // @ts-ignore - Utils types
    const chosenPaths = await Utils.openFileDialog({
      startingFolder: join(homedir(), 'Desktop'),
      canChooseFiles: false,
      canChooseDirectory: true,
      allowsMultipleSelection: false,
    });

    if (!chosenPaths || chosenPaths.length === 0) {
      return { success: false };
    }

    const folderPath = chosenPaths[0];

    return {
      success: true,
      path: folderPath,
    };
  } catch (error) {
    console.error('Failed to open folder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
