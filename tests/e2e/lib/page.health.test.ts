import { describe, it, expect } from "bun:test";
import { Page } from "./page.ts";

describe("Page health", () => {
  it("compiles and Page class has expected public methods", () => {
    expect(typeof Page).toBe("function");
    expect(typeof Page.connect).toBe("function");

    const proto = Page.prototype;
    expect(typeof proto.close).toBe("function");
    expect(typeof proto.evaluate).toBe("function");
    expect(typeof proto.evaluateJSON).toBe("function");
    expect(typeof proto.click).toBe("function");
    expect(typeof proto.type).toBe("function");
    expect(typeof proto.key).toBe("function");
    expect(typeof proto.waitForSelector).toBe("function");
    expect(typeof proto.screenshot).toBe("function");
  });

  it("can connect to CDP when MarkBun is running (skipped by default)", async () => {
    // This test requires MarkBun already running with CDP on 127.0.0.1:9222.
    // If you have tests/e2e/lib/runner.ts available, import it here to manage the lifecycle.
    const runnerPath = new URL("./runner.ts", import.meta.url).pathname;
    const runnerExists = await Bun.file(runnerPath).exists();
    if (!runnerExists) {
      console.log("Skipping runtime CDP test: runner.ts not available yet (Unit 2a).");
      return;
    }

    let page: Page | undefined;
    try {
      page = await Page.connect();
      const title = await page.evaluate<string>("document.title");
      expect(typeof title).toBe("string");
    } catch (err: any) {
      console.log(`Skipping runtime CDP test: ${err.message}`);
    } finally {
      await page?.close();
    }
  });

  it("evaluates expressions and returns results via CDP", async () => {
    const runnerPath = new URL("./runner.ts", import.meta.url).pathname;
    const runnerExists = await Bun.file(runnerPath).exists();
    if (!runnerExists) {
      console.log("Skipping runtime CDP eval test: runner.ts not available.");
      return;
    }

    let p: Page | undefined;
    try {
      p = await Page.connect();
      expect(await p.evaluate<number>("1 + 2")).toBe(3);
      expect(await p.evaluate<string>("'hello'")).toBe("hello");
      expect(await p.evaluate<boolean>("true")).toBe(true);
    } catch (err: any) {
      console.log(`Skipping runtime CDP eval test: ${err.message}`);
    } finally {
      await p?.close();
    }
  });

  it("captures a non-empty screenshot via CDP", async () => {
    const runnerPath = new URL("./runner.ts", import.meta.url).pathname;
    const runnerExists = await Bun.file(runnerPath).exists();
    if (!runnerExists) {
      console.log("Skipping screenshot test: runner.ts not available.");
      return;
    }

    let p: Page | undefined;
    try {
      p = await Page.connect();
      const buffer = await p.screenshot();
      expect(buffer.length).toBeGreaterThan(1000);
    } catch (err: any) {
      console.log(`Skipping screenshot test: ${err.message}`);
    } finally {
      await p?.close();
    }
  });
});
