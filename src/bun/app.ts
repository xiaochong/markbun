import Electrobun, { BrowserWindow, BrowserView, Updater, Utils, ApplicationMenu, ContextMenu, Screen } from 'electrobun/bun';
import { setupMenu, getMenuConfig, type ViewMenuState } from './menu';
import { initI18n, changeLanguage, t } from './i18n';
import { resolveLanguage } from '../shared/i18n/config';
import type { MarkBunRPC } from '../shared/types';
import { getCommand } from '../shared/commandRegistry';
import { readFile, writeFile, stat, mkdir, readdir, open, unlink, rename, rmdir, rm, access, mkdtemp } from 'fs/promises';
import {existsSync, mkdirSync} from 'fs';
import { join, dirname, relative } from 'path';
import { tmpdir } from 'os';
import { homedir } from './services/homedir';
import { HELP_CONTENT } from './assets/helpContent';
import { readFolder } from './ipc/folders';
import { getRecentFiles, addRecentFile, removeRecentFile, clearRecentFiles } from './ipc/recentFiles';
import { getCommandHistory, recordCommandUsage } from './ipc/commandHistory';
import { loadSettings, saveSettings, type Settings } from './services/settings';
import { loadUIState, saveUIState, type UIState } from './services/uiState';
import {
  atomicWrite,
  writeRecoveryFile,
  clearRecoveryFile,
  scanRecoveries,
  readRecoveryContent,
  createVersionBackup,
  getVersionBackups,
  readVersionBackupContent,
  deleteVersionBackup,
} from './services/backup';
import { loadSessionState, saveSessionState as saveSessionStateToDisk, getDefaultSessionState, type SessionState } from './services/sessionState';
import { saveAIKey, getAIKey, deleteAIKey as deleteAIKeyFromStore, getMaskedKeys } from './services/ai-keys';
import { startStream, abortStream, isStreaming, createDefaultToolExecutor, type AIStreamEvent } from './services/ai-stream';
import * as aiSessions from './services/ai-sessions';
import type { Api, Model } from '@mariozechner/pi-ai';
import { getModel as piAiGetModel, stream as piAiStream } from '@mariozechner/pi-ai';
import { spawn, exec } from 'child_process';

// ── AI Provider Resolution ────────────────────────────────────────────────────

/**
 * Map MarkBun provider IDs to pi-ai Model objects.
 *
 * MarkBun uses friendly provider names (deepseek, kimi, glm, qwen, etc.)
 * that aren't registered in pi-ai. These providers all use OpenAI-compatible
 * APIs, so we construct Model objects manually for them.
 */
