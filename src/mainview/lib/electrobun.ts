// Electrobun view client for renderer process
import { Electroview } from 'electrobun/view';
import type { PingWriteRPC } from '../../shared/types';

// Define RPC for the view side with increased timeout
const rpc = Electroview.defineRPC<PingWriteRPC>({
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
