import { describe, it, expect } from "bun:test";
import { page } from "../../e2e-setup";
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

  it("can connect to CDP when MarkBun is running", async () => {
    expect(page).toBeDefined();
    const title = await page!.evaluate<string>("document.title");
    expect(typeof title).toBe("string");
  });

  it("evaluates expressions and returns results via CDP", async () => {
    expect(await page!.evaluate<number>("1 + 2")).toBe(3);
    expect(await page!.evaluate<string>("'hello'")).toBe("hello");
    expect(await page!.evaluate<boolean>("true")).toBe(true);
  });

  it("evaluate returns floats for decimal arithmetic", async () => {
    expect(await page!.evaluate<number>("1.5 + 1.5")).toBe(3.0);
    expect(await page!.evaluate<number>("2.5 * 2")).toBe(5.0);
  });

  it("captures a non-empty screenshot via CDP", async () => {
    const buffer = await page!.screenshot();
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("screenshot buffer has PNG header", async () => {
    const buffer = await page!.screenshot();
    expect(buffer.length).toBeGreaterThan(4);
    const header = buffer.subarray(0, 4);
    expect(header[0]).toBe(0x89);
    expect(header[1]).toBe(0x50);
    expect(header[2]).toBe(0x4E);
    expect(header[3]).toBe(0x47);
  });

  it("waitForSelector resolves for known elements", async () => {
    await page!.waitForSelector("#root", { timeout: 5000 });
  });

  it("waitForSelector resolves immediately for present element with zero timeout", async () => {
    await page!.waitForSelector("#root", { timeout: 0 });
  });

  it("click resolves for existing root element", async () => {
    await page!.click("#root");
  });

  it("evaluateJSON returns parsed objects", async () => {
    const obj = await page!.evaluateJSON<{ a: number }>("({ a: 42 })");
    expect(obj.a).toBe(42);
  });

  it("evaluateJSON returns primitive types", async () => {
    expect(await page!.evaluateJSON<string>('"hello"')).toBe("hello");
    expect(await page!.evaluateJSON<number>("99")).toBe(99);
    expect(await page!.evaluateJSON<boolean>("false")).toBe(false);
  });

  it("types text into a focused input via CDP", async () => {
    await page!.evaluate(`(() => {
      const input = document.createElement('input');
      input.id = '__cdp_type_test__';
      input.style.position = 'fixed';
      input.style.top = '0';
      input.style.left = '0';
      document.body.appendChild(input);
      input.focus();
    })()`);
    await page!.type("hello cdp");
    const value = await page!.evaluate<string>("document.querySelector('#__cdp_type_test__').value");
    expect(value).toBe("hello cdp");
  });

  it("deletes a character via CDP key dispatch", async () => {
    await page!.evaluate(`(() => {
      const input = document.createElement('input');
      input.id = '__cdp_key_test__';
      input.style.position = 'fixed';
      input.style.top = '0';
      input.style.left = '0';
      input.value = 'hello';
      document.body.appendChild(input);
      input.focus();
    })()`);
    await page!.key("Backspace");
    const value = await page!.evaluate<string>("document.querySelector('#__cdp_key_test__').value");
    expect(value).toBe("hell");
  });

  it("sends Enter key in a textarea via CDP", async () => {
    await page!.evaluate(`(() => {
      const ta = document.createElement('textarea');
      ta.id = '__cdp_enter_test__';
      ta.style.position = 'fixed';
      ta.style.top = '0';
      ta.style.left = '0';
      document.body.appendChild(ta);
      ta.focus();
    })()`);
    await page!.type("hello");
    await page!.key("Enter");
    await page!.type("world");
    const value = await page!.evaluate<string>("document.querySelector('#__cdp_enter_test__').value");
    expect(value).toBe("hello\nworld");
  });

  it("waitForSelector throws on missing element", async () => {
    let threw = false;
    try {
      await page!.waitForSelector("#__nonexistent__", { timeout: 500 });
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("click throws for nonexistent element", async () => {
    let threw = false;
    try {
      await page!.click("#__nonexistent_click__");
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });

  it("evaluateJSON returns parsed arrays", async () => {
    const arr = await page!.evaluateJSON<number[]>("[1, 2, 3]");
    expect(Array.isArray(arr)).toBe(true);
    expect(arr[0]).toBe(1);
    expect(arr.length).toBe(3);
  });

  it("evaluate returns null for null expression", async () => {
    const result = await page!.evaluate<null>("null");
    expect(result).toBe(null);
  });

  it("evaluate returns undefined for undefined expression", async () => {
    const result = await page!.evaluate<undefined>("undefined");
    expect(result).toBe(undefined);
  });

  it("evaluateJSON returns nested objects", async () => {
    const obj = await page!.evaluateJSON<{ a: { b: number } }>("({ a: { b: 7 } })");
    expect(obj.a.b).toBe(7);
  });

  it("evaluate returns negative numbers", async () => {
    expect(await page!.evaluate<number>("-5")).toBe(-5);
    expect(await page!.evaluate<number>("-10.5")).toBe(-10.5);
    expect(await page!.evaluate<number>("3 - 8")).toBe(-5);
  });

  it("evaluate returns large integers", async () => {
    expect(await page!.evaluate<number>("9007199254740991")).toBe(9007199254740991);
    expect(await page!.evaluate<number>("-9007199254740991")).toBe(-9007199254740991);
    expect(await page!.evaluate<number>("1000000 * 1000000")).toBe(1000000000000);
  });

  it("evaluate returns boolean expressions", async () => {
    expect(await page!.evaluate<boolean>("1 < 2")).toBe(true);
    expect(await page!.evaluate<boolean>("3 === 4")).toBe(false);
    expect(await page!.evaluate<boolean>("true && false")).toBe(false);
    expect(await page!.evaluate<boolean>("true || false")).toBe(true);
  });

  it("evaluate returns string concatenation", async () => {
    expect(await page!.evaluate<string>("'hello' + ' ' + 'world'")).toBe("hello world");
    expect(await page!.evaluate<string>("'foo'.concat('bar')")).toBe("foobar");
  });

  it("evaluate returns array length and indexing", async () => {
    expect(await page!.evaluate<number>("[1, 2, 3].length")).toBe(3);
    expect(await page!.evaluate<number>("[10, 20, 30][1]")).toBe(20);
    expect(await page!.evaluate<number>("['a', 'b'].indexOf('b')")).toBe(1);
  });

  it("evaluate returns object property access", async () => {
    expect(await page!.evaluate<string>("({ name: 'MarkBun' }).name")).toBe("MarkBun");
    expect(await page!.evaluate<number>("({ count: 42 })['count']")).toBe(42);
  });

  it("evaluate returns regex test results", async () => {
    expect(await page!.evaluate<boolean>("/markbun/i.test('MarkBun')")).toBe(true);
    expect(await page!.evaluate<boolean>("/^\\d+$/.test('abc')")).toBe(false);
  });

  it("evaluate returns Math operations", async () => {
    expect(await page!.evaluate<number>("Math.max(1, 5, 3)")).toBe(5);
    expect(await page!.evaluate<number>("Math.min(10, 2, 8)")).toBe(2);
    expect(await page!.evaluate<number>("Math.abs(-7)")).toBe(7);
  });
});
