// Electrobun view client for renderer process
import { Electroview } from 'electrobun/view';
import type { MarkBunRPC, AppSettings } from '../../shared/types';

// Define RPC for the view side with standard timeout
// @ts-ignore - Type complexity with RPCSchema
const rpc = Electroview.defineRPC<MarkBunRPC>({
  maxRequestTime: 30000, // 30 seconds timeout
  handlers: {
    requests: {
      executeAITool: async ({ tool, args }: { tool: string; args?: string }) => {
        const aiTools = (window as any).__markbunAI;
        if (!aiTools || !aiTools[tool]) {
          return { success: false, error: `Tool not found: ${tool}` };
        }
        try {
          const parsedArgs = args ? JSON.parse(args) : undefined;
          const result = await aiTools[tool](parsedArgs);
          return { success: true, result: typeof result === 'string' ? result : JSON.stringify(result) };
        } catch (err: any) {
          return { success: false, error: err.message || String(err) };
        }
      },
    },
    messages: {
      fileOpened: ({ path, content }) => {
        const listeners = (window as any).__electrobunListeners?.['file-opened'] || [];
        listeners.forEach((cb: (data: unknown) => void) => cb({ path, content }));
      },
      folderOpened: ({ path }) => {
        const listeners = (window as any).__electrobunListeners?.['folder-opened'] || [];
        listeners.forEach((cb: (data: unknown) => void) => cb({ path }));
      },
      fileNew: () => {
        const listeners = (window as any).__electrobunListeners?.['file-new'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      fileSaveRequest: () => {
        const listeners = (window as any).__electrobunListeners?.['file-save-request'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      fileSaveAsRequest: () => {
        const listeners = (window as any).__electrobunListeners?.['file-save-as-request'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      fileOpenRequest: () => {
        const listeners = (window as any).__electrobunListeners?.['file-open-request'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      toggleTheme: () => {
        const listeners = (window as any).__electrobunListeners?.['toggle-theme'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      showAbout: () => {
        const listeners = (window as any).__electrobunListeners?.['show-about'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      toggleTitlebar: () => {
        const listeners = (window as any).__electrobunListeners?.['toggle-titlebar'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      toggleToolbar: () => {
        const listeners = (window as any).__electrobunListeners?.['toggle-toolbar'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      toggleStatusbar: () => {
        const listeners = (window as any).__electrobunListeners?.['toggle-statusbar'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      menuAction: ({ action }) => {
        const listeners = (window as any).__electrobunListeners?.['menuAction'] || [];
        listeners.forEach((cb: (data: unknown) => void) => cb({ action }));
      },
      toggleSidebar: () => {
        const listeners = (window as any).__electrobunListeners?.['toggle-sidebar'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      openQuickOpen: () => {
        const listeners = (window as any).__electrobunListeners?.['open-quick-open'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      openSettings: () => {
        const listeners = (window as any).__electrobunListeners?.['open-settings'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      toggleSourceMode: () => {
        const listeners = (window as any).__electrobunListeners?.['toggle-source-mode'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      openFileHistory: () => {
        const listeners = (window as any).__electrobunListeners?.['open-file-history'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
      languageChanged: ({ language }) => {
        const listeners = (window as any).__electrobunListeners?.['language-changed'] || [];
        listeners.forEach((cb: (data: unknown) => void) => cb({ language }));
      },
      aiStreamEvent: ({ sessionId, type, data }) => {
        const listeners = (window as any).__electrobunListeners?.['ai-stream-event'] || [];
        listeners.forEach((cb: (data: unknown) => void) => cb({ sessionId, type, data }));
      },
      toggleAIPanel: () => {
        const listeners = (window as any).__electrobunListeners?.['toggle-ai-panel'] || [];
        listeners.forEach((cb: () => void) => cb());
      },
    },
  },
});

// Create the Electroview instance
const electroview = new Electroview({ rpc });

// Export a simple API
export const electrobun = {
  // File operations (call Bun process)
  async openFile() {
    return await electroview.rpc.request.openFile({});
  },

  async openFolder() {
    return await electroview.rpc.request.openFolder({});
  },

  async saveFile(content: string, path?: string) {
    return await electroview.rpc.request.saveFile({ content, path });
  },

  async saveFileAs(content: string) {
    return await electroview.rpc.request.saveFileAs({ content });
  },

  async getCurrentFile() {
    return await electroview.rpc.request.getCurrentFile({});
  },

  async getPendingFile() {
    return await electroview.rpc.request.getPendingFile({});
  },

  async readImageAsBase64(path: string) {
    return await electroview.rpc.request.readImageAsBase64({ path });
  },

  async showTableContextMenu() {
    return await electroview.rpc.request.showTableContextMenu({});
  },

  async showDefaultContextMenu() {
    return await electroview.rpc.request.showDefaultContextMenu({});
  },

  async showMermaidContextMenu() {
    return await electroview.rpc.request.showMermaidContextMenu({});
  },

  // Phase 2: File Management
  async readFile(params: { path: string }) {
    return await electroview.rpc.request.readFile(params);
  },

  async readFolder(params: { path: string; maxDepth?: number }) {
    return await electroview.rpc.request.readFolder(params);
  },

  async getRecentFiles() {
    return await electroview.rpc.request.getRecentFiles({});
  },

  async addRecentFile(params: { path: string }) {
    return await electroview.rpc.request.addRecentFile(params);
  },

  async removeRecentFile(params: { path: string }) {
    return await electroview.rpc.request.removeRecentFile(params);
  },

  async clearRecentFiles() {
    return await electroview.rpc.request.clearRecentFiles({});
  },

  async quickOpen() {
    return await electroview.rpc.request.quickOpen({});
  },

  async writeToClipboard(text: string) {
    return await electroview.rpc.request.writeToClipboard({ text });
  },

  async readFromClipboard(options?: { html?: boolean; image?: boolean }) {
    return await electroview.rpc.request.readFromClipboard(options ?? {});
  },

  async selectImageFile() {
    return await electroview.rpc.request.selectImageFile({});
  },

  async getDesktopPath() {
    return await electroview.rpc.request.getDesktopPath({});
  },

  async getWorkspaceRoot() {
    return await electroview.rpc.request.getWorkspaceRoot({});
  },

  async saveDroppedImage(fileName: string, base64Data: string, workspaceRoot: string) {
    return await electroview.rpc.request.saveDroppedImage({ fileName, base64Data, workspaceRoot });
  },

  // Custom save dialog methods
  async listFolder(params: { path: string }) {
    return await electroview.rpc.request.listFolder(params);
  },

  async getParentFolder(params: { path: string }) {
    return await electroview.rpc.request.getParentFolder(params);
  },

  async saveFileWithPath(params: { content: string; folderPath: string; fileName: string }) {
    return await electroview.rpc.request.saveFileWithPath(params);
  },

  async fileExists(params: { path: string }) {
    return await electroview.rpc.request.fileExists(params);
  },

  async showConfirmationDialog(params: { title: string; message: string; detail?: string; confirmLabel?: string; cancelLabel?: string }) {
    return await electroview.rpc.request.showConfirmationDialog(params) as { confirmed: boolean };
  },

  async showUnsavedChangesDialog(params: { fileName?: string } = {}) {
    return await electroview.rpc.request.showUnsavedChangesDialog(params) as { action: 'save' | 'discard' | 'cancel' };
  },

  // Phase 3: Settings
  async getSettings() {
    return await electroview.rpc.request.getSettings({});
  },

  async saveSettings(params: AppSettings) {
    return await electroview.rpc.request.saveSettings({ settings: params });
  },

  async setLanguage(language: 'en' | 'zh-CN' | 'de' | 'fr' | 'ja' | 'ko' | 'pt' | 'es') {
    return await electroview.rpc.request.setLanguage({ language });
  },

  async getSystemLanguage() {
    return await electroview.rpc.request.getSystemLanguage({});
  },

  async getMenuConfig() {
    return await electroview.rpc.request.getMenuConfig({});
  },

  async getUIState() {
    return await electroview.rpc.request.getUIState({});
  },

  async saveUIState(params: Partial<import('@/shared/types').UIState>) {
    return await electroview.rpc.request.saveUIState({ state: params });
  },

  async updateWindowBounds(x: number, y: number, width: number, height: number) {
    return await electroview.rpc.request.updateWindowBounds({ x, y, width, height });
  },

  // ── Backup & Recovery ───────────────────────────────────────────────────────

  async checkRecovery() {
    return await electroview.rpc.request.checkRecovery({});
  },

  async clearRecovery(recoveryPath: string) {
    return await electroview.rpc.request.clearRecovery({ recoveryPath });
  },

  async recoverFile(recoveryPath: string, targetPath?: string) {
    return await electroview.rpc.request.recoverFile({ recoveryPath, targetPath });
  },

  async writeRecovery(content: string, filePath?: string) {
    return await electroview.rpc.request.writeRecovery({ content, filePath });
  },

  async getVersionBackups(filePath: string) {
    return await electroview.rpc.request.getVersionBackups({ filePath });
  },

  async restoreVersionBackup(backupPath: string) {
    return await electroview.rpc.request.restoreVersionBackup({ backupPath });
  },

  async deleteVersionBackup(backupPath: string) {
    return await electroview.rpc.request.deleteVersionBackup({ backupPath });
  },

  // File Explorer context menu operations
  async createFile(params: { folderPath: string; fileName?: string }) {
    return await electroview.rpc.request.createFile(params) as { success: boolean; path?: string; error?: string };
  },

  async createFolder(params: { parentPath: string; folderName?: string }) {
    return await electroview.rpc.request.createFolder(params) as { success: boolean; path?: string; error?: string };
  },

  async deleteFile(params: { path: string }) {
    return await electroview.rpc.request.deleteFile(params) as { success: boolean; error?: string };
  },

  async moveFile(params: { sourcePath: string; targetFolderPath: string }) {
    return await electroview.rpc.request.moveFile(params) as { success: boolean; newPath?: string; error?: string };
  },

  async renameFile(params: { path: string; newName: string }) {
    return await electroview.rpc.request.renameFile(params) as { success: boolean; newPath?: string; error?: string };
  },

  async openInFinder(params: { path: string }) {
    return await electroview.rpc.request.openInFinder(params) as { success: boolean; error?: string };
  },

  // Export
  async saveExportedFile(params: { content: string; isBase64: boolean; filePath: string }) {
    return await electroview.rpc.request.saveExportedFile(params) as { success: boolean; path?: string; error?: string };
  },

  async openExternal(url: string) {
    return await electroview.rpc.request.openExternal({ url }) as { success: boolean; error?: string };
  },

  // File Dialog (custom implementation)
  async showFileDialog(params: {
    mode: 'open' | 'save';
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    properties?: string[];
    buttonLabel?: string;
  }) {
    return await electroview.rpc.request.showFileDialog(params) as
      | { canceled: true; error?: string }
      | { canceled: false; filePaths: string[] }
      | { canceled: false; filePath: string };
  },

  async getFileStats(params: { path: string }) {
    return await electroview.rpc.request.getFileStats(params) as
      | { success: true; size: number; mtime: number; isDirectory: boolean }
      | { success: false; error: string };
  },

  async getCommonPaths() {
    return await electroview.rpc.request.getCommonPaths({}) as
      | { success: true; paths: { home: string; desktop: string; documents: string; downloads: string; pictures?: string } }
      | { success: false; error: string };
  },

  // Send menu action to main process (for Windows frontend menu)
  async sendMenuAction(action: string) {
    return await electroview.rpc.request.sendMenuAction({ action });
  },

  // Command palette history
  async getCommandHistory() {
    return await electroview.rpc.request.getCommandHistory({}) as { success: boolean; history?: string[]; error?: string };
  },

  async recordCommandUsage(action: string) {
    return await electroview.rpc.request.recordCommandUsage({ action }) as { success: boolean; error?: string };
  },

  // Session State
  async getSessionState() {
    return await electroview.rpc.request.getSessionState({}) as { success: boolean; state?: import('@/shared/types').SessionState; error?: string };
  },

  async saveSessionState(state: Partial<import('@/shared/types').SessionState>) {
    return await electroview.rpc.request.saveSessionState({ state }) as { success: boolean; error?: string };
  },

  // AI
  async testAIConnection(provider: string, model: string, baseUrl?: string) {
    return await electroview.rpc.request.testAIConnection({ provider, model, baseUrl }) as
      { success: boolean; latency?: number; error?: string };
  },

  async getAIKeyMasked(provider: string) {
    return await electroview.rpc.request.getAIKeyMasked({ provider }) as
      { success: boolean; maskedKey?: string; error?: string };
  },

  async saveAIKey(provider: string, apiKey: string) {
    return await electroview.rpc.request.saveAIKey({ provider, apiKey }) as
      { success: boolean; error?: string };
  },

  async deleteAIKey(provider: string) {
    return await electroview.rpc.request.deleteAIKey({ provider }) as
      { success: boolean; error?: string };
  },

  // AI Chat — send a message to AI and start streaming
  async aiChat(message: string) {
    return await electroview.rpc.request.aiChat({ message }) as
      { success: boolean; sessionId?: string; error?: string };
  },

  // AI Abort — stop current AI generation
  async aiAbort() {
    return await electroview.rpc.request.aiAbort({}) as
      { success: boolean; wasAborted?: boolean; error?: string };
  },

  async resetAIContext() {
    // @ts-ignore - RPC request not fully typed
    return await electroview.rpc.request.resetAIContext({});
  },

  // AI Session History
  async getAISessionList() {
    return await electroview.rpc.request.getAISessionList({}) as
      { success: boolean; sessions?: import('@/shared/types').AISessionSummaryData[]; error?: string };
  },

  async getAISession(id: string) {
    return await electroview.rpc.request.getAISession({ id }) as
      { success: boolean; session?: import('@/shared/types').AISessionData; error?: string };
  },

  async saveAISession(session: import('@/shared/types').AISessionData) {
    return await electroview.rpc.request.saveAISession({ session }) as
      { success: boolean; error?: string };
  },

  async deleteAISession(id: string) {
    return await electroview.rpc.request.deleteAISession({ id }) as
      { success: boolean; error?: string };
  },

  async getLatestAISession() {
    return await electroview.rpc.request.getLatestAISession({}) as
      { success: boolean; session?: import('@/shared/types').AISessionData; error?: string };
  },

  // Subscribe to messages from main process
  on(event: string, callback: (data?: unknown) => void): () => void {
    const win = window as any;
    win.__electrobunListeners = win.__electrobunListeners || {};
    win.__electrobunListeners[event] = win.__electrobunListeners[event] || [];
    win.__electrobunListeners[event].push(callback);

    // Return unsubscribe function
    return () => {
      if (win.__electrobunListeners?.[event]) {
        win.__electrobunListeners[event] = win.__electrobunListeners[event].filter(
          (cb: (data?: unknown) => void) => cb !== callback
        );
      }
    };
  },
};
