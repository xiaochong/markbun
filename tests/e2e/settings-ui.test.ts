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
});
