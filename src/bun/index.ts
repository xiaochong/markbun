import { BrowserWindow, BrowserView, Updater, Utils, ApplicationMenu, ContextMenu } from 'electrobun/bun';
import { setupMenu, type ViewMenuState } from './menu';
import type { PingWriteRPC } from '../shared/types';
import { readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { readFolder } from './ipc/folders';
import { getRecentFiles, addRecentFile, removeRecentFile, clearRecentFiles } from './ipc/recentFiles';
import { spawn } from 'child_process';

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Current file state
let currentFilePath: string | null = null;

// Current view menu state
let viewMenuState: ViewMenuState = {
  showTitleBar: false,
  showToolBar: false,
  showStatusBar: false,
  showSidebar: false,
};

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

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
  try {
    const channel = await Updater.localInfo.channel();
    if (channel === 'dev') {
      try {
        await fetch(DEV_SERVER_URL, { method: 'HEAD' });
        return DEV_SERVER_URL;
      } catch {
        console.log('[Bun Main] Vite dev server not running. Run `bun run dev:hmr` for HMR support.');
      }
    }
  } catch {}
  return 'views://mainview/index.html';
}

// Create the main application window
async function main() {
  // Setup application menu FIRST (before creating window)
  setupMenu(viewMenuState);

  const url = await getMainViewUrl();

  // Define RPC handlers
  // @ts-ignore - Type complexity with RPCSchema
  const rpc = BrowserView.defineRPC<PingWriteRPC>({
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
        readFolder: async (params: { path: string }) => {
          const folderPath = params.path;
          if (!folderPath) {
            return { success: false, error: 'No folder path provided' };
          }
          return await readFolder(folderPath);
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
      },
      messages: {},
    },
  });

  const win = new BrowserWindow({
    title: 'PingWrite',
    url,
    frame: {
      width: 1000,
      height: 700,
      x: 200,
      y: 200,
    },
    rpc,
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

  console.log('[Bun Main] PingWrite started!');
}

main().catch(console.error);
