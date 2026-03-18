import { BrowserWindow, BrowserView, Updater, Utils, ApplicationMenu, ContextMenu, Screen } from 'electrobun/bun';
import { setupMenu, type ViewMenuState } from './menu';
import type { MarkBunRPC } from '../shared/types';
import { readFile, writeFile, stat, mkdir, readdir, open, unlink, rename, rmdir, rm } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { homedir } from 'os';
import { readFolder } from './ipc/folders';
import { getRecentFiles, addRecentFile, removeRecentFile, clearRecentFiles } from './ipc/recentFiles';
import { loadSettings, saveSettings, type Settings } from './services/settings';
import { loadUIState, saveUIState, type UIState } from './services/uiState';
import { spawn } from 'child_process';

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Current file state
let currentFilePath: string | null = null;

// Current view menu state
let currentWorkspaceRoot: string | null = null;

// Helper to get desktop path for current platform
function getDesktopPath(): string {
  return join(homedir(), 'Desktop');
}

// Helper to read first and last N bytes from a file for comparison
async function readFileHeadAndTail(
  filePath: string,
  byteCount: number
): Promise<{ head: Buffer; tail: Buffer } | null> {
  try {
    const fileHandle = await open(filePath, 'r');
    try {
      const fileStat = await fileHandle.stat();
      const fileSize = fileStat.size;

      // Read first N bytes
      const headBuffer = Buffer.alloc(byteCount);
      await fileHandle.read(headBuffer, 0, byteCount, 0);

      // Read last N bytes (if file is larger than byteCount)
      const tailBuffer = Buffer.alloc(byteCount);
      if (fileSize > byteCount) {
        await fileHandle.read(tailBuffer, 0, byteCount, fileSize - byteCount);
      } else {
        // File is smaller than byteCount, read what we can
        await fileHandle.read(tailBuffer, 0, fileSize, 0);
      }

      return { head: headBuffer, tail: tailBuffer };
    } finally {
      await fileHandle.close();
    }
  } catch {
    return null;
  }
}

// Helper to recursively find a file in workspace with depth limit
async function findFileInWorkspace(
  workspaceRoot: string,
  fileName: string,
  fileSize: number,
  fileHead: Buffer,
  fileTail: Buffer,
  options: {
    maxDepth?: number;
    skipDirs?: string[];
  } = {}
): Promise<{ absolutePath: string; relativePath: string; mtime?: Date } | null> {
  const { maxDepth = 3, skipDirs = ['.git', 'node_modules', '.cache', 'dist', 'build'] } = options;

  async function search(dir: string, depth: number): Promise<{ absolutePath: string; relativePath: string; mtime?: Date } | null> {
    if (depth > maxDepth) return null;

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files and directories
        if (entry.name.startsWith('.')) continue;

        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          // Skip specified directories
          if (skipDirs.includes(entry.name)) continue;

          const found = await search(fullPath, depth + 1);
          if (found) return found;
        } else if (entry.isFile() && entry.name === fileName) {
          try {
            const existingStat = await stat(fullPath);

            // Check file size matches
            if (existingStat.size !== fileSize) continue;

            // Compare head and tail bytes
            const existingData = await readFileHeadAndTail(fullPath, 10);
            if (!existingData) continue;

            const headMatches = fileHead.equals(existingData.head);
            const tailMatches = fileTail.equals(existingData.tail);

            if (headMatches && tailMatches) {
              return {
                absolutePath: fullPath,
                relativePath: relative(workspaceRoot, fullPath),
                mtime: existingStat.mtime,
              };
            }
          } catch {
            // Continue searching
            continue;
          }
        }
      }
    } catch {
      // Directory not readable, skip
    }

    return null;
  }

  return search(workspaceRoot, 0);
}

// Current view menu state
let viewMenuState: ViewMenuState = {
  showTitleBar: false,
  showToolBar: false,
  showStatusBar: false,
  showSidebar: false,
  sourceMode: false,
};

// Current settings
let currentSettings: Settings | null = null;

// Current UI state
let currentUIState: UIState | null = null;

// Helper to update view menu state and refresh menu
function updateViewMenuState(updates: Partial<ViewMenuState>) {
  viewMenuState = { ...viewMenuState, ...updates };
  setupMenu(viewMenuState);
}

