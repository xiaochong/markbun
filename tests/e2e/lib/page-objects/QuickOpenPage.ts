import type { Page } from "../page";
import { sleep } from "../utils";

const QUICK_OPEN_ROOT = ".z-50.flex.items-start.justify-center";
const QUICK_OPEN_INPUT = `${QUICK_OPEN_ROOT} input[placeholder]`;

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
    await this.page.waitForSelector(QUICK_OPEN_INPUT, { timeout });
  }

  async close(): Promise<void> {
    try {
      await this.page.key("Escape");
    } catch {
      // ignore
    }
  }

  async typeQuery(query: string): Promise<void> {
    await this.page.waitForSelector(QUICK_OPEN_INPUT, { timeout: 5000 });
    await this.page.evaluate(`(() => {
      const input = document.querySelector(${JSON.stringify(QUICK_OPEN_INPUT)});
      if (input) {
        input.focus();
        input.select();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, ${JSON.stringify(query)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
    await sleep(300);
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
      const qo = document.querySelector(${JSON.stringify(QUICK_OPEN_ROOT)});
      const buttons = qo ? Array.from(qo.querySelectorAll('[data-palette-index]')) : [];
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
      `(() => {
        const qo = document.querySelector(${JSON.stringify(QUICK_OPEN_ROOT)});
        return qo ? qo.querySelectorAll('[data-palette-index]').length : 0;
      })()`
    );
    return count;
  }
}
