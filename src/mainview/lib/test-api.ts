/**
 * Test API exposed on `window.__markbunTestAPI` for E2E and integration tests.
 * Only available in development builds (`import.meta.env.DEV`).
 */

export interface MarkbunTestAPI {
  isEditorReady: () => boolean;
  getEditorMarkdown: () => string;
  setEditorMarkdown: (text: string) => void;
  menuAction: (action: string) => void;
  focusEditor: () => void;
  focusTableFirstCell: () => boolean;
  getEditorView: () => any;
}

declare global {
  interface Window {
    __markbunTestAPI?: MarkbunTestAPI;
  }
}
