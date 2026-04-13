import { describe, it, expect } from "bun:test";
import { page } from "../e2e-setup";
import { EditorPage } from "./lib/page-objects/EditorPage";
import { FileHistoryPage } from "./lib/page-objects/FileHistoryPage";
import { SettingsPage } from "./lib/page-objects/SettingsPage";
import { collectTrace } from "./lib/trace";
import { join } from "path";

const WORKSPACE_DIR = process.env.MARKBUN_E2E_HOME || "";
const TEST_FILE = join(WORKSPACE_DIR, "files", "history-test.md");

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

describe("file history restore", () => {
  it("restores an earlier version and asserts content, path, and dirty state", async () => {
    await withTrace("file-history-restore", async () => {
      const editor = new EditorPage(page!);
      const fileHistory = new FileHistoryPage(page!);
      const settings = new SettingsPage(page!);

      // Disable auto-save so restore leaves the document dirty
      await settings.open();
      const autoSaveWasOn = await settings.getAutoSaveValue();
      if (autoSaveWasOn) {
        await settings.toggleAutoSave();
      }
      await settings.save();
      await new Promise((r) => setTimeout(r, 500));

      // Ensure files dir exists
      const filesDir = join(WORKSPACE_DIR, "files");
      await Bun.write(join(filesDir, ".keep"), "");

      await editor.waitForReady();

      const v1 = "# Version 1\n\nOriginal content.";
      const v2 = "# Version 2\n\nUpdated content.";

      // 1. Write v1 and save to disk
      await editor.setMarkdown(v1);
      const save1 = await editor.saveFile(TEST_FILE);
      expect(save1.success).toBe(true);

      // 2. Open file in renderer so path is tracked
      const openResult = await page!.evaluate<{ success: boolean; path?: string; content?: string; error?: string }>(
        `window.electrobun._testOpenFileByPath(${JSON.stringify(TEST_FILE)})`
      );
      expect(openResult.success).toBe(true);
      await editor.waitForReady();
      await editor.waitForMarkdown(v1);

      // 3. Write v2 and save again — this triggers createVersionBackup for v1
      await editor.setMarkdown(v2);
      const save2 = await editor.saveFile(TEST_FILE);
      expect(save2.success).toBe(true);

      // Re-open file to sync renderer fileState.content to v2 (setMarkdown bypasses useFileOperations)
      const reopenResult = await page!.evaluate<{ success: boolean; path?: string; content?: string; error?: string }>(
        `window.electrobun._testOpenFileByPath(${JSON.stringify(TEST_FILE)})`
      );
      expect(reopenResult.success).toBe(true);
      await editor.waitForReady();
      await editor.waitForMarkdown(v2);

      // 4. Open File History dialog
      await fileHistory.open();
      await fileHistory.waitForVersions(1);
      const versionCount = await fileHistory.getVersionCount();
      expect(versionCount).toBeGreaterThanOrEqual(1);

      // 5. Select the oldest backup (newest-first list, so index = versionCount - 1)
      await fileHistory.selectVersionByIndex(versionCount - 1);
      await new Promise((r) => setTimeout(r, 300));
      const preview = await fileHistory.getPreviewContent();
      expect(preview?.trim()).toBe(v1);

      // 6. Click Restore
      await fileHistory.clickRestore();
      await editor.waitForReady();
      await editor.waitForMarkdown(v1);

      // 7. Assert dialog is closed
      expect(await fileHistory.isDialogOpen()).toBe(false);

      // 8. Assert editor content reverted to v1
      const restoredContent = await editor.getMarkdown();
      expect(restoredContent.trim()).toBe(v1);

      // 9. Assert path unchanged
      const fileState = await page!.evaluate<{ path: string | null; isDirty: boolean }>(
        "window.__markbunTestAPI && window.__markbunTestAPI.getFileState ? window.__markbunTestAPI.getFileState() : { path: null, isDirty: false }"
      );
      expect(fileState.path).toEndWith("history-test.md");

      // 10. Assert dirty state is true
      expect(fileState.isDirty).toBe(true);

      // Restore auto-save to original state
      await settings.open();
      const autoSaveIsOff = await settings.getAutoSaveValue();
      if (!autoSaveIsOff && autoSaveWasOn) {
        await settings.toggleAutoSave();
        await settings.save();
        await new Promise((r) => setTimeout(r, 500));
      } else if (autoSaveIsOff && !autoSaveWasOn) {
        await settings.toggleAutoSave();
        await settings.save();
        await new Promise((r) => setTimeout(r, 500));
      } else {
        await settings.close();
      }
    });
  }, 120000);
});
