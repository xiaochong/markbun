import { describe, it, expect } from "bun:test";
import { page } from "../e2e-setup";
import { EditorPage } from "./lib/page-objects/EditorPage";
import { collectTrace } from "./lib/trace";
import { join } from "path";

const WORKSPACE_DIR = process.env.MARKBUN_E2E_HOME || "";
const TEST_FILE = join(WORKSPACE_DIR, "files", "lifecycle.md");

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

describe("file lifecycle", () => {
  it("types markdown, saves, clears, reopens and asserts content", async () => {
    await withTrace("file-lifecycle", async () => {
      const editor = new EditorPage(page!);

      // Ensure files dir exists
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, ".keep"), "");

      // 1. Wait for editor to be ready
      await editor.waitForReady();

      // 2. Set editor content via test API
      await editor.setMarkdown("# Hello MarkBun");
      const typedContent = await editor.getMarkdown();
      expect(typedContent.trim()).toBe("# Hello MarkBun");

      // 3. Save file via RPC
      const saveResult = await editor.saveFile(TEST_FILE);
      expect(saveResult.success).toBe(true);

      // 4. Verify file on disk
      const file = Bun.file(TEST_FILE);
      expect(await file.exists()).toBe(true);
      const savedContent = await file.text();
      expect(savedContent.trim()).toBe("# Hello MarkBun");

      // 5. Clear editor
      await editor.setMarkdown("");
      const emptyContent = await editor.getMarkdown();
      expect(emptyContent.trim()).toBe("");

      // 6. Reopen file via _test RPC
      const openResult = await page!.evaluate<{ success: boolean; path?: string; content?: string; error?: string }>(
        `window.electrobun._testOpenFileByPath(${JSON.stringify(TEST_FILE)})`
      );
      expect(openResult.success).toBe(true);

      // 7. Wait for editor ready and assert restored content
      await editor.waitForReady();
      const restoredContent = await editor.getMarkdown();
      expect(restoredContent.trim()).toBe("# Hello MarkBun");
    });
  }, 120000);

  it("saves unicode markdown content to disk", async () => {
    await withTrace("file-unicode-save", async () => {
      const editor = new EditorPage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, ".keep"), "");
      await editor.waitForReady();

      const unicodeContent = "# 你好世界 \uD83C\uDF0D";
      await editor.setMarkdown(unicodeContent);
      const saveResult = await editor.saveFile(TEST_FILE);
      expect(saveResult.success).toBe(true);

      const file = Bun.file(TEST_FILE);
      expect(await file.exists()).toBe(true);
      expect((await file.text()).trim()).toBe(unicodeContent);
    });
  }, 60000);
});
