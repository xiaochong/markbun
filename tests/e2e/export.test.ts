import { describe, it, expect } from "bun:test";
import { page } from "../e2e-setup";
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

// Helper: dismiss any open dialog by pressing Escape
async function dismissDialogs() {
  await page!.key("Escape");
  await new Promise((r) => setTimeout(r, 300));
  await page!.key("Escape");
  await new Promise((r) => setTimeout(r, 300));
}

// Helper: dismiss export dialog by clicking Cancel
async function dismissExportDialog() {
  await page!.evaluate(`(() => {
    var buttons = Array.from(document.querySelectorAll('button'));
    var cancelBtn = buttons.find(function(b) {
      return (b.textContent || '').trim() === 'Cancel';
    });
    if (cancelBtn) cancelBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 300));
}

// Skipped: dynamic import('marked'/'html2canvas') unreliable in CEF WebView
describe.skip("export", () => {
  it("opens export HTML dialog and cancels", async () => {
    await withTrace("export-html-dialog", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await dismissDialogs();
      await editor.setMarkdown("# Export Test\n\nHello world.");

      await editor.menuAction("file-export-html");
      await new Promise((r) => setTimeout(r, 3000));

      const hasDialog = await page!.evaluate<boolean>(
        `(() => {
          var body = document.body.innerText || '';
          return body.includes('Export as HTML');
        })()`
      );
      expect(hasDialog).toBe(true);

      await dismissExportDialog();
    });
  }, 30000);

  it("opens export HTML dialog with empty content", async () => {
    await withTrace("export-html-empty", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await dismissDialogs();
      await editor.setMarkdown("");

      await editor.menuAction("file-export-html");
      await new Promise((r) => setTimeout(r, 3000));

      const hasDialog = await page!.evaluate<boolean>(
        `(() => {
          var body = document.body.innerText || '';
          return body.includes('Export as HTML');
        })()`
      );
      expect(hasDialog).toBe(true);

      await dismissExportDialog();
    });
  }, 30000);

  it("opens export HTML dialog with unicode content", async () => {
    await withTrace("export-html-unicode", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await dismissDialogs();
      await editor.setMarkdown("# 你好世界\n\n中文内容测试");

      await editor.menuAction("file-export-html");
      await new Promise((r) => setTimeout(r, 3000));

      const hasDialog = await page!.evaluate<boolean>(
        `(() => {
          var body = document.body.innerText || '';
          return body.includes('Export as HTML');
        })()`
      );
      expect(hasDialog).toBe(true);

      await dismissExportDialog();
    });
  }, 30000);

  it("opens export HTML dialog with formatted content", async () => {
    await withTrace("export-html-formatted", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await dismissDialogs();
      await editor.setMarkdown("# Hello\n\n**Bold** and *italic* text.\n\n- list item\n\n> quote");

      await editor.menuAction("file-export-html");
      await new Promise((r) => setTimeout(r, 3000));

      const hasDialog = await page!.evaluate<boolean>(
        `(() => {
          var body = document.body.innerText || '';
          return body.includes('Export as HTML');
        })()`
      );
      expect(hasDialog).toBe(true);

      await dismissExportDialog();
    });
  }, 30000);

  it("dismisses export dialog via cancel button", async () => {
    await withTrace("export-html-dismiss", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await dismissDialogs();
      await editor.setMarkdown("# Test dismiss");

      await editor.menuAction("file-export-html");
      await new Promise((r) => setTimeout(r, 3000));

      const hasBefore = await page!.evaluate<boolean>(
        `(() => {
          var body = document.body.innerText || '';
          return body.includes('Export as HTML');
        })()`
      );
      expect(hasBefore).toBe(true);

      await dismissExportDialog();
      const hasAfter = await page!.evaluate<boolean>(
        `(() => {
          var body = document.body.innerText || '';
          return body.includes('Export as HTML');
        })()`
      );
      expect(hasAfter).toBe(false);
    });
  }, 30000);
});