// File operations
async function openFile(): Promise<{ success: boolean; path?: string; content?: string; error?: string }> {
  try {
    // @ts-ignore
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
      content: content
    };
  } catch (error) {
    console.error('Failed to open file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function saveFile(content: string, path?: string): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const filePath = path || currentFilePath;
    if (!filePath) {
      return { success: false, error: 'No file path specified' };
    }

    await writeFile(filePath, content, 'utf-8');
    currentFilePath = filePath;
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Failed to save file:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function saveFileAs(content: string): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    // @ts-ignore
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
    try {
      const s = await stat(filePath);
      if (s.isDirectory()) {
        filePath = join(filePath, 'Untitled.md');
      }
    } catch {}

    await writeFile(filePath, content, 'utf-8');
    currentFilePath = filePath;
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Failed to save file as:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Open folder dialog
async function openFolder(): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    // @ts-ignore
    const chosenPaths = await Utils.openFileDialog({
      startingFolder: join(homedir(), 'Desktop'),
      canChooseFiles: false,
      canChooseDirectory: true,
      allowsMultipleSelection: false,
    });

    if (!chosenPaths || chosenPaths.length === 0) {
      return { success: false };
    }

    return {
      success: true,
      path: chosenPaths[0],
    };
  } catch (error) {
    console.error('Failed to open folder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
  try {
    const channel = await Updater.localInfo.channel();
    if (channel === 'dev') {
      try {
        await fetch(DEV_SERVER_URL, { method: 'HEAD' });
        return DEV_SERVER_URL;
      } catch {
        // Dev server not running, use bundled assets
      }
    }
  } catch {}
  return 'views://mainview/index.html';
}

// Create the main application window
async function main() {
  // Load settings and UI state before setting up menu
  try {
    currentSettings = await loadSettings();
    currentUIState = await loadUIState();

    // Update view menu state from saved UI state
    viewMenuState = {
      showTitleBar: currentUIState.showTitleBar,
      showToolBar: currentUIState.showToolBar,
      showStatusBar: currentUIState.showStatusBar,
      showSidebar: currentUIState.showSidebar,
      sourceMode: currentUIState.sourceMode,
    };

  } catch (error) {
    console.error('[Bun Main] Failed to load settings:', error);
  }

  // Setup application menu FIRST (before creating window)
  setupMenu(viewMenuState);

  const url = await getMainViewUrl();

  // Define RPC handlers
  // @ts-ignore - Type complexity with RPCSchema
  const rpc = BrowserView.defineRPC<MarkBunRPC>({
    maxRequestTime: 30000, // 30 seconds timeout for file operations
    handlers: {
      requests: {
        openFile: async () => {
          try {
            return await openFile();
          } catch (err) {
            console.error('RPC openFile error:', err);
            return { success: false, error: String(err) };
          }
        },
        openFolder: async () => {
          try {
            return await openFolder();
          } catch (err) {
            console.error('RPC openFolder error:', err);
            return { success: false, error: String(err) };
          }
        },
        saveFile: async ({ content, path }: { content: string; path?: string }) => {
          return await saveFile(content, path);
        },
        saveFileAs: async ({ content }: { content: string }) => {
          return await saveFileAs(content);
        },
        getCurrentFile: async () => {
          return currentFilePath;
        },
        readImageAsBase64: async ({ path }: { path: string }) => {
          try {
            const imageBuffer = await readFile(path);
            const ext = path.split('.').pop()?.toLowerCase() || 'png';
            const mimeTypes: Record<string, string> = {
              'png': 'image/png',
              'jpg': 'image/jpeg',
              'jpeg': 'image/jpeg',
              'gif': 'image/gif',
              'svg': 'image/svg+xml',
              'webp': 'image/webp',
              'bmp': 'image/bmp',
            };
            const mimeType = mimeTypes[ext] || 'image/png';
            const base64 = imageBuffer.toString('base64');
            return {
              success: true,
              dataUrl: `data:${mimeType};base64,${base64}`
            };
          } catch (error) {
            console.error('Failed to read image:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        },
        showTableContextMenu: async () => {
          // Show context menu for table operations
          ContextMenu.showContextMenu([
            { label: 'Insert Row Above', action: 'table-insert-row-above' },
            { label: 'Insert Row Below', action: 'table-insert-row-below' },
            { type: 'separator' },
            { label: 'Insert Column Left', action: 'table-insert-col-left' },
            { label: 'Insert Column Right', action: 'table-insert-col-right' },
            { type: 'separator' },
            { label: 'Move Row Up', action: 'table-move-row-up' },
            { label: 'Move Row Down', action: 'table-move-row-down' },
            { type: 'separator' },
            { label: 'Move Column Left', action: 'table-move-col-left' },
            { label: 'Move Column Right', action: 'table-move-col-right' },
            { type: 'separator' },
            { label: 'Delete Row', action: 'table-delete-row' },
            { label: 'Delete Column', action: 'table-delete-col' },
            { label: 'Delete Table', action: 'table-delete' },
          ]);
          return { success: true };
        },
        showDefaultContextMenu: async () => {
          // Show default context menu with standard editing actions
          // Note: We use custom actions instead of roles to handle copy/paste in the renderer
          // This ensures blob URLs are properly converted to original paths
          ContextMenu.showContextMenu([
            { label: 'Undo', action: 'editor-undo' },
            { label: 'Redo', action: 'editor-redo' },
            { type: 'separator' },
            { label: 'Cut', action: 'editor-cut' },
            { label: 'Copy', action: 'editor-copy' },
            { label: 'Paste', action: 'editor-paste' },
          ]);
          return { success: true };
        },
        writeToClipboard: async ({ text }: { text: string }) => {
          try {
            // Use pbcopy on macOS to write to clipboard
            const proc = spawn('pbcopy', { stdio: ['pipe', 'inherit', 'inherit'] });
            proc.stdin.write(text);
            proc.stdin.end();
            return { success: true };
          } catch (error) {
            console.error('Failed to write to clipboard:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        },
        readFromClipboard: async () => {
          try {
            // Use pbpaste on macOS to read from clipboard
            const result = await new Promise<{ success: boolean; text?: string; error?: string }>((resolve) => {
              const proc = spawn('pbpaste', { stdio: ['inherit', 'pipe', 'pipe'] });
              let output = '';
              let errorOutput = '';

              proc.stdout.on('data', (data: Buffer) => {
                output += data.toString();
              });

              proc.stderr.on('data', (data: Buffer) => {
                errorOutput += data.toString();
              });

              proc.on('close', (code: number | null) => {
                if (code === 0) {
                  resolve({ success: true, text: output });
                } else {
                  resolve({ success: false, error: errorOutput || `pbpaste exited with code ${code}` });
                }
              });

              proc.on('error', (error: Error) => {
                resolve({ success: false, error: error.message });
              });
            });
            return result;
          } catch (error) {
            console.error('Failed to read from clipboard:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        },
        // Phase 2: File Management
        readFile: async (params: { path: string }) => {
          try {
            const filePath = params?.path;
            if (!filePath || typeof filePath !== 'string') {
              return { success: false, error: 'No file path provided' };
            }
            const content = await readFile(filePath, 'utf-8');
            currentFilePath = filePath;
            return {
              success: true,
              path: filePath,
              content
            };
          } catch (error) {
            console.error('Failed to read file:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        },
        readFolder: async (params: { path: string; maxDepth?: number }) => {
          const folderPath = params.path;
          const maxDepth = params.maxDepth ?? 3;
          if (!folderPath) {
            return { success: false, error: 'No folder path provided' };
          }
          return await readFolder(folderPath, maxDepth);
        },
        getRecentFiles: async () => {
          return await getRecentFiles();
        },
        addRecentFile: async (params: { path: string }) => {
          const filePath = params.path;
          if (!filePath) {
            return { success: false, error: 'No file path provided' };
          }
          return await addRecentFile(filePath);
        },
        removeRecentFile: async (params: { path: string }) => {
          const filePath = params.path;
          if (!filePath) {
            return { success: false, error: 'No file path provided' };
          }
          return await removeRecentFile(filePath);
        },
        clearRecentFiles: async () => {
          return await clearRecentFiles();
        },
        quickOpen: async () => {
          // Get recent files as quick open items
          const recent = await getRecentFiles();
          if (recent.success && recent.files) {
            const items = recent.files.map(f => ({
              path: f.path,
              name: f.name,
              isRecent: true,
            }));
            return { success: true, items };
          }
          return { success: true, items: [] };
        },
        selectImageFile: async () => {
          try {
            // @ts-ignore
            const chosenPaths = await Utils.openFileDialog({
              startingFolder: join(homedir(), 'Desktop'),
              allowedFileTypes: 'png,jpg,jpeg,gif,svg,webp,bmp',
              canChooseFiles: true,
              canChooseDirectory: false,
              allowsMultipleSelection: false,
            });

            if (!chosenPaths || chosenPaths.length === 0) {
              return { success: false };
            }

            return {
              success: true,
              path: chosenPaths[0],
            };
          } catch (error) {
            console.error('Failed to select image:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        },
        getDesktopPath: async () => {
          return {
            success: true,
            path: getDesktopPath(),
          };
        },
        getWorkspaceRoot: async () => {
          return {
            success: true,
            path: currentWorkspaceRoot ?? getDesktopPath(),
          };
        },
        saveDroppedImage: async ({ fileName, base64Data, workspaceRoot }: { fileName: string; base64Data: string; workspaceRoot: string }) => {
          try {
            // Decode base64 to buffer for comparison
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const fileSize = imageBuffer.length;

            // Extract head and tail bytes (10 bytes each) for comparison
            const headBytes = imageBuffer.slice(0, 10);
            const tailBytes = fileSize > 10
              ? imageBuffer.slice(fileSize - 10)
              : imageBuffer.slice(0);

            // Step 1: Check if file already exists in workspace (recursively, max 3 levels)
            const existingFile = await findFileInWorkspace(
              workspaceRoot,
              fileName,
              fileSize,
              headBytes,
              tailBytes,
              { maxDepth: 3 }
            );

            if (existingFile) {
              // File already exists in workspace, use it directly
              return {
                success: true,
                relativePath: existingFile.relativePath,
                absolutePath: existingFile.absolutePath,
              };
            }

            // Step 2: File doesn't exist, save to assets directory
            // Create assets directory if it doesn't exist
            const assetsDir = join(workspaceRoot, 'assets');
            try {
              await stat(assetsDir);
            } catch {
              await mkdir(assetsDir, { recursive: true });
            }

            // Generate unique filename if file already exists in assets
            let targetFileName = fileName;
            let targetPath = join(assetsDir, targetFileName);
            let counter = 1;
            const extMatch = fileName.match(/^(.*)(\.[^.]+)$/);
            const baseName = extMatch ? extMatch[1] : fileName;
            const ext = extMatch ? extMatch[2] : '';

            while (true) {
              try {
                await stat(targetPath);
                targetFileName = `${baseName}_${counter}${ext}`;
                targetPath = join(assetsDir, targetFileName);
                counter++;
              } catch {
                break;
              }
            }

            // Save the file
            await writeFile(targetPath, imageBuffer);

            const relativePath = `assets/${targetFileName}`;

            return {
              success: true,
              relativePath,
              absolutePath: targetPath,
            };
          } catch (error) {
            console.error('Failed to save dropped image:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },

        // Custom save dialog - list folder contents
        listFolder: async ({ path }: { path: string }) => {
          try {
            const entries = await readdir(path, { withFileTypes: true });
            const items = entries
              .filter(entry => {
                const name = entry.name;
                // Hide Unix hidden files
                if (name.startsWith('.')) return false;
                // Hide Windows system folders
                const windowsHidden = [
                  '$recycle.bin',
                  '$recycle',
                  'system volume information',
                  'config.msi',
                  'msocache',
                  'pagefile.sys',
                  'swapfile.sys',
                  'hiberfil.sys',
                  'recycler',
                  'thumbs.db',
                  'desktop.ini',
                  'ntuser.dat',
                  'ntuser.ini',
                ];
                if (windowsHidden.includes(name.toLowerCase())) return false;
                // Hide macOS system folders
                const macSystem = [
                  '.ds_store',
                  '.trashes',
                  '.fseventsd',
                  '.spotlight-v100',
                  '.temporaryitems',
                  'desktop.db',
                  'desktopdf',
                  '.appledb',
                  '.appledesktop',
                  '.appledouble',
                ];
                const lowerName = name.toLowerCase();
                if (macSystem.some(sys => lowerName === sys || lowerName.startsWith('._'))) return false;
                return true;
              })
              .map(entry => ({
                name: entry.name,
                path: join(path, entry.name),
                isDirectory: entry.isDirectory(),
              }))
              .sort((a, b) => {
                // Folders first, then alphabetically
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
              });
            return { success: true, items };
          } catch (error) {
            console.error('Failed to list folder:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },

        // Get parent folder path
        getParentFolder: async ({ path }: { path: string }) => {
          try {
            const parentPath = dirname(path);
            // Don't go above root
            if (parentPath === path) {
              return { success: false, error: 'Already at root' };
            }
            return { success: true, path: parentPath };
          } catch (error) {
            console.error('Failed to get parent folder:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },

        // Save file with specified path
        saveFileWithPath: async ({ content, folderPath, fileName }: { content: string; folderPath: string; fileName: string }) => {
          try {
            const fullPath = join(folderPath, fileName);
            await writeFile(fullPath, content, 'utf-8');
            currentFilePath = fullPath;
            return { success: true, fullPath };
          } catch (error) {
            console.error('Failed to save file:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },

        // Check if file exists
        fileExists: async ({ path }: { path: string }) => {
          try {
            const s = await stat(path);
            return { exists: true, isDirectory: s.isDirectory() };
          } catch {
            return { exists: false };
          }
        },

        // Show confirmation dialog for file overwrite
        showConfirmationDialog: async ({ title, message, detail, confirmLabel = 'Replace', cancelLabel = 'Cancel' }: { title: string; message: string; detail?: string; confirmLabel?: string; cancelLabel?: string }) => {
          try {
            const { response } = await Utils.showMessageBox({
              type: 'warning',
              title,
              message,
              detail,
              buttons: [cancelLabel, confirmLabel],
              defaultId: 0,
              cancelId: 0,
            });
            // response 0 = Cancel, 1 = Replace
            return { confirmed: response === 1 };
          } catch (error) {
            console.error('Failed to show confirmation dialog:', error);
            return { confirmed: false };
          }
        },

        // Settings (Phase 3)
        getSettings: async () => {
          try {
            if (!currentSettings) {
              currentSettings = await loadSettings();
            }
            // Convert Settings to AppSettings for RPC
            const appSettings = {
              theme: currentSettings.appearance.theme,
              fontSize: currentSettings.editor.fontSize,
              lineHeight: currentSettings.editor.lineHeight,
              autoSave: currentSettings.general.autoSave,
              autoSaveInterval: currentSettings.general.autoSaveInterval,
            };
            return { success: true, settings: appSettings };
          } catch (error) {
            console.error('[RPC] Failed to get settings:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },
        saveSettings: async ({ settings }: { settings: { theme: 'light' | 'dark' | 'system'; fontSize: number; lineHeight: number; autoSave: boolean; autoSaveInterval: number } }) => {
          try {
            currentSettings = {
              __version: 1,
              general: {
                autoSave: settings.autoSave,
                autoSaveInterval: settings.autoSaveInterval,
              },
              editor: {
                fontSize: settings.fontSize,
                lineHeight: settings.lineHeight,
              },
              appearance: {
                theme: settings.theme,
                sidebarWidth: currentSettings?.appearance.sidebarWidth ?? 280,
              },
            };
            const result = await saveSettings(currentSettings);
            return result;
          } catch (error) {
            console.error('[RPC] Failed to save settings:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },
        getUIState: async () => {
          try {
            if (!currentUIState) {
              currentUIState = await loadUIState();
            }
            return { success: true, state: currentUIState };
          } catch (error) {
            console.error('[RPC] Failed to get UI state:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },
        saveUIState: async ({ state }: { state: Partial<UIState> }) => {
          try {
            // Merge with current state (preserving window state if not provided)
            currentUIState = {
              ...currentUIState,
              ...state,
            } as UIState;
            // Also update view menu state
            viewMenuState = {
              showTitleBar: currentUIState.showTitleBar,
              showToolBar: currentUIState.showToolBar,
              showStatusBar: currentUIState.showStatusBar,
              showSidebar: currentUIState.showSidebar,
              sourceMode: currentUIState.sourceMode,
            };
            setupMenu(viewMenuState);
            const result = await saveUIState(currentUIState);
            return result;
            return result;
          } catch (error) {
            console.error('[RPC] Failed to save UI state:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },
        updateWindowBounds: async ({ x, y, width, height }: { x: number; y: number; width: number; height: number }) => {
          try {
            if (currentUIState) {
              currentUIState.windowX = x;
              currentUIState.windowY = y;
              currentUIState.windowWidth = width;
              currentUIState.windowHeight = height;
            }
            return { success: true };
          } catch (error) {
            console.error('[RPC] Failed to update window bounds:', error);
            return { success: false };
          }
        },

        // File Explorer context menu operations
        createFile: async ({ folderPath, fileName }: { folderPath: string; fileName?: string }) => {
          try {
            // Generate unique filename
            let baseName = fileName || 'Untitled.md';
            if (!baseName.endsWith('.md')) {
              baseName += '.md';
            }

            let targetPath = join(folderPath, baseName);
            let counter = 1;

            // Check for existing files and generate unique name
            while (true) {
              try {
                await stat(targetPath);
                // File exists, increment counter
                const ext = baseName.endsWith('.md') ? '.md' : '';
                const nameWithoutExt = baseName.slice(0, -ext.length) || 'Untitled';
                const match = nameWithoutExt.match(/^(.*?)(?:\s*(\d+))?$/);
                const base = match ? match[1] : 'Untitled';
                targetPath = join(folderPath, `${base} ${counter}${ext}`);
                counter++;
              } catch {
                // File doesn't exist, we can use this path
                break;
              }
            }

            // Create empty file
            await writeFile(targetPath, '', 'utf-8');
            return { success: true, path: targetPath };
          } catch (error) {
            console.error('[RPC] Failed to create file:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },

        createFolder: async ({ parentPath, folderName }: { parentPath: string; folderName?: string }) => {
          try {
            // Generate unique folder name
            let baseName = folderName || 'New Folder';
            let targetPath = join(parentPath, baseName);
            let counter = 1;

            // Check for existing folders and generate unique name
            while (true) {
              try {
                await stat(targetPath);
                // Folder exists, increment counter
                const match = baseName.match(/^(.*?)(?:\s*(\d+))?$/);
                const base = match ? match[1] : 'New Folder';
                targetPath = join(parentPath, `${base} ${counter}`);
                counter++;
              } catch {
                // Folder doesn't exist, we can use this path
                break;
              }
            }

            // Create folder
            await mkdir(targetPath, { recursive: true });
            return { success: true, path: targetPath };
          } catch (error) {
            console.error('[RPC] Failed to create folder:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },

        deleteFile: async ({ path }: { path: string }) => {
          try {
            // Check if it's a file or folder
            const stats = await stat(path);
            if (stats.isDirectory()) {
              // Delete folder recursively
              await rm(path, { recursive: true, force: true });
            } else {
              // Delete file
              await unlink(path);
            }
            return { success: true };
          } catch (error) {
            console.error('[RPC] Failed to delete file:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },

        moveFile: async ({ sourcePath, targetFolderPath }: { sourcePath: string; targetFolderPath: string }) => {
          try {
            const fileName = sourcePath.split('/').pop() || '';
            const targetPath = join(targetFolderPath, fileName);

            // Check if target already exists
            try {
              await stat(targetPath);
              return {
                success: false,
                error: 'A file with the same name already exists in the target folder',
              };
            } catch {
              // Target doesn't exist, proceed with move
            }

            await rename(sourcePath, targetPath);
            return { success: true, newPath: targetPath };
          } catch (error) {
            console.error('[RPC] Failed to move file:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },

        renameFile: async ({ path, newName }: { path: string; newName: string }) => {
          try {
            const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
            const newPath = join(parentPath, newName);

            // Check if target already exists and is not the same file
            if (newPath !== path) {
              try {
                await stat(newPath);
                return {
                  success: false,
                  error: 'A file or folder with that name already exists',
                };
              } catch {
                // Target doesn't exist, proceed with rename
              }
            }

            await rename(path, newPath);
            return { success: true, newPath };
          } catch (error) {
            console.error('[RPC] Failed to rename file:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        },
      },
      messages: {},
    },
  });

  // Use saved window state or defaults
  let windowX = currentUIState?.windowX ?? 200;
  let windowY = currentUIState?.windowY ?? 200;
  let windowWidth = currentUIState?.windowWidth ?? 1200;
  let windowHeight = currentUIState?.windowHeight ?? 800;


  // Multi-monitor support: Check if the window is within any available display
  try {
    const displays = Screen.getAllDisplays();

    // Check if window center is within any display
    const windowCenterX = windowX + windowWidth / 2;
    const windowCenterY = windowY + windowHeight / 2;
    const MIN_VISIBLE_PIXELS = 100;

    const isWindowOnAnyDisplay = displays.some(display => {
      const { x, y, width, height } = display.bounds;
      // Check if at least MIN_VISIBLE_PIXELS of the window would be visible
      const windowRight = windowX + windowWidth;
      const windowBottom = windowY + windowHeight;
      const displayRight = x + width;
      const displayBottom = y + height;

      // Check horizontal overlap
      const horizontalOverlap = windowX < displayRight - MIN_VISIBLE_PIXELS &&
                               windowRight > x + MIN_VISIBLE_PIXELS;
      // Check vertical overlap
      const verticalOverlap = windowY < displayBottom - MIN_VISIBLE_PIXELS &&
                             windowBottom > y + MIN_VISIBLE_PIXELS;

      return horizontalOverlap && verticalOverlap;
    });

    if (!isWindowOnAnyDisplay) {
      const primaryDisplay = Screen.getPrimaryDisplay();
      const workArea = primaryDisplay.workArea;
      windowWidth = Math.min(windowWidth, workArea.width - 100);
      windowHeight = Math.min(windowHeight, workArea.height - 100);
      windowX = workArea.x + Math.round((workArea.width - windowWidth) / 2);
      windowY = workArea.y + Math.round((workArea.height - windowHeight) / 2);
    }
  } catch (error) {
    console.error('[Bun Main] Failed to get display info:', error);
    // Fallback to basic validation
    const MIN_VISIBLE_PIXELS = 100;
    const MAX_REASONABLE_SCREEN_WIDTH = 7680;
    const MAX_REASONABLE_SCREEN_HEIGHT = 4320;

    const isXValid = windowX >= -windowWidth + MIN_VISIBLE_PIXELS && windowX < MAX_REASONABLE_SCREEN_WIDTH;
    const isYValid = windowY >= -windowHeight + MIN_VISIBLE_PIXELS && windowY < MAX_REASONABLE_SCREEN_HEIGHT;
    const isWidthValid = windowWidth >= 400 && windowWidth <= MAX_REASONABLE_SCREEN_WIDTH;
    const isHeightValid = windowHeight >= 300 && windowHeight <= MAX_REASONABLE_SCREEN_HEIGHT;

    if (!isXValid || !isYValid || !isWidthValid || !isHeightValid) {
      windowX = 200;
      windowY = 200;
      windowWidth = 1200;
      windowHeight = 800;
    }
  }

  const win = new BrowserWindow({
    title: 'MarkBun',
    url,
    renderer: "cef",
    frame: {
      width: windowWidth,
      height: windowHeight,
      x: windowX,
      y: windowY,
    },
    rpc,
  });

  // Save window state when it changes
  let windowStateTimeout: NodeJS.Timeout | null = null;
  const saveWindowState = async () => {
    if (windowStateTimeout) {
      clearTimeout(windowStateTimeout);
    }
    windowStateTimeout = setTimeout(async () => {
      try {
        // Use getFrame() method to get current window bounds
        // @ts-ignore - getFrame method exists but may not be typed
        const frame = win.getFrame ? win.getFrame() : null;
        if (frame && currentUIState) {
          const newX = frame.x ?? windowX;
          const newY = frame.y ?? windowY;
          const newWidth = frame.width ?? windowWidth;
          const newHeight = frame.height ?? windowHeight;

          // Only save if values actually changed
          if (
            currentUIState.windowX !== newX ||
            currentUIState.windowY !== newY ||
            currentUIState.windowWidth !== newWidth ||
            currentUIState.windowHeight !== newHeight
          ) {
            currentUIState.windowX = newX;
            currentUIState.windowY = newY;
            currentUIState.windowWidth = newWidth;
            currentUIState.windowHeight = newHeight;

            // Get display info for multi-monitor support
            try {
              const displays = Screen.getAllDisplays();
              const windowCenterX = newX + newWidth / 2;
              const windowCenterY = newY + newHeight / 2;

              const currentDisplay = displays.find(d => {
                const { x, y, width, height } = d.bounds;
                return windowCenterX >= x && windowCenterX < x + width &&
                       windowCenterY >= y && windowCenterY < y + height;
              });

              if (currentDisplay) {
                currentUIState.displayId = currentDisplay.id;
                currentUIState.displayWidth = currentDisplay.bounds.width;
                currentUIState.displayHeight = currentDisplay.bounds.height;
              }
            } catch {
              // Silently ignore display info errors
            }

            await saveUIState(currentUIState);
          }
        }
      } catch (error) {
        console.error('[Bun Main] Failed to save window state:', error);
      }
    }, 500);
  };

  // Listen for window move/resize events
  // @ts-ignore - Events may not be typed
  if (win.on) {
    // @ts-ignore
    win.on('move', () => void saveWindowState());
    // @ts-ignore
    win.on('resize', () => void saveWindowState());
  }

  // Save state before app quits
  const cleanup = async () => {
    await saveWindowState();
  };

  process.on('exit', cleanup);

  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });

  // Handle context menu clicks
  ContextMenu.on('context-menu-clicked', (event: { data: { action: string } }) => {
    const action = event.data.action;
    // Forward context menu actions to renderer
    // @ts-ignore
    win.webview.rpc.send.menuAction({ action });
  });

  // Handle menu actions
  ApplicationMenu.on('application-menu-clicked', async (event: { data: { action: string } }) => {
    const action = event.data.action;

    switch (action) {
      case 'file-new':
        currentFilePath = null;
        // @ts-ignore
        win.webview.rpc.send.fileNew({});
        break;

      case 'file-open': {
        try {
          const result = await openFile();
          if (result?.success === true && result.content !== undefined) {
            // Add to recent files
            if (result.path) {
              await addRecentFile(result.path);
              // Update workspace root to file's directory
              const dirSeparator = result.path.lastIndexOf('/');
              currentWorkspaceRoot = dirSeparator > 0 ? result.path.substring(0, dirSeparator) : '/';
            }
            // @ts-ignore
            win.webview.rpc.send.fileOpened({
              path: result.path || '',
              content: result.content,
            });
          }
        } catch (err) {
          console.error('Error in file-open handler:', err);
        }
        break;
      }

      case 'file-open-folder': {
        try {
          const result = await openFolder();
          if (result?.success === true && result.path) {
            // Update workspace root
            currentWorkspaceRoot = result.path;
            // @ts-ignore
            win.webview.rpc.send.folderOpened({
              path: result.path,
            });
          }
        } catch (err) {
          console.error('Error in file-open-folder handler:', err);
        }
        break;
      }

      case 'file-save':
        // @ts-ignore
        win.webview.rpc.send.fileSaveRequest({});
        break;

      case 'file-save-as':
        // @ts-ignore
        win.webview.rpc.send.fileSaveAsRequest({});
        break;

      case 'view-toggle-theme':
        // @ts-ignore
        win.webview.rpc.send.toggleTheme({});
        break;

      case 'view-toggle-devtools':
        // @ts-ignore
        win.webview.toggleDevTools();
        // Trigger window resize to fix layout issues after DevTools toggle
        setTimeout(() => {
          try {
            // @ts-ignore
            const frame = win.frame;
            if (frame) {
              // Resize by 1px and back to force WebView relayout
              // @ts-ignore
              win.frame = { ...frame, width: frame.width + 1 };
              setTimeout(() => {
                // @ts-ignore
                win.frame = frame;
              }, 50);
            }
            // Also trigger a resize event in the WebView
            // @ts-ignore
            win.webview?.evaluateJavaScript?.(`
              window.dispatchEvent(new Event('resize'));
              document.body.style.display = 'none';
              document.body.offsetHeight; // force reflow
              document.body.style.display = '';
            `);
          } catch (e) {
            console.error('Failed to fix layout after DevTools toggle:', e);
          }
        }, 150);
        break;

      case 'app-about':
        // @ts-ignore
        win.webview.rpc.send.showAbout({});
        break;

      case 'app-preferences':
        // @ts-ignore
        win.webview.rpc.send.openSettings({});
        break;

      case 'view-toggle-titlebar':
        updateViewMenuState({ showTitleBar: !viewMenuState.showTitleBar });
        // @ts-ignore
        win.webview.rpc.send.toggleTitlebar({});
        break;

      case 'view-toggle-toolbar':
        updateViewMenuState({ showToolBar: !viewMenuState.showToolBar });
        // @ts-ignore
        win.webview.rpc.send.toggleToolbar({});
        break;

      case 'view-toggle-statusbar':
        updateViewMenuState({ showStatusBar: !viewMenuState.showStatusBar });
        // @ts-ignore
        win.webview.rpc.send.toggleStatusbar({});
        break;

      case 'view-toggle-sidebar':
        updateViewMenuState({ showSidebar: !viewMenuState.showSidebar });
        // @ts-ignore
        win.webview.rpc.send.toggleSidebar({});
        break;

      case 'view-quick-open':
        // @ts-ignore
        win.webview.rpc.send.openQuickOpen({});
        break;

      case 'view-toggle-source-mode':
        updateViewMenuState({ sourceMode: !viewMenuState.sourceMode });
        // @ts-ignore
        win.webview.rpc.send.toggleSourceMode({});
        break;

      // Table menu actions
      case 'table-insert':
      case 'table-insert-row-above':
      case 'table-insert-row-below':
      case 'table-insert-col-left':
      case 'table-insert-col-right':
      case 'table-move-row-up':
      case 'table-move-row-down':
      case 'table-move-col-left':
      case 'table-move-col-right':
      case 'table-delete-row':
      case 'table-delete-col':
      case 'table-delete':
      // Edit menu actions
      case 'editor-undo':
      case 'editor-redo':
      case 'editor-cut':
      case 'editor-copy':
      case 'editor-paste':
      case 'editor-select-all':
      // Format menu actions
      case 'format-strong':
      case 'format-emphasis':
      case 'format-code':
      case 'format-strikethrough':
      case 'format-link':
      case 'format-image':
      // Paragraph menu actions
      case 'para-heading-1':
      case 'para-heading-2':
      case 'para-heading-3':
      case 'para-heading-4':
      case 'para-heading-5':
      case 'para-heading-6':
      case 'para-paragraph':
      case 'para-increase-heading':
      case 'para-decrease-heading':
      case 'para-math-block':
      case 'para-code-block':
      case 'para-quote':
      case 'para-ordered-list':
      case 'para-unordered-list':
      case 'para-task-list':
      case 'para-insert-above':
      case 'para-insert-below':
      case 'para-horizontal-rule':
        // @ts-ignore
        win.webview.rpc.send.menuAction({ action });
        break;
    }
  });

}

main().catch(console.error);
