import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { SidebarTab } from '../../shared/types';

export interface UIState {
  showTitleBar: boolean;
  showToolBar: boolean;
  showStatusBar: boolean;
  showSidebar: boolean;
  sidebarWidth: number;
  sidebarActiveTab: SidebarTab;
  // Window state
  windowX: number;
  windowY: number;
  windowWidth: number;
  windowHeight: number;
  // Display info for multi-monitor support
  displayId?: number;
  displayWidth?: number;
  displayHeight?: number;
}

const CONFIG_DIR = join(homedir(), '.config', 'markbun');
const UI_STATE_PATH = join(CONFIG_DIR, 'ui-state.json');

const defaultUIState: UIState = {
  showTitleBar: false,
  showToolBar: false,
  showStatusBar: false,
  showSidebar: false,
  sidebarWidth: 280,
  sidebarActiveTab: 'files',
  // Default window state
  windowX: 200,
  windowY: 200,
  windowWidth: 1200,
  windowHeight: 800,
};

/**
 * Ensure the config directory exists
 */
async function ensureConfigDir(): Promise<void> {
  try {
    await access(CONFIG_DIR);
  } catch {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load UI state from disk
 */
export async function loadUIState(): Promise<UIState> {
  try {
    await ensureConfigDir();
    const data = await readFile(UI_STATE_PATH, 'utf-8');
    const parsed = JSON.parse(data) as Partial<UIState>;

    // Merge with defaults to ensure all fields exist
    return {
      ...defaultUIState,
      ...parsed,
    };
  } catch (error) {
    // File doesn't exist or is invalid, return defaults
    return { ...defaultUIState };
  }
}

/**
 * Save UI state to disk
 */
export async function saveUIState(state: UIState): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureConfigDir();
    await writeFile(UI_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('[UIState] Failed to save UI state:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get default UI state
 */
export function getDefaultUIState(): UIState {
  return { ...defaultUIState };
}
