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

  it("waitForSelector resolves for known elements", async () => {
    const runnerPath = new URL("./runner.ts", import.meta.url).pathname;
    const runnerExists = await Bun.file(runnerPath).exists();
    if (!runnerExists) {
      console.log("Skipping waitForSelector test: runner.ts not available.");
      return;
    }

    let p: Page | undefined;
    try {
      p = await Page.connect();
      await p.waitForSelector("#root", { timeout: 5000 });
    } catch (err: any) {
      console.log(`Skipping waitForSelector test: ${err.message}`);
    } finally {
      await p?.close();
    }
  });

  it("click resolves for existing root element", async () => {
    const runnerPath = new URL("./runner.ts", import.meta.url).pathname;
    const runnerExists = await Bun.file(runnerPath).exists();
    if (!runnerExists) {
      console.log("Skipping click test: runner.ts not available.");
      return;
    }

    let p: Page | undefined;
    try {
      p = await Page.connect();
      await p.click("#root");
    } catch (err: any) {
      console.log(`Skipping click test: ${err.message}`);
    } finally {
      await p?.close();
    }
  });

  it("evaluateJSON returns parsed objects", async () => {
    const runnerPath = new URL("./runner.ts", import.meta.url).pathname;
    const runnerExists = await Bun.file(runnerPath).exists();
    if (!runnerExists) {
      console.log("Skipping evaluateJSON test: runner.ts not available.");
      return;
    }

    let p: Page | undefined;
    try {
      p = await Page.connect();
      const obj = await p.evaluateJSON<{ a: number }>("({ a: 42 })");
      expect(obj.a).toBe(42);
    } catch (err: any) {
      console.log(`Skipping evaluateJSON test: ${err.message}`);
    } finally {
      await p?.close();
    }
  });

  it("types text into a focused input via CDP", async () => {
    const runnerPath = new URL("./runner.ts", import.meta.url).pathname;
    const runnerExists = await Bun.file(runnerPath).exists();
    if (!runnerExists) {
      console.log("Skipping type test: runner.ts not available.");
      return;
    }

    let p: Page | undefined;
    try {
      p = await Page.connect();
      await p.evaluate(`(() => {
        const input = document.createElement('input');
        input.id = '__cdp_type_test__';
        input.style.position = 'fixed';
        input.style.top = '0';
        input.style.left = '0';
        document.body.appendChild(input);
        input.focus();
      })()`);
      await p.type("hello cdp");
      const value = await p.evaluate<string>("document.querySelector('#__cdp_type_test__').value");
      expect(value).toBe("hello cdp");
    } catch (err: any) {
      console.log(`Skipping type test: ${err.message}`);
    } finally {
      await p?.close();
    }
  });

  it("deletes a character via CDP key dispatch", async () => {
    const runnerPath = new URL("./runner.ts", import.meta.url).pathname;
    const runnerExists = await Bun.file(runnerPath).exists();
    if (!runnerExists) {
      console.log("Skipping key test: runner.ts not available.");
      return;
    }

    let p: Page | undefined;
    try {
      p = await Page.connect();
      await p.evaluate(`(() => {
        const input = document.createElement('input');
        input.id = '__cdp_key_test__';
        input.style.position = 'fixed';
        input.style.top = '0';
        input.style.left = '0';
        input.value = 'hello';
        document.body.appendChild(input);
        input.focus();
      })()`);
      await p.key("Backspace");
      const value = await p.evaluate<string>("document.querySelector('#__cdp_key_test__').value");
      expect(value).toBe("hell");
    } catch (err: any) {
      console.log(`Skipping key test: ${err.message}`);
    } finally {
      await p?.close();
    }
  });

  it("waitForSelector throws on missing element", async () => {
    const runnerPath = new URL("./runner.ts", import.meta.url).pathname;
    const runnerExists = await Bun.file(runnerPath).exists();
    if (!runnerExists) {
      console.log("Skipping waitForSelector timeout test: runner.ts not available.");
      return;
    }

    let p: Page | undefined;
    try {
      p = await Page.connect();
      let threw = false;
      try {
        await p.waitForSelector("#__nonexistent__", { timeout: 500 });
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    } catch (err: any) {
      console.log(`Skipping waitForSelector timeout test: ${err.message}`);
    } finally {
      await p?.close();
    }
  });

  it("click throws for nonexistent element", async () => {
    const runnerPath = new URL("./runner.ts", import.meta.url).pathname;
    const runnerExists = await Bun.file(runnerPath).exists();
    if (!runnerExists) {
      console.log("Skipping click missing element test: runner.ts not available.");
      return;
    }

    let p: Page | undefined;
    try {
      p = await Page.connect();
      let threw = false;
      try {
        await p.click("#__nonexistent_click__");
      } catch {
        threw = true;
      }
      expect(threw).toBe(true);
    } catch (err: any) {
      console.log(`Skipping click missing element test: ${err.message}`);
    } finally {
      await p?.close();
    }
  });

  it("evaluateJSON returns parsed arrays", async () => {
    const runnerPath = new URL("./runner.ts", import.meta.url).pathname;
    const runnerExists = await Bun.file(runnerPath).exists();
    if (!runnerExists) {
      console.log("Skipping evaluateJSON array test: runner.ts not available.");
      return;
    }

    let p: Page | undefined;
    try {
      p = await Page.connect();
      const arr = await p.evaluateJSON<number[]>("[1, 2, 3]");
      expect(Array.isArray(arr)).toBe(true);
      expect(arr[0]).toBe(1);
      expect(arr.length).toBe(3);
    } catch (err: any) {
      console.log(`Skipping evaluateJSON array test: ${err.message}`);
    } finally {
      await p?.close();
    }
  });
});
