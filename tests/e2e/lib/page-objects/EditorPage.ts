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
    // Use the test RPC that correctly routes cross-process actions through Bun
    await this.page.evaluate(
      `window.electrobun._testMenuAction(${JSON.stringify(action)})`
    );
  }

  async focus(): Promise<void> {
    await this.page.evaluate("window.__markbunTestAPI && window.__markbunTestAPI.focusEditor && window.__markbunTestAPI.focusEditor()");
  }

  async focusTableFirstCell(): Promise<boolean> {
    return await this.page.evaluate<boolean>(
      "window.__markbunTestAPI && window.__markbunTestAPI.focusTableFirstCell ? window.__markbunTestAPI.focusTableFirstCell() : false"
    );
  }

  async waitForMarkdown(expected: string, timeout = 10000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const content = await this.getMarkdown();
      if (content.trim() === expected.trim()) return;
      await sleep(200);
    }
    throw new Error(`Editor content did not become expected value within timeout`);
  }

  async clickTableCellByText(text: string): Promise<void> {
    await this.page.evaluate(
      `(() => {
        const cells = Array.from(document.querySelectorAll('table td, table th'));
        const target = cells.find((c) => (c.textContent || '').includes(${JSON.stringify(text)}));
        if (target) {
          const rect = target.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
          target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
        }
      })()`
    );
    await sleep(300);
  }
}
