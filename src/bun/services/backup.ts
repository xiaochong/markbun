/**
 * Backup Service — Three-layer file protection
 *
 * Layer 1: Atomic Write     — write to .tmp, then rename (POSIX atomic)
 * Layer 2: Crash Recovery   — persist content to recovery dir, clear on success
 * Layer 3: Version History  — snapshot before each save, auto-prune old versions
 */

import {
  readFile,
  writeFile,
  rename,
  unlink,
  mkdir,
  readdir,
  stat,
  access,
  copyFile,
} from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import type { BackupEntry, BackupSettings, RecoveryInfo } from '../../shared/types';

// ── Storage paths ────────────────────────────────────────────────────────────

const CONFIG_DIR = join(homedir(), '.config', 'markbun');
const RECOVERY_DIR = join(CONFIG_DIR, 'recovery');
const BACKUP_DIR = join(CONFIG_DIR, 'backups');

// Files larger than this are not version-backed up (still atomically written)
const MAX_BACKUP_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Internal helpers ─────────────────────────────────────────────────────────

function getPathHash(filePath: string): string {
  return createHash('sha1').update(filePath).digest('hex');
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await access(dir);
  } catch {
    await mkdir(dir, { recursive: true, mode: 0o755 });
  }
}

function getRecoveryPath(filePath: string): string {
  return join(RECOVERY_DIR, `${getPathHash(filePath)}.recovery`);
}

function getVersionBackupDir(filePath: string): string {
  return join(BACKUP_DIR, getPathHash(filePath));
}

// ── Recovery file format ─────────────────────────────────────────────────────

interface RecoveryFile {
  originalPath: string;
  timestamp: number;
  content: string;
}

// ── Layer 1: Atomic Write ─────────────────────────────────────────────────────

