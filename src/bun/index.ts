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

    return { success: true, path: filePath, content };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function saveFileAs(content: string): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    // @ts-ignore
    await Utils.showMessageBox({
      type: 'info',
      title: 'Save File',
      message: 'Please select a location to save the file.',
      buttons: ['OK'],
    });

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
        console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
        return DEV_SERVER_URL;
      } catch {
        console.log('Vite dev server not running. Run `bun run dev:hmr` for HMR support.');
      }
    }
  } catch {}
  return 'views://mainview/index.html';
}

// Create the main application window
async function main() {
  const url = await getMainViewUrl();

  // Define RPC handlers
  const rpc = BrowserView.defineRPC<PingWriteRPC>({
    handlers: {
      requests: {
        openFile: async () => openFile(),
        saveFile: async ({ content, path }) => saveFile(content, path),
        saveFileAs: async ({ content }) => saveFileAs(content),
        getCurrentFile: async () => currentFilePath,
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
    console.log('Menu action:', action);

    switch (action) {
      case 'file-new':
        currentFilePath = null;
        win.webview.rpc.send.fileNew({});
        break;

      case 'file-open': {
        const result = await openFile();
        if (result.success && result.content !== undefined) {
          win.webview.rpc.send.fileOpened({
            path: result.path || '',
            content: result.content,
          });
        }
        break;
      }

      case 'file-save':
        win.webview.rpc.send.fileSaveRequest({});
        break;

      case 'file-save-as':
        win.webview.rpc.send.fileSaveAsRequest({});
        break;

      case 'view-toggle-theme':
        win.webview.rpc.send.toggleTheme({});
        break;
    }
  });

  console.log('PingWrite started!');
}

main().catch(console.error);
