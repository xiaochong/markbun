// Electrobun view client for renderer process
import { Electroview } from 'electrobun/view';
import type { MarkBunRPC } from '../../shared/types';

// Define RPC for the view side with increased timeout
// @ts-ignore - Type complexity with RPCSchema
const rpc = Electroview.defineRPC<MarkBunRPC>({
  maxRequestTime: 30000, // 30 seconds timeout for file operations
  handlers: {
    requests: {},
    messages: {
      fileOpened: ({ path, content }) => {
        const listeners = (window as any).__electrobunListeners?.['file-opened'] || [];
        listeners.forEach((cb: (data: unknown) => void) => cb({ path, content }));
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

  async saveFile(content: string, path?: string) {
    return await electroview.rpc.request.saveFile({ content, path });
  },

  async saveFileAs(content: string) {
    return await electroview.rpc.request.saveFileAs({ content });
  },

  async getCurrentFile() {
    return await electroview.rpc.request.getCurrentFile({});
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

  // Phase 2: File Management
  async readFile(params: { path: string }) {
    return await electroview.rpc.request.readFile(params);
  },

  async readFolder(params: { path: string }) {
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

  async readFromClipboard() {
    return await electroview.rpc.request.readFromClipboard({});
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

  // Phase 3: Settings
  async getSettings() {
    return await electroview.rpc.request.getSettings({});
  },

  async saveSettings(params: { theme: 'light' | 'dark' | 'system'; fontSize: number; lineHeight: number; autoSave: boolean; autoSaveInterval: number }) {
    return await electroview.rpc.request.saveSettings({ settings: params });
  },

  async getUIState() {
    return await electroview.rpc.request.getUIState({});
  },

  async saveUIState(params: Partial<{ showTitleBar: boolean; showToolBar: boolean; showStatusBar: boolean; showSidebar: boolean; sidebarWidth: number; sidebarActiveTab: 'files' | 'outline' | 'search' }>) {
    return await electroview.rpc.request.saveUIState({ state: params });
  },

  async updateWindowBounds(x: number, y: number, width: number, height: number) {
    return await electroview.rpc.request.updateWindowBounds({ x, y, width, height });
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
