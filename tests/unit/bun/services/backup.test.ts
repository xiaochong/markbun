/**
 * Backup Service 单元测试
 * 覆盖三层备份系统：原子写入、崩溃恢复、版本历史
 *
 * 隔离策略：在 backup.ts 加载前 mock `os` 模块，
 * 将 homedir() 重定向到进程级临时目录。
 */

import { mock, describe, it, expect, beforeEach, afterEach, afterAll } from 'bun:test';
import { mkdirSync, existsSync } from 'fs';
import {
  writeFile,
  readFile,
  mkdir,
  rm,
  mkdtemp,
  readdir,
} from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// ── 重定向 homedir → 临时目录（必须在 backup.ts 首次加载前执行）────────────
const TEST_HOME = join(tmpdir(), `markbun-backup-test-${process.pid}`);
mkdirSync(TEST_HOME, { recursive: true });
process.env.MARKBUN_E2E_HOME = TEST_HOME;

// ── 加载 backup 模块（已使用 MARKBUN_E2E_HOME 后的 os）──────────────────────
const {
  atomicWrite,
  writeRecoveryFile,
  clearRecoveryFile,
  scanRecoveries,
  readRecoveryContent,
  createVersionBackup,
  getVersionBackups,
  readVersionBackupContent,
  deleteVersionBackup,
} = await import('../../../../src/bun/services/backup');

// 备份目录路径（与 backup.ts 中一致）
const CONFIG_DIR = join(TEST_HOME, '.config', 'markbun');
const RECOVERY_DIR = join(CONFIG_DIR, 'recovery');
const BACKUP_DIR = join(CONFIG_DIR, 'backups');

// 测试结束后清理临时目录
afterAll(async () => {
  await rm(TEST_HOME, { recursive: true, force: true });
});

// ── 工具函数 ─────────────────────────────────────────────────────────────────

/** 每个测试用一个独立的临时工作目录，避免互相干扰 */
async function makeTmpDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'markbun-work-'));
}

// ═══════════════════════════════════════════════════════════════════════════
// Layer 1: Atomic Write
// ═══════════════════════════════════════════════════════════════════════════

