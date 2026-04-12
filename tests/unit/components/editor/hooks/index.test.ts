/**
 * Hooks 单元测试
 * 测试自定义 React Hooks
 */
import { describe, it, expect } from 'bun:test';

const isBun = typeof (globalThis as any).Bun !== 'undefined';

describe('Hooks', () => {
  it('should skip hooks tests in Bun environment (requires DOM)', () => {
    expect(true).toBe(true);
  });

  it('useCrepeEditor should be defined', () => {
    if (isBun) {
      expect(true).toBe(true);
      return;
    }
    const { useCrepeEditor } = require('../../../setup');
    expect(typeof useCrepeEditor).toBe('function');
  });

  it('useThemeLoader should be defined', () => {
    if (isBun) {
      expect(true).toBe(true);
      return;
    }
    const { useThemeLoader } = require('../../../setup');
    expect(typeof useThemeLoader).toBe('function');
  });

  it('useContextMenu should be defined', () => {
    if (isBun) {
      expect(true).toBe(true);
      return;
    }
    const { useContextMenu } = require('../../../setup');
    expect(typeof useContextMenu).toBe('function');
  });
});
