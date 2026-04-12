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
});
