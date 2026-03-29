import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { SidebarTab } from '../../shared/types';

export interface UIState {
  showTitleBar: boolean;
  showToolBar: boolean;
  showStatusBar: boolean;
  showSidebar: boolean;
  sourceMode: boolean;
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
  sourceMode: false,
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

    // Validate and sanitize window dimensions
    const MIN_WIDTH = 800;
    const MIN_HEIGHT = 600;
    const MAX_DIMENSION = 10000;

    const sanitized: Partial<UIState> = {
      ...parsed,
    };

    // Sanitize window dimensions
    if (parsed.windowWidth !== undefined && (parsed.windowWidth < MIN_WIDTH || parsed.windowWidth > MAX_DIMENSION)) {
      sanitized.windowWidth = defaultUIState.windowWidth;
    }
    if (parsed.windowHeight !== undefined && (parsed.windowHeight < MIN_HEIGHT || parsed.windowHeight > MAX_DIMENSION)) {
      sanitized.windowHeight = defaultUIState.windowHeight;
    }
    if (parsed.windowX !== undefined && (parsed.windowX < -MAX_DIMENSION || parsed.windowX > MAX_DIMENSION)) {
      sanitized.windowX = defaultUIState.windowX;
    }
    if (parsed.windowY !== undefined && (parsed.windowY < -MAX_DIMENSION || parsed.windowY > MAX_DIMENSION)) {
      sanitized.windowY = defaultUIState.windowY;
    }

    // Merge with defaults to ensure all fields exist
    return {
      ...defaultUIState,
      ...sanitized,
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
