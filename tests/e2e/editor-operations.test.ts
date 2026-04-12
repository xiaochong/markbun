import { describe, it, expect } from "bun:test";
import { page } from "../e2e-setup";
import { EditorPage } from "./lib/page-objects/EditorPage";
import { collectTrace } from "./lib/trace";

const WORKSPACE_DIR = process.env.MARKBUN_E2E_HOME || "";

async function withTrace<T>(testName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.log("[trace] Collecting failure trace...");
    const traceDir = await collectTrace(testName, {
      page: page!,
      workspaceDir: WORKSPACE_DIR,
    });
    console.log(`[trace] Saved to ${traceDir}`);
    throw err;
  }
}

describe("editor operations", () => {
  it("focuses editor without error", async () => {
    await withTrace("editor-focus", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.focus();
    });
  }, 30000);

  it("round-trips markdown content", async () => {
    await withTrace("editor-roundtrip", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("# Roundtrip");
      const content = await editor.getMarkdown();
      expect(content.trim()).toBe("# Roundtrip");
    });
  }, 30000);

  it("handles empty markdown", async () => {
    await withTrace("editor-empty", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("");
      const content = await editor.getMarkdown();
      expect(content.trim()).toBe("");
    });
  }, 30000);

  it("toggles sidebar via menu action", async () => {
    await withTrace("editor-toggle-sidebar", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.menuAction("view-toggle-sidebar");
      await new Promise((r) => setTimeout(r, 500));
      const hasSidebar = await page!.evaluate<boolean>(
        `(() => {
          const sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
          return sidebar ? (sidebar as HTMLElement).offsetWidth > 0 : false;
        })()`
      );
      expect(hasSidebar).toBe(true);

      await editor.menuAction("view-toggle-sidebar");
      await new Promise((r) => setTimeout(r, 500));
      const closed = await page!.evaluate<boolean>(
        `(() => {
          const sidebar = document.querySelector('.flex.h-full.flex-shrink-0.transition-all');
          return sidebar ? (sidebar as HTMLElement).offsetWidth === 0 : true;
        })()`
      );
      expect(closed).toBe(true);
    });
  }, 30000);

  it("toggles theme via menu action", async () => {
    await withTrace("editor-toggle-theme", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      const before = await page!.evaluate<string>(
        "document.documentElement.classList.contains('dark') ? 'dark' : 'light'"
      );

      await editor.menuAction("view-toggle-theme");
      await new Promise((r) => setTimeout(r, 500));

      const after = await page!.evaluate<string>(
        "document.documentElement.classList.contains('dark') ? 'dark' : 'light'"
      );
      expect(after).not.toBe(before);

      // Toggle back to restore original theme
      await editor.menuAction("view-toggle-theme");
      await new Promise((r) => setTimeout(r, 500));
    });
  }, 30000);

  it("toggles toolbar via menu action", async () => {
    await withTrace("editor-toggle-toolbar", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.menuAction("view-toggle-toolbar");
      await new Promise((r) => setTimeout(r, 500));
      const hasToolbar = await page!.evaluate<boolean>(
        "Boolean(document.querySelector('.border-b.bg-background.select-none'))"
      );
      expect(hasToolbar).toBe(true);

      await editor.menuAction("view-toggle-toolbar");
      await new Promise((r) => setTimeout(r, 500));
      const gone = await page!.evaluate<boolean>(
        "Boolean(document.querySelector('.border-b.bg-background.select-none'))"
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("creates a new file via menu action", async () => {
    await withTrace("editor-file-new", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("# Existing");
      expect(await editor.getMarkdown()).toContain("Existing");
      await editor.menuAction("file-new");
      await new Promise((r) => setTimeout(r, 500));
      const content = await editor.getMarkdown();
      expect(content.trim()).toBe("");
    });
  }, 30000);

  it("toggles status bar via menu action", async () => {
    await withTrace("editor-toggle-statusbar", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.menuAction("view-toggle-statusbar");
      await new Promise((r) => setTimeout(r, 500));
      const hasStatusBar = await page!.evaluate<boolean>(
        "Boolean(document.querySelector('.flex.items-center.justify-between.px-4.py-1.border-t.bg-background'))"
      );
      expect(hasStatusBar).toBe(true);

      await editor.menuAction("view-toggle-statusbar");
      await new Promise((r) => setTimeout(r, 500));
      const gone = await page!.evaluate<boolean>(
        "Boolean(document.querySelector('.flex.items-center.justify-between.px-4.py-1.border-t.bg-background'))"
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("toggles source mode via menu action", async () => {
    await withTrace("editor-source-mode", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      const hasMilkdown = await page!.evaluate<boolean>(
        "Boolean(document.querySelector('.ProseMirror'))"
      );
      expect(hasMilkdown).toBe(true);

      await editor.menuAction("view-toggle-source-mode");
      await new Promise((r) => setTimeout(r, 500));

      const hasSourceEditor = await page!.evaluate<boolean>(
        "Boolean(document.querySelector('.cm-editor'))"
      );
      expect(hasSourceEditor).toBe(true);

      await editor.menuAction("view-toggle-source-mode");
      await new Promise((r) => setTimeout(r, 500));

      const backToMilkdown = await page!.evaluate<boolean>(
        "Boolean(document.querySelector('.ProseMirror'))"
      );
      expect(backToMilkdown).toBe(true);
    });
  }, 30000);

  it("toggles title bar via menu action", async () => {
    await withTrace("editor-toggle-titlebar", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.menuAction("view-toggle-titlebar");
      await new Promise((r) => setTimeout(r, 500));
      const hasTitleBar = await page!.evaluate<boolean>(
        "Boolean(document.querySelector('.flex.items-center.justify-center.h-8.px-4.bg-background.border-b.text-sm.select-none'))"
      );
      expect(hasTitleBar).toBe(true);

      await editor.menuAction("view-toggle-titlebar");
      await new Promise((r) => setTimeout(r, 500));
      const gone = await page!.evaluate<boolean>(
        "Boolean(document.querySelector('.flex.items-center.justify-center.h-8.px-4.bg-background.border-b.text-sm.select-none'))"
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("applies bold formatting via menu action", async () => {
    await withTrace("editor-bold", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("bold me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("format-strong");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("**bold me**");
    });
  }, 30000);

  it("applies italic formatting via menu action", async () => {
    await withTrace("editor-italic", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("italic me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("format-emphasis");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("*italic me*");
    });
  }, 30000);

  it("applies heading 1 via menu action", async () => {
    await withTrace("editor-heading1", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("heading text");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("para-heading-1");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("# heading text");
    });
  }, 30000);

  it("applies heading 2 via menu action", async () => {
    await withTrace("editor-heading2", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("heading text");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("para-heading-2");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("## heading text");
    });
  }, 30000);

  it("applies inline code formatting via menu action", async () => {
    await withTrace("editor-code", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("code me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("format-code");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("`code me`");
    });
  }, 30000);

  it("applies strikethrough formatting via menu action", async () => {
    await withTrace("editor-strikethrough", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("strike me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("format-strikethrough");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("~~strike me~~");
    });
  }, 30000);

  it("applies link formatting via menu action", async () => {
    await withTrace("editor-link", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("link me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("format-link");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("[link me]");
    });
  }, 30000);

  it("applies blockquote via menu action", async () => {
    await withTrace("editor-blockquote", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("quote me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("para-quote");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("> quote me");
    });
  }, 30000);

  it("applies unordered list via menu action", async () => {
    await withTrace("editor-unordered-list", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("list me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("para-unordered-list");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("list me");
      expect(content).toMatch(/[-*] list me/);
    });
  }, 30000);

  it("applies ordered list via menu action", async () => {
    await withTrace("editor-ordered-list", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("list me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("para-ordered-list");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toMatch(/\d+\. list me/);
    });
  }, 30000);

  it("applies task list via menu action", async () => {
    await withTrace("editor-task-list", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("task me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("para-task-list");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("task me");
      expect(content).toMatch(/[-*] \[ ] task me/);
    });
  }, 30000);

  it("inserts horizontal rule via menu action", async () => {
    await withTrace("editor-hr", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("before");
      await editor.menuAction("para-horizontal-rule");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("---");
    });
  }, 30000);

  it("inserts code block via menu action", async () => {
    await withTrace("editor-code-block", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("");
      await editor.menuAction("para-code-block");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("```");
    });
  }, 30000);

  it("inserts table via menu action", async () => {
    await withTrace("editor-table", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("");
      await editor.menuAction("table-insert");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("|");
    });
  }, 30000);

  it("undo reverts formatting change", async () => {
    await withTrace("editor-undo", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("undo me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("format-strong");
      await new Promise((r) => setTimeout(r, 300));
      expect(await editor.getMarkdown()).toContain("**undo me**");

      await editor.menuAction("editor-undo");
      await new Promise((r) => setTimeout(r, 300));
      const afterUndo = await editor.getMarkdown();
      expect(afterUndo).not.toContain("**undo me**");
    });
  }, 30000);

  it("redo restores undone formatting change", async () => {
    await withTrace("editor-redo", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("redo me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("format-strong");
      await new Promise((r) => setTimeout(r, 300));
      expect(await editor.getMarkdown()).toContain("**redo me**");

      await editor.menuAction("editor-undo");
      await new Promise((r) => setTimeout(r, 300));
      expect(await editor.getMarkdown()).not.toContain("**redo me**");

      await editor.menuAction("editor-redo");
      await new Promise((r) => setTimeout(r, 300));
      const afterRedo = await editor.getMarkdown();
      expect(afterRedo).toContain("**redo me**");
    });
  }, 30000);

  it("toggles AI panel via menu action", async () => {
    await withTrace("editor-toggle-ai-panel", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.menuAction("toggle-ai-panel");
      await new Promise((r) => setTimeout(r, 500));
      const hasPanel = await page!.evaluate<boolean>(
        `(() => {
          const body = document.body.innerText || '';
          return body.includes('AI Not Configured') || body.includes('Open AI Settings');
        })()`
      );
      expect(hasPanel).toBe(true);

      await editor.menuAction("toggle-ai-panel");
      await new Promise((r) => setTimeout(r, 500));
      const gone = await page!.evaluate<boolean>(
        `(() => {
          const body = document.body.innerText || '';
          return body.includes('AI Not Configured') || body.includes('Open AI Settings');
        })()`
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("applies heading 3 via menu action", async () => {
    await withTrace("editor-heading3", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("heading text");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("para-heading-3");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("### heading text");
    });
  }, 30000);

  it("toggles search bar via menu action", async () => {
    await withTrace("editor-toggle-searchbar", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.menuAction("edit-find");
      await new Promise((r) => setTimeout(r, 300));
      const hasSearchBar = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('input[placeholder="Find"]'))`
      );
      expect(hasSearchBar).toBe(true);

      await page!.evaluate(`(() => {
        const btn = document.querySelector('.flex.flex-col.border-b.border-border.bg-background.px-3.py-2.text-sm button:last-child');
        if (btn) (btn as HTMLElement).click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      const gone = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('input[placeholder="Find"]'))`
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("applies heading 4 via menu action", async () => {
    await withTrace("editor-heading4", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("heading text");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("para-heading-4");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("#### heading text");
    });
  }, 30000);

  it("applies heading 5 via menu action", async () => {
    await withTrace("editor-heading5", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("heading text");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("para-heading-5");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("##### heading text");
    });
  }, 30000);

  it("applies heading 6 via menu action", async () => {
    await withTrace("editor-heading6", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("heading text");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("para-heading-6");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("###### heading text");
    });
  }, 30000);

  it("toggles find and replace via menu action", async () => {
    await withTrace("editor-find-replace", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.menuAction("edit-find-and-replace");
      await new Promise((r) => setTimeout(r, 300));
      const hasReplace = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('input[placeholder="Replace"]'))`
      );
      expect(hasReplace).toBe(true);

      await page!.evaluate(`(() => {
        const btn = document.querySelector('.flex.flex-col.border-b.border-border.bg-background.px-3.py-2.text-sm button:last-child');
        if (btn) (btn as HTMLElement).click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      const gone = await page!.evaluate<boolean>(
        `Boolean(document.querySelector('input[placeholder="Replace"]'))`
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("inserts math block via menu action", async () => {
    await withTrace("editor-math-block", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("");
      await editor.menuAction("para-math-block");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("$$");
      expect(content).toContain("E=mc^2");
    });
  }, 30000);

  it("applies inline math formatting via menu action", async () => {
    await withTrace("editor-inline-math", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("math");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("format-inline-math");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("$math$");
    });
  }, 30000);

  it("applies highlight formatting via menu action", async () => {
    await withTrace("editor-highlight", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("highlight me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("format-highlight");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("==highlight me==");
    });
  }, 30000);

  it("sets paragraph via menu action", async () => {
    await withTrace("editor-paragraph", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("# heading text");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("para-paragraph");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content.trim()).toBe("heading text");
    });
  }, 30000);

  it("opens image insert dialog via menu action", async () => {
    await withTrace("editor-image-dialog", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.menuAction("format-image");
      await new Promise((r) => setTimeout(r, 300));
      const hasDialog = await page!.evaluate<boolean>(
        `(() => {
          const body = document.body.innerText || '';
          return body.includes('Insert Image');
        })()`
      );
      expect(hasDialog).toBe(true);

      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const cancelBtn = buttons.find((b) => (b.textContent || '').trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      const gone = await page!.evaluate<boolean>(
        `(() => {
          const body = document.body.innerText || '';
          return body.includes('Insert Image');
        })()`
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("increases heading level via menu action", async () => {
    await withTrace("editor-increase-heading", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("## heading text");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("para-increase-heading");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("# heading text");
      expect(content).not.toContain("## heading text");
    });
  }, 30000);

  it("decreases heading level via menu action", async () => {
    await withTrace("editor-decrease-heading", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("# heading text");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("para-decrease-heading");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("## heading text");
    });
  }, 30000);

  it("inserts mermaid block via menu action", async () => {
    await withTrace("editor-mermaid-block", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("");
      await editor.menuAction("para-mermaid-block");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("mermaid");
      expect(content).toContain("graph TD");
    });
  }, 30000);

  it("opens export html dialog via menu action", async () => {
    await withTrace("editor-export-html", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.menuAction("file-export-html");
      await new Promise((r) => setTimeout(r, 500));
      const hasDialog = await page!.evaluate<boolean>(
        `(() => {
          const body = document.body.innerText || '';
          return body.includes('Export as HTML');
        })()`
      );
      expect(hasDialog).toBe(true);

      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const cancelBtn = buttons.find((b) => (b.textContent || '').trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      const gone = await page!.evaluate<boolean>(
        `(() => {
          const body = document.body.innerText || '';
          return body.includes('Export as HTML');
        })()`
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("opens export image dialog via menu action", async () => {
    await withTrace("editor-export-image", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.menuAction("file-export-image");
      await new Promise((r) => setTimeout(r, 500));
      const hasDialog = await page!.evaluate<boolean>(
        `(() => {
          const body = document.body.innerText || '';
          return body.includes('Export as Image');
        })()`
      );
      expect(hasDialog).toBe(true);

      await page!.evaluate(`(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const cancelBtn = buttons.find((b) => (b.textContent || '').trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()`);
      await new Promise((r) => setTimeout(r, 300));
      const gone = await page!.evaluate<boolean>(
        `(() => {
          const body = document.body.innerText || '';
          return body.includes('Export as Image');
        })()`
      );
      expect(gone).toBe(false);
    });
  }, 30000);

  it("inserts table row below via menu action", async () => {
    await withTrace("editor-table-row-below", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("");
      await editor.menuAction("table-insert");
      await new Promise((r) => setTimeout(r, 500));
      const before = await editor.getMarkdown();

      await page!.click("table td");
      await new Promise((r) => setTimeout(r, 200));
      await editor.menuAction("table-insert-row-below");
      await new Promise((r) => setTimeout(r, 300));
      const after = await editor.getMarkdown();
      expect(after.split("|").length).toBeGreaterThan(before.split("|").length);
    });
  }, 30000);

  it("inserts table column right via menu action", async () => {
    await withTrace("editor-table-col-right", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("");
      await editor.menuAction("table-insert");
      await new Promise((r) => setTimeout(r, 500));
      const before = await editor.getMarkdown();

      await page!.click("table td");
      await new Promise((r) => setTimeout(r, 200));
      await editor.menuAction("table-insert-col-right");
      await new Promise((r) => setTimeout(r, 300));
      const after = await editor.getMarkdown();
      expect(after.split("|").length).toBeGreaterThan(before.split("|").length);
    });
  }, 30000);

  it("deletes table row via menu action", async () => {
    await withTrace("editor-table-delete-row", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("");
      await editor.menuAction("table-insert");
      await new Promise((r) => setTimeout(r, 500));
      const before = await editor.getMarkdown();

      await page!.click("table td");
      await new Promise((r) => setTimeout(r, 200));
      await editor.menuAction("table-delete-row");
      await new Promise((r) => setTimeout(r, 300));
      const after = await editor.getMarkdown();
      expect(after.split("|").length).toBeLessThan(before.split("|").length);
    });
  }, 30000);

  it("deletes table via menu action", async () => {
    await withTrace("editor-table-delete", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("");
      await editor.menuAction("table-insert");
      await new Promise((r) => setTimeout(r, 500));

      await page!.click("table td");
      await new Promise((r) => setTimeout(r, 200));
      await editor.menuAction("table-delete");
      await new Promise((r) => setTimeout(r, 300));
      const after = await editor.getMarkdown();
      expect(after).not.toContain("|");
    });
  }, 30000);

  it("inserts table row above via menu action", async () => {
    await withTrace("editor-table-row-above", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("");
      await editor.menuAction("table-insert");
      await new Promise((r) => setTimeout(r, 500));
      const before = await editor.getMarkdown();

      await page!.click("table td");
      await new Promise((r) => setTimeout(r, 200));
      await editor.menuAction("table-insert-row-above");
      await new Promise((r) => setTimeout(r, 300));
      const after = await editor.getMarkdown();
      expect(after.split("|").length).toBeGreaterThan(before.split("|").length);
    });
  }, 30000);

  it("inserts table column left via menu action", async () => {
    await withTrace("editor-table-col-left", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("");
      await editor.menuAction("table-insert");
      await new Promise((r) => setTimeout(r, 500));
      const before = await editor.getMarkdown();

      await page!.click("table td");
      await new Promise((r) => setTimeout(r, 200));
      await editor.menuAction("table-insert-col-left");
      await new Promise((r) => setTimeout(r, 300));
      const after = await editor.getMarkdown();
      expect(after.split("|").length).toBeGreaterThan(before.split("|").length);
    });
  }, 30000);

  it("deletes table column via menu action", async () => {
    await withTrace("editor-table-delete-col", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("");
      await editor.menuAction("table-insert");
      await new Promise((r) => setTimeout(r, 500));
      const before = await editor.getMarkdown();

      await page!.click("table td");
      await new Promise((r) => setTimeout(r, 200));
      await editor.menuAction("table-delete-col");
      await new Promise((r) => setTimeout(r, 300));
      const after = await editor.getMarkdown();
      expect(after.split("|").length).toBeLessThan(before.split("|").length);
    });
  }, 30000);

  it("applies superscript formatting via menu action", async () => {
    await withTrace("editor-superscript", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("superscript me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("format-superscript");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("^superscript me^");
    });
  }, 30000);

  it("applies subscript formatting via menu action", async () => {
    await withTrace("editor-subscript", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("subscript me");
      await editor.menuAction("editor-select-all");
      await editor.menuAction("format-subscript");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("~subscript me~");
    });
  }, 30000);

  it("inserts paragraph above via menu action", async () => {
    await withTrace("editor-para-above", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("hello");
      await editor.menuAction("editor-select-all");
      await new Promise((r) => setTimeout(r, 300));
      const beforeCount = await page!.evaluate<number>(
        "document.querySelectorAll('.ProseMirror p').length"
      );
      await editor.menuAction("para-insert-above");
      await new Promise((r) => setTimeout(r, 300));
      const afterCount = await page!.evaluate<number>(
        "document.querySelectorAll('.ProseMirror p').length"
      );
      expect(afterCount).toBeGreaterThan(beforeCount);
    });
  }, 30000);

  it("inserts paragraph below via menu action", async () => {
    await withTrace("editor-para-below", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("hello");
      await editor.menuAction("editor-select-all");
      await new Promise((r) => setTimeout(r, 300));
      const beforeCount = await page!.evaluate<number>(
        "document.querySelectorAll('.ProseMirror p').length"
      );
      await editor.menuAction("para-insert-below");
      await new Promise((r) => setTimeout(r, 300));
      const afterCount = await page!.evaluate<number>(
        "document.querySelectorAll('.ProseMirror p').length"
      );
      expect(afterCount).toBeGreaterThan(beforeCount);
    });
  }, 30000);

  it("copies selected text without removing it", async () => {
    await withTrace("editor-copy", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("copy me");
      await editor.menuAction("editor-select-all");
      await new Promise((r) => setTimeout(r, 300));
      await editor.menuAction("editor-copy");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).toContain("copy me");
    });
  }, 30000);

  it("cuts selected text and removes it", async () => {
    await withTrace("editor-cut", async () => {
      const editor = new EditorPage(page!);
      await editor.waitForReady();
      await editor.setMarkdown("cut me");
      await editor.menuAction("editor-select-all");
      await new Promise((r) => setTimeout(r, 300));
      await editor.menuAction("editor-cut");
      await new Promise((r) => setTimeout(r, 300));
      const content = await editor.getMarkdown();
      expect(content).not.toContain("cut me");
    });
  }, 30000);
});
