import { describe, it, expect } from "bun:test";
import { page } from "../e2e-setup";
import { EditorPage } from "./lib/page-objects/EditorPage";
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

describe("editor operations", () => {
  it("focuses editor without error", async () => {
    await withTrace("editor-focus", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.focus();
    });
  }, 30000);

  it("round-trips markdown content", async () => {
    await withTrace("editor-roundtrip", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("# Roundtrip");
      const content = await editor.getMarkdown();
      expect(content.trim()).toBe("# Roundtrip");
    });
  }, 30000);

  it("handles empty markdown", async () => {
    await withTrace("editor-empty", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("");
      const content = await editor.getMarkdown();
      expect(content.trim()).toBe("");
    });
  }, 30000);

  it("toggles sidebar via menu action", async () => {
    await withTrace("editor-toggle-sidebar", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.menuAction("view-toggle-sidebar");
      await new Promise((r) => setTimeout(r, 500));
      const hasSidebar = await page!.evaluate<boolean>(
        `(() => {
          const sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
          return sidebar ? (sidebar as HTMLElement).offsetWidth > 0 : false;
        })()`
      );
      expect(hasSidebar).toBe(true);

      await editor.menuAction("view-toggle-sidebar");
      await new Promise((r) => setTimeout(r, 500));
      const closed = await page!.evaluate<boolean>(
        `(() => {
          const sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
          return sidebar ? (sidebar as HTMLElement).offsetWidth === 0 : true;
        })()`
      );
      expect(closed).toBe(true);
    });
  }, 30000);

  it("toggles theme via menu action", async () => {
    await withTrace("editor-toggle-theme", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      const before = await page!.evaluate<string>(
        "document.documentElement.classList.contains('dark') ? 'dark' : 'light'"
      );

      await editor.menuAction("view-toggle-theme");
      await new Promise((r) => setTimeout(r, 500));

      const after = await page!.evaluate<string>(
        "document.documentElement.classList.contains('dark') ? 'dark' : 'light'"
      );
      expect(after).not.toBe(before);

      // Toggle back to restore original theme
      await editor.menuAction("view-toggle-theme");
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 30000);

  it("toggles toolbar via menu action", async () => {
    await withTrace("editor-toggle-toolbar", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.menuAction("view-toggle-toolbar");
      await new Promise((r) => setTimeout(r, 500));
      const hasToolbar = await page!.evaluate<boolean>(
        "Boolean(document.querySelector('.border-b.bg-background.select-none'))"
      );
      expect(hasToolbar).toBe(true);

      await editor.menuAction("view-toggle-toolbar");
      await new Promise((r) => setTimeout(r, 500));
      const gone = await page!.evaluate<boolean>(
        "Boolean(document.querySelector('.border-b.bg-background.select-none'))"
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("creates a new file via menu action", async () => {
    await withTrace("editor-file-new", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("# Existing");
      expect(await editor.getMarkdown()).toContain("Existing");
      await editor.menuAction("file-new");
      await new Promise((r) => setTimeout(r, 500));
      const content = await editor.getMarkdown();
      expect(content.trim()).toBe("");
    });
  }, 30000);
});
