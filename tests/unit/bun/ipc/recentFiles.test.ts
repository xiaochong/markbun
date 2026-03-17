/**
 * Recent Files IPC 单元测试
 * 测试最近文件管理功能
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  getRecentFiles,
  addRecentFile,
  removeRecentFile,
  clearRecentFiles,
  refreshRecentFiles,
} from '../../../../src/bun/ipc/recentFiles';
import { mkdtemp, writeFile, mkdir, rmdir, unlink, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir, homedir } from 'os';

describe('getRecentFiles', () => {
  beforeEach(async () => {
    await clearRecentFiles();
  });

  it('should return success status', async () => {
    const result = await getRecentFiles();
    expect(result.success).toBe(true);
  });

  it('should return array of files', async () => {
    await addRecentFile('/test/file.md');
    const result = await getRecentFiles();
    expect(Array.isArray(result.files)).toBe(true);
  });
});

describe('addRecentFile', () => {
  it('should add a file to recent files', async () => {
    const testPath = '/home/user/test.md';
    const result = await addRecentFile(testPath);
    expect(result.success).toBe(true);

    // Verify it was added
    const recent = await getRecentFiles();
    expect(recent.files?.some(f => f.path === testPath)).toBe(true);
  });

  it('should move existing file to top', async () => {
    await clearRecentFiles();
    await addRecentFile('/home/user/first.md');
    await addRecentFile('/home/user/second.md');
    await addRecentFile('/home/user/first.md'); // Add again

    const result = await getRecentFiles();
    expect(result.files?.[0].path).toBe('/home/user/first.md');
    expect(result.files?.length).toBe(2);
  });

  it('should include file name in recent entry', async () => {
    await addRecentFile('/home/user/document.md');

    const result = await getRecentFiles();
    const file = result.files?.find(f => f.path === '/home/user/document.md');
    expect(file?.name).toBe('document.md');
  });

  it('should include timestamp in recent entry', async () => {
    const before = Date.now();
    await addRecentFile('/home/user/timed.md');
    const after = Date.now();

    const result = await getRecentFiles();
    const file = result.files?.find(f => f.path === '/home/user/timed.md');
    expect(file?.openedAt).toBeGreaterThanOrEqual(before);
    expect(file?.openedAt).toBeLessThanOrEqual(after);
  });
});

describe('removeRecentFile', () => {
  it('should remove a file from recent files', async () => {
    await addRecentFile('/home/user/to-remove.md');
    const result = await removeRecentFile('/home/user/to-remove.md');
    expect(result.success).toBe(true);

    const recent = await getRecentFiles();
    expect(recent.files?.some(f => f.path === '/home/user/to-remove.md')).toBe(false);
  });

  it('should succeed when removing non-existent file', async () => {
    const result = await removeRecentFile('/non/existent/file.md');
    expect(result.success).toBe(true);
  });
});

describe('clearRecentFiles', () => {
  it('should clear all recent files', async () => {
    await addRecentFile('/home/user/file1.md');
    await addRecentFile('/home/user/file2.md');

    const result = await clearRecentFiles();
    expect(result.success).toBe(true);

    const recent = await getRecentFiles();
    expect(recent.files).toEqual([]);
  });
});

describe('refreshRecentFiles', () => {
  it('should refresh recent files', async () => {
    await addRecentFile('/home/user/existing.md');
    const result = await refreshRecentFiles();
    expect(result.success).toBe(true);
  });
});
