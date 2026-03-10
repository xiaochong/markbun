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
    };
    messages: {
      fileOpened: { path: string; content: string };
      fileNew: {};
      fileSaveRequest: {};
      fileSaveAsRequest: {};
      toggleTheme: {};
    };
  }>;
  webview: RPCSchema<{
    requests: {};
    messages: {};
  }>;
};
