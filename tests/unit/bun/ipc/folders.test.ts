/**
 * Folders IPC 单元测试
 * 测试文件夹操作相关函数
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { readFolder, expandFolder, getWorkspaceRoot } from '../../../../src/bun/ipc/folders';
import { mkdtemp, writeFile, mkdir, rmdir, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('readFolder', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'folders-test-'));
  });

  afterEach(async () => {
    try {
      const entries = await import('fs/promises').then(m => m.readdir(tempDir));
      for (const entry of entries) {
        const path = join(tempDir, entry);
        try {
          await unlink(path);
        } catch {
          await rmdir(path, { recursive: true });
        }
      }
      await rmdir(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should return success with nodes for valid folder', async () => {
    await writeFile(join(tempDir, 'test.md'), '# Test');

    const result = await readFolder(tempDir);
    expect(result.success).toBe(true);
    expect(result.nodes).toBeDefined();
    expect(result.nodes!.length).toBeGreaterThan(0);
  });

  it('should filter unsupported file types', async () => {
    await writeFile(join(tempDir, 'test.md'), '# Test');
    await writeFile(join(tempDir, 'test.exe'), 'binary');

    const result = await readFolder(tempDir);
    expect(result.success).toBe(true);
    const files = result.nodes!.filter(n => n.type === 'file');
    expect(files.every(f => f.extension !== 'exe')).toBe(true);
  });

  it('should skip hidden files', async () => {
    await writeFile(join(tempDir, '.hidden'), 'secret');
    await writeFile(join(tempDir, 'visible.md'), '# Test');

    const result = await readFolder(tempDir);
    expect(result.success).toBe(true);
    expect(result.nodes!.some(n => n.name.startsWith('.'))).toBe(false);
  });

  it('should sort folders before files', async () => {
    await mkdir(join(tempDir, 'folderA'));
    await writeFile(join(tempDir, 'fileA.md'), '# Test');
    await mkdir(join(tempDir, 'folderB'));

    const result = await readFolder(tempDir);
    expect(result.success).toBe(true);
    const types = result.nodes!.map(n => n.type);
    const firstFileIndex = types.indexOf('file');
    const lastFolderIndex = types.lastIndexOf('folder');
    expect(firstFileIndex).toBeGreaterThan(lastFolderIndex);
  });

  it('should return error for non-existent folder', async () => {
    const result = await readFolder('/non/existent/path/12345');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle empty folder', async () => {
    const result = await readFolder(tempDir);
    expect(result.success).toBe(true);
    expect(result.nodes).toEqual([]);
  });

  it('should include file extension without dot', async () => {
    await writeFile(join(tempDir, 'document.md'), '# Test');

    const result = await readFolder(tempDir);
    expect(result.success).toBe(true);
    const file = result.nodes!.find(n => n.name === 'document.md') as any;
    expect(file).toBeDefined();
    expect(file.extension).toBe('md');
  });

  it('should handle .markdown extension', async () => {
    await writeFile(join(tempDir, 'doc.markdown'), '# Test');

    const result = await readFolder(tempDir);
    expect(result.success).toBe(true);
    const file = result.nodes!.find(n => n.name === 'doc.markdown');
    expect(file).toBeDefined();
    expect(file!.type).toBe('file');
  });

  it('should handle .txt extension', async () => {
    await writeFile(join(tempDir, 'notes.txt'), 'notes');

    const result = await readFolder(tempDir);
    expect(result.success).toBe(true);
    const file = result.nodes!.find(n => n.name === 'notes.txt');
    expect(file).toBeDefined();
    expect(file!.type).toBe('file');
  });

  it('should skip Windows system files', async () => {
    await writeFile(join(tempDir, 'thumbs.db'), '');
    await writeFile(join(tempDir, 'desktop.ini'), '');
    await writeFile(join(tempDir, 'valid.md'), '# Test');

    const result = await readFolder(tempDir);
    expect(result.success).toBe(true);
    expect(result.nodes!.some(n => n.name.toLowerCase() === 'thumbs.db')).toBe(false);
    expect(result.nodes!.some(n => n.name.toLowerCase() === 'desktop.ini')).toBe(false);
  });

  it('should skip macOS system files', async () => {
    await writeFile(join(tempDir, '.DS_Store'), '');
    await writeFile(join(tempDir, '.Trashes'), '');
    await writeFile(join(tempDir, 'valid.md'), '# Test');

    const result = await readFolder(tempDir);
    expect(result.success).toBe(true);
    expect(result.nodes!.some(n => n.name.toLowerCase() === '.ds_store')).toBe(false);
  });

  it('should skip macOS resource fork files (._*)', async () => {
    await writeFile(join(tempDir, '._resource'), '');
    await writeFile(join(tempDir, 'valid.md'), '# Test');

    const result = await readFolder(tempDir);
    expect(result.success).toBe(true);
    expect(result.nodes!.some(n => n.name.startsWith('._'))).toBe(false);
  });
});

describe('expandFolder', () => {
  it('should call readFolder', async () => {
    const result = await expandFolder('/non/existent');
    expect(result.success).toBe(false);
  });
});

describe('getWorkspaceRoot', () => {
  it('should return Documents path', async () => {
    const result = await getWorkspaceRoot();
    expect(result.success).toBe(true);
    expect(result.path).toBeDefined();
    expect(result.path).toContain('Documents');
  });
});
