// Recent files management for Phase 2
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join, basename } from 'path';
import { homedir } from '../services/homedir';
import type { RecentFile } from '../../shared/types';

const MAX_RECENT_FILES = 20;
const RECENT_FILES_PATH = join(homedir(), '.config', 'markbun', 'recent-files.json');

/**
 * Ensure the config directory exists
 */
async function ensureConfigDir(): Promise<void> {
  const configDir = join(homedir(), '.config', 'markbun');
  try {
    await access(configDir);
  } catch {
    await mkdir(configDir, { recursive: true });
  }
}

/**
 * Read recent files from disk
 */
async function readRecentFilesFromDisk(): Promise<RecentFile[]> {
  try {
    await ensureConfigDir();
    const data = await readFile(RECENT_FILES_PATH, 'utf-8');
    const files = JSON.parse(data) as RecentFile[];
    // Validate and filter out duplicates
    return files.filter((f, index, self) =>
      index === self.findIndex(t => t.path === f.path)
    );
  } catch {
    return [];
  }
}

/**
 * Save recent files to disk
 */
async function saveRecentFilesToDisk(files: RecentFile[]): Promise<void> {
  await ensureConfigDir();
  await writeFile(RECENT_FILES_PATH, JSON.stringify(files, null, 2), 'utf-8');
}

/**
 * Get all recent files
 */
export async function getRecentFiles(): Promise<{ success: boolean; files?: RecentFile[]; error?: string }> {
  try {
    const files = await readRecentFilesFromDisk();
    return { success: true, files };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Add a file to recent files
 */
export async function addRecentFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const files = await readRecentFilesFromDisk();

    // Remove if already exists
    const filtered = files.filter(f => f.path !== filePath);

    // Add to beginning
    const newFile: RecentFile = {
      path: filePath,
      name: basename(filePath),
      openedAt: Date.now(),
    };

    filtered.unshift(newFile);

    // Keep only max allowed
    const trimmed = filtered.slice(0, MAX_RECENT_FILES);

    await saveRecentFilesToDisk(trimmed);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove a file from recent files
 */
export async function removeRecentFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const files = await readRecentFilesFromDisk();
    const filtered = files.filter(f => f.path !== filePath);
    await saveRecentFilesToDisk(filtered);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Clear all recent files
 */
export async function clearRecentFiles(): Promise<{ success: boolean; error?: string }> {
  try {
    await saveRecentFilesToDisk([]);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update recent file names (in case files were renamed)
 */
export async function refreshRecentFiles(): Promise<{ success: boolean; error?: string }> {
  try {
    const files = await readRecentFilesFromDisk();
    const { stat } = await import('fs/promises');

    // Check which files still exist and update names
    const refreshed = await Promise.all(
      files.map(async (f) => {
        try {
          await stat(f.path);
          return { ...f, name: basename(f.path) };
        } catch {
          // File doesn't exist, keep it but mark somehow?
          return f;
        }
      })
    );

    await saveRecentFilesToDisk(refreshed);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
