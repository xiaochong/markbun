/**
 * UI State Service 单元测试
 * 测试UI状态加载/保存功能
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import {
  getDefaultUIState,
  loadUIState,
  saveUIState,
} from '../../../../src/bun/services/uiState';
import type { UIState } from '../../../../src/bun/services/uiState';

describe('getDefaultUIState', () => {
  it('should return default UI state', () => {
    const defaults = getDefaultUIState();
    expect(defaults.showTitleBar).toBe(false);
    expect(defaults.showToolBar).toBe(false);
    expect(defaults.showStatusBar).toBe(false);
    expect(defaults.showSidebar).toBe(false);
    expect(defaults.sourceMode).toBe(false);
  });

  it('should have correct sidebar defaults', () => {
    const defaults = getDefaultUIState();
    expect(defaults.sidebarWidth).toBe(280);
    expect(defaults.sidebarActiveTab).toBe('files');
  });

  it('should have correct window defaults', () => {
    const defaults = getDefaultUIState();
    expect(defaults.windowWidth).toBe(1200);
    expect(defaults.windowHeight).toBe(800);
    expect(defaults.windowX).toBe(200);
    expect(defaults.windowY).toBe(200);
  });
});

describe('loadUIState', () => {
  it('should load UI state successfully', async () => {
    const state = await loadUIState();
    expect(typeof state).toBe('object');
    expect(state.showTitleBar).toBeDefined();
  });

  it('should have all required UI properties', async () => {
    const state = await loadUIState();
    expect(typeof state.showTitleBar).toBe('boolean');
    expect(typeof state.showToolBar).toBe('boolean');
    expect(typeof state.showStatusBar).toBe('boolean');
    expect(typeof state.showSidebar).toBe('boolean');
    expect(typeof state.sourceMode).toBe('boolean');
    expect(typeof state.sidebarWidth).toBe('number');
    expect(typeof state.sidebarActiveTab).toBe('string');
  });

  it('should have window state properties', async () => {
    const state = await loadUIState();
    expect(typeof state.windowX).toBe('number');
    expect(typeof state.windowY).toBe('number');
    expect(typeof state.windowWidth).toBe('number');
    expect(typeof state.windowHeight).toBe('number');
  });

  it('should support optional display info', async () => {
    const state = await loadUIState();
    // displayId, displayWidth, displayHeight are optional
    expect(state.displayId === undefined || typeof state.displayId === 'number').toBe(true);
  });
});

describe('saveUIState', () => {
  it('should save valid UI state', async () => {
    const state: UIState = {
      showTitleBar: true,
      showToolBar: true,
      showStatusBar: true,
      showSidebar: true,
      sourceMode: false,
      sidebarWidth: 300,
      sidebarActiveTab: 'files',
      windowX: 100,
      windowY: 100,
      windowWidth: 1024,
      windowHeight: 768,
      displayId: 1,
      displayWidth: 1920,
      displayHeight: 1080,
    };
    const result = await saveUIState(state);
    expect(result.success).toBe(true);
  });

  it('should save minimal UI state', async () => {
    const state = getDefaultUIState();
    const result = await saveUIState(state);
    expect(result.success).toBe(true);
  });

  it('should handle different sidebar tabs', async () => {
    const state = getDefaultUIState();
    const tabs = ['files', 'outline', 'search', 'settings'] as const;
    for (const tab of tabs) {
      state.sidebarActiveTab = tab;
      const result = await saveUIState(state);
      expect(result.success).toBe(true);
    }
  });
});
