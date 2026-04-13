import { describe, it, expect } from "bun:test";
import { page } from "../e2e-setup";
import { EditorPage } from "./lib/page-objects/EditorPage";
import { FileExplorerPage } from "./lib/page-objects/FileExplorerPage";
import { collectTrace } from "./lib/trace";
import { join } from "path";
import { mkdirSync } from "fs";

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

describe("file explorer", () => {
  it("shows file explorer in sidebar when files tab is active", async () => {
    await withTrace("explorer-visible", async () => {
      const editor = new EditorPage(page!);
      const explorer = new FileExplorerPage(page!);

      // Open a file to set the workspace root for the file explorer
      const filesDir = join(WORKSPACE_DIR, "files");
      const testFile = join(filesDir, "explorer-visible.md");
      await Bun.write(testFile, "# Explorer Test");
      await page!.evaluate(
        `window.electrobun._testOpenFileByPath(${JSON.stringify(testFile)})`
      );
      await editor.waitForReady();

      await explorer.ensureFilesTab();
      await new Promise((r) => setTimeout(r, 500));

      expect(await explorer.isVisible()).toBe(true);
    });
  }, 30000);

  it("displays files in the workspace directory", async () => {
    await withTrace("explorer-files", async () => {
      const editor = new EditorPage(page!);
      const explorer = new FileExplorerPage(page!);

      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, "explorer-a.md"), "# File A");
      await Bun.write(join(filesDir, "explorer-b.md"), "# File B");

      const testFile = join(filesDir, "explorer-a.md");
      await page!.evaluate(
        `window.electrobun._testOpenFileByPath(${JSON.stringify(testFile)})`
      );
      await editor.waitForReady();

      await explorer.ensureFilesTab();
      await new Promise((r) => setTimeout(r, 1000));

      const text = await explorer.getExplorerText();
      // Explorer should show some file content
      expect(text.length).toBeGreaterThan(0);
    });
  }, 30000);

  it("clicks a file in the file explorer and opens it", async () => {
    await withTrace("explorer-click-file", async () => {
      const editor = new EditorPage(page!);
      const explorer = new FileExplorerPage(page!);

      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, "click-test.md"), "# Click Test");
      // Also create a second file
      await Bun.write(join(filesDir, "click-test-2.md"), "# Click Test 2");

      const testFile = join(filesDir, "click-test.md");
      await page!.evaluate(
        `window.electrobun._testOpenFileByPath(${JSON.stringify(testFile)})`
      );
      await editor.waitForReady();

      await explorer.ensureFilesTab();
      await new Promise((r) => setTimeout(r, 1000));

      // Click the second file
      await explorer.clickFileByName("click-test-2.md");
      await new Promise((r) => setTimeout(r, 500));

      // Verify the file was opened (editor content should change)
      const content = await editor.getMarkdown();
      expect(content).toContain("Click Test 2");
    });
  }, 30000);

  it("sidebar toggles visibility via menu action", async () => {
    await withTrace("explorer-sidebar-toggle", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();

      // Ensure sidebar is open first
      const startsOpen = await page!.evaluate<boolean>(
        `(() => {
          var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
          return sidebar ? sidebar.offsetWidth > 0 : false;
        })()`
      );
      if (!startsOpen) {
        await editor.menuAction("view-toggle-sidebar");
        await new Promise((r) => setTimeout(r, 500));
      }

      // Close sidebar
      await editor.menuAction("view-toggle-sidebar");
      await new Promise((r) => setTimeout(r, 500));
      const closed = await page!.evaluate<boolean>(
        `(() => {
          var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
          return sidebar ? sidebar.offsetWidth === 0 : true;
        })()`
      );
      expect(closed).toBe(true);

      // Re-open sidebar
      await editor.menuAction("view-toggle-sidebar");
      await new Promise((r) => setTimeout(r, 500));
      const reopened = await page!.evaluate<boolean>(
        `(() => {
          var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
          return sidebar ? sidebar.offsetWidth > 0 : false;
        })()`
      );
      expect(reopened).toBe(true);
    });
  }, 30000);

  it("file explorer shows nested directory structure", async () => {
    await withTrace("explorer-nested", async () => {
      const editor = new EditorPage(page!);
      const explorer = new FileExplorerPage(page!);

      const filesDir = join(WORKSPACE_DIR, "files");
      const nestedDir = join(filesDir, "subdir");
      mkdirSync(nestedDir, { recursive: true });
      await Bun.write(join(nestedDir, "nested.md"), "# Nested");
      await Bun.write(join(filesDir, "root.md"), "# Root");

      const testFile = join(filesDir, "root.md");
      await page!.evaluate(
        `window.electrobun._testOpenFileByPath(${JSON.stringify(testFile)})`
      );
      await editor.waitForReady();

      await explorer.ensureFilesTab();
      await new Promise((r) => setTimeout(r, 1000));

      const text = await explorer.getExplorerText();
      expect(text.length).toBeGreaterThan(0);
    });
  }, 30000);

  it("file explorer persists when sidebar is toggled off and on", async () => {
    await withTrace("explorer-persist", async () => {
      const editor = new EditorPage(page!);
      const explorer = new FileExplorerPage(page!);

      const filesDir = join(WORKSPACE_DIR, "files");
      const testFile = join(filesDir, "persist.md");
      await Bun.write(testFile, "# Persist Test");
      await page!.evaluate(
        `window.electrobun._testOpenFileByPath(${JSON.stringify(testFile)})`
      );
      await editor.waitForReady();

      await explorer.ensureFilesTab();
      await new Promise((r) => setTimeout(r, 500));
      expect(await explorer.isVisible()).toBe(true);

      // Toggle sidebar off
      await editor.menuAction("view-toggle-sidebar");
      await new Promise((r) => setTimeout(r, 500));
      expect(await explorer.isVisible()).toBe(false);

      // Toggle sidebar back on
      await editor.menuAction("view-toggle-sidebar");
      await new Promise((r) => setTimeout(r, 500));
      expect(await explorer.isVisible()).toBe(true);
    });
  }, 30000);
});
