import type { Page } from "../page";
import { sleep } from "../utils";

export class FileExplorerPage {
  constructor(private page: Page) {}

  async isVisible(): Promise<boolean> {
    return await this.page.evaluate<boolean>(
      `(() => {
        var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
        if (!sidebar || sidebar.offsetWidth === 0) return false;
        var filesTab = sidebar.querySelector('button[title="Files"]');
        if (!filesTab) return false;
        return filesTab.classList.contains('border-primary');
      })()`
    );
  }

  async ensureFilesTab(): Promise<void> {
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

    // Switch to files tab using title attribute
    await this.page.evaluate(`(() => {
      var filesTab = document.querySelector('button[title="Files"]');
      if (filesTab) filesTab.click();
    })()`);
    await sleep(300);
  }

  async getFileCount(): Promise<number> {
    return await this.page.evaluate<number>(
      `(() => {
        var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
        if (!sidebar) return 0;
        var content = sidebar.querySelector('.flex-1.overflow-auto');
        if (!content) return 0;
        // File nodes are div elements within the scrollable content
        var nodes = content.querySelectorAll('div[class*="cursor-pointer"]');
        var count = 0;
        nodes.forEach(function(n) {
          // Files have a text label (no child divs that are collapsible)
          var text = n.textContent || '';
          if (text.length > 0 && text.length < 100) count++;
        });
        return count;
      })()`
    );
  }

  async clickFileByName(name: string): Promise<void> {
    await this.page.evaluate(
      `(() => {
        var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
        if (!sidebar) return;
        var nodes = sidebar.querySelectorAll('div[class*="cursor-pointer"]');
        var target = Array.from(nodes).find(function(n) {
          return (n.textContent || '').includes(${JSON.stringify(name)});
        });
        if (target) target.click();
      })()`
    );
    await sleep(300);
  }

  async hasFilesContent(): Promise<boolean> {
    return await this.page.evaluate<boolean>(
      `(() => {
        var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
        if (!sidebar) return false;
        var content = sidebar.querySelector('.flex-1.overflow-auto');
        if (!content) return false;
        return content.children.length > 0;
      })()`
    );
  }

  async isFileSelected(name: string): Promise<boolean> {
    return await this.page.evaluate<boolean>(
      `(() => {
        var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
        if (!sidebar) return false;
        var selected = sidebar.querySelector('.bg-accent.text-accent-foreground');
        return selected ? (selected.textContent || '').includes(${JSON.stringify(name)}) : false;
      })()`
    );
  }

  async getExplorerText(): Promise<string> {
    return await this.page.evaluate<string>(
      `(() => {
        var sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
        if (!sidebar) return '';
        var content = sidebar.querySelector('.flex-1.overflow-auto');
        return content ? (content.textContent || '').substring(0, 500) : '';
      })()`
    );
  }
}
