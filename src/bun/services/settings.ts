import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from './homedir';
import { settingsSchema, defaultSettings } from '../../shared/settings/schema';
import type { Settings } from '../../shared/settings/schema';

export type { Settings };

const CONFIG_DIR = join(homedir(), '.config', 'markbun');
const SETTINGS_PATH = join(CONFIG_DIR, 'settings.json');

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
 * Get default settings
 */
export function getDefaultSettings(): Settings {
  return { ...defaultSettings };
}

/**
 * Load settings from disk
 */
export async function loadSettings(): Promise<Settings> {
  try {
    await ensureConfigDir();
    const data = await readFile(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(data);

    // Validate with schema
    const result = settingsSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }

    // If validation fails, merge with defaults
    console.warn('[Settings] Invalid settings file, merging with defaults:', result.error);
    return mergeWithDefaults(parsed);
  } catch (error) {
    // File doesn't exist or is invalid, return defaults
    return getDefaultSettings();
  }
}

/**
 * Save settings to disk
 */
export async function saveSettings(settings: Settings): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureConfigDir();

    // Validate before saving
    const result = settingsSchema.safeParse(settings);
    if (!result.success) {
      return {
        success: false,
        error: `Invalid settings: ${result.error.message}`,
      };
    }

    await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('[Settings] Failed to save settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Merge partial settings with defaults
 */
function mergeWithDefaults(partial: Partial<Settings>): Settings {
  return {
    __version: 1,
    general: {
      ...defaultSettings.general,
      ...partial.general,
    },
    editor: {
      ...defaultSettings.editor,
      ...partial.editor,
    },
    appearance: {
      ...defaultSettings.appearance,
      ...partial.appearance,
    },
    backup: {
      ...defaultSettings.backup,
      ...partial.backup,
    },
    ai: {
      ...defaultSettings.ai,
      ...partial.ai,
    },
  };
}

/**
 * Migrate settings from old format (if needed)
 */
export function migrateSettings(oldSettings: Record<string, unknown>): Settings {
  // Currently only version 1 exists, but this is for future migrations
  const version = (oldSettings.__version as number) || 0;

  if (version < 1) {
    // Migrate from version 0 (no version field) to version 1
    return mergeWithDefaults(oldSettings as Partial<Settings>);
  }

  return mergeWithDefaults(oldSettings as Partial<Settings>);
}
