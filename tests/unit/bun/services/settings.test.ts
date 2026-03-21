/**
 * Settings Service 单元测试
 * 测试设置加载/保存/迁移功能
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  getDefaultSettings,
  loadSettings,
  saveSettings,
  migrateSettings,
} from '../../../../src/bun/services/settings';
import type { Settings } from '../../../../src/bun/services/settings';

describe('getDefaultSettings', () => {
  it('should return default settings', () => {
    const defaults = getDefaultSettings();
    expect(defaults.__version).toBe(1);
    expect(defaults.general).toBeDefined();
    expect(defaults.editor).toBeDefined();
    expect(defaults.appearance).toBeDefined();
  });

  it('should have autoSave enabled by default', () => {
    const defaults = getDefaultSettings();
    expect(defaults.general.autoSave).toBe(true);
  });

  it('should have autoSave enabled by default', () => {
    const defaults = getDefaultSettings();
    expect(defaults.general.autoSave).toBe(true);
  });

  it('should return valid settings object', () => {
    const defaults = getDefaultSettings();
    expect(typeof defaults).toBe('object');
    expect(defaults.__version).toBe(1);
  });
});

describe('loadSettings', () => {
  it('should return default settings when no settings file exists', async () => {
    const settings = await loadSettings();
    expect(settings.__version).toBe(1);
    expect(settings.general).toBeDefined();
  });

  it('should have required editor settings', async () => {
    const settings = await loadSettings();
    expect(settings.editor.fontSize).toBeGreaterThan(0);
    expect(settings.editor.lineHeight).toBeGreaterThan(0);
  });

  it('should have required appearance settings', async () => {
    const settings = await loadSettings();
    expect(['light', 'dark', 'system']).toContain(settings.appearance.theme);
  });
});

describe('saveSettings', () => {
  it('should validate settings before saving', async () => {
    const invalidSettings = { __version: 1 } as Settings;
    const result = await saveSettings(invalidSettings);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid');
  });

  it('should save valid settings', async () => {
    const validSettings: Settings = {
      __version: 1,
      general: {
        autoSave: true,
        autoSaveInterval: 3000,
      },
      editor: {
        fontSize: 15,
        lineHeight: 1.6,
      },
      appearance: {
        theme: 'system',
        sidebarWidth: 280,
      },
      backup: {
        enabled: true,
        maxVersions: 20,
        retentionDays: 30,
        recoveryInterval: 30000,
      },
    };
    const result = await saveSettings(validSettings);
    expect(result.success).toBe(true);
  });

  it('should reject invalid theme values', async () => {
    const invalidSettings = getDefaultSettings();
    (invalidSettings.appearance as any).theme = 'invalid-theme';
    const result = await saveSettings(invalidSettings);
    expect(result.success).toBe(false);
  });

  it('should reject negative fontSize', async () => {
    const invalidSettings = getDefaultSettings();
    invalidSettings.editor.fontSize = -1;
    const result = await saveSettings(invalidSettings);
    expect(result.success).toBe(false);
  });
});

describe('migrateSettings', () => {
  it('should migrate version 0 settings', () => {
    const oldSettings = {
      general: { language: 'zh-CN' },
      editor: { fontSize: 16 },
    };
    const migrated = migrateSettings(oldSettings);
    expect(migrated.__version).toBe(1);
    expect(migrated.general.language).toBe('zh-CN');
    expect(migrated.editor.fontSize).toBe(16);
  });

  it('should merge missing fields with defaults', () => {
    const partial = {
      __version: 0,
      general: { language: 'en' },
    } as any;
    const migrated = migrateSettings(partial);
    expect(migrated.general.autoSave).toBeDefined();
    expect(migrated.editor.fontSize).toBeDefined();
    expect(migrated.appearance.theme).toBeDefined();
  });

  it('should keep existing values when migrating', () => {
    const existing = {
      __version: 1,
      general: {
        autoSave: false,
        autoSaveInterval: 10000,
      },
      editor: {
        fontSize: 20,
        lineHeight: 2.0,
      },
      appearance: {
        theme: 'dark',
        sidebarWidth: 300,
      },
    };
    const migrated = migrateSettings(existing);
    expect(migrated.general.autoSave).toBe(false);
    expect(migrated.editor.fontSize).toBe(20);
    expect(migrated.appearance.theme).toBe('dark');
  });
});
