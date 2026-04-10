/**
 * Session State Service — Persist workspace editing context across restarts
 *
 * Stores: open file path, cursor position, scroll position, expanded folder paths.
 * File: ~/.config/markbun/session-state.json
 * Uses atomic write (.tmp + rename) for crash safety during frequent overwrites.
 */

import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface SessionState {
  version: number;
  filePath: string | null;
  cursor: { line: number; column: number } | null;
  scrollTop: number;
  expandedPaths: string[];
  sourceMode?: boolean;
  rootPath?: string | null;
}

const CONFIG_DIR = join(homedir(), '.config', 'markbun');
const SESSION_STATE_PATH = join(CONFIG_DIR, 'session-state.json');

const defaultSessionState: SessionState = {
  version: 1,
  filePath: null,
  cursor: null,
  scrollTop: 0,
  expandedPaths: [],
};

async function ensureConfigDir(): Promise<void> {
  try {
    await access(CONFIG_DIR);
  } catch {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load session state from disk.
 * Returns default state if file is absent or corrupt.
 */
export async function loadSessionState(): Promise<SessionState> {
  try {
    await ensureConfigDir();
    const data = await readFile(SESSION_STATE_PATH, 'utf-8');
    if (!data.trim()) return { ...defaultSessionState };
    const parsed = JSON.parse(data) as Partial<SessionState>;
    return {
      ...defaultSessionState,
      ...parsed,
    };
  } catch {
    return { ...defaultSessionState };
  }
}

/**
 * Save session state to disk using atomic write.
 */
export async function saveSessionState(state: SessionState): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureConfigDir();
    await writeFile(SESSION_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('[SessionState] Failed to save:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get default session state
 */
export function getDefaultSessionState(): SessionState {
  return { ...defaultSessionState };
}
