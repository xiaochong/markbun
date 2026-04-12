import type { Page } from "../page";
import { sleep } from "../utils";

export class EditorPage {
  constructor(private page: Page) {}

  async waitForReady(timeout = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const ready = await this.page.evaluate<boolean>(
        "window.__markbunTestAPI && window.__markbunTestAPI.isEditorReady ? window.__markbunTestAPI.isEditorReady() : false"
      );
      if (ready) return;
      await sleep(200);
    }
    throw new Error("Editor did not become ready within timeout");
  }

  async setMarkdown(text: string): Promise<void> {
    await this.page.evaluate(
      `window.__markbunTestAPI && window.__markbunTestAPI.setEditorMarkdown && window.__markbunTestAPI.setEditorMarkdown(${JSON.stringify(text)})`
    );
  }

  async getMarkdown(): Promise<string> {
    const content = await this.page.evaluate<string>(
      "window.__markbunTestAPI && window.__markbunTestAPI.getEditorMarkdown ? window.__markbunTestAPI.getEditorMarkdown() : ''"
    );
    return content;
  }

  async saveFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    const markdown = await this.getMarkdown();
    return await this.page.evaluate<{ success: boolean; error?: string }>(
      `window.electrobun.saveFile(${JSON.stringify(markdown)}, ${JSON.stringify(filePath)})`
    );
  }

  async menuAction(action: string): Promise<void> {
    await this.page.evaluate(
      `window.__markbunTestAPI && window.__markbunTestAPI.menuAction && window.__markbunTestAPI.menuAction(${JSON.stringify(action)})`
    );
  }

  async focus(): Promise<void> {
    await this.page.evaluate("window.__markbunTestAPI && window.__markbunTestAPI.focusEditor && window.__markbunTestAPI.focusEditor()");
  }
}
