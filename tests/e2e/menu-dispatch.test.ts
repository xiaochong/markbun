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
      expect(await dialog.isDialogOpen()).toBe(false);
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
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-center.justify-center');
        if (backdrop && backdrop.classList.contains('bg-black/50')) backdrop.click();
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
      const isOpen = await dialog.isDialogOpen();
      if (isOpen) {
        const debug = await page!.evaluate<string>(`(() => {
          return Array.from(document.querySelectorAll('.z-50')).filter(function(el) {
            return !el.querySelector('input[placeholder]');
          }).map(function(el) {
            return el.className + " | " + (el.textContent || '').slice(0, 100);
          }).join('\\n');
        })()`);
        console.log('[DEBUG] Dialogs still open after OK:', debug);
      }
      expect(isOpen).toBe(false);

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
      await quickOpen.typeQuery("Preferences");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const settingsBtn = buttons.find((b) => (b.textContent || '').includes('Preferences'));
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
      await quickOpen.typeQuery("History");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const historyBtn = buttons.find((b) => (b.textContent || '').includes('History'));
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

  it("closes file history dialog by clicking backdrop", async () => {
    await withTrace("menu-file-history-backdrop", async () => {
      const dialog = new DialogPage(page!);
      await page!.evaluate(`(() => {
        const listeners = window.__electrobunListeners && window.__electrobunListeners['open-file-history'] || [];
        listeners.forEach((cb) => cb());
      })()`);
      await dialog.waitForDialogContaining("File History");
      expect(await dialog.isDialogOpen()).toBe(true);

      await page!.evaluate(`(() => {
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-center.justify-center');
        if (backdrop && backdrop.classList.contains('bg-black/50')) backdrop.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      expect(await dialog.isDialogOpen()).toBe(false);
    });
  }, 30000);

  it("opens search bar via quick open command", async () => {
    await withTrace("menu-quick-open-search", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("Find");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const findBtn = buttons.find((b) => (b.textContent || '').includes('Find'));
        if (findBtn) findBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      const hasSearchBar = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('input[placeholder="Find"]'))`
      );
      expect(hasSearchBar).toBe(true);
    });
  }, 30000);

  it("opens find and replace via quick open command", async () => {
    await withTrace("menu-quick-open-find-replace", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("Replace");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const replaceBtn = buttons.find((b) => (b.textContent || '').includes('Replace'));
        if (replaceBtn) replaceBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      const hasReplaceInput = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('input[placeholder="Replace"]'))`
      );
      expect(hasReplaceInput).toBe(true);
    });
  }, 30000);

  it("toggles sidebar via quick open command", async () => {
    await withTrace("menu-quick-open-sidebar", async () => {
      const quickOpen = new QuickOpenPage(page!);

      // UI state is persisted, so the sidebar may already be open.
      // Ensure a consistent starting state (closed) before verifying toggles.
      const startsOpen = await page!.evaluate<boolean>(
        `(() => {
          const sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
          return sidebar ? sidebar.offsetWidth > 0 : false;
        })()`
      );
      if (startsOpen) {
        await quickOpen.open();
        await quickOpen.typeQuery("Sidebar");
        await page!.evaluate(`(() => {
          const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
          const btn = buttons.find((b) => (b.textContent || '').includes('Sidebar'));
          if (btn) btn.click();
        })()`);
        await new Promise((r) => setTimeout(r, 500));
      }

      await quickOpen.open();
      await quickOpen.typeQuery("Sidebar");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const btn = buttons.find((b) => (b.textContent || '').includes('Sidebar'));
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));
      const hasSidebar = await page!.evaluate<boolean>(
        `(() => {
          const sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
          return sidebar ? sidebar.offsetWidth > 0 : false;
        })()`
      );
      expect(hasSidebar).toBe(true);

      await quickOpen.open();
      await quickOpen.typeQuery("Sidebar");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const btn = buttons.find((b) => (b.textContent || '').includes('Sidebar'));
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));
      const gone = await page!.evaluate<boolean>(
        `(() => {
          const sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
          return sidebar ? sidebar.offsetWidth > 0 : false;
        })()`
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("toggles toolbar via quick open command", async () => {
    await withTrace("menu-quick-open-toolbar", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("Tool Bar");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const btn = buttons.find((b) => (b.textContent || '').includes('Tool Bar'));
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));
      const hasToolbar = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('.border-b.bg-background.select-none'))`
      );
      expect(hasToolbar).toBe(true);

      await quickOpen.open();
      await quickOpen.typeQuery("Tool Bar");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const btn = buttons.find((b) => (b.textContent || '').includes('Tool Bar'));
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));
      const gone = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('.border-b.bg-background.select-none'))`
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("toggles status bar via quick open command", async () => {
    await withTrace("menu-quick-open-statusbar", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("Status Bar");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const btn = buttons.find((b) => (b.textContent || '').includes('Status Bar'));
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));
      const hasStatusBar = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('.flex.items-center.justify-between.px-4.py-1.border-t.bg-background'))`
      );
      expect(hasStatusBar).toBe(true);

      await quickOpen.open();
      await quickOpen.typeQuery("Status Bar");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const btn = buttons.find((b) => (b.textContent || '').includes('Status Bar'));
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));
      const gone = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('.flex.items-center.justify-between.px-4.py-1.border-t.bg-background'))`
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("toggles AI panel via quick open command", async () => {
    await withTrace("menu-quick-open-ai-panel", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("AI Panel");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const btn = buttons.find((b) => (b.textContent || '').includes('AI Panel'));
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));
      const hasPanel = await page!.evaluate<boolean>(
        `(() => {
          const body = document.body.innerText || '';
          return body.includes('AI Not Configured') || body.includes('Open AI Settings');
        })()`
      );
      expect(hasPanel).toBe(true);

      await quickOpen.open();
      await quickOpen.typeQuery("AI Panel");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const btn = buttons.find((b) => (b.textContent || '').includes('AI Panel'));
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));
      const gone = await page!.evaluate<boolean>(
        `(() => {
          const body = document.body.innerText || '';
          return body.includes('AI Not Configured') || body.includes('Open AI Settings');
        })()`
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("toggles title bar via quick open command", async () => {
    await withTrace("menu-quick-open-titlebar", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("Title Bar");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const btn = buttons.find((b) => (b.textContent || '').includes('Title Bar'));
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));
      const hasTitleBar = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('.flex.items-center.justify-center.h-8.px-4.bg-background.border-b.text-sm.select-none'))`
      );
      expect(hasTitleBar).toBe(true);

      await quickOpen.open();
      await quickOpen.typeQuery("Title Bar");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const btn = buttons.find((b) => (b.textContent || '').includes('Title Bar'));
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));
      const gone = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('.flex.items-center.justify-center.h-8.px-4.bg-background.border-b.text-sm.select-none'))`
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("toggles source mode via quick open command", async () => {
    await withTrace("menu-quick-open-source-mode", async () => {
      const quickOpen = new QuickOpenPage(page!);
      await quickOpen.open();
      await quickOpen.typeQuery("Source Mode");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const btn = buttons.find((b) => (b.textContent || '').includes('Source Mode'));
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));
      const hasSourceEditor = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('.source-editor-container'))`
      );
      expect(hasSourceEditor).toBe(true);

      await quickOpen.open();
      await quickOpen.typeQuery("Source Mode");
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
        const btn = buttons.find((b) => (b.textContent || '').includes('Source Mode'));
        if (btn) btn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 500));
      const gone = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('.source-editor-container'))`
      );
      expect(gone).toBe(false);
    });
  }, 30000);
});