function resolveAIModel(provider: string, modelId: string, baseUrl?: string): Model<Api> {
  const knownProviders = new Set([
    'ollama', 'anthropic', 'openai', 'google', 'openrouter', 'groq', 'xai',
    'mistral', 'minimax', 'minimax-cn', 'huggingface', 'cerebras', 'kimi-coding',
  ]);

  if (knownProviders.has(provider)) {
    const m = piAiGetModel(provider as any, modelId);
    if (!m) {
      // Model not found in pi-ai registry — treat as OpenAI-compatible
      return {
        id: modelId,
        name: modelId,
        api: 'openai-completions' as Api,
        provider: provider as any,
        baseUrl: baseUrl || '',
        reasoning: false,
        input: ['text'] as ('text')[],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128_000,
        maxTokens: 8192,
      };
    }
    return baseUrl ? { ...m, baseUrl } : m;
  }

  // Domestic / custom providers — construct OpenAI-compatible model
  return {
    id: modelId,
    name: modelId,
    api: 'openai-completions' as Api,
    provider: provider as any,
    baseUrl: baseUrl || '',
    reasoning: false,
    input: ['text'] as ('text')[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8192,
  };
}

// ── Command Routing ──────────────────────────────────────────────────────────

// Map cross-process action IDs to renderer-side RPC event names
export const ACTION_TO_RPC_EVENT: Record<string, string> = {
  'file-new': 'fileNew',
  'file-open': 'fileOpenRequest',
  'file-save': 'fileSaveRequest',
  'file-save-as': 'fileSaveAsRequest',
  'view-toggle-sidebar': 'toggleSidebar',
  'view-toggle-titlebar': 'toggleTitlebar',
  'view-toggle-toolbar': 'toggleToolbar',
  'view-toggle-statusbar': 'toggleStatusbar',
  'view-toggle-source-mode': 'toggleSourceMode',
  'toggle-ai-panel': 'toggleAIPanel',
  'view-toggle-theme': 'toggleTheme',
  'view-quick-open': 'openQuickOpen',
  'app-preferences': 'openSettings',
  'file-history': 'openFileHistory',
  'app-about': 'showAbout',
};
export type AppState = typeof appState;

// Per-window file state
export interface WindowState {
  filePath: string | null;
  workspaceRoot: string | null;
}

// Helper to get desktop path for current platform
export function getDesktopPath(): string {
  return join(homedir(), 'Desktop');
}

// Helper to read first and last N bytes from a file for comparison
export async function readFileHeadAndTail(
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
export async function findFileInWorkspace(
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

// File operations
export async function openFile(state: WindowState): Promise<{ success: boolean; path?: string; content?: string; error?: string }> {
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
    state.filePath = filePath;

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

export async function openFileByPath(filePath: string, state: WindowState): Promise<{ success: boolean; path?: string; content?: string; error?: string }> {
  try {
    await access(filePath);
    const content = await readFile(filePath, 'utf-8');
    state.filePath = filePath;
    return { success: true, path: filePath, content };
  } catch (error) {
    console.error('Failed to open file by path:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function saveFile(content: string, path: string | undefined, state: WindowState, settings?: Settings | null): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const filePath = path || state.filePath;
    if (!filePath) {
      return { success: false, error: 'No file path specified' };
    }

    // Layer 2: write recovery file before touching the original
    await writeRecoveryFile(filePath, content);

    // Layer 3: snapshot the existing file before overwriting it
    const effectiveSettings = settings ?? appState.currentSettings;
    if (effectiveSettings?.backup) {
      await createVersionBackup(filePath, effectiveSettings.backup);
    }

    // Layer 1: atomic write (write .tmp → rename)
    await atomicWrite(filePath, content);

    // Layer 2: clear recovery file now that the save succeeded
    await clearRecoveryFile(filePath);

    state.filePath = filePath;
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Failed to save file:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function saveFileAs(content: string, state: WindowState): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    // @ts-ignore
    const chosenPaths = await Utils.openFileDialog({
      startingFolder: state.filePath || join(homedir(), 'Desktop'),
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
    state.filePath = filePath;
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Failed to save file as:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Open folder dialog
export async function openFolder(): Promise<{ success: boolean; path?: string; error?: string }> {
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

// Open a file in the focused window (shared by open-url handler and pending file polling)
export async function openFileInFocusedWindow(filePath: string) {
  const fw = appState.focusedWindow;
  if (!fw) return;
  try {
    const result = await openFileByPath(filePath, fw.state);
    if (result.success && result.path && result.content !== undefined) {
      await addRecentFile(result.path);
      fw.state.workspaceRoot = dirname(result.path);
      // @ts-ignore
      fw.win.webview.rpc.send.fileOpened({ path: result.path, content: result.content });
    }
  } catch (err) {
    console.error('[open-file] Failed to open:', filePath, err);
  }
}

export const appState = {
  focusedWindow: null as { win: any; state: WindowState } | null,
  activeAIContext: null as { systemPrompt: string; messages: any[]; tools: any[] } | null,
  pendingOpenFilePath: null as string | null,
  pendingOpenFolderPath: null as string | null,
  pendingCloseSidebar: false,
  pendingSkipRecentFile: false,
  viewMenuState: {
    showTitleBar: false,
    showToolBar: false,
    showStatusBar: false,
    showSidebar: false,
    sourceMode: false,
  } as ViewMenuState,
  currentSettings: null as Settings | null,
  currentUIState: null as UIState | null,
  currentSessionState: null as SessionState | null,

};

// Helper to update view menu state and refresh menu
export function updateViewMenuState(updates: Partial<ViewMenuState>) {
  appState.viewMenuState = { ...appState.viewMenuState, ...updates };
  setupMenu(appState.viewMenuState, t);
}

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

export async function getMainViewUrl(): Promise<string> {
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

export const PENDING_DIR = join(tmpdir(), 'markbun-pending');
export const PENDING_FILE_PATH = join(PENDING_DIR, 'pending.txt');

// Consume the pending file IPC, returns the file path or null
export async function consumePendingFile(): Promise<string | null> {
  try {
    const content = (await readFile(PENDING_FILE_PATH, 'utf-8')).trim();
    await unlink(PENDING_FILE_PATH);
    return content || null;
  } catch {
    return null;
  }
}

// ── App Context ───────────────────────────────────────────────────────────────

export interface AppContext {
  state: WindowState;
  focusedWindow: { win: BrowserWindow; state: WindowState } | null;
  activeAIContext: { systemPrompt: string; messages: any[]; tools: any[] } | null;
  currentSettings: Settings | null;
  currentUIState: UIState | null;
  currentSessionState: SessionState | null;
  get viewMenuState(): ViewMenuState;
  set viewMenuState(val: ViewMenuState);
  pendingOpenFilePath: string | null;
  pendingOpenFolderPath: string | null;
  pendingCloseSidebar: boolean;
  pendingSkipRecentFile: boolean;
  createAppWindow: () => Promise<{ win: BrowserWindow; state: WindowState }>;
  updateViewMenuState: (updates: Partial<ViewMenuState>) => void;
}

export function createAppContext(
  state: WindowState,
  createAppWindow: () => Promise<{ win: BrowserWindow; state: WindowState }>
): AppContext {
  return {
    state,
    get focusedWindow() { return appState.focusedWindow; },
    set focusedWindow(val) { appState.focusedWindow = val; },
    get activeAIContext() { return appState.activeAIContext; },
    set activeAIContext(val) { appState.activeAIContext = val; },
    get currentSettings() { return appState.currentSettings; },
    set currentSettings(val) { appState.currentSettings = val; },
    get currentUIState() { return appState.currentUIState; },
    set currentUIState(val) { appState.currentUIState = val; },
    get currentSessionState() { return appState.currentSessionState; },
    set currentSessionState(val) { appState.currentSessionState = val; },
    get viewMenuState() { return appState.viewMenuState; },
    set viewMenuState(val) { appState.viewMenuState = val; },
    get pendingOpenFilePath() { return appState.pendingOpenFilePath; },
    set pendingOpenFilePath(val) { appState.pendingOpenFilePath = val; },
    get pendingOpenFolderPath() { return appState.pendingOpenFolderPath; },
    set pendingOpenFolderPath(val) { appState.pendingOpenFolderPath = val; },
    get pendingCloseSidebar() { return appState.pendingCloseSidebar; },
    set pendingCloseSidebar(val) { appState.pendingCloseSidebar = val; },
    get pendingSkipRecentFile() { return appState.pendingSkipRecentFile; },
    set pendingSkipRecentFile(val) { appState.pendingSkipRecentFile = val; },
    createAppWindow,
    updateViewMenuState,
  };
}

// ── RPC Handlers ───────────────────────────────────────────────────────────────

export function createRequestHandlers(ctx: AppContext) {
  return {
    requests: {
      openFile: async () => {
        try {
          return await openFile(ctx.state);
        } catch (err) {
          console.error('RPC openFile error:', err);
          return { success: false, error: String(err) };
        }
      },
      openFileInNewWindow: async ({ path }: { path: string }) => {
        try {
          ctx.pendingOpenFilePath = path;
          ctx.pendingCloseSidebar = false;
          ctx.pendingSkipRecentFile = false;
          await ctx.createAppWindow();
          return { success: true };
        } catch (err) {
          console.error('RPC openFileInNewWindow error:', err);
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
        return await saveFile(content, path, ctx.state, ctx.currentSettings);
      },
      saveFileAs: async ({ content }: { content: string }) => {
        return await saveFileAs(content, ctx.state);
      },
      getCurrentFile: async () => {
        return ctx.state.filePath;
      },
      getPendingFile: async () => {
        if (!ctx.pendingOpenFilePath) return null;
        const filePath = ctx.pendingOpenFilePath;
        const closeSidebar = ctx.pendingCloseSidebar;
        const skipRecentFile = ctx.pendingSkipRecentFile;
        ctx.pendingOpenFilePath = null;
        ctx.pendingCloseSidebar = false;
        ctx.pendingSkipRecentFile = false;
        const result = await openFileByPath(filePath, ctx.state);
        if (result.success && result.path && result.content !== undefined) {
          if (!skipRecentFile) await addRecentFile(result.path);
          ctx.state.workspaceRoot = dirname(result.path);
          return { path: result.path, content: result.content, closeSidebar };
        }
        return null;
      },
      getPendingFolder: async () => {
        if (!ctx.pendingOpenFolderPath) return null;
        const path = ctx.pendingOpenFolderPath;
        ctx.pendingOpenFolderPath = null;
        ctx.state.workspaceRoot = path;
        return { path };
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
          { label: t('paragraph.copyCell'), action: 'table-copy-cell' },
          { type: 'separator' },
          { label: t('paragraph.insertRowAbove'), action: 'table-insert-row-above' },
          { label: t('paragraph.insertRowBelow'), action: 'table-insert-row-below' },
          { type: 'separator' },
          { label: t('paragraph.insertColLeft'), action: 'table-insert-col-left' },
          { label: t('paragraph.insertColRight'), action: 'table-insert-col-right' },
          { type: 'separator' },
          { label: t('paragraph.moveRowUp'), action: 'table-move-row-up' },
          { label: t('paragraph.moveRowDown'), action: 'table-move-row-down' },
          { type: 'separator' },
          { label: t('paragraph.moveColLeft'), action: 'table-move-col-left' },
          { label: t('paragraph.moveColRight'), action: 'table-move-col-right' },
          { type: 'separator' },
          { label: t('paragraph.deleteRow'), action: 'table-delete-row' },
          { label: t('paragraph.deleteCol'), action: 'table-delete-col' },
          { label: t('paragraph.deleteTable'), action: 'table-delete' },
          { type: 'separator' },
          {
            label: t('format.title'),
            submenu: [
              { label: t('format.strong'), action: 'format-strong' },
              { label: t('format.emphasis'), action: 'format-emphasis' },
              { label: t('format.code'), action: 'format-code' },
              { type: 'separator' },
              { label: t('format.inlineFormula'), action: 'format-inline-math' },
              { label: t('format.strikethrough'), action: 'format-strikethrough' },
              { label: t('format.highlight'), action: 'format-highlight' },
              { label: t('format.superscript'), action: 'format-superscript' },
              { label: t('format.subscript'), action: 'format-subscript' },
              { type: 'separator' },
              { label: t('format.hyperlink'), action: 'format-link' },
              { type: 'separator' },
              { label: t('format.image'), action: 'format-image' },
            ],
          },
        ]);
        return { success: true };
      },
      showMermaidContextMenu: async () => {
        // Show context menu for Mermaid diagram blocks
        ContextMenu.showContextMenu([
          { label: t('paragraph.viewDiagram'), action: 'mermaid-view-diagram' },
          { type: 'separator' },
          { label: t('edit.undo'), action: 'editor-undo' },
          { label: t('edit.redo'), action: 'editor-redo' },
          { type: 'separator' },
          { label: t('edit.cut'), action: 'editor-cut' },
          { label: t('edit.copy'), action: 'editor-copy' },
          { label: t('edit.paste'), action: 'editor-paste' },
          { type: 'separator' },
          { label: t('paragraph.insertTable'), action: 'table-insert' },
          { type: 'separator' },
          {
            label: t('format.title'),
            submenu: [
              { label: t('format.strong'), action: 'format-strong' },
              { label: t('format.emphasis'), action: 'format-emphasis' },
              { label: t('format.code'), action: 'format-code' },
              { type: 'separator' },
              { label: t('format.inlineFormula'), action: 'format-inline-math' },
              { label: t('format.strikethrough'), action: 'format-strikethrough' },
              { label: t('format.highlight'), action: 'format-highlight' },
              { label: t('format.superscript'), action: 'format-superscript' },
              { label: t('format.subscript'), action: 'format-subscript' },
              { type: 'separator' },
              { label: t('format.hyperlink'), action: 'format-link' },
              { type: 'separator' },
              { label: t('format.image'), action: 'format-image' },
            ],
          },
        ]);
        return { success: true };
      },
      showDefaultContextMenu: async () => {
        // Show default context menu with standard editing actions
        // Note: We use custom actions instead of roles to handle copy/paste in the renderer
        // This ensures blob URLs are properly converted to original paths
        ContextMenu.showContextMenu([
          { label: t('edit.undo'), action: 'editor-undo' },
          { label: t('edit.redo'), action: 'editor-redo' },
          { type: 'separator' },
          { label: t('edit.cut'), action: 'editor-cut' },
          { label: t('edit.copy'), action: 'editor-copy' },
          { label: t('edit.paste'), action: 'editor-paste' },
          { type: 'separator' },
          { label: t('paragraph.insertTable'), action: 'table-insert' },
          { type: 'separator' },
          {
            label: t('format.title'),
            submenu: [
              { label: t('format.strong'), action: 'format-strong' },
              { label: t('format.emphasis'), action: 'format-emphasis' },
              { label: t('format.code'), action: 'format-code' },
              { type: 'separator' },
              { label: t('format.inlineFormula'), action: 'format-inline-math' },
              { label: t('format.strikethrough'), action: 'format-strikethrough' },
              { label: t('format.highlight'), action: 'format-highlight' },
              { label: t('format.superscript'), action: 'format-superscript' },
              { label: t('format.subscript'), action: 'format-subscript' },
              { type: 'separator' },
              { label: t('format.hyperlink'), action: 'format-link' },
              { type: 'separator' },
              { label: t('format.image'), action: 'format-image' },
            ],
          },
        ]);
        return { success: true };
      },
      writeToClipboard: async ({ text }: { text: string }) => {
        try {
          const platform = process.platform;
          if (platform === 'win32') {
            // clip.exe reads from stdin, but requires UTF-16LE on some versions;
            // PowerShell Set-Clipboard handles Unicode cleanly.
            const escaped = text.replace(/'/g, "''");
            const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Set-Clipboard -Value '${escaped}'`], { stdio: ['ignore', 'ignore', 'ignore'] });
            await new Promise<void>((resolve) => {
              proc.on('close', () => resolve());
              proc.on('error', () => resolve());
            });
          } else if (platform === 'linux') {
            const proc = spawn('xclip', ['-selection', 'clipboard'], { stdio: ['pipe', 'ignore', 'ignore'] });
            proc.stdin.write(text);
            proc.stdin.end();
          } else {
            // macOS
            const proc = spawn('pbcopy', { stdio: ['pipe', 'inherit', 'inherit'] });
            proc.stdin.write(text);
            proc.stdin.end();
          }
          return { success: true };
        } catch (error) {
          console.error('Failed to write to clipboard:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      },
      readFromClipboard: async (params: { html?: boolean; image?: boolean }) => {
        try {
          const { html: wantHtml, image: wantImage } = params ?? {};
          const platform = process.platform;

          // Always read text (backward compatible)
          let cmd: string;
          let args: string[];
          if (platform === 'win32') {
            cmd = 'powershell.exe';
            args = ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard'];
          } else if (platform === 'linux') {
            cmd = 'xclip';
            args = ['-selection', 'clipboard', '-o'];
          } else {
            cmd = 'pbpaste';
            args = [];
          }
          const textResult = await new Promise<{ success: boolean; text?: string }>((resolve) => {
            const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
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
                resolve({ success: true }); // Empty clipboard is not an error
              }
            });

            proc.on('error', () => {
              resolve({ success: true });
            });
          });

          const result: { success: boolean; text?: string; html?: string; imageData?: string; imageFormat?: string; error?: string } = {
            success: true,
            text: textResult.text,
          };

          // Read HTML from clipboard if requested
          if (wantHtml && platform === 'darwin') {
            try {
              const htmlResult = await new Promise<string | null>((resolve) => {
                const proc = spawn('osascript', ['-e', 'the clipboard as «class HTML»'], { stdio: ['ignore', 'pipe', 'pipe'] });
                let output = '';
                let errOutput = '';
                let resolved = false;

                // 3s timeout — osascript can hang if clipboard access requires permissions
                const timer = setTimeout(() => {
                  if (!resolved) {
                    resolved = true;
                    proc.kill();
                    resolve(null);
                  }
                }, 3000);

                proc.stdout.on('data', (data: Buffer) => {
                  output += data.toString();
                });

                proc.stderr.on('data', (data: Buffer) => {
                  errOutput += data.toString();
                });

                proc.on('close', (code: number | null) => {
                  if (resolved) return;
                  resolved = true;
                  clearTimeout(timer);
                  if (code === 0 && output) {
                    // osascript returns HTML as hex-encoded «data HTMLXXXX...»
                    const hexMatch = output.match(/«data HTML([0-9A-Fa-f]+)»/);
                    if (hexMatch && hexMatch[1]) {
                      const hex = hexMatch[1];
                      const bytes = Buffer.from(hex, 'hex');
                      resolve(bytes.toString('utf-8'));
                    } else {
                      resolve(null);
                    }
                  } else {
                    resolve(null);
                  }
                });

                proc.on('error', () => {
                  if (resolved) return;
                  resolved = true;
                  clearTimeout(timer);
                  resolve(null);
                });
              });
              if (htmlResult) {
                result.html = htmlResult;
              }
            } catch {
              // No HTML in clipboard is not an error
            }
          } else if (wantHtml && platform === 'linux') {
            try {
              const htmlResult = await new Promise<string | null>((resolve) => {
                const proc = spawn('xclip', ['-selection', 'clipboard', '-t', 'text/html', '-o'], { stdio: ['ignore', 'pipe', 'pipe'] });
                let output = '';

                proc.stdout.on('data', (data: Buffer) => {
                  output += data.toString();
                });

                proc.on('close', () => resolve(output || null));
                proc.on('error', () => resolve(null));
              });
              if (htmlResult) {
                result.html = htmlResult;
              }
            } catch {
              // No HTML in clipboard is not an error
            }
          } else if (wantHtml && platform === 'win32') {
            try {
              const htmlResult = await new Promise<string | null>((resolve) => {
                const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Get-Clipboard -Format Html'], { stdio: ['ignore', 'pipe', 'pipe'] });
                let output = '';

                proc.stdout.on('data', (data: Buffer) => {
                  output += data.toString();
                });

                proc.on('close', () => resolve(output || null));
                proc.on('error', () => resolve(null));
              });
              if (htmlResult) {
                result.html = htmlResult;
              }
            } catch {
              // No HTML in clipboard is not an error
            }
          }

          // Read image from clipboard if requested (macOS only for now)
          if (wantImage && platform === 'darwin') {
            try {
              const tmpPath = `${tmpdir()}/markbun-clipboard-${Date.now()}.png`;
              const imageResult = await new Promise<string | null>((resolve) => {
                const proc = spawn('osascript', ['-e', `
                  set theClipboard to the clipboard as «class PNGf»
                  set fp to open for access POSIX file "${tmpPath}" with write permission
                  write theClipboard to fp
                  close access fp
                `.trim()], { stdio: ['ignore', 'pipe', 'pipe'] });
                let errOutput = '';
                let resolved = false;

                // 3s timeout — osascript can hang if clipboard access requires permissions
                const timer = setTimeout(() => {
                  if (!resolved) {
                    resolved = true;
                    proc.kill();
                    resolve(null);
                  }
                }, 3000);

                proc.stderr.on('data', (data: Buffer) => {
                  errOutput += data.toString();
                });

                proc.on('close', async (code: number | null) => {
                  if (resolved) return;
                  resolved = true;
                  clearTimeout(timer);
                  if (code === 0) {
                    try {
                      const data = await readFile(tmpPath);
                      resolve(data.toString('base64'));
                      // Cleanup temp file
                      await unlink(tmpPath);
                    } catch {
                      resolve(null);
                    }
                  } else {
                    resolve(null);
                  }
                });

                proc.on('error', () => {
                  if (resolved) return;
                  resolved = true;
                  clearTimeout(timer);
                  resolve(null);
                });
              });
              if (imageResult) {
                result.imageData = imageResult;
                result.imageFormat = 'png';
              }
            } catch {
              // No image in clipboard is not an error
            }
          }

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
          ctx.state.filePath = filePath;
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
          path: ctx.state.workspaceRoot ?? getDesktopPath(),
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
          await atomicWrite(fullPath, content);
          ctx.state.filePath = fullPath;
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

      // Show unsaved changes dialog (3-button: Save / Don't Save / Cancel)
      showUnsavedChangesDialog: async ({ fileName }: { fileName?: string }) => {
        try {
          const displayName = fileName ? `"${fileName}"` : '当前文件';
          const { response } = await Utils.showMessageBox({
            type: 'warning',
            title: '未保存的更改',
            message: `${displayName} 有未保存的更改`,
            detail: '如果现在离开，未保存的更改将会丢失。',
            buttons: ['取消', '不保存', '保存'],
            defaultId: 2,
            cancelId: 0,
          });
          // 0 = Cancel, 1 = Don't Save, 2 = Save
          const actions = ['cancel', 'discard', 'save'] as const;
          return { action: actions[response] };
        } catch (error) {
          console.error('Failed to show unsaved changes dialog:', error);
          return { action: 'cancel' as const };
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
          if (!ctx.currentSettings) {
            ctx.currentSettings = await loadSettings();
          }
          // Convert Settings to AppSettings for RPC
          const appSettings = {
            theme: ctx.currentSettings.appearance.theme,
            fontSize: ctx.currentSettings.editor.fontSize,
            lineHeight: ctx.currentSettings.editor.lineHeight,
            autoSave: ctx.currentSettings.general.autoSave,
            autoSaveInterval: ctx.currentSettings.general.autoSaveInterval,
            backup: ctx.currentSettings.backup,
            language: ctx.currentSettings.general.language ?? 'en',
            ai: ctx.currentSettings.ai,
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
      saveSettings: async ({ settings }: { settings: { theme: 'light' | 'dark' | 'system'; fontSize: number; lineHeight: number; autoSave: boolean; autoSaveInterval: number; language?: 'en' | 'zh-CN' | 'de' | 'fr' | 'ja' | 'ko' | 'pt' | 'es'; backup?: { enabled: boolean; maxVersions: number; retentionDays: number; recoveryInterval: number } } }) => {
        try {
          const defaultBackup = { enabled: true, maxVersions: 20, retentionDays: 30, recoveryInterval: 30000 };
          ctx.currentSettings = {
            __version: 1,
            general: {
              autoSave: settings.autoSave,
              autoSaveInterval: settings.autoSaveInterval,
              language: settings.language ?? ctx.currentSettings?.general.language ?? 'en',
            },
            editor: {
              fontSize: settings.fontSize,
              lineHeight: settings.lineHeight,
            },
            appearance: {
              theme: settings.theme,
              sidebarWidth: ctx.currentSettings?.appearance.sidebarWidth ?? 280,
            },
            backup: settings.backup ?? ctx.currentSettings?.backup ?? defaultBackup,
            ai: (settings as any).ai ?? ctx.currentSettings?.ai ?? { enabled: false, provider: '', model: '', baseUrl: undefined, localOnly: false },
          };
          const result = await saveSettings(ctx.currentSettings);
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
          if (!ctx.currentUIState) {
            ctx.currentUIState = await loadUIState();
          }
          return { success: true, state: ctx.currentUIState };
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
          ctx.currentUIState = {
            ...ctx.currentUIState,
            ...state,
          } as UIState;
          // Also update view menu state
          ctx.updateViewMenuState({
            showTitleBar: ctx.currentUIState.showTitleBar,
            showToolBar: ctx.currentUIState.showToolBar,
            showStatusBar: ctx.currentUIState.showStatusBar,
            showSidebar: ctx.currentUIState.showSidebar,
            sourceMode: ctx.currentUIState.sourceMode,
          });
          const result = await saveUIState(ctx.currentUIState);
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
          if (ctx.currentUIState) {
            ctx.currentUIState.windowX = x;
            ctx.currentUIState.windowY = y;
            ctx.currentUIState.windowWidth = width;
            ctx.currentUIState.windowHeight = height;
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

      openInFinder: async ({ path }: { path: string }) => {
        try {
          const platform = process.platform;
          if (platform === 'darwin') {
            Bun.spawn(['open', '-R', path]);
          } else if (platform === 'win32') {
            const winPath = path.replace(/\//g, '\\');
            Bun.spawn(['explorer', `/select,${winPath}`]);
          } else {
            // Linux: open the containing folder
            const folder = path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : path;
            Bun.spawn(['xdg-open', folder]);
          }
          return { success: true };
        } catch (error) {
          console.error('[RPC] Failed to open in finder:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      // ── Backup & Recovery ──────────────────────────────────────────────

      checkRecovery: async () => {
        try {
          const recoveries = await scanRecoveries();
          return { success: true, recoveries };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      clearRecovery: async ({ recoveryPath }: { recoveryPath: string }) => {
        try {
          if (existsSync(recoveryPath)) await unlink(recoveryPath);
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      recoverFile: async ({ recoveryPath, targetPath }: { recoveryPath: string; targetPath?: string }) => {
        try {
          const data = await readRecoveryContent(recoveryPath);
          if (!data) return { success: false, error: 'Recovery file not found or corrupt' };
          return { success: true, path: targetPath ?? data.originalPath, content: data.content };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      writeRecovery: async ({ content, filePath }: { content: string; filePath?: string }) => {
        try {
          const targetPath = filePath || ctx.state.filePath;
          if (!targetPath) return { success: false, error: 'No file path' };
          await writeRecoveryFile(targetPath, content);
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      getVersionBackups: async ({ filePath }: { filePath: string }) => {
        try {
          const backups = await getVersionBackups(filePath);
          return { success: true, backups };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      restoreVersionBackup: async ({ backupPath }: { backupPath: string }) => {
        try {
          const content = await readVersionBackupContent(backupPath);
          if (content === null) return { success: false, error: 'Backup file not found' };
          return { success: true, content };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      deleteVersionBackup: async ({ backupPath }: { backupPath: string }) => {
        try {
          await deleteVersionBackup(backupPath);
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      // i18n
      setLanguage: async ({ language }: { language: 'en' | 'zh-CN' | 'de' | 'fr' | 'ja' | 'ko' | 'pt' | 'es' }) => {
        try {
          if (ctx.currentSettings) {
            ctx.currentSettings.general.language = language;
            await saveSettings(ctx.currentSettings);
          }
          await changeLanguage(language);
          setupMenu(ctx.viewMenuState, t);
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      getSystemLanguage: async () => {
        try {
          const locale = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || 'en';
          // 提取语言代码部分，去除 .UTF-8 等后缀
          const language = locale.split('.')[0].replace('_', '-');
          return { success: true, language };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      getMenuConfig: async () => {
        try {
          const config = getMenuConfig();
          return { success: true, config };
        } catch (error) {
          console.error('[RPC] Failed to get menu config:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      sendMenuAction: async ({ action }: { action: string }) => {
        // Forward menu action from Windows frontend menu.
        // Mirrors the macOS 'application-menu-clicked' handler so both platforms behave identically.
        try {
          const fw = ctx.focusedWindow;
          if (!fw) return { success: true };

          // Route using manifest's executionContext
          const entry = getCommand(action);

          // Main-process actions (keep inline for now, Unit 7 will refactor)
          if (action === 'help-open') {
            const helpDir = await mkdtemp(join(tmpdir(), 'markbun-help-'));
            const tmpPath = join(helpDir, 'MarkBun Help.md');
            await writeFile(tmpPath, HELP_CONTENT, 'utf-8');
            ctx.pendingOpenFilePath = tmpPath;
            ctx.pendingCloseSidebar = true;
            ctx.pendingSkipRecentFile = true;
            await ctx.createAppWindow();
            return { success: true };
          }
          if (action === 'file-open-folder') {
            try {
              const result = await openFolder();
              if (result?.success === true && result.path) {
                if (fw.state.filePath) {
                  ctx.pendingOpenFolderPath = result.path;
                  await ctx.createAppWindow();
                } else {
                  fw.state.workspaceRoot = result.path;
                  // @ts-ignore
                  fw.win.webview.rpc.send.folderOpened({ path: result.path });
                }
              }
            } catch (err) {
              console.error('Error in file-open-folder handler:', err);
            }
            return { success: true };
          }
          if (action === 'view-toggle-devtools') {
            // @ts-ignore
            fw.win.webview.toggleDevTools();
            return { success: true };
          }
          if (action === 'window-new') {
            await ctx.createAppWindow();
            return { success: true };
          }
          if (action === 'app-quit') {
            process.exit(0);
          }

          // Cross-process actions: send named RPC event to renderer
          const eventName = ACTION_TO_RPC_EVENT[action];
          if (eventName) {
            // @ts-ignore - dynamic event name
            fw.win.webview.rpc.send[eventName]({});
          } else if (entry?.executionContext === 'renderer') {
            // Renderer-only actions: forward as menuAction
            // @ts-ignore
            fw.win.webview.rpc.send.menuAction({ action });
          }

          return { success: true };
        } catch (error) {
          console.error('[RPC] Failed to send menu action:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      saveExportedFile: async ({ content, isBase64, filePath }: { content: string; isBase64: boolean; filePath: string }) => {
        try {
          if (isBase64) {
            await writeFile(filePath, Buffer.from(content, 'base64'));
          } else {
            await writeFile(filePath, content, 'utf-8');
          }

          return { success: true, path: filePath };
        } catch (error) {
          console.error('Failed to save exported file:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      openExternal: async ({ url }: { url: string }) => {
        try {
          await Utils.openExternal(url);
          return { success: true };
        } catch (error) {
          console.error('Failed to open external URL:', error);
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      getCommandHistory: async () => {
        return await getCommandHistory();
      },

      recordCommandUsage: async ({ action }: { action: string }) => {
        return await recordCommandUsage(action);
      },

      // Session State
      getSessionState: async () => {
        try {
          if (!ctx.currentSessionState) {
            ctx.currentSessionState = await loadSessionState();
          }
          return { success: true, state: ctx.currentSessionState };
        } catch (error) {
          console.error('[RPC] Failed to get session state:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      saveSessionState: async ({ state }: { state: Partial<SessionState> }) => {
        try {
          ctx.currentSessionState = {
            ...(ctx.currentSessionState ?? getDefaultSessionState()),
            ...state,
          };
          const result = await saveSessionStateToDisk(ctx.currentSessionState);
          return result;
        } catch (error) {
          console.error('[RPC] Failed to save session state:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },

      getFileStats: async ({ path }: { path: string }) => {
        try {
          const s = await stat(path);
          return {
            success: true,
            size: s.size,
            mtime: s.mtime.getTime(),
            isDirectory: s.isDirectory(),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },

      getCommonPaths: async () => {
        try {
          const home = homedir();
          return {
            success: true,
            paths: {
              home,
              desktop: join(home, 'Desktop'),
              documents: join(home, 'Documents'),
              downloads: join(home, 'Downloads'),
              pictures: join(home, 'Pictures'),
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },

      // ── AI ──────────────────────────────────────────────────────────────────────

      getAIKeyMasked: async ({ provider }: { provider: string }) => {
        try {
          const maskedKeys = await getMaskedKeys();
          const maskedKey = maskedKeys[provider];
          if (maskedKey) {
            return { success: true, maskedKey };
          }
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      saveAIKey: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
        return await saveAIKey(provider, apiKey);
      },

      deleteAIKey: async ({ provider }: { provider: string }) => {
        return await deleteAIKeyFromStore(provider);
      },

      testAIConnection: async ({ provider, model, baseUrl }: { provider: string; model: string; baseUrl?: string }) => {
        try {
          const apiKey = provider !== 'ollama' ? await getAIKey(provider) : undefined;
          const aiModel = resolveAIModel(provider, model, baseUrl);
          const start = Date.now();
          const aiCtx = {
            messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Hi' }], timestamp: Date.now() }],
          };
          const eventStream = piAiStream(aiModel, aiCtx, {
            ...(apiKey ? { apiKey } : {}),
          });
          let lastEventType = '';
          let lastError: string | undefined;
          for await (const event of eventStream) {
            lastEventType = event.type;
            if (event.type === 'error') {
              lastError = (event as any).error?.errorMessage || 'Unknown error';
            }
            if (event.type === 'done' || event.type === 'error') break;
          }
          const latency = Date.now() - start;
          if (lastEventType === 'error') {
            return { success: false, error: lastError };
          }
          return { success: true, latency };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      aiChat: async ({ message }: { message: string }) => {
        try {
          const fw = ctx.focusedWindow;
          if (!fw) return { success: false as const, error: 'No active window' };

          const currentSettings = await loadSettings();
          const aiConfig = currentSettings.ai;
          if (!aiConfig?.enabled || !aiConfig.provider || !aiConfig.model) {
            return { success: false as const, error: 'AI not configured' };
          }

          const apiKey = aiConfig.provider !== 'ollama' ? await getAIKey(aiConfig.provider) : undefined;
          const aiModel = resolveAIModel(aiConfig.provider, aiConfig.model, aiConfig.baseUrl);

          const sendEvent = (event: AIStreamEvent) => {
            // @ts-ignore - RPC send not fully typed
            fw.win.webview.rpc.send.aiStreamEvent(event);
          };

          // RPC-based tool executor: calls executeAITool in the WebView
          const executeToolRPC = async (tool: string, args?: string): Promise<{ success: boolean; result?: string; error?: string }> => {
            try {
              // @ts-ignore - webview RPC request types not fully resolved
              return await fw.win.webview.rpc.request.executeAITool({ tool, args });
            } catch (err) {
              return { success: false, error: err instanceof Error ? err.message : String(err) };
            }
          };

          const systemPrompt = `You are an AI assistant embedded in MarkBun, a Markdown editor. Current file: ${fw.state.filePath || '(untitled)'}. UI language: ${currentSettings.general.language}. Respond in the same language as the document content. If the document is mixed-language, prefer the UI language (${currentSettings.general.language}).`;

          if (!ctx.activeAIContext) {
            ctx.activeAIContext = {
              systemPrompt,
              messages: [],
              tools: [
                {
                  name: 'read',
                  description: 'Read the full content of the current document. Use this to understand what is in the document before making changes.',
                  parameters: { type: 'object' as const, properties: {} },
                },
                {
                  name: 'edit',
                  description: 'Find and replace text in the document. Provide the exact text to find (old_text) and what to replace it with (new_text). All occurrences will be replaced. Returns the number of replacements made.',
                  parameters: {
                    type: 'object' as const,
                    properties: {
                      old_text: { type: 'string' as const, description: 'The exact text to find in the document' },
                      new_text: { type: 'string' as const, description: 'The text to replace it with' },
                    },
                    required: ['old_text', 'new_text'] as const,
                  },
                },
                {
                  name: 'write',
                  description: 'Replace the entire document content with new content. Use this for major rewrites, reformatting, or when you need to replace a large portion of the document.',
                  parameters: {
                    type: 'object' as const,
                    properties: {
                      content: { type: 'string' as const, description: 'The complete new document content' },
                    },
                    required: ['content'] as const,
                  },
                },
              ],
            } as any;
          }

          // Update system prompt with current file path
          // If file changed, reset message history to avoid stale context
          if (ctx.activeAIContext.systemPrompt !== systemPrompt) {
            ctx.activeAIContext.messages = [];
          }
          ctx.activeAIContext.systemPrompt = systemPrompt;

          // Add user message
          ctx.activeAIContext.messages.push({
            role: 'user',
            content: [{ type: 'text', text: message }],
            timestamp: Date.now(),
          });

          const result = startStream({
            model: aiModel,
            context: ctx.activeAIContext,
            apiKey: apiKey ?? undefined,
            sendEvent,
            executeToolRPC,
          });

          return { success: true as const, sessionId: result.sessionId };
        } catch (error) {
          return { success: false as const, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },

      aiAbort: async () => {
        const wasAborted = abortStream();
        return { success: true, wasAborted };
      },
      resetAIContext: async () => {
        ctx.activeAIContext = null;
        return { success: true };
      },

      // AI Session History
      getAISessionList: async () => {
        return await aiSessions.loadSessionIndex();
      },
      getAISession: async ({ id }: { id: string }) => {
        return await aiSessions.loadSession(id);
      },
      saveAISession: async ({ session }: { session: aiSessions.AISession }) => {
        return await aiSessions.saveSession(session);
      },
      deleteAISession: async ({ id }: { id: string }) => {
        return await aiSessions.deleteSession(id);
      },
      getLatestAISession: async () => {
        return await aiSessions.getLatestSession();
      },
    },
    messages: {
      toggleAIPanel: () => {
        const fw = ctx.focusedWindow;
        if (fw) {
          // @ts-ignore - RPC send not fully typed
          fw.win.webview.rpc.send.toggleAIPanel({});
        }
      },
    },
  };
}
export async function main(extraRequests?: Record<string, any>) {
  // FIRST: Check for pending file from MarkBun wrapper (macOS only)
  if (process.platform === 'darwin') {
    const filePath = await consumePendingFile();
    if (filePath) {
      console.log('[main] Found pending file from wrapper:', filePath);
      appState.pendingOpenFilePath = filePath;
    }
  }

  // THIRD: Check if a file path was passed as a CLI argument
  const MD_EXTENSIONS = ['.md', '.markdown', '.mdx'];
  const argFilePath = process.argv.slice(2).find(arg =>
    MD_EXTENSIONS.some(ext => arg.toLowerCase().endsWith(ext)) && !arg.startsWith('-')
  );
  if (argFilePath) {
    try {
      await access(argFilePath);
      appState.pendingOpenFilePath = argFilePath;
    } catch {
      // File doesn't exist, ignore
    }
  }

  // Load settings and UI state before setting up menu
  try {
    appState.currentSettings = await loadSettings();
    appState.currentUIState = await loadUIState();

    // Update view menu state from saved UI state
    appState.viewMenuState = {
      showTitleBar: appState.currentUIState.showTitleBar,
      showToolBar: appState.currentUIState.showToolBar,
      showStatusBar: appState.currentUIState.showStatusBar,
      showSidebar: appState.currentUIState.showSidebar,
      sourceMode: appState.currentUIState.sourceMode,
    };

  } catch (error) {
    console.error('[Bun Main] Failed to load settings:', error);
  }

  // Initialize i18n before building the menu
  // On Windows, LANG/LANGUAGE/LC_ALL are typically not set; fall back to Intl API which works cross-platform
  const systemLocale = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL ||
    Intl.DateTimeFormat().resolvedOptions().locale || 'en';
  const resolvedLanguage = resolveLanguage(appState.currentSettings?.general?.language, systemLocale);
  await initI18n(resolvedLanguage);

  // Setup application menu FIRST (before creating window)
  setupMenu(appState.viewMenuState, t);

  const url = await getMainViewUrl();
  const isDev = await Updater.localInfo.channel().then(ch => ch === 'dev').catch(() => false);

  // Create a new application window with independent per-window file state
  async function createAppWindow(): Promise<{ win: BrowserWindow; state: WindowState }> {
    const state: WindowState = { filePath: null, workspaceRoot: null };

  // Define RPC handlers
    const rpcHandlers = createRequestHandlers(createAppContext(state, createAppWindow));
    // @ts-ignore - Type complexity with RPCSchema
    const rpc = BrowserView.defineRPC<MarkBunRPC>({
      maxRequestTime: 30000, // 30 seconds timeout for file operations
      handlers: {
        requests: {
          ...rpcHandlers.requests,
          ...extraRequests,
        },
        messages: {
          ...rpcHandlers.messages,
          toggleAIPanel: () => {
            const fw = appState.focusedWindow;
            if (fw) {
              // @ts-ignore - RPC send not fully typed
              fw.win.webview.rpc.send.toggleAIPanel({});
            }
          },
        },
      },
    });

  // Use saved window state or defaults
  // For subsequent windows, offset from the focused window; first window uses saved state
  let windowX: number;
  let windowY: number;
  let windowWidth: number;
  let windowHeight: number;
  if (appState.focusedWindow) {
    // @ts-ignore
    const frame = appState.focusedWindow.win.getFrame ? appState.focusedWindow.win.getFrame() : null;
    windowX = (frame?.x ?? appState.currentUIState?.windowX ?? 200) + 30;
    windowY = (frame?.y ?? appState.currentUIState?.windowY ?? 200) + 30;
    windowWidth = frame?.width ?? appState.currentUIState?.windowWidth ?? 1200;
    windowHeight = frame?.height ?? appState.currentUIState?.windowHeight ?? 800;
  } else {
    windowX = appState.currentUIState?.windowX ?? 200;
    windowY = appState.currentUIState?.windowY ?? 200;
    windowWidth = appState.currentUIState?.windowWidth ?? 1200;
    windowHeight = appState.currentUIState?.windowHeight ?? 800;
  }

  // Validate window dimensions - ensure minimum valid size
  const MIN_WIDTH = 800;
  const MIN_HEIGHT = 600;
  const DEFAULT_WIDTH = 1200;
  const DEFAULT_HEIGHT = 800;

  if (!windowWidth || windowWidth < MIN_WIDTH || windowWidth > 10000) {
    windowWidth = DEFAULT_WIDTH;
  }
  if (!windowHeight || windowHeight < MIN_HEIGHT || windowHeight > 10000) {
    windowHeight = DEFAULT_HEIGHT;
  }
  if (!windowX || windowX < -10000 || windowX > 10000) {
    windowX = 200;
  }
  if (!windowY || windowY < -10000 || windowY > 10000) {
    windowY = 200;
  }


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
    // 只在 macOS 开发模式下使用 CEF（用于调试），其他平台使用原生 WebView
    ...(process.platform === "darwin" && isDev ? { renderer: "cef" as const } : {}),
    frame: {
      width: Math.round(windowWidth),
      height: Math.round(windowHeight),
      x: Math.round(windowX),
      y: Math.round(windowY),
    },
    rpc,
  });

  console.log(`[Window] Created with size: ${Math.round(windowWidth)}x${Math.round(windowHeight)} at (${Math.round(windowX)}, ${Math.round(windowY)})`);

  // 设置窗口图标（Windows 平台）— 直接调用 Win32 API
  if (process.platform === 'win32' && win.ptr) {
    try {
      const { dlopen, FFIType, ptr } = await import('bun:ffi');
      const iconPath = join(process.cwd(), '..', 'Resources', 'app.ico');
      if (existsSync(iconPath)) {
        const user32 = dlopen("user32.dll", {
          LoadImageA: {
            args: [FFIType.ptr, FFIType.cstring, FFIType.u32, FFIType.i32, FFIType.i32, FFIType.u32],
            returns: FFIType.ptr,
          },
          SendMessageA: {
            args: [FFIType.ptr, FFIType.u32, FFIType.i64, FFIType.i64],
            returns: FFIType.i64,
          },
        });
        // IMAGE_ICON=1, LR_LOADFROMFILE=0x10, LR_DEFAULTSIZE=0x40
        const iconPathBuf = Buffer.from(iconPath + '\0');
        const hIcon = user32.symbols.LoadImageA(null, iconPathBuf, 1, 0, 0, 0x50);
        if (hIcon) {
          const iconPtr = BigInt(typeof hIcon === 'number' ? hIcon : Number(hIcon));
          // WM_SETICON=0x80, ICON_SMALL=0, ICON_BIG=1
          user32.symbols.SendMessageA(win.ptr, 0x80, 0n, iconPtr);
          user32.symbols.SendMessageA(win.ptr, 0x80, 1n, iconPtr);
          console.log('[Icon] Set window icon via Win32 API, hIcon:', hIcon);
        } else {
          console.warn('[Icon] LoadImageA returned null for:', iconPath);
        }
      }
    } catch (e) {
      console.warn('[Icon] Failed to set window icon:', e);
    }
  }

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
        if (frame && appState.currentUIState) {
          const newX = frame.x ?? windowX;
          const newY = frame.y ?? windowY;
          const newWidth = frame.width ?? windowWidth;
          const newHeight = frame.height ?? windowHeight;

          // Only save if values actually changed
          if (
            appState.currentUIState.windowX !== newX ||
            appState.currentUIState.windowY !== newY ||
            appState.currentUIState.windowWidth !== newWidth ||
            appState.currentUIState.windowHeight !== newHeight
          ) {
            appState.currentUIState.windowX = newX;
            appState.currentUIState.windowY = newY;
            appState.currentUIState.windowWidth = newWidth;
            appState.currentUIState.windowHeight = newHeight;

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
                appState.currentUIState.displayId = currentDisplay.id;
                appState.currentUIState.displayWidth = currentDisplay.bounds.width;
                appState.currentUIState.displayHeight = currentDisplay.bounds.height;
              }
            } catch {
              // Silently ignore display info errors
            }

            await saveUIState(appState.currentUIState);
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


  process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
  });

  // Track this window as focused on creation
  appState.focusedWindow = { win, state };
  // @ts-ignore
  if (win.on) {
    // @ts-ignore
    win.on('focus', () => {
      // Reset AI context when switching windows to avoid cross-window state leak
      if (appState.focusedWindow?.win !== win) {
        appState.activeAIContext = null;
      }
      appState.focusedWindow = { win, state };
    });
  }

    return { win, state };
  } // end createAppWindow

  // Create the first application window
  const { win } = await createAppWindow();

  // Handle context menu clicks (global - routes to focused window)
  ContextMenu.on('context-menu-clicked', (event: { data: { action: string } }) => {
    const action = event.data.action;

    // Forward all context menu actions to focused window's renderer
    // @ts-ignore
    appState.focusedWindow?.win.webview.rpc.send.menuAction({ action });
  });

  // Handle menu actions
  ApplicationMenu.on('application-menu-clicked', async (event: { data: { action: string } }) => {
    const action = event.data.action;
    const fw = appState.focusedWindow;

    // ── Main-process actions (inline handling) ────────────────────────────
    if (action === 'window-new') {
      await createAppWindow();
      return;
    }
    if (action === 'help-open') {
      const helpDir = await mkdtemp(join(tmpdir(), 'markbun-help-'));
      const tmpPath = join(helpDir, 'MarkBun Help.md');
      await writeFile(tmpPath, HELP_CONTENT, 'utf-8');
      appState.pendingOpenFilePath = tmpPath;
      appState.pendingCloseSidebar = true;
      appState.pendingSkipRecentFile = true;
      await createAppWindow();
      return;
    }
    if (action === 'view-toggle-devtools') {
      if (!fw) return;
      // @ts-ignore
      fw.win.webview.toggleDevTools();
      // Trigger window resize to fix layout issues after DevTools toggle
      setTimeout(() => {
        try {
          // @ts-ignore
          const frame = fw.win.frame;
          if (frame) {
            // @ts-ignore
            fw.win.frame = { ...frame, width: frame.width + 1 };
            setTimeout(() => {
              // @ts-ignore
              fw.win.frame = frame;
            }, 50);
          }
          // @ts-ignore
          fw.win.webview?.evaluateJavaScript?.(`
            window.dispatchEvent(new Event('resize'));
            document.body.style.display = 'none';
            document.body.offsetHeight;
            document.body.style.display = '';
          `);
        } catch (e) {
          console.error('Failed to fix layout after DevTools toggle:', e);
        }
      }, 150);
      return;
    }

    // ── Cross-process actions with special Bun-side side effects ─────────
    if (action === 'file-new') {
      if (fw) {
        fw.state.filePath = null;
        // @ts-ignore
        fw.win.webview.rpc.send.fileNew({});
      }
      return;
    }
    if (action === 'file-open-folder') {
      if (!fw) return;
      try {
        const result = await openFolder();
        if (result?.success === true && result.path) {
          if (fw.state.filePath) {
            appState.pendingOpenFolderPath = result.path;
            await createAppWindow();
          } else {
            fw.state.workspaceRoot = result.path;
            // @ts-ignore
            fw.win.webview.rpc.send.folderOpened({ path: result.path });
          }
        }
      } catch (err) {
        console.error('Error in file-open-folder handler:', err);
      }
      return;
    }

    // View toggles: update Bun-side menu state before forwarding to renderer
    if (action === 'view-toggle-titlebar') {
      updateViewMenuState({ showTitleBar: !appState.viewMenuState.showTitleBar });
      // @ts-ignore
      fw?.win.webview.rpc.send.toggleTitlebar({});
      return;
    }
    if (action === 'view-toggle-toolbar') {
      updateViewMenuState({ showToolBar: !appState.viewMenuState.showToolBar });
      // @ts-ignore
      fw?.win.webview.rpc.send.toggleToolbar({});
      return;
    }
    if (action === 'view-toggle-statusbar') {
      updateViewMenuState({ showStatusBar: !appState.viewMenuState.showStatusBar });
      // @ts-ignore
      fw?.win.webview.rpc.send.toggleStatusbar({});
      return;
    }
    if (action === 'view-toggle-sidebar') {
      updateViewMenuState({ showSidebar: !appState.viewMenuState.showSidebar });
      // @ts-ignore
      fw?.win.webview.rpc.send.toggleSidebar({});
      return;
    }
    if (action === 'view-toggle-source-mode') {
      updateViewMenuState({ sourceMode: !appState.viewMenuState.sourceMode });
      // @ts-ignore
      fw?.win.webview.rpc.send.toggleSourceMode({});
      return;
    }
    if (action === 'mermaid-view-diagram') {
      // @ts-ignore
      fw?.win.webview.rpc.send.menuAction({ action });
      return;
    }

    // ── Generic cross-process / renderer routing ─────────────────────────
    const eventName = ACTION_TO_RPC_EVENT[action];
    if (eventName) {
      // @ts-ignore - dynamic event name
      fw?.win.webview.rpc.send[eventName]({});
    } else {
      // Renderer-only actions: forward as menuAction
      const entry = getCommand(action);
      if (entry?.executionContext === 'renderer') {
        // @ts-ignore
        fw?.win.webview.rpc.send.menuAction({ action });
      }
    }
  });

  // Handle open-url events (triggered by markbun:// URL scheme)
  Electrobun.events.on('open-url', async (event: { data: { url: string } }) => {
    try {
      const url = new URL(event.data.url);
      if (url.hostname === 'open') {
        const filePath = decodeURIComponent(url.searchParams.get('path') ?? '');
        if (filePath) {
          await openFileInFocusedWindow(filePath);
        }
      }
    } catch (err) {
      console.error('[open-url] Failed to handle URL:', err);
    }
  });

  // Watch for pending file from wrapper (handles "app already running" case)
  if (process.platform === 'darwin') {
    const { watch } = await import('fs');
    mkdirSync(PENDING_DIR, { recursive: true });
    watch(PENDING_DIR, (eventType, filename) => {
      if (filename !== 'pending.txt') return;
      consumePendingFile().then(filePath => {
        if (filePath) {
          console.log('[pending-file] Opening file from wrapper:', filePath);
          openFileInFocusedWindow(filePath);
        }
      });
    });
  }

}
