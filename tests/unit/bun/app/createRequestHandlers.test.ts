import { mock, describe, it, expect } from 'bun:test';

mock.module('electrobun/bun', () => ({
  default: {},
  BrowserWindow: class FakeBrowserWindow {},
  BrowserView: { defineRPC: () => ({}) },
  Updater: { localInfo: { channel: async () => 'stable' } },
  Utils: {},
  ApplicationMenu: { on: () => {} },
  ContextMenu: { on: () => {}, showContextMenu: () => {} },
  Screen: { getAllDisplays: () => [], getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
}));

mock.module('../../../../src/bun/menu', () => ({
  setupMenu: () => {},
  getMenuConfig: () => ({}),
}));

mock.module('../../../../src/bun/i18n', () => ({
  initI18n: async () => {},
  changeLanguage: async () => {},
  t: (key: string) => key,
}));

// Lazy load app.ts after mocks are registered
const { createRequestHandlers } = await import('../../../../src/bun/app');

describe('createRequestHandlers', () => {
  it('returns expected request handler keys', () => {
    const mockCtx = {
      state: { filePath: null as string | null, workspaceRoot: null as string | null },
      focusedWindow: null,
      activeAIContext: null,
      currentSettings: null,
      currentUIState: null,
      currentSessionState: null,
      viewMenuState: {
        showTitleBar: false,
        showToolBar: false,
        showStatusBar: false,
        showSidebar: false,
        sourceMode: false,
      },
      pendingOpenFilePath: null,
      pendingOpenFolderPath: null,
      pendingCloseSidebar: false,
      pendingSkipRecentFile: false,
      createAppWindow: async () => ({ win: {} as any, state: { filePath: null, workspaceRoot: null } }),
      updateViewMenuState: () => {},
    } as any;

    const handlers = createRequestHandlers(mockCtx);
    expect(handlers).toHaveProperty('requests');
    expect(handlers).toHaveProperty('messages');

    const requestKeys = Object.keys(handlers.requests);
    expect(requestKeys).toContain('openFile');
    expect(requestKeys).toContain('saveFile');
    expect(requestKeys).toContain('getSettings');
    expect(requestKeys).toContain('aiChat');
    expect(requestKeys).toContain('sendMenuAction');

    expect(Object.keys(handlers.messages)).toContain('toggleAIPanel');
  });
});
