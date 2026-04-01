/**
 * Session State Service 单元测试
 * 测试 session state 加载/保存/合并功能
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import {
  getDefaultSessionState,
  loadSessionState,
  saveSessionState,
} from '../../../../src/bun/services/sessionState';
import type { SessionState } from '../../../../src/bun/services/sessionState';

describe('getDefaultSessionState', () => {
  it('should return default session state', () => {
    const defaults = getDefaultSessionState();
    expect(defaults.version).toBe(1);
    expect(defaults.filePath).toBeNull();
    expect(defaults.cursor).toBeNull();
    expect(defaults.scrollTop).toBe(0);
    expect(defaults.expandedPaths).toEqual([]);
  });
});

describe('loadSessionState', () => {
  it('should return default state when no file exists', async () => {
    const state = await loadSessionState();
    expect(state.version).toBe(1);
    expect(state.filePath).toBeNull();
    expect(state.cursor).toBeNull();
    expect(state.scrollTop).toBe(0);
    expect(state.expandedPaths).toEqual([]);
  });

  it('should have all required properties', async () => {
    const state = await loadSessionState();
    expect(typeof state.version).toBe('number');
    expect(state.filePath === null || typeof state.filePath === 'string').toBe(true);
    expect(state.cursor === null || (typeof state.cursor === 'object' && typeof state.cursor.line === 'number' && typeof state.cursor.column === 'number')).toBe(true);
    expect(typeof state.scrollTop).toBe('number');
    expect(Array.isArray(state.expandedPaths)).toBe(true);
  });
});

describe('saveSessionState + loadSessionState', () => {
  it('should save and load session state round-trip', async () => {
    const state: SessionState = {
      version: 1,
      filePath: '/Users/test/notes.md',
      cursor: { line: 10, column: 5 },
      scrollTop: 300,
      expandedPaths: ['/Users/test', '/Users/test/subfolder'],
    };
    const saveResult = await saveSessionState(state);
    expect(saveResult.success).toBe(true);

    const loaded = await loadSessionState();
    expect(loaded.filePath).toBe('/Users/test/notes.md');
    expect(loaded.cursor).toEqual({ line: 10, column: 5 });
    expect(loaded.scrollTop).toBe(300);
    expect(loaded.expandedPaths).toEqual(['/Users/test', '/Users/test/subfolder']);
  });

  it('should save state with null values', async () => {
    const state: SessionState = {
      version: 1,
      filePath: null,
      cursor: null,
      scrollTop: 0,
      expandedPaths: [],
    };
    const saveResult = await saveSessionState(state);
    expect(saveResult.success).toBe(true);

    const loaded = await loadSessionState();
    expect(loaded.filePath).toBeNull();
    expect(loaded.cursor).toBeNull();
    expect(loaded.scrollTop).toBe(0);
    expect(loaded.expandedPaths).toEqual([]);
  });

  it('should handle partial state via merge', async () => {
    // Save a full state first
    const fullState: SessionState = {
      version: 1,
      filePath: '/test/file.md',
      cursor: { line: 5, column: 3 },
      scrollTop: 100,
      expandedPaths: ['/test'],
    };
    await saveSessionState(fullState);

    // Save a partial update (only filePath)
    const partialState: SessionState = {
      ...fullState,
      filePath: '/test/other.md',
      cursor: null,
    };
    await saveSessionState(partialState);

    const loaded = await loadSessionState();
    expect(loaded.filePath).toBe('/test/other.md');
    expect(loaded.cursor).toBeNull();
    expect(loaded.scrollTop).toBe(100);
  });
});
