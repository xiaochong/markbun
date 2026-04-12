import type { Page } from "../page";
import { sleep, dispatchEventScript } from "../utils";

export class SettingsPage {
  constructor(private page: Page) {}

  async open(): Promise<void> {
    await this.page.evaluate(dispatchEventScript('open-settings'));
    await this.waitForOpen();
  }

  async waitForOpen(timeout = 5000): Promise<void> {
    await this.page.waitForSelector("div.z-50 button", { timeout });
  }

  async close(): Promise<void> {
    try {
      await this.page.key("Escape");
    } catch {
      // ignore
    }
  }

  async switchTab(tabLabel: string): Promise<void> {
    await this.page.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('.z-50 nav button'));
      const btn = buttons.find(function(b) {
        return (b.textContent || '').includes(${JSON.stringify(tabLabel)});
      });
      if (btn) {
        var ev = document.createEvent('MouseEvents');
        ev.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
        btn.dispatchEvent(ev);
      }
    })()`);
    await sleep(500);
  }

  async toggleAutoSave(): Promise<void> {
    await this.page.evaluate(`(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const label = labels.find(function(l) {
        return (l.textContent || '').toLowerCase().includes('auto save');
      });
      const container = label && label.parentElement && label.parentElement.parentElement;
      const checkbox = container && container.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.click();
    })()`);
  }

  async save(): Promise<void> {
    await this.page.evaluate(`(() => {
      const buttons = Array.from(document.querySelectorAll('div.z-50 button'));
      const saveBtn = buttons.find(function(b) {
        return (b.textContent || '').trim() === 'Save';
      });
      if (saveBtn) saveBtn.click();
    })()`);
    await sleep(300);
  }

  async isOpen(): Promise<boolean> {
    try {
      await this.waitForOpen(2000);
      return true;
    } catch {
      return false;
    }
  }

  async getAutoSaveValue(): Promise<boolean> {
    return await this.page.evaluate<boolean>(`(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const label = labels.find(function(l) {
        return (l.textContent || '').toLowerCase().includes('auto save');
      });
      const container = label && label.parentElement && label.parentElement.parentElement;
      const checkbox = container && container.querySelector('input[type="checkbox"]');
      return checkbox ? checkbox.checked : false;
    })()`);
  }

  async toggleBackupEnabled(): Promise<void> {
    await this.page.evaluate(`(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const label = labels.find(function(l) {
        return (l.textContent || '').includes('Version History');
      });
      const container = label && label.parentElement && label.parentElement.parentElement;
      const checkbox = container && container.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.click();
    })()`);
  }

  async getBackupEnabledValue(): Promise<boolean> {
    return await this.page.evaluate<boolean>(`(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const label = labels.find(function(l) {
        return (l.textContent || '').includes('Version History');
      });
      const container = label && label.parentElement && label.parentElement.parentElement;
      const checkbox = container && container.querySelector('input[type="checkbox"]');
      return checkbox ? checkbox.checked : false;
    })()`);
  }
}
