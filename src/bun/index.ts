import { BrowserWindow, BrowserView, Updater, Utils } from 'electrobun/bun';
import { setupMenu } from './menu';
import type { PingWriteRPC } from '../shared/types';
import { readFile, writeFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

// Current file state
let currentFilePath: string | null = null;

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

  // Setup application menu
  setupMenu();

  // Handle menu actions
  win.on('menu-action', async (event: unknown) => {
    const action = String(event);

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
    }
  });

  console.log('[Bun Main] PingWrite started!');
}

main().catch(console.error);
