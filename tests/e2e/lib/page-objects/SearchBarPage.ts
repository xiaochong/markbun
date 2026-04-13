import type { Page } from "../page";
import { sleep } from "../utils";

export class SearchBarPage {
  constructor(private page: Page) {}

  async openFind(): Promise<void> {
    await this.page.evaluate(
      "window.electrobun._testMenuAction('edit-find')"
    );
    await sleep(300);
  }

  async openFindAndReplace(): Promise<void> {
    await this.page.evaluate(
      "window.electrobun._testMenuAction('edit-find-and-replace')"
    );
    await sleep(300);
  }

  async isOpen(): Promise<boolean> {
    return await this.page.evaluate<boolean>(
      'Boolean(document.querySelector(\'input[placeholder="Find"]\'))'
    );
  }

  async isReplaceVisible(): Promise<boolean> {
    return await this.page.evaluate<boolean>(
      'Boolean(document.querySelector(\'input[placeholder="Replace"]\'))'
    );
  }

  async typeFindQuery(text: string): Promise<void> {
    await this.page.evaluate(
      `(() => {
        const input = document.querySelector('input[placeholder="Find"]');
        if (input) {
          input.focus();
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(input, ${JSON.stringify(text)});
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()`
    );
    await sleep(200);
  }

  async typeReplaceQuery(text: string): Promise<void> {
    await this.page.evaluate(
      `(() => {
        const input = document.querySelector('input[placeholder="Replace"]');
        if (input) {
          input.focus();
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(input, ${JSON.stringify(text)});
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()`
    );
    await sleep(200);
  }

  async getMatchCount(): Promise<number> {
    const text = await this.page.evaluate<string>(
      `(() => {
        const span = document.querySelector('.flex.flex-col.border-b .shrink-0.text-xs');
        return span && span.textContent ? span.textContent.trim() : '';
      })()`
    );
    if (!text || text.includes("No results")) return 0;
    const parts = text.split("/");
    if (parts.length === 2) return parseInt(parts[1], 10);
    return 0;
  }

  async getActiveIndex(): Promise<number> {
    const text = await this.page.evaluate<string>(
      `(() => {
        const span = document.querySelector('.flex.flex-col.border-b .shrink-0.text-xs');
        return span && span.textContent ? span.textContent.trim() : '';
      })()`
    );
    if (!text || text.includes("No results")) return -1;
    const parts = text.split("/");
    if (parts.length === 2) return parseInt(parts[0], 10) - 1;
    return -1;
  }

  async clickNextMatch(): Promise<void> {
    await this.page.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('.flex.flex-col.border-b button'));
      const nextBtn = buttons.find(function(b) {
        return b.getAttribute('title') === 'Next Match';
      });
      if (nextBtn) nextBtn.click();
    })()`);
    await sleep(200);
  }

  async clickPrevMatch(): Promise<void> {
    await this.page.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('.flex.flex-col.border-b button'));
      const prevBtn = buttons.find(function(b) {
        return b.getAttribute('title') === 'Previous Match';
      });
      if (prevBtn) prevBtn.click();
    })()`);
    await sleep(200);
  }

  async toggleCaseSensitive(): Promise<void> {
    await this.page.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('.flex.flex-col.border-b button'));
      const aaBtn = buttons.find(function(b) {
        return (b.textContent || '').trim() === 'Aa';
      });
      if (aaBtn) aaBtn.click();
    })()`);
    await sleep(200);
  }

  async toggleRegex(): Promise<void> {
    await this.page.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('.flex.flex-col.border-b button'));
      const regexBtn = buttons.find(function(b) {
        return (b.textContent || '').trim() === '.*';
      });
      if (regexBtn) regexBtn.click();
    })()`);
    await sleep(200);
  }

  async isCaseSensitive(): Promise<boolean> {
    return await this.page.evaluate<boolean>(`(() => {
      const buttons = Array.from(document.querySelectorAll('.flex.flex-col.border-b button'));
      const aaBtn = buttons.find(function(b) {
        return (b.textContent || '').trim() === 'Aa';
      });
      return aaBtn ? aaBtn.classList.contains('bg-primary') : false;
    })()`);
  }

  async isRegex(): Promise<boolean> {
    return await this.page.evaluate<boolean>(`(() => {
      const buttons = Array.from(document.querySelectorAll('.flex.flex-col.border-b button'));
      const regexBtn = buttons.find(function(b) {
        return (b.textContent || '').trim() === '.*';
      });
      return regexBtn ? regexBtn.classList.contains('bg-primary') : false;
    })()`);
  }

  async clickReplace(): Promise<void> {
    await this.page.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('.flex.flex-col.border-b button'));
      const replaceBtn = buttons.find(function(b) {
        return (b.textContent || '').trim() === 'Replace' && !b.disabled;
      });
      if (replaceBtn) replaceBtn.click();
    })()`);
    await sleep(200);
  }

  async clickReplaceAll(): Promise<void> {
    await this.page.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('.flex.flex-col.border-b button'));
      const replaceAllBtn = buttons.find(function(b) {
        return (b.textContent || '').trim() === 'Replace All' && !b.disabled;
      });
      if (replaceAllBtn) replaceAllBtn.click();
    })()`);
    await sleep(200);
  }

  async close(): Promise<void> {
    // Click the close button (last button in the search bar row)
    await this.page.evaluate(`(() => {
      const container = document.querySelector('.flex.flex-col.border-b.border-border.bg-background');
      if (!container) return;
      const closeBtn = container.querySelector('button:last-of-type');
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(300);
  }

  async isError(): Promise<boolean> {
    return await this.page.evaluate<boolean>(
      `(() => {
        const input = document.querySelector('input[placeholder="Find"]');
        return input ? input.classList.contains('border-red-500') : false;
      })()`
    );
  }
}
