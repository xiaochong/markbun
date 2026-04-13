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

describe("image insert", () => {
  it("opens image insert dialog via menu action", async () => {
    await withTrace("image-insert-dialog", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();

      await editor.menuAction("format-image");
      await new Promise((r) => setTimeout(r, 300));

      const hasDialog = await page!.evaluate<boolean>(
        `(() => {
          const body = document.body.innerText || '';
          return body.includes('Insert Image');
        })()`
      );
      expect(hasDialog).toBe(true);

      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const cancelBtn = buttons.find((b) => (b.textContent || '').trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("switches to URL tab in image insert dialog", async () => {
    await withTrace("image-insert-url-tab", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();

      await editor.menuAction("format-image");
      await new Promise((r) => setTimeout(r, 300));

      // Click URL tab
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const urlTab = buttons.find((b) => (b.textContent || '').trim() === 'URL');
        if (urlTab) urlTab.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));

      const hasUrlInput = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('input[placeholder="https://example.com/image.png"]'))`
      );
      expect(hasUrlInput).toBe(true);

      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const cancelBtn = buttons.find((b) => (b.textContent || '').trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("has alt text input in image insert dialog", async () => {
    await withTrace("image-insert-alt-text", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();

      await editor.menuAction("format-image");
      await new Promise((r) => setTimeout(r, 300));

      const hasAltInput = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('input[placeholder="Description of the image"]'))`
      );
      expect(hasAltInput).toBe(true);

      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const cancelBtn = buttons.find((b) => (b.textContent || '').trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("insert button is disabled when no image source provided", async () => {
    await withTrace("image-insert-disabled", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();

      await editor.menuAction("format-image");
      await new Promise((r) => setTimeout(r, 300));

      // Switch to URL tab where no URL is entered
      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const urlTab = buttons.find((b) => (b.textContent || '').trim() === 'URL');
        if (urlTab) urlTab.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));

      const insertDisabled = await page!.evaluate<boolean>(
        `(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const insertBtn = buttons.find((b) => (b.textContent || '').trim() === 'Insert');
          return insertBtn ? insertBtn.disabled : false;
        })()`
      );
      expect(insertDisabled).toBe(true);

      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const cancelBtn = buttons.find((b) => (b.textContent || '').trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("closes image insert dialog via cancel button", async () => {
    await withTrace("image-insert-cancel", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();

      await editor.menuAction("format-image");
      await new Promise((r) => setTimeout(r, 300));

      const hasDialogBefore = await page!.evaluate<boolean>(
        `(() => {
          const body = document.body.innerText || '';
          return body.includes('Insert Image');
        })()`
      );
      expect(hasDialogBefore).toBe(true);

      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const cancelBtn = buttons.find((b) => (b.textContent || '').trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));

      const hasDialogAfter = await page!.evaluate<boolean>(
        `(() => {
          const body = document.body.innerText || '';
          return body.includes('Insert Image');
        })()`
      );
      expect(hasDialogAfter).toBe(false);
    });
  }, 30000);
});
