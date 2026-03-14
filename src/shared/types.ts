// Shared RPC type definition for PingWrite
import type { RPCSchema } from "electrobun/bun";

// @ts-ignore - Type complexity issue with RPCSchema resolution
export type PingWriteRPC = {
  bun: RPCSchema<{
    requests: {
      openFile: { params: {}; response: { success: boolean; path?: string; content?: string; error?: string } };
      saveFile: { params: { content: string; path?: string }; response: { success: boolean; path?: string; error?: string } };
      saveFileAs: { params: { content: string }; response: { success: boolean; path?: string; error?: string } };
      getCurrentFile: { params: {}; response: string | null };
      readImageAsBase64: { params: { path: string }; response: { success: boolean; dataUrl?: string; error?: string } };
      showTableContextMenu: { params: {}; response: { success: boolean } };
      showDefaultContextMenu: { params: {}; response: { success: boolean } };
    };
    messages: {
      fileOpened: { path: string; content: string };
      fileNew: {};
      fileSaveRequest: {};
      fileSaveAsRequest: {};
      toggleTheme: {};
      showAbout: {};
      toggleTitlebar: {};
      toggleToolbar: {};
      toggleStatusbar: {};
      menuAction: { action: string };
    };
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {};
  }>;
};
