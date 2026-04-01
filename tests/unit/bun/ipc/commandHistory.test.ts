/**
 * Command History IPC unit tests
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { getCommandHistory, recordCommandUsage } from '../../../../src/bun/ipc/commandHistory';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const HISTORY_PATH = join(homedir(), '.config', 'markbun', 'command-history.json');

async function clearHistory() {
  try {
    await unlink(HISTORY_PATH);
  } catch {
    // File doesn't exist, that's fine
  }
}

describe('commandHistory', () => {
  beforeEach(async () => {
    await clearHistory();
  });

  it('returns empty history when no commands recorded', async () => {
    const result = await getCommandHistory();
    expect(result.success).toBe(true);
    expect(result.history).toEqual([]);
  });

  it('records and retrieves commands in reverse chronological order', async () => {
    await recordCommandUsage('format-strong');
    await recordCommandUsage('para-heading-1');
    await recordCommandUsage('file-save');

    const result = await getCommandHistory();
    expect(result.success).toBe(true);
    expect(result.history).toEqual(['file-save', 'para-heading-1', 'format-strong']);
  });

  it('moves duplicate action to front without creating duplicates', async () => {
    await recordCommandUsage('format-strong');
    await recordCommandUsage('para-heading-1');
    await recordCommandUsage('format-strong');

    const result = await getCommandHistory();
    expect(result.success).toBe(true);
    expect(result.history).toEqual(['format-strong', 'para-heading-1']);
  });

  it('evicts oldest entry when at max capacity', async () => {
    // Fill to max (30 entries)
    for (let i = 0; i < 30; i++) {
      await recordCommandUsage(`cmd-${i}`);
    }

    // Add one more — should evict cmd-29 (oldest)
    await recordCommandUsage('cmd-new');

    const result = await getCommandHistory();
    expect(result.success).toBe(true);
    expect(result.history!.length).toBe(30);
    expect(result.history![0]).toBe('cmd-new');
    // cmd-0 was the oldest (added first, pushed to end by subsequent adds)
    expect(result.history).not.toContain('cmd-0');
  });

  it('persists to disk as valid JSON', async () => {
    await recordCommandUsage('format-strong');

    const data = await readFile(HISTORY_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].action).toBe('format-strong');
    expect(typeof parsed[0].usedAt).toBe('number');
  });
});