/**
 * Write `content` to `filePath` atomically.
 * Writes to a sibling `.tmp` file first, then renames into place.
 */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  const tmpPath = `${filePath}.tmp`;

  try {
    await ensureDir(dirname(filePath));
    await writeFile(tmpPath, content, 'utf-8');
    await rename(tmpPath, filePath);
  } catch (err) {
    // Best-effort cleanup of the temp file
    try { await unlink(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

// ── Layer 2: Crash Recovery ───────────────────────────────────────────────────

/**
 * Persist `content` to the recovery directory for `filePath`.
 * Called just before (and independently of) the main atomic write, so that
 * a crash mid-write still leaves a recoverable copy.
 */
export async function writeRecoveryFile(filePath: string, content: string): Promise<void> {
  if (!filePath) return;
  try {
    await ensureDir(RECOVERY_DIR);
    const data: RecoveryFile = {
      originalPath: filePath,
      timestamp: Date.now(),
      content,
    };
    await writeFile(getRecoveryPath(filePath), JSON.stringify(data), 'utf-8');
  } catch (err) {
    // Recovery writes must never block normal operation
    console.error('[Backup] writeRecoveryFile failed:', err);
  }
}

/**
 * Remove the recovery file after a successful save.
 */
export async function clearRecoveryFile(filePath: string): Promise<void> {
  if (!filePath) return;
  try {
    const p = getRecoveryPath(filePath);
    if (existsSync(p)) await unlink(p);
  } catch (err) {
    console.error('[Backup] clearRecoveryFile failed:', err);
  }
}

/**
 * Scan the recovery directory and return info about files that differ from
 * their originals (i.e. they were not cleanly saved before the app exited).
 * Stale recovery files (>30 days) and ones that match the original are silently
 * removed.
 */
export async function scanRecoveries(): Promise<RecoveryInfo[]> {
  const results: RecoveryInfo[] = [];

  try {
    await ensureDir(RECOVERY_DIR);
    const entries = await readdir(RECOVERY_DIR);
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000;

    for (const entry of entries) {
      if (!entry.endsWith('.recovery')) continue;
      const recoveryPath = join(RECOVERY_DIR, entry);

      try {
        const raw = await readFile(recoveryPath, 'utf-8');
        const data: RecoveryFile = JSON.parse(raw);
        const fileStats = await stat(recoveryPath);

        // Prune stale recovery files
        if (now - data.timestamp > maxAge) {
          await unlink(recoveryPath);
          continue;
        }

        // Check whether the original file still has different content
        let needsRecovery = true;
        if (existsSync(data.originalPath)) {
          try {
            const original = await readFile(data.originalPath, 'utf-8');
            if (original === data.content) {
              // Content already on disk — clean up the recovery file
              await unlink(recoveryPath);
              needsRecovery = false;
            }
          } catch {
            // Can't read original → keep recovery file
          }
        }

        if (needsRecovery) {
          results.push({
            originalPath: data.originalPath,
            recoveryPath,
            lastModified: data.timestamp,
            preview: data.content.slice(0, 200),
            size: fileStats.size,
          });
        }
      } catch {
        // Corrupt recovery file — skip it
      }
    }
  } catch (err) {
    console.error('[Backup] scanRecoveries failed:', err);
  }

  return results;
}

/**
 * Read the content stored in a recovery file.
 */
export async function readRecoveryContent(
  recoveryPath: string,
): Promise<{ originalPath: string; content: string } | null> {
  try {
    const raw = await readFile(recoveryPath, 'utf-8');
    const data: RecoveryFile = JSON.parse(raw);
    return { originalPath: data.originalPath, content: data.content };
  } catch {
    return null;
  }
}

// ── Layer 3: Version History ──────────────────────────────────────────────────

/**
 * Create a version snapshot of `filePath` *before* the next write.
 * Returns a BackupEntry on success, null if skipped (file too large / disabled).
 */
export async function createVersionBackup(
  filePath: string,
  settings: BackupSettings,
): Promise<BackupEntry | null> {
  if (!settings.enabled || !filePath) return null;
  if (!existsSync(filePath)) return null;

  try {
    const fileStats = await stat(filePath);
    if (fileStats.size > MAX_BACKUP_FILE_SIZE) return null;

    const backupDir = getVersionBackupDir(filePath);
    await ensureDir(backupDir);

    const timestamp = Date.now();
    const backupPath = join(backupDir, `${timestamp}.md`);

    await copyFile(filePath, backupPath);

    // Prune old backups asynchronously (don't await — keep hot path fast)
    pruneVersionBackups(filePath, settings).catch(console.error);

    return { path: backupPath, timestamp, size: fileStats.size };
  } catch (err) {
    console.error('[Backup] createVersionBackup failed:', err);
    return null;
  }
}

/**
 * List all version backups for `filePath`, newest first.
 */
export async function getVersionBackups(filePath: string): Promise<BackupEntry[]> {
  const backups: BackupEntry[] = [];

  try {
    const backupDir = getVersionBackupDir(filePath);
    if (!existsSync(backupDir)) return backups;

    const entries = await readdir(backupDir);
    for (const entry of entries) {
      const m = entry.match(/^(\d+)\.md$/);
      if (!m) continue;
      const backupPath = join(backupDir, entry);
      try {
        const s = await stat(backupPath);
        backups.push({ path: backupPath, timestamp: Number(m[1]), size: s.size });
      } catch { /* skip */ }
    }
  } catch (err) {
    console.error('[Backup] getVersionBackups failed:', err);
  }

  return backups.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Read the content of a specific version backup.
 */
export async function readVersionBackupContent(backupPath: string): Promise<string | null> {
  try {
    return await readFile(backupPath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Delete a specific version backup.
 */
export async function deleteVersionBackup(backupPath: string): Promise<void> {
  try {
    if (existsSync(backupPath)) await unlink(backupPath);
  } catch (err) {
    console.error('[Backup] deleteVersionBackup failed:', err);
  }
}

/**
 * Remove backups older than `retentionDays` and keep at most `maxVersions`
 * copies per file.
 */
async function pruneVersionBackups(
  filePath: string,
  settings: BackupSettings,
): Promise<void> {
  try {
    const backupDir = getVersionBackupDir(filePath);
    if (!existsSync(backupDir)) return;

    const now = Date.now();
    const maxAgeMs = settings.retentionDays * 24 * 60 * 60 * 1000;
    const entries = await readdir(backupDir);

    const parsed = entries
      .map(e => ({ name: e, m: e.match(/^(\d+)\.md$/) }))
      .filter(e => e.m !== null)
      .map(e => ({ path: join(backupDir, e.name), timestamp: Number(e.m![1]) }))
      .sort((a, b) => b.timestamp - a.timestamp); // newest first

    for (let i = 0; i < parsed.length; i++) {
      const entry = parsed[i];
      const tooOld = now - entry.timestamp > maxAgeMs;
      const overLimit = i >= settings.maxVersions;
      if (tooOld || overLimit) {
        await unlink(entry.path);
      }
    }
  } catch (err) {
    console.error('[Backup] pruneVersionBackups failed:', err);
  }
}
