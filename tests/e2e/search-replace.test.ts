import { describe, it, expect } from "bun:test";
import { page } from "../e2e-setup";
import { EditorPage } from "./lib/page-objects/EditorPage";
import { SearchBarPage } from "./lib/page-objects/SearchBarPage";
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

describe("search replace", () => {
  it("opens find bar via menu action", async () => {
    await withTrace("search-open-find", async () => {
      const editor = new EditorPage(page!);
      const search = new SearchBarPage(page!);
      await editor.waitForReady();

      await search.openFind();
      expect(await search.isOpen()).toBe(true);

      await search.close();
      await new Promise((r) => setTimeout(r, 300));
      expect(await search.isOpen()).toBe(false);
    });
  }, 30000);

  it("opens find and replace bar via menu action", async () => {
    await withTrace("search-open-replace", async () => {
      const editor = new EditorPage(page!);
      const search = new SearchBarPage(page!);
      await editor.waitForReady();

      await search.openFindAndReplace();
      expect(await search.isOpen()).toBe(true);
      expect(await search.isReplaceVisible()).toBe(true);

      await search.close();
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("finds matching text and shows match count", async () => {
    await withTrace("search-match-count", async () => {
      const editor = new EditorPage(page!);
      const search = new SearchBarPage(page!);
      await editor.waitForReady();

      await editor.setMarkdown("hello world hello");
      await search.openFind();
      await search.typeFindQuery("hello");

      const count = await search.getMatchCount();
      expect(count).toBe(2);

      await search.close();
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("navigates between matches with next and previous", async () => {
    await withTrace("search-navigate", async () => {
      const editor = new EditorPage(page!);
      const search = new SearchBarPage(page!);
      await editor.waitForReady();

      await editor.setMarkdown("alpha beta alpha gamma alpha");
      await search.openFind();
      await search.typeFindQuery("alpha");

      expect(await search.getActiveIndex()).toBe(0);

      await search.clickNextMatch();
      expect(await search.getActiveIndex()).toBe(1);

      await search.clickNextMatch();
      expect(await search.getActiveIndex()).toBe(2);

      await search.clickPrevMatch();
      expect(await search.getActiveIndex()).toBe(1);

      await search.close();
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("replaces current match", async () => {
    await withTrace("search-replace-current", async () => {
      const editor = new EditorPage(page!);
      const search = new SearchBarPage(page!);
      await editor.waitForReady();

      await editor.setMarkdown("foo bar foo");
      await search.openFindAndReplace();
      await search.typeFindQuery("foo");
      await search.typeReplaceQuery("baz");

      await search.clickReplace();
      await new Promise((r) => setTimeout(r, 300));

      const content = await editor.getMarkdown();
      expect(content).toContain("baz");
      // Only first occurrence should be replaced
      expect(content).toContain("foo");

      await search.close();
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("replaces all matches", async () => {
    await withTrace("search-replace-all", async () => {
      const editor = new EditorPage(page!);
      const search = new SearchBarPage(page!);
      await editor.waitForReady();

      await editor.setMarkdown("cat dog cat dog cat");
      await search.openFindAndReplace();
      await search.typeFindQuery("cat");
      await search.typeReplaceQuery("bird");

      await search.clickReplaceAll();
      await new Promise((r) => setTimeout(r, 300));

      const content = await editor.getMarkdown();
      expect(content).not.toContain("cat");
      expect(content).toContain("bird");

      await search.close();
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("toggles case sensitive search", async () => {
    await withTrace("search-case-sensitive", async () => {
      const editor = new EditorPage(page!);
      const search = new SearchBarPage(page!);
      await editor.waitForReady();

      await editor.setMarkdown("Hello hello HELLO");
      await search.openFind();
      await search.typeFindQuery("hello");

      // Case insensitive by default — should find all 3
      expect(await search.getMatchCount()).toBe(3);

      await search.toggleCaseSensitive();
      await new Promise((r) => setTimeout(r, 200));

      // Case sensitive — should find only 1
      expect(await search.getMatchCount()).toBe(1);

      await search.close();
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("toggles regex search", async () => {
    await withTrace("search-regex", async () => {
      const editor = new EditorPage(page!);
      const search = new SearchBarPage(page!);
      await editor.waitForReady();

      await editor.setMarkdown("abc123def456");
      await search.openFind();
      await search.typeFindQuery("\\d+");
      expect(await search.getMatchCount()).toBe(0);

      await search.toggleRegex();
      await new Promise((r) => setTimeout(r, 200));

      const count = await search.getMatchCount();
      expect(count).toBeGreaterThanOrEqual(1);

      await search.close();
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("shows no results for unmatched query", async () => {
    await withTrace("search-no-results", async () => {
      const editor = new EditorPage(page!);
      const search = new SearchBarPage(page!);
      await editor.waitForReady();

      await editor.setMarkdown("hello world");
      await search.openFind();
      await search.typeFindQuery("xyznotfound123");

      expect(await search.getMatchCount()).toBe(0);

      await search.close();
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);

  it("closes search bar via escape key", async () => {
    await withTrace("search-escape-close", async () => {
      const editor = new EditorPage(page!);
      const search = new SearchBarPage(page!);
      await editor.waitForReady();

      await search.openFind();
      expect(await search.isOpen()).toBe(true);

      await page!.key("Escape");
      await new Promise((r) => setTimeout(r, 300));
      expect(await search.isOpen()).toBe(false);
    });
  }, 30000);

  it("shows error state for invalid regex", async () => {
    await withTrace("search-regex-error", async () => {
      const editor = new EditorPage(page!);
      const search = new SearchBarPage(page!);
      await editor.waitForReady();

      await editor.setMarkdown("hello world");
      await search.openFind();
      await search.toggleRegex();
      await new Promise((r) => setTimeout(r, 200));

      await search.typeFindQuery("[invalid");
      await new Promise((r) => setTimeout(r, 200));

      expect(await search.isError()).toBe(true);

      await search.close();
      await new Promise((r) => setTimeout(r, 300));
    });
  }, 30000);
});
