import { describe, it, expect } from "bun:test";
import { page } from "../e2e-setup";
import { DialogPage } from "./lib/page-objects/DialogPage";
import { QuickOpenPage } from "./lib/page-objects/QuickOpenPage";
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

describe("menu dispatch", () => {
  it("opens about dialog via menu action", async () => {
    await withTrace("menu-about", async () => {
      const dialog = new DialogPage(page!);
      await page!.evaluate(`(() => {
        const listeners = window.__electrobunListeners && window.__electrobunListeners['show-about'] || [];
        listeners.forEach((cb) => cb());
      })()`);
      await dialog.waitForDialogContaining("MarkBun");
      expect(await dialog.isDialogOpen()).toBe(true);
      await dialog.clickButton("OK");
      await new Promise((r) => setTimeout(r, 300));
      const stillOpen = await page!.evaluate<boolean>(
        "Boolean(document.querySelector('.fixed.inset-0.z-50'))"
      );
      expect(stillOpen).toBe(false);
    });
  }, 30000);

  it("opens quick open via menu action", async () => {
    await withTrace("menu-quick-open", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      expect(await quickOpen.getResultCount()).toBeGreaterThanOrEqual(0);
      await quickOpen.close();
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("opens settings via menu action", async () => {
    await withTrace("menu-settings", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      expect(await settings.isOpen()).toBe(true);
      await settings.close();
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("quick open shows recommended commands by default", async () => {
    await withTrace("menu-quick-open-defaults", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      const count = await quickOpen.getResultCount();
      expect(count).toBeGreaterThan(0);
      await page!.evaluate(`(() => {
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-start.justify-center');
        if (backdrop) backdrop.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("reopens about dialog after closing", async () => {
    await withTrace("menu-about-reopen", async () => {
      const dialog = new DialogPage(page!);
      await page!.evaluate(`(() => {
        const listeners = window.__electrobunListeners && window.__electrobunListeners['show-about'] || [];
        listeners.forEach((cb) => cb());
      })()`);
      await dialog.waitForDialogContaining("MarkBun");
      await dialog.clickButton("OK");
      await new Promise((r) => setTimeout(r, 300));
      expect(await dialog.isDialogOpen()).toBe(false);

      await page!.evaluate(`(() => {
        const listeners = window.__electrobunListeners && window.__electrobunListeners['show-about'] || [];
        listeners.forEach((cb) => cb());
      })()`);
      await dialog.waitForDialogContaining("MarkBun");
      expect(await dialog.isDialogOpen()).toBe(true);
      await dialog.clickButton("OK");
      await new Promise((r) => setTimeout(r, 300));
      expect(await dialog.isDialogOpen()).toBe(false);
    });
  }, 30000);
});
