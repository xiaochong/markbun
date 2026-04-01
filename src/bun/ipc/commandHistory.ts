// Command usage history persistence for the command palette
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const MAX_COMMAND_HISTORY = 30;
const COMMAND_HISTORY_PATH = join(homedir(), '.config', 'markbun', 'command-history.json');

export interface CommandHistoryEntry {
  action: string;
  usedAt: number;
}

async function ensureConfigDir(): Promise<void> {
  const configDir = join(homedir(), '.config', 'markbun');
  try {
    await access(configDir);
  } catch {
    await mkdir(configDir, { recursive: true });
  }
}

async function readHistoryFromDisk(): Promise<CommandHistoryEntry[]> {
  try {
    await ensureConfigDir();
    const data = await readFile(COMMAND_HISTORY_PATH, 'utf-8');
    return JSON.parse(data) as CommandHistoryEntry[];
  } catch {
    return [];
  }
}

async function saveHistoryToDisk(entries: CommandHistoryEntry[]): Promise<void> {
  await ensureConfigDir();
  await writeFile(COMMAND_HISTORY_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}

export async function getCommandHistory(): Promise<{ success: boolean; history?: string[]; error?: string }> {
  try {
    const entries = await readHistoryFromDisk();
    return { success: true, history: entries.map(e => e.action) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function recordCommandUsage(action: string): Promise<{ success: boolean; error?: string }> {
  try {
    const entries = await readHistoryFromDisk();

    // Remove existing entry for same action (dedup)
    const filtered = entries.filter(e => e.action !== action);

    // Prepend new entry
    filtered.unshift({ action, usedAt: Date.now() });

    // Keep only max allowed
    const trimmed = filtered.slice(0, MAX_COMMAND_HISTORY);

    await saveHistoryToDisk(trimmed);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
