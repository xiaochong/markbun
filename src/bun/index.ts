import { BrowserWindow, BrowserView, Updater, Utils, ApplicationMenu } from 'electrobun/bun';
import { setupMenu, type ViewMenuState } from './menu';
import type { PingWriteRPC } from '../shared/types';
import { readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Current file state
let currentFilePath: string | null = null;

// Current view menu state
let viewMenuState: ViewMenuState = {
  showTitleBar: false,
  showToolBar: false,
  showStatusBar: true,
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
    }
  });

  console.log('[Bun Main] PingWrite started!');
}

main().catch(console.error);
