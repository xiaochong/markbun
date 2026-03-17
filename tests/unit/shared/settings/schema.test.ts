/**
 * Settings Schema 单元测试
 * 测试设置 schema 和默认值
 */
import { describe, it, expect } from 'bun:test';
import { settingsSchema, defaultSettings } from '../../../../src/shared/settings/schema';

describe('settingsSchema', () => {
  it('should validate correct settings', () => {
    const validSettings = {
      __version: 1,
      general: {
        autoSave: true,
        autoSaveInterval: 2000,
      },
      editor: {
        fontSize: 15,
        lineHeight: 1.65,
      },
      appearance: {
        theme: 'system',
        sidebarWidth: 280,
      },
    };

    const result = settingsSchema.safeParse(validSettings);
    expect(result.success).toBe(true);
  });

  it('should apply default values for version field', () => {
    const partialSettings = {
      general: {
        autoSave: true,
        autoSaveInterval: 2000,
      },
      editor: {
        fontSize: 15,
        lineHeight: 1.65,
      },
      appearance: {
        theme: 'system' as const,
        sidebarWidth: 280,
      },
    };

    const result = settingsSchema.parse(partialSettings);
    expect(result.__version).toBe(1);
    expect(result.general.autoSave).toBe(true);
    expect(result.general.autoSaveInterval).toBe(2000);
    expect(result.editor.fontSize).toBe(15);
    expect(result.editor.lineHeight).toBe(1.65);
    expect(result.appearance.theme).toBe('system');
    expect(result.appearance.sidebarWidth).toBe(280);
  });

  it('should validate autoSaveInterval range', () => {
    const invalidSettings = {
      general: {
        autoSave: true,
        autoSaveInterval: 100, // Too low
      },
    };

    const result = settingsSchema.safeParse(invalidSettings);
    expect(result.success).toBe(false);
  });

  it('should validate fontSize range', () => {
    const invalidSettings = {
      editor: {
        fontSize: 5, // Too low
        lineHeight: 1.65,
      },
    };

    const result = settingsSchema.safeParse(invalidSettings);
    expect(result.success).toBe(false);
  });

  it('should validate theme enum', () => {
    const invalidSettings = {
      appearance: {
        theme: 'invalid-theme',
        sidebarWidth: 280,
      },
    };

    const result = settingsSchema.safeParse(invalidSettings);
    expect(result.success).toBe(false);
  });

  it('should accept valid theme values', () => {
    const themes = ['light', 'dark', 'system'] as const;
    themes.forEach((theme) => {
      const settings = {
        __version: 1,
        general: {
          autoSave: true,
          autoSaveInterval: 2000,
        },
        editor: {
          fontSize: 15,
          lineHeight: 1.65,
        },
        appearance: {
          theme,
          sidebarWidth: 280,
        },
      };
      const result = settingsSchema.safeParse(settings);
      expect(result.success).toBe(true);
    });
  });
});

describe('defaultSettings', () => {
  it('should have correct structure', () => {
    expect(defaultSettings.__version).toBe(1);
    expect(defaultSettings.general).toBeDefined();
    expect(defaultSettings.editor).toBeDefined();
    expect(defaultSettings.appearance).toBeDefined();
  });

  it('should match schema defaults', () => {
    const parsed = settingsSchema.parse(defaultSettings);
    expect(defaultSettings.__version).toBe(parsed.__version);
    expect(defaultSettings.general.autoSave).toBe(parsed.general.autoSave);
    expect(defaultSettings.editor.fontSize).toBe(parsed.editor.fontSize);
    expect(defaultSettings.appearance.theme).toBe(parsed.appearance.theme);
  });
});
