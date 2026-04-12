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

  it("changes retention days and persists the change", async () => {
    await withTrace("settings-retention-days", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("Backup");
      const initialValue = await settings.getRetentionDaysValue();
      const targetValue = initialValue === 30 ? 25 : 30;

      await settings.setRetentionDaysValue(targetValue);
      expect(await settings.getRetentionDaysValue()).toBe(targetValue);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));

      await settings.open();
      await settings.switchTab("Backup");
      expect(await settings.getRetentionDaysValue()).toBe(targetValue);

      await settings.setRetentionDaysValue(initialValue);
      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);

  it("changes recovery interval and persists the change", async () => {
    await withTrace("settings-recovery-interval", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("Backup");
      const initialValue = await settings.getRecoveryIntervalValue();
      const targetValue = initialValue === 30000 ? 25000 : 30000;

      await settings.setRecoveryIntervalValue(targetValue);
      expect(await settings.getRecoveryIntervalValue()).toBe(targetValue);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));

      await settings.open();
      await settings.switchTab("Backup");
      expect(await settings.getRecoveryIntervalValue()).toBe(targetValue);

      await settings.setRecoveryIntervalValue(initialValue);
      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);

  it("toggles ai enabled and persists the change", async () => {
    await withTrace("settings-ai-enabled", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("AI");
      const initialValue = await settings.getAIEnabledValue();
      const targetValue = !initialValue;

      await settings.toggleAIEnabled();
      expect(await settings.getAIEnabledValue()).toBe(targetValue);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));

      await settings.open();
      await settings.switchTab("AI");
      expect(await settings.getAIEnabledValue()).toBe(targetValue);

      if ((await settings.getAIEnabledValue()) !== initialValue) {
        await settings.toggleAIEnabled();
        await settings.save();
        await new Promise((r) => setTimeout(r, 500));
      }
    });
  }, 60000);

  it("closes settings dialog by clicking backdrop", async () => {
    await withTrace("settings-backdrop-close", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      expect(await settings.isOpen()).toBe(true);

      await page!.evaluate(`(() => {
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-center.justify-center.bg-black\\/50');
        if (backdrop) backdrop.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      expect(await settings.isOpen()).toBe(false);
    });
  }, 30000);

  it("toggles ai local only and persists the change", async () => {
    await withTrace("settings-ai-local-only", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("AI");

      // Ensure AI is enabled so local-only checkbox is visible
      if (!(await settings.getAIEnabledValue())) {
        await settings.toggleAIEnabled();
      }

      const initialValue = await settings.getAILocalOnlyValue();
      const targetValue = !initialValue;

      await settings.toggleAILocalOnly();
      expect(await settings.getAILocalOnlyValue()).toBe(targetValue);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));

      await settings.open();
      await settings.switchTab("AI");
      expect(await settings.getAILocalOnlyValue()).toBe(targetValue);

      if ((await settings.getAILocalOnlyValue()) !== initialValue) {
        await settings.toggleAILocalOnly();
      }
      // Restore AI enabled state if it was originally off
      if (!initialValue && !(await settings.getAIEnabledValue())) {
        await settings.toggleAIEnabled();
      }
      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);

  it("resets font size to default in editor tab", async () => {
    await withTrace("settings-reset-font", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("Editor");

      await settings.setFontSizeValue(20);
      expect(await settings.getFontSizeValue()).toBe(20);

      await settings.clickResetDefaults();
      expect(await settings.getFontSizeValue()).toBe(15);
      expect(await settings.getLineHeightValue()).toBe(1.65);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);

  it("cancelling settings discards unsaved changes", async () => {
    await withTrace("settings-cancel-discard", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      const originalValue = await settings.getAutoSaveValue();

      await settings.toggleAutoSave();
      const toggledValue = await settings.getAutoSaveValue();
      expect(toggledValue).toBe(!originalValue);

      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('div.z-50 button'));
        const cancelBtn = buttons.find(function(b) {
          return (b.textContent || '').trim() === 'Cancel';
        });
        if (cancelBtn) cancelBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      expect(await settings.isOpen()).toBe(false);

      await settings.open();
      const revertedValue = await settings.getAutoSaveValue();
      expect(revertedValue).toBe(originalValue);
      await settings.close();
    });
  }, 60000);

  it("resets line height to default in editor tab", async () => {
    await withTrace("settings-reset-line-height", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("Editor");

      await settings.setLineHeightValue(2.5);
      expect(await settings.getLineHeightValue()).toBe(2.5);

      await settings.clickResetDefaults();
      expect(await settings.getLineHeightValue()).toBe(1.65);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);

  it("resets max versions to default in backup tab", async () => {
    await withTrace("settings-reset-max-versions", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("Backup");

      await settings.setMaxVersionsValue(50);
      expect(await settings.getMaxVersionsValue()).toBe(50);

      await settings.clickResetDefaults();
      expect(await settings.getMaxVersionsValue()).toBe(20);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);

  it("resets retention days to default in backup tab", async () => {
    await withTrace("settings-reset-retention-days", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("Backup");

      await settings.setRetentionDaysValue(90);
      expect(await settings.getRetentionDaysValue()).toBe(90);

      await settings.clickResetDefaults();
      expect(await settings.getRetentionDaysValue()).toBe(30);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);

  it("resets recovery interval to default in backup tab", async () => {
    await withTrace("settings-reset-recovery-interval", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      await settings.switchTab("Backup");

      await settings.setRecoveryIntervalValue(60000);
      expect(await settings.getRecoveryIntervalValue()).toBe(60000);

      await settings.clickResetDefaults();
      expect(await settings.getRecoveryIntervalValue()).toBe(30000);

      await settings.save();
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);
});
