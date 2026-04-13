import type { Page } from "../page";
import { sleep } from "../utils";

export class OutlinePage {
  constructor(private page: Page) {}

  async isOpen(): Promise<boolean> {
    return await this.page.evaluate<boolean>(
      `(() => {
        var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
        if (!sidebar || sidebar.offsetWidth === 0) return false;
        var outlineTab = sidebar.querySelector('button[title="Outline"]');
        if (!outlineTab) return false;
        var isActive = outlineTab.classList.contains('border-primary');
        if (!isActive) return false;
        var container = sidebar.querySelector('.flex-1.overflow-hidden');
        if (!container) return false;
        var visible = container.querySelector('.h-full.block');
        return visible !== null;
      })()`
    );
  }

  async getHeadingCount(): Promise<number> {
    return await this.page.evaluate<number>(
      `(() => {
        var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
        if (!sidebar) return 0;
        var buttons = sidebar.querySelectorAll('button[style*="padding-left"]');
        return buttons.length;
      })()`
    );
  }

  async getHeadingTexts(): Promise<string[]> {
    return await this.page.evaluate<string[]>(
      `(() => {
        var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
        if (!sidebar) return [];
        var buttons = sidebar.querySelectorAll('button[style*="padding-left"]');
        return Array.from(buttons).map(function(b) {
          return b.textContent ? b.textContent.trim() : '';
        }).filter(function(t) { return t.length > 0; });
      })()`
    );
  }

  async clickHeading(text: string): Promise<void> {
    await this.page.evaluate(
      `(() => {
        var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
        if (!sidebar) return;
        var buttons = sidebar.querySelectorAll('button[style*="padding-left"]');
        var target = Array.from(buttons).find(function(b) {
          return b.textContent && b.textContent.trim().includes(${JSON.stringify(text)});
        });
        if (target) target.click();
      })()`
    );
    await sleep(300);
  }

  async isEmpty(): Promise<boolean> {
    return await this.page.evaluate<boolean>(
      `(() => {
        var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
        if (!sidebar) return true;
        var empty = sidebar.querySelector('p');
        var allP = Array.from(sidebar.querySelectorAll('p'));
        return allP.some(function(p) {
          return (p.textContent || '').includes('No headings found');
        });
      })()`
    );
  }

  async ensureOutlineTab(): Promise<void> {
    // Ensure sidebar is visible
    const sidebarVisible = await this.page.evaluate<boolean>(
      `(() => {
        var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
        return sidebar ? sidebar.offsetWidth > 0 : false;
      })()`
    );
    if (!sidebarVisible) {
      await this.page.evaluate(
        "window.electrobun._testMenuAction('view-toggle-sidebar')"
      );
      await sleep(500);
    }

    // Switch to outline tab using title attribute
    await this.page.evaluate(`(() => {
      var outlineTab = document.querySelector('button[title="Outline"]');
      if (outlineTab) outlineTab.click();
    })()`);
    await sleep(300);
  }
}
