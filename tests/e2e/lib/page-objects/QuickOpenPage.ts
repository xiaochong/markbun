import type { Page } from "../page";
import { sleep } from "../utils";

export class QuickOpenPage {
  constructor(private page: Page) {}

  async open(): Promise<void> {
    await this.page.evaluate(`(() => {
      const listeners = window.__electrobunListeners && window.__electrobunListeners['open-quick-open'] || [];
      listeners.forEach((cb) => cb());
    })()`);
    await this.waitForOpen();
  }

  async waitForOpen(timeout = 5000): Promise<void> {
    await this.page.waitForSelector("input[placeholder]", { timeout });
  }

  async close(): Promise<void> {
    try {
      await this.page.key("Escape");
    } catch {
      // ignore
    }
  }

  async typeQuery(query: string): Promise<void> {
    const input = await this.page.waitForSelector("input[placeholder]", { timeout: 5000 });
    await input!.click();
    await this.page.key("Control+a");
    await this.page.type(query);
    await sleep(150);
  }

  async selectIndex(index: number): Promise<void> {
    for (let i = 0; i < index; i++) {
      await this.page.key("ArrowDown");
      await sleep(100);
    }
    await this.page.key("Enter");
    await sleep(200);
  }

  async selectByText(text: string): Promise<void> {
    const buttons = await this.page.evaluate<
      { index: number; text: string }[]
    >(`(() => {
      const buttons = Array.from(document.querySelectorAll('[data-palette-index]'));
      return buttons.map(function(b, i) {
        return {
          index: i,
          text: b.textContent || ''
        };
      });
    })()`);
    const match = buttons.find((b) => b.text.includes(text));
    if (match === undefined) {
      throw new Error(`QuickOpen item containing "${text}" not found`);
    }
    await this.selectIndex(match.index);
  }

  async getResultCount(): Promise<number> {
    const count = await this.page.evaluate<number>(
      "document.querySelectorAll('[data-palette-index]').length"
    );
    return count;
  }
}
