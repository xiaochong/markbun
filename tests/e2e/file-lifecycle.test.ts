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

  it("saves empty markdown file", async () => {
    await withTrace("file-empty-save", async () => {
      const editor = new EditorPage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, ".keep"), "");
      await editor.waitForReady();
      await editor.setMarkdown("");
      const saveResult = await editor.saveFile(TEST_FILE);
      expect(saveResult.success).toBe(true);
      const file = Bun.file(TEST_FILE);
      expect(await file.exists()).toBe(true);
      expect((await file.text()).trim()).toBe("");
    });
  }, 60000);

  it("overwrites existing file with new content", async () => {
    await withTrace("file-overwrite", async () => {
      const editor = new EditorPage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, ".keep"), "");
      await editor.waitForReady();

      await editor.setMarkdown("first content");
      const save1 = await editor.saveFile(TEST_FILE);
      expect(save1.success).toBe(true);
      expect((await Bun.file(TEST_FILE).text()).trim()).toBe("first content");

      await editor.setMarkdown("second content");
      const save2 = await editor.saveFile(TEST_FILE);
      expect(save2.success).toBe(true);
      expect((await Bun.file(TEST_FILE).text()).trim()).toBe("second content");
    });
  }, 60000);

  it("saves markdown with code blocks", async () => {
    await withTrace("file-code-blocks", async () => {
      const editor = new EditorPage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, ".keep"), "");
      await editor.waitForReady();

      const content = "# Code\n\n```typescript\nconst x = 1;\n```";
      await editor.setMarkdown(content);
      const saveResult = await editor.saveFile(TEST_FILE);
      expect(saveResult.success).toBe(true);
      expect((await Bun.file(TEST_FILE).text()).trim()).toBe(content);
    });
  }, 60000);

  it("saves markdown with tables", async () => {
    await withTrace("file-tables", async () => {
      const editor = new EditorPage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, ".keep"), "");
      await editor.waitForReady();

      const content = "| A | B |\n|---|---|\n| 1 | 2 |";
      await editor.setMarkdown(content);
      const saveResult = await editor.saveFile(TEST_FILE);
      expect(saveResult.success).toBe(true);
      expect((await Bun.file(TEST_FILE).text()).trim()).toBe(content);
    });
  }, 60000);

  it("saves markdown with frontmatter", async () => {
    await withTrace("file-frontmatter", async () => {
      const editor = new EditorPage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, ".keep"), "");
      await editor.waitForReady();

      const content = "---\ntitle: Test\n---\n\n# Hello";
      await editor.setMarkdown(content);
      const saveResult = await editor.saveFile(TEST_FILE);
      expect(saveResult.success).toBe(true);
      expect((await Bun.file(TEST_FILE).text()).trim()).toBe(content);
    });
  }, 60000);

  it("saves markdown to a deeply nested path", async () => {
    await withTrace("file-nested-path", async () => {
      const editor = new EditorPage(page!);
      const nestedDir = join(WORKSPACE_DIR, "files", "a", "b", "c");
      await Bun.mkdir(nestedDir, { recursive: true });
      const nestedFile = join(nestedDir, "deep.md");

      await editor.waitForReady();
      await editor.setMarkdown("# Deep");
      const saveResult = await editor.saveFile(nestedFile);
      expect(saveResult.success).toBe(true);
      expect((await Bun.file(nestedFile).text()).trim()).toBe("# Deep");
    });
  }, 60000);

  it("saves a large markdown file", async () => {
    await withTrace("file-large", async () => {
      const editor = new EditorPage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, ".keep"), "");
      await editor.waitForReady();

      const paragraphs = Array.from({ length: 200 }, (_, i) => `Paragraph ${i + 1} with some content.`);
      const content = "# Large Document\n\n" + paragraphs.join("\n\n");
      await editor.setMarkdown(content);
      const saveResult = await editor.saveFile(TEST_FILE);
      expect(saveResult.success).toBe(true);
      const saved = await Bun.file(TEST_FILE).text();
      expect(saved.length).toBeGreaterThan(5000);
      expect(saved).toContain("Paragraph 200");
    });
  }, 60000);

  it("shows saved file info in status bar", async () => {
    await withTrace("file-status-bar", async () => {
      const editor = new EditorPage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, ".keep"), "");
      await editor.waitForReady();

      const content = "word1 word2 word3";
      await editor.setMarkdown(content);
      const saveResult = await editor.saveFile(TEST_FILE);
      expect(saveResult.success).toBe(true);

      await editor.menuAction("view-toggle-statusbar");
      await new Promise((r) => setTimeout(r, 500));

      const hasFileName = await page!.evaluate<boolean>(
        `(() => {
          const text = document.body.innerText || '';
          return text.includes('lifecycle.md');
        })()`
      );
      expect(hasFileName).toBe(true);

      const hasWordCount = await page!.evaluate<boolean>(
        `(() => {
          const text = document.body.innerText || '';
          return text.includes('3') && text.includes('words');
        })()`
      );
      expect(hasWordCount).toBe(true);

      await editor.menuAction("view-toggle-statusbar");
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 60000);

  it("saves whitespace-only markdown file", async () => {
    await withTrace("file-whitespace-save", async () => {
      const editor = new EditorPage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, ".keep"), "");
      await editor.waitForReady();

      await editor.setMarkdown("   \n\n   ");
      const saveResult = await editor.saveFile(TEST_FILE);
      expect(saveResult.success).toBe(true);

      const file = Bun.file(TEST_FILE);
      expect(await file.exists()).toBe(true);
      const saved = await file.text();
      expect(saved.trim()).toBe("");
    });
  }, 60000);

  it("saves markdown with mixed lists", async () => {
    await withTrace("file-mixed-lists", async () => {
      const editor = new EditorPage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, ".keep"), "");
      await editor.waitForReady();

      const content = "# Mixed\n\n- unordered\n\n1. ordered";
      await editor.setMarkdown(content);
      const saveResult = await editor.saveFile(TEST_FILE);
      expect(saveResult.success).toBe(true);
      expect((await Bun.file(TEST_FILE).text()).trim()).toBe(content);
    });
  }, 60000);

  it("saves markdown with inline html", async () => {
    await withTrace("file-inline-html", async () => {
      const editor = new EditorPage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, ".keep"), "");
      await editor.waitForReady();

      const content = "# HTML\n\n<u>underlined</u>";
      await editor.setMarkdown(content);
      const saveResult = await editor.saveFile(TEST_FILE);
      expect(saveResult.success).toBe(true);
      expect((await Bun.file(TEST_FILE).text()).trim()).toBe(content);
    });
  }, 60000);
});
