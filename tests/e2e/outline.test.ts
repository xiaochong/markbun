import { describe, it, expect } from "bun:test";
import { page } from "../e2e-setup";
import { EditorPage } from "./lib/page-objects/EditorPage";
import { OutlinePage } from "./lib/page-objects/OutlinePage";
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

// Helper: create a file and open it via the full app flow so outline updates
async function openFileWithContent(editor: EditorPage, filePath: string, content: string) {
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  await Bun.write(join(dir, ".keep"), "");
  await Bun.write(filePath, content);
  const result = await page!.evaluate<{ success: boolean; error?: string }>(
    `window.electrobun._testOpenFileByPath(${JSON.stringify(filePath)})`
  );
  if (!result.success) throw new Error("Failed to open file: " + (result.error || "unknown"));
  await editor.waitForReady();
  await new Promise((r) => setTimeout(r, 500));
}

describe("outline", () => {
  it("shows headings in outline panel after opening file", async () => {
    await withTrace("outline-headings", async () => {
      const editor = new EditorPage(page!);
      const outline = new OutlinePage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      const testFile = join(filesDir, "outline-headings.md");

      await openFileWithContent(
        editor,
        testFile,
        "# Title\n\n## Section 1\n\n### Subsection\n\n## Section 2"
      );
      await outline.ensureOutlineTab();
      await new Promise((r) => setTimeout(r, 500));

      const count = await outline.getHeadingCount();
      expect(count).toBe(4);

      const texts = await outline.getHeadingTexts();
      expect(texts).toContain("Title");
      expect(texts).toContain("Section 1");
      expect(texts).toContain("Subsection");
      expect(texts).toContain("Section 2");
    });
  }, 30000);

  it("shows empty state when opening file without headings", async () => {
    await withTrace("outline-empty", async () => {
      const editor = new EditorPage(page!);
      const outline = new OutlinePage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      const testFile = join(filesDir, "outline-empty.md");

      await openFileWithContent(
        editor,
        testFile,
        "Just a plain paragraph without any headings."
      );
      await outline.ensureOutlineTab();
      await new Promise((r) => setTimeout(r, 500));

      expect(await outline.isEmpty()).toBe(true);
      expect(await outline.getHeadingCount()).toBe(0);
    });
  }, 30000);

  it("clicking heading does not throw error", async () => {
    await withTrace("outline-click", async () => {
      const editor = new EditorPage(page!);
      const outline = new OutlinePage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      const testFile = join(filesDir, "outline-click.md");

      await openFileWithContent(
        editor,
        testFile,
        "# Alpha\n\nSome content\n\n## Beta\n\nMore content"
      );
      await outline.ensureOutlineTab();
      await new Promise((r) => setTimeout(r, 500));

      expect(await outline.getHeadingCount()).toBeGreaterThanOrEqual(2);

      // Click should not throw
      await outline.clickHeading("Alpha");
      await outline.clickHeading("Beta");

      // Verify outline still visible and headings present
      expect(await outline.getHeadingCount()).toBeGreaterThanOrEqual(2);
    });
  }, 30000);

  it("handles deeply nested headings", async () => {
    await withTrace("outline-deep-headings", async () => {
      const editor = new EditorPage(page!);
      const outline = new OutlinePage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      const testFile = join(filesDir, "outline-deep.md");

      await openFileWithContent(
        editor,
        testFile,
        "# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6"
      );
      await outline.ensureOutlineTab();
      await new Promise((r) => setTimeout(r, 500));

      expect(await outline.getHeadingCount()).toBe(6);
      const texts = await outline.getHeadingTexts();
      expect(texts).toContain("H1");
      expect(texts).toContain("H6");
    });
  }, 30000);

  it("shows single heading correctly", async () => {
    await withTrace("outline-single-heading", async () => {
      const editor = new EditorPage(page!);
      const outline = new OutlinePage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      const testFile = join(filesDir, "outline-single.md");

      await openFileWithContent(editor, testFile, "# Only Heading\n\nContent here.");
      await outline.ensureOutlineTab();
      await new Promise((r) => setTimeout(r, 500));

      expect(await outline.getHeadingCount()).toBe(1);
      const texts = await outline.getHeadingTexts();
      expect(texts).toContain("Only Heading");
    });
  }, 30000);

  it("shows duplicate headings with same text", async () => {
    await withTrace("outline-duplicate-headings", async () => {
      const editor = new EditorPage(page!);
      const outline = new OutlinePage(page!);
      const filesDir = join(WORKSPACE_DIR, "files");
      const testFile = join(filesDir, "outline-dup.md");

      await openFileWithContent(
        editor,
        testFile,
        "# Title\n\nContent 1\n\n## Section\n\nContent 2\n\n## Section\n\nContent 3"
      );
      await outline.ensureOutlineTab();
      await new Promise((r) => setTimeout(r, 500));

      // Should have 3 headings: Title + 2x Section
      expect(await outline.getHeadingCount()).toBe(3);
    });
  }, 30000);
});
