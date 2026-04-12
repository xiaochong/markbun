import { describe, it, expect } from "bun:test";
import { page } from "../e2e-setup";
import { QuickOpenPage } from "./lib/page-objects/QuickOpenPage";
import { EditorPage } from "./lib/page-objects/EditorPage";
import { collectTrace } from "./lib/trace";
import { join } from "path";

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

describe("quick open search", () => {
  it("searches files and selects a result", async () => {
    await withTrace("quick-open-search", async () => {
      const quickOpen = new QuickOpenPage(page!);
      const editor = new EditorPage(page!);

      // Seed two files in workspace
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, "alpha.md"), "# Alpha");
      await Bun.write(join(filesDir, "beta.md"), "## Beta");

      const alphaPath = join(filesDir, "alpha.md");
      const betaPath = join(filesDir, "beta.md");

      // Add files to recent files via _test RPC so they appear in quick open
      const openAlpha = await page!.evaluate<{ success: boolean; path?: string; content?: string; error?: string }>(
        `window.electrobun._testOpenFileByPath(${JSON.stringify(alphaPath)})`
      );
      expect(openAlpha.success).toBe(true);

      const openBeta = await page!.evaluate<{ success: boolean; path?: string; content?: string; error?: string }>(
        `window.electrobun._testOpenFileByPath(${JSON.stringify(betaPath)})`
      );
      expect(openBeta.success).toBe(true);

      // Open quick open
      await quickOpen.open();
      await quickOpen.waitForOpen();

      // Without query, should show results (recent files)
      const initialCount = await quickOpen.getResultCount();
      expect(initialCount).toBeGreaterThanOrEqual(2);

      // Type query to filter
      await quickOpen.typeQuery("alp");
      await new Promise((r) => setTimeout(r, 300));

      const filteredCount = await quickOpen.getResultCount();
      expect(filteredCount).toBeGreaterThanOrEqual(1);

      // Select the first filtered result
      await quickOpen.selectIndex(0);
      await new Promise((r) => setTimeout(r, 300));

      // Editor should now have Alpha content
      await editor.waitForReady();
      const content = await editor.getMarkdown();
      expect(content).toContain("Alpha");
    });
  }, 60000);
});
