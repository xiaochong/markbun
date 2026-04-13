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

describe("clipboard", () => {
  it("copies selected text and preserves original content", async () => {
    await withTrace("clipboard-copy", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();

      await editor.setMarkdown("copy this text");
      await editor.menuAction("editor-select-all");
      await new Promise((r) => setTimeout(r, 300));
      await editor.menuAction("editor-copy");
      await new Promise((r) => setTimeout(r, 300));

      // Content should remain after copy
      const content = await editor.getMarkdown();
      expect(content).toContain("copy this text");
    });
  }, 30000);

  it("cuts selected text and removes it", async () => {
    await withTrace("clipboard-cut", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();

      await editor.setMarkdown("cut this text");
      await editor.menuAction("editor-select-all");
      await new Promise((r) => setTimeout(r, 300));
      await editor.menuAction("editor-cut");
      await new Promise((r) => setTimeout(r, 300));

      const content = await editor.getMarkdown();
      expect(content).not.toContain("cut this text");
    });
  }, 30000);

  it("pastes previously copied text", async () => {
    await withTrace("clipboard-paste", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();

      // Setup: write content and copy it
      await editor.setMarkdown("clipboard content");
      await editor.menuAction("editor-select-all");
      await new Promise((r) => setTimeout(r, 300));
      await editor.menuAction("editor-copy");
      await new Promise((r) => setTimeout(r, 300));

      // Clear and paste
      await editor.setMarkdown("");
      await editor.focus();
      await new Promise((r) => setTimeout(r, 300));
      await editor.menuAction("editor-paste");
      await new Promise((r) => setTimeout(r, 500));

      const content = await editor.getMarkdown();
      expect(content).toContain("clipboard content");
    });
  }, 30000);

  it("cut and paste cycle preserves content", async () => {
    await withTrace("clipboard-cut-paste", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();

      await editor.setMarkdown("move me");
      await editor.menuAction("editor-select-all");
      await new Promise((r) => setTimeout(r, 300));
      await editor.menuAction("editor-cut");
      await new Promise((r) => setTimeout(r, 300));

      // Content should be gone
      expect(await editor.getMarkdown()).not.toContain("move me");

      // Paste it back
      await editor.focus();
      await new Promise((r) => setTimeout(r, 300));
      await editor.menuAction("editor-paste");
      await new Promise((r) => setTimeout(r, 500));

      const content = await editor.getMarkdown();
      expect(content).toContain("move me");
    });
  }, 30000);

  it("select all selects all editor content", async () => {
    await withTrace("clipboard-select-all", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();

      await editor.setMarkdown("# Title\n\nParagraph one\n\nParagraph two");
      await editor.menuAction("editor-select-all");
      await new Promise((r) => setTimeout(r, 300));

      // After cut, everything should be gone
      await editor.menuAction("editor-cut");
      await new Promise((r) => setTimeout(r, 300));

      const content = await editor.getMarkdown();
      expect(content).not.toContain("Title");
      expect(content).not.toContain("Paragraph");
    });
  }, 30000);
});
