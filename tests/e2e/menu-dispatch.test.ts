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

  it("closes about dialog by clicking backdrop", async () => {
    await withTrace("menu-about-backdrop", async () => {
      const dialog = new DialogPage(page!);
      await page!.evaluate(`(() => {
        const listeners = window.__electrobunListeners && window.__electrobunListeners['show-about'] || [];
        listeners.forEach((cb) => cb());
      })()`);
      await dialog.waitForDialogContaining("MarkBun");
      expect(await dialog.isDialogOpen()).toBe(true);

      await page!.evaluate(`(() => {
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-center.justify-center.bg-black\\/50');
        if (backdrop) backdrop.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      expect(await dialog.isDialogOpen()).toBe(false);
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

  it("reopens quick open after closing", async () => {
    await withTrace("menu-quick-open-reopen", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      expect(await quickOpen.getResultCount()).toBeGreaterThanOrEqual(0);
      await page!.evaluate(`(() => {
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-start.justify-center');
        if (backdrop) backdrop.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));

      await quickOpen.open();
      expect(await quickOpen.getResultCount()).toBeGreaterThanOrEqual(0);
      await page!.evaluate(`(() => {
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-start.justify-center');
        if (backdrop) backdrop.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("reopens settings dialog after closing", async () => {
    await withTrace("menu-settings-reopen", async () => {
      const settings = new SettingsPage(page!);
      await settings.open();
      expect(await settings.isOpen()).toBe(true);

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
      expect(await settings.isOpen()).toBe(true);

      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('div.z-50 button'));
        const cancelBtn = buttons.find(function(b) {
          return (b.textContent || '').trim() === 'Cancel';
        });
        if (cancelBtn) cancelBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      expect(await settings.isOpen()).toBe(false);
    });
  }, 30000);

  it("filters quick open commands when typing", async () => {
    await withTrace("menu-quick-open-filter", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("Strong");
      const count = await quickOpen.getResultCount();
      expect(count).toBeGreaterThanOrEqual(1);
      await page!.evaluate(`(() => {
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-start.justify-center');
        if (backdrop) backdrop.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("opens file history dialog via menu action", async () => {
    await withTrace("menu-file-history", async () => {
      const dialog = new DialogPage(page!);
      await page!.evaluate(`(() => {
        const listeners = window.__electrobunListeners && window.__electrobunListeners['open-file-history'] || [];
        listeners.forEach((cb) => cb());
      })()`);
      await dialog.waitForDialogContaining("File History");
      expect(await dialog.isDialogOpen()).toBe(true);
      await dialog.clickButton("Close");
      await new Promise((r) => setTimeout(r, 300));
      expect(await dialog.isDialogOpen()).toBe(false);
    });
  }, 30000);

  it("opens about dialog via quick open command", async () => {
    await withTrace("menu-quick-open-about", async () => {
      const quickOpen = new QuickOpenPage(page!);
      const dialog = new DialogPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("About");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const aboutBtn = buttons.find((b) => (b.textContent || '').includes('About'));
        if (aboutBtn) aboutBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      await dialog.waitForDialogContaining("MarkBun");
      expect(await dialog.isDialogOpen()).toBe(true);
      await dialog.clickButton("OK");
      await new Promise((r) => setTimeout(r, 300));
      expect(await dialog.isDialogOpen()).toBe(false);
    });
  }, 30000);

  it("opens settings via quick open command", async () => {
    await withTrace("menu-quick-open-settings", async () => {
      const quickOpen = new QuickOpenPage(page!);
      const settings = new SettingsPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("Settings");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const settingsBtn = buttons.find((b) => (b.textContent || '').includes('Settings'));
        if (settingsBtn) settingsBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      expect(await settings.isOpen()).toBe(true);
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('div.z-50 button'));
        const cancelBtn = buttons.find(function(b) {
          return (b.textContent || '').trim() === 'Cancel';
        });
        if (cancelBtn) cancelBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      expect(await settings.isOpen()).toBe(false);
    });
  }, 30000);

  it("shows commands group header in quick open", async () => {
    await withTrace("menu-quick-open-header", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      const hasHeader = await page!.evaluate<boolean>(
        `(() => {
          const text = document.body.innerText || '';
          return text.includes('Commands');
        })()`
      );
      expect(hasHeader).toBe(true);
      await page!.evaluate(`(() => {
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-start.justify-center');
        if (backdrop) backdrop.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("quick open yields no results for nonsense query", async () => {
    await withTrace("menu-quick-open-empty", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("xyznotfound12345");
      const count = await quickOpen.getResultCount();
      expect(count).toBe(0);
      await page!.evaluate(`(() => {
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-start.justify-center');
        if (backdrop) backdrop.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("closes quick open by clicking backdrop", async () => {
    await withTrace("menu-quick-open-backdrop", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      expect(await quickOpen.getResultCount()).toBeGreaterThan(0);

      await page!.evaluate(`(() => {
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-start.justify-center');
        if (backdrop) backdrop.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      const count = await quickOpen.getResultCount();
      expect(count).toBe(0);
    });
  }, 30000);

  it("quick open returns results for partial command match", async () => {
    await withTrace("menu-quick-open-partial", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("Hist");
      const count = await quickOpen.getResultCount();
      expect(count).toBeGreaterThanOrEqual(1);
      await page!.evaluate(`(() => {
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-start.justify-center');
        if (backdrop) backdrop.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("quick open returns zero results for unmatched partial query", async () => {
    await withTrace("menu-quick-open-unmatched-partial", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("Xyz");
      const count = await quickOpen.getResultCount();
      expect(count).toBe(0);
      await page!.evaluate(`(() => {
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-start.justify-center');
        if (backdrop) backdrop.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("opens file history via quick open command", async () => {
    await withTrace("menu-quick-open-file-history", async () => {
      const quickOpen = new QuickOpenPage(page!);
      const dialog = new DialogPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("File History");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const historyBtn = buttons.find((b) => (b.textContent || '').includes('File History'));
        if (historyBtn) historyBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      await dialog.waitForDialogContaining("File History");
      expect(await dialog.isDialogOpen()).toBe(true);
      await dialog.clickButton("Close");
      await new Promise((r) => setTimeout(r, 300));
      expect(await dialog.isDialogOpen()).toBe(false);
    });
  }, 30000);
});
