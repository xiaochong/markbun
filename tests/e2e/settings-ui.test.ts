import { describe, it, expect } from "bun:test";
import { page } from "../e2e-setup";
import { SettingsPage } from "./lib/page-objects/SettingsPage";
import { collectTrace } from "./lib/trace";

const WORKSPACE_DIR = process.env.MARKBUN_E2E_HOME || "";

async function withTrace<T>(testName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.log("[trace] Collecting failure trace...");
    const traceDir = await collectTrace(testName, {
      page: page!,
      workspaceDir: WORKSPACE_DIR,
    });
    console.log(`[trace] Saved to ${traceDir}`);
    throw err;
  }
}

describe("settings ui", () => {
  it("toggles auto-save and persists the change", async () => {
    await withTrace("settings-auto-save", async () => {
      const settings = new SettingsPage(page!);

      // 1. Open settings and read the current auto-save value
      await settings.open();
      const initialValue = await settings.getAutoSaveValue();

      // 2. Toggle to the opposite state
      await settings.toggleAutoSave();
      const toggledValue = await settings.getAutoSaveValue();
      expect(toggledValue).toBe(!initialValue);

      // 3. Save and close
      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
      expect(await settings.isOpen()).toBe(false);

      // 4. Re-open settings and verify the toggled state persisted
      await settings.open();
      const persistedValue = await settings.getAutoSaveValue();
      expect(persistedValue).toBe(!initialValue);

      // 5. Restore original state and close
      if (persistedValue !== initialValue) {
        await settings.toggleAutoSave();
        await settings.save();
        await new Promise((r) => setTimeout(r, 500));
      }
    });
  }, 60000);

  it("switches tabs in settings dialog", async () => {
    await withTrace("settings-tabs", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();

      // Switch to Editor tab
      await settings.switchTab("Editor");
      await page!.evaluate(`(() => {
        const dialog = document.querySelector('.z-50');
        const text = dialog && dialog.textContent ? dialog.textContent : '';
        if (!text.includes('Font Size')) {
          throw new Error('Editor tab content not found');
        }
      })()`);

      // Switch to Appearance tab
      await settings.switchTab("Appearance");
      await page!.evaluate(`(() => {
        const dialog = document.querySelector('.z-50');
        const text = dialog && dialog.textContent ? dialog.textContent : '';
        if (!text.includes('Theme')) {
          throw new Error('Appearance tab content not found');
        }
      })()`);

      await settings.close();
    });
  }, 30000);

  it("switches to backup tab in settings dialog", async () => {
    await withTrace("settings-backup-tab", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();

      await settings.switchTab("Backup");
      await page!.evaluate(`(() => {
        const dialog = document.querySelector('.z-50');
        const text = dialog && dialog.textContent ? dialog.textContent : '';
        if (!text.includes('Version History')) {
          throw new Error('Backup tab content not found');
        }
      })()`);

      await settings.close();
    });
  }, 30000);

  it("switches to AI tab in settings dialog", async () => {
    await withTrace("settings-ai-tab", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();

      await settings.switchTab("AI");
      await page!.evaluate(`(() => {
        const dialog = document.querySelector('.z-50');
        const text = dialog && dialog.textContent ? dialog.textContent : '';
        if (!text.includes('AI Assistant')) {
          throw new Error('AI tab content not found');
        }
      })()`);

      await settings.close();
    });
  }, 30000);

  it("switches to language tab in settings dialog", async () => {
    await withTrace("settings-language-tab", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();

      await settings.switchTab("Language");
      await page!.evaluate(`(() => {
        const dialog = document.querySelector('.z-50');
        const text = dialog && dialog.textContent ? dialog.textContent : '';
        if (!text.includes('Choose the display language')) {
          throw new Error('Language tab content not found');
        }
      })()`);

      await settings.close();
    });
  }, 30000);

  it("toggles version history and persists the change", async () => {
    await withTrace("settings-version-history", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("Backup");
      const initialValue = await settings.getBackupEnabledValue();

      await settings.toggleBackupEnabled();
      const toggledValue = await settings.getBackupEnabledValue();
      expect(toggledValue).toBe(!initialValue);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
      expect(await settings.isOpen()).toBe(false);

      await settings.open();
      await settings.switchTab("Backup");
      const persistedValue = await settings.getBackupEnabledValue();
      expect(persistedValue).toBe(!initialValue);

      if (persistedValue !== initialValue) {
        await settings.toggleBackupEnabled();
        await settings.save();
        await new Promise((r) => setTimeout(r, 500));
      }
    });
  }, 60000);

  it("switches to general tab in settings dialog", async () => {
    await withTrace("settings-general-tab", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("General");
      await page!.evaluate(`(() => {
        const dialog = document.querySelector('.z-50');
        const text = dialog && dialog.textContent ? dialog.textContent : '';
        if (!text.includes('Auto Save')) {
          throw new Error('General tab content not found');
        }
      })()`);
      await settings.close();
    });
  }, 30000);

  it("switches theme via settings dialog appearance tab", async () => {
    await withTrace("settings-theme-switch", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("Appearance");

      const before = await page!.evaluate<string>(
        "document.documentElement.classList.contains('dark') ? 'dark' : 'light'"
      );
      const target = before === 'dark' ? 'Light' : 'Dark';

      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('.z-50 button'));
        const btn = buttons.find((b) => (b.textContent || '').trim() === ${JSON.stringify(target)});
        if (btn) (btn as HTMLElement).click();
      })()`);
      await settings.save();
      await new Promise((r) => setTimeout(r, 500));

      const after = await page!.evaluate<string>(
        "document.documentElement.classList.contains('dark') ? 'dark' : 'light'"
      );
      expect(after).not.toBe(before);

      // Restore original theme
      await settings.open();
      await settings.switchTab("Appearance");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('.z-50 button'));
        const btn = buttons.find((b) => (b.textContent || '').trim() === ${JSON.stringify(before === 'dark' ? 'Dark' : 'Light')});
        if (btn) (btn as HTMLElement).click();
      })()`);
      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);

  it("changes font size and persists the change", async () => {
    await withTrace("settings-font-size", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("Editor");
      const initialValue = await settings.getFontSizeValue();
      const targetValue = initialValue === 20 ? 18 : 20;

      await settings.setFontSizeValue(targetValue);
      expect(await settings.getFontSizeValue()).toBe(targetValue);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));

      await settings.open();
      await settings.switchTab("Editor");
      expect(await settings.getFontSizeValue()).toBe(targetValue);

      await settings.setFontSizeValue(initialValue);
      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);

  it("changes line height and persists the change", async () => {
    await withTrace("settings-line-height", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("Editor");
      const initialValue = await settings.getLineHeightValue();
      const targetValue = initialValue === 2.0 ? 1.8 : 2.0;

      await settings.setLineHeightValue(targetValue);
      expect(await settings.getLineHeightValue()).toBe(targetValue);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));

      await settings.open();
      await settings.switchTab("Editor");
      expect(await settings.getLineHeightValue()).toBe(targetValue);

      await settings.setLineHeightValue(initialValue);
      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);

  it("switches language and persists the change", async () => {
    await withTrace("settings-language", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("Language");
      const initialLang = await settings.getCurrentLanguage();
      const targetLang = initialLang === 'zh-CN' ? 'en' : 'zh-CN';
      const targetLabel = targetLang === 'zh-CN' ? '简体中文' : 'English';

      await settings.switchLanguage(targetLabel);
      expect(await settings.getCurrentLanguage()).toBe(targetLang);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));

      // Re-open and verify persisted
      await settings.open();
      await settings.switchTab("Language");
      expect(await settings.getCurrentLanguage()).toBe(targetLang);

      // Restore original
      const restoreLabel = initialLang === 'zh-CN' ? '简体中文' : 'English';
      await settings.switchLanguage(restoreLabel);
      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);

  it("changes max versions and persists the change", async () => {
    await withTrace("settings-max-versions", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("Backup");
      const initialValue = await settings.getMaxVersionsValue();
      const targetValue = initialValue === 30 ? 25 : 30;

      await settings.setMaxVersionsValue(targetValue);
      expect(await settings.getMaxVersionsValue()).toBe(targetValue);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));

      await settings.open();
      await settings.switchTab("Backup");
      expect(await settings.getMaxVersionsValue()).toBe(targetValue);

      await settings.setMaxVersionsValue(initialValue);
      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);
});
