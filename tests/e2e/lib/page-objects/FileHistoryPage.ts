import type { Page } from "../page";
import { sleep } from "../utils";

export class FileHistoryPage {
  constructor(private page: Page) {}

  async open(): Promise<void> {
    await this.page.evaluate(`(() => {
      const listeners = window.__electrobunListeners && window.__electrobunListeners['open-file-history'] || [];
      listeners.forEach((cb) => cb());
    })()`);
    await this.waitForOpen();
  }

  async waitForOpen(timeout = 5000): Promise<void> {
    const expression = `(() => {
      const dialogs = Array.from(document.querySelectorAll('.z-50')).filter(function(el) {
        return !el.querySelector('input[placeholder]');
      });
      return dialogs.some(function(el) {
        return (el.textContent || '').includes('History');
      });
    })()`;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const found = await this.page.evaluate<boolean>(expression);
      if (found) return;
      await sleep(200);
    }
    throw new Error(`File History dialog did not appear within timeout`);
  }

  async selectVersionByIndex(index: number): Promise<void> {
    await this.page.evaluate(`(() => {
      const dialog = Array.from(document.querySelectorAll('.z-50')).find(function(el) {
        return (el.textContent || '').includes('History');
      });
      if (!dialog) return;
      const button = dialog.querySelector('ul li:nth-child(' + ${index + 1} + ') button');
      if (button) button.click();
    })()`);
    await sleep(300);
  }

  async getPreviewContent(): Promise<string | null> {
    return await this.page.evaluate<string | null>(`(() => {
      const dialog = Array.from(document.querySelectorAll('.z-50')).find(function(el) {
        return (el.textContent || '').includes('History');
      });
      if (!dialog) return null;
      const pre = dialog.querySelector('pre');
      return pre ? pre.textContent : null;
    })()`);
  }

  async clickRestore(): Promise<void> {
    await this.page.evaluate(`(() => {
      const dialog = Array.from(document.querySelectorAll('.z-50')).find(function(el) {
        return (el.textContent || '').includes('History');
      });
      if (!dialog) return;
      const buttons = Array.from(dialog.querySelectorAll('button'));
      const restoreBtn = buttons.find(function(b) {
        return (b.textContent || '').trim() === 'Restore this version';
      });
      if (restoreBtn) {
        restoreBtn.focus();
        restoreBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        restoreBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        restoreBtn.click();
      }
    })()`);
    await sleep(500);
  }

  async close(): Promise<void> {
    await this.page.evaluate(`(() => {
      const dialog = Array.from(document.querySelectorAll('.z-50')).find(function(el) {
        return (el.textContent || '').includes('History');
      });
      if (!dialog) return;
      const buttons = Array.from(dialog.querySelectorAll('button'));
      const closeBtn = buttons.find(function(b) {
        return (b.textContent || '').trim() === 'Close';
      });
      if (closeBtn) {
        closeBtn.click();
      } else {
        const backdrop = document.querySelector('.fixed.inset-0.z-50.flex.items-center.justify-center');
        if (backdrop && backdrop.classList.contains('bg-black/50')) backdrop.click();
      }
    })()`);
    await sleep(300);
  }

  async isDialogOpen(): Promise<boolean> {
    return await this.page.evaluate<boolean>(`(() => {
      const dialogs = Array.from(document.querySelectorAll('.z-50')).filter(function(el) {
        return !el.querySelector('input[placeholder]');
      });
      return dialogs.some(function(el) {
        return (el.textContent || '').includes('History');
      });
    })()`);
  }

  async getVersionCount(): Promise<number> {
    return await this.page.evaluate<number>(`(() => {
      const dialog = Array.from(document.querySelectorAll('.z-50')).find(function(el) {
        return (el.textContent || '').includes('History');
      });
      if (!dialog) return 0;
      const list = dialog.querySelector('ul');
      if (!list) return 0;
      return list.querySelectorAll('li').length;
    })()`);
  }

  async waitForVersions(minCount = 1, timeout = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const count = await this.getVersionCount();
      if (count >= minCount) return;
      await sleep(200);
    }
    throw new Error(`File History did not show at least ${minCount} version(s) within timeout`);
  }
}
