import type { Page } from "../page";
import { sleep } from "../utils";

export class DialogPage {
  constructor(private page: Page) {}

  async waitForDialogContaining(text: string, timeout = 5000): Promise<void> {
    const expression = `(() => {
      const dialogs = Array.from(document.querySelectorAll('.z-50, [role="dialog"]'));
      return dialogs.some(function(el) {
        return (el.textContent || '').includes(${JSON.stringify(text)});
      });
    })()`;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const found = await this.page.evaluate<boolean>(expression);
      if (found) return;
      await sleep(200);
    }
    throw new Error(`Dialog containing "${text}" did not appear within timeout`);
  }

  async clickButton(label: string): Promise<void> {
    await this.page.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('.z-50 button, [role="dialog"] button'));
      const btn = buttons.find(function(b) {
        return (b.textContent || '').trim() === ${JSON.stringify(label)};
      });
      if (btn) btn.click();
    })()`);
    await sleep(200);
  }

  async close(): Promise<void> {
    try {
      await this.page.key("Escape");
      await sleep(200);
    } catch {
      // ignore
    }
  }

  async isDialogOpen(): Promise<boolean> {
    return await this.page.evaluate<boolean>(
      "Boolean(document.querySelector('.z-50, [role=\"dialog\"]'))"
    );
  }
}