describe('atomicWrite', () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await makeTmpDir();
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('写入内容后可正确读回', async () => {
    const filePath = join(workDir, 'hello.md');
    await atomicWrite(filePath, '# Hello World');
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('# Hello World');
  });

  it('目标目录不存在时自动创建', async () => {
    const filePath = join(workDir, 'deep', 'nested', 'file.md');
    await atomicWrite(filePath, 'content');
    expect(existsSync(filePath)).toBe(true);
  });

  it('写入后不留 .tmp 临时文件', async () => {
    const filePath = join(workDir, 'test.md');
    await atomicWrite(filePath, 'data');
    const tmpPath = `${filePath}.tmp`;
    expect(existsSync(tmpPath)).toBe(false);
  });

  it('覆盖写入时内容被更新', async () => {
    const filePath = join(workDir, 'overwrite.md');
    await atomicWrite(filePath, 'v1');
    await atomicWrite(filePath, 'v2');
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('v2');
  });

  it('空字符串内容正常写入', async () => {
    const filePath = join(workDir, 'empty.md');
    await atomicWrite(filePath, '');
    const content = await readFile(filePath, 'utf-8');
    expect(content).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Layer 2: Crash Recovery
// ═══════════════════════════════════════════════════════════════════════════

describe('writeRecoveryFile', () => {
  beforeEach(async () => {
    // 清理 recovery 目录
    await rm(RECOVERY_DIR, { recursive: true, force: true });
  });

  it('空 filePath 时直接返回，不写文件', async () => {
    await writeRecoveryFile('', 'some content');
    const entries = existsSync(RECOVERY_DIR)
      ? await readdir(RECOVERY_DIR)
      : [];
    expect(entries.length).toBe(0);
  });

  it('写入后 recovery 文件存在', async () => {
    await writeRecoveryFile('/fake/path/note.md', '# Note');
    const entries = await readdir(RECOVERY_DIR);
    expect(entries.some(e => e.endsWith('.recovery'))).toBe(true);
  });

  it('recovery 文件中包含原始路径和内容', async () => {
    const filePath = '/fake/path/doc.md';
    const content = '# Document\ncontent here';
    await writeRecoveryFile(filePath, content);

    const entries = await readdir(RECOVERY_DIR);
    const recoveryFile = entries.find(e => e.endsWith('.recovery'))!;
    const raw = await readFile(join(RECOVERY_DIR, recoveryFile), 'utf-8');
    const data = JSON.parse(raw);

    expect(data.originalPath).toBe(filePath);
    expect(data.content).toBe(content);
    expect(typeof data.timestamp).toBe('number');
  });

  it('多次调用相同 filePath 时覆盖旧 recovery 文件（非累积）', async () => {
    await writeRecoveryFile('/same/path.md', 'v1');
    await writeRecoveryFile('/same/path.md', 'v2');
    const entries = await readdir(RECOVERY_DIR);
    // 同一路径的 hash 相同，只应有一个 .recovery 文件
    expect(entries.filter(e => e.endsWith('.recovery')).length).toBe(1);
  });
});

describe('clearRecoveryFile', () => {
  beforeEach(async () => {
    await rm(RECOVERY_DIR, { recursive: true, force: true });
  });

  it('清除已存在的 recovery 文件', async () => {
    const filePath = '/tmp/clear-test.md';
    await writeRecoveryFile(filePath, 'content');

    // 确认文件存在
    let entries = await readdir(RECOVERY_DIR);
    expect(entries.some(e => e.endsWith('.recovery'))).toBe(true);

    await clearRecoveryFile(filePath);

    entries = await readdir(RECOVERY_DIR);
    expect(entries.filter(e => e.endsWith('.recovery')).length).toBe(0);
  });

  it('文件不存在时不抛出异常', async () => {
    await expect(clearRecoveryFile('/nonexistent/path.md')).resolves.toBeUndefined();
  });

  it('空 filePath 时不抛出异常', async () => {
    await expect(clearRecoveryFile('')).resolves.toBeUndefined();
  });
});

describe('scanRecoveries', () => {
  let workDir: string;

  beforeEach(async () => {
    await rm(RECOVERY_DIR, { recursive: true, force: true });
    workDir = await makeTmpDir();
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('recovery 目录为空时返回空数组', async () => {
    const results = await scanRecoveries();
    expect(results).toEqual([]);
  });

  it('原文件内容与 recovery 相同时自动清理并不返回', async () => {
    const filePath = join(workDir, 'same.md');
    const content = '# Same Content';
    await writeFile(filePath, content, 'utf-8');
    await writeRecoveryFile(filePath, content);

    const results = await scanRecoveries();
    expect(results.length).toBe(0);

    // recovery 文件被清理
    const entries = existsSync(RECOVERY_DIR)
      ? await readdir(RECOVERY_DIR)
      : [];
    expect(entries.filter(e => e.endsWith('.recovery')).length).toBe(0);
  });

  it('原文件内容与 recovery 不同时返回 RecoveryInfo', async () => {
    const filePath = join(workDir, 'diff.md');
    await writeFile(filePath, 'disk content', 'utf-8');
    await writeRecoveryFile(filePath, 'recovered content — different');

    const results = await scanRecoveries();
    expect(results.length).toBe(1);
    expect(results[0].originalPath).toBe(filePath);
    expect(results[0].preview).toBe('recovered content — different');
    expect(typeof results[0].size).toBe('number');
    expect(typeof results[0].lastModified).toBe('number');
  });

  it('原文件不存在时返回 RecoveryInfo（需要恢复）', async () => {
    const filePath = join(workDir, 'missing.md');
    // 不创建 filePath，只写 recovery
    await writeRecoveryFile(filePath, '# Lost content');

    const results = await scanRecoveries();
    expect(results.length).toBe(1);
    expect(results[0].originalPath).toBe(filePath);
  });

  it('preview 最多截取 200 个字符', async () => {
    const filePath = join(workDir, 'long.md');
    const longContent = 'x'.repeat(500);
    await writeRecoveryFile(filePath, longContent);

    const results = await scanRecoveries();
    expect(results.length).toBe(1);
    expect(results[0].preview.length).toBeLessThanOrEqual(200);
  });

  it('30 天以上的 stale recovery 文件被自动删除', async () => {
    // 直接写一个 timestamp 为 31 天前的 recovery 文件
    await mkdir(RECOVERY_DIR, { recursive: true });
    const staleData = {
      originalPath: '/fake/stale.md',
      timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000,
      content: 'stale content',
    };
    // 计算与 backup.ts 相同的 hash 路径
    const { createHash } = await import('crypto');
    const hash = createHash('sha1').update('/fake/stale.md').digest('hex');
    await writeFile(
      join(RECOVERY_DIR, `${hash}.recovery`),
      JSON.stringify(staleData),
      'utf-8',
    );

    const results = await scanRecoveries();
    expect(results.length).toBe(0);

    // stale 文件已被删除
    const entries = await readdir(RECOVERY_DIR);
    expect(entries.filter(e => e.endsWith('.recovery')).length).toBe(0);
  });
});

describe('readRecoveryContent', () => {
  beforeEach(async () => {
    await rm(RECOVERY_DIR, { recursive: true, force: true });
  });

  it('读取有效 recovery 文件返回原始路径和内容', async () => {
    const filePath = '/test/read.md';
    const content = '# Read Me';
    await writeRecoveryFile(filePath, content);

    const entries = await readdir(RECOVERY_DIR);
    const recoveryPath = join(RECOVERY_DIR, entries[0]);

    const result = await readRecoveryContent(recoveryPath);
    expect(result).not.toBeNull();
    expect(result!.originalPath).toBe(filePath);
    expect(result!.content).toBe(content);
  });

  it('文件不存在时返回 null', async () => {
    const result = await readRecoveryContent('/nonexistent/recovery.recovery');
    expect(result).toBeNull();
  });

  it('文件内容损坏（非 JSON）时返回 null', async () => {
    await mkdir(RECOVERY_DIR, { recursive: true });
    const corruptPath = join(RECOVERY_DIR, 'corrupt.recovery');
    await writeFile(corruptPath, 'not-json-content', 'utf-8');

    const result = await readRecoveryContent(corruptPath);
    expect(result).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Layer 3: Version History
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_SETTINGS = {
  enabled: true,
  maxVersions: 10,
  retentionDays: 30,
  recoveryInterval: 30000,
};

describe('createVersionBackup', () => {
  let workDir: string;

  beforeEach(async () => {
    await rm(BACKUP_DIR, { recursive: true, force: true });
    workDir = await makeTmpDir();
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('settings.enabled = false 时返回 null', async () => {
    const filePath = join(workDir, 'test.md');
    await writeFile(filePath, '# Test', 'utf-8');

    const result = await createVersionBackup(filePath, { ...DEFAULT_SETTINGS, enabled: false });
    expect(result).toBeNull();
  });

  it('空 filePath 时返回 null', async () => {
    const result = await createVersionBackup('', DEFAULT_SETTINGS);
    expect(result).toBeNull();
  });

  it('原文件不存在时返回 null', async () => {
    const result = await createVersionBackup(join(workDir, 'ghost.md'), DEFAULT_SETTINGS);
    expect(result).toBeNull();
  });

  it('成功备份时返回 BackupEntry', async () => {
    const filePath = join(workDir, 'note.md');
    await writeFile(filePath, '# Note\ncontent', 'utf-8');

    const entry = await createVersionBackup(filePath, DEFAULT_SETTINGS);
    expect(entry).not.toBeNull();
    expect(typeof entry!.path).toBe('string');
    expect(typeof entry!.timestamp).toBe('number');
    expect(entry!.size).toBeGreaterThan(0);
  });

  it('备份文件内容与原文件一致', async () => {
    const filePath = join(workDir, 'copy.md');
    const content = '# Copy Test\nhello world';
    await writeFile(filePath, content, 'utf-8');

    const entry = await createVersionBackup(filePath, DEFAULT_SETTINGS);
    expect(entry).not.toBeNull();

    const backedContent = await readFile(entry!.path, 'utf-8');
    expect(backedContent).toBe(content);
  });

  it('备份文件名格式为 <timestamp>.md', async () => {
    const filePath = join(workDir, 'format.md');
    await writeFile(filePath, '# Format', 'utf-8');

    const entry = await createVersionBackup(filePath, DEFAULT_SETTINGS);
    expect(entry).not.toBeNull();
    expect(entry!.path).toMatch(/\d+\.md$/);
  });
});

describe('getVersionBackups', () => {
  let workDir: string;

  beforeEach(async () => {
    await rm(BACKUP_DIR, { recursive: true, force: true });
    workDir = await makeTmpDir();
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('无备份时返回空数组', async () => {
    const backups = await getVersionBackups(join(workDir, 'nofile.md'));
    expect(backups).toEqual([]);
  });

  it('返回已创建的备份', async () => {
    const filePath = join(workDir, 'list.md');
    await writeFile(filePath, '# List', 'utf-8');

    await createVersionBackup(filePath, DEFAULT_SETTINGS);
    const backups = await getVersionBackups(filePath);

    expect(backups.length).toBe(1);
    expect(backups[0].path).toMatch(/\.md$/);
    expect(backups[0].size).toBeGreaterThan(0);
  });

  it('多个备份按时间戳降序排列（最新在前）', async () => {
    const filePath = join(workDir, 'sorted.md');
    await writeFile(filePath, '# v1', 'utf-8');
    await createVersionBackup(filePath, DEFAULT_SETTINGS);

    // 稍等确保时间戳不同
    await Bun.sleep(5);

    await writeFile(filePath, '# v2', 'utf-8');
    await createVersionBackup(filePath, DEFAULT_SETTINGS);

    const backups = await getVersionBackups(filePath);
    expect(backups.length).toBe(2);
    expect(backups[0].timestamp).toBeGreaterThan(backups[1].timestamp);
  });
});

describe('readVersionBackupContent', () => {
  let workDir: string;

  beforeEach(async () => {
    await rm(BACKUP_DIR, { recursive: true, force: true });
    workDir = await makeTmpDir();
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('读取存在的备份内容', async () => {
    const filePath = join(workDir, 'readable.md');
    const content = '# Readable Content';
    await writeFile(filePath, content, 'utf-8');

    const entry = await createVersionBackup(filePath, DEFAULT_SETTINGS);
    expect(entry).not.toBeNull();

    const read = await readVersionBackupContent(entry!.path);
    expect(read).toBe(content);
  });

  it('备份不存在时返回 null', async () => {
    const result = await readVersionBackupContent('/nonexistent/backup.md');
    expect(result).toBeNull();
  });
});

describe('deleteVersionBackup', () => {
  let workDir: string;

  beforeEach(async () => {
    await rm(BACKUP_DIR, { recursive: true, force: true });
    workDir = await makeTmpDir();
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('删除存在的备份文件', async () => {
    const filePath = join(workDir, 'to-delete.md');
    await writeFile(filePath, '# Delete Me', 'utf-8');

    const entry = await createVersionBackup(filePath, DEFAULT_SETTINGS);
    expect(entry).not.toBeNull();
    expect(existsSync(entry!.path)).toBe(true);

    await deleteVersionBackup(entry!.path);
    expect(existsSync(entry!.path)).toBe(false);
  });

  it('文件不存在时不抛出异常', async () => {
    await expect(deleteVersionBackup('/nonexistent/backup.md')).resolves.toBeUndefined();
  });
});

describe('pruneVersionBackups（通过 createVersionBackup 触发）', () => {
  let workDir: string;

  beforeEach(async () => {
    await rm(BACKUP_DIR, { recursive: true, force: true });
    workDir = await makeTmpDir();
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it('超过 maxVersions 的旧备份被剪裁', async () => {
    const filePath = join(workDir, 'prune.md');
    const maxVersions = 3;

    // 创建 maxVersions + 2 个备份
    for (let i = 0; i < maxVersions + 2; i++) {
      await writeFile(filePath, `# Version ${i}`, 'utf-8');
      await createVersionBackup(filePath, { ...DEFAULT_SETTINGS, maxVersions });
      await Bun.sleep(5); // 保证时间戳不同
    }

    // pruneVersionBackups 是异步后台执行的，需稍等
    await Bun.sleep(100);

    const backups = await getVersionBackups(filePath);
    expect(backups.length).toBeLessThanOrEqual(maxVersions);
  });
});
