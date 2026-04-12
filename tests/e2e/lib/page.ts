const CDP_HTTP = "http://127.0.0.1:9222";
const DEFAULT_TIMEOUT = 10000;

type CDPPageInfo = {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
};

type CDPResponse = {
  id?: number;
  result?: any;
  error?: { message: string };
};

export class Page {
  private ws: WebSocket;
  private pending = new Map<number, (msg: CDPResponse) => void>();
  private msgId = 1;
  private closed = false;

  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data as string) as CDPResponse;
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        this.pending.get(msg.id)!(msg);
        this.pending.delete(msg.id);
      }
    };
  }

  static async connect(): Promise<Page> {
    const res = await fetch(`${CDP_HTTP}/json`);
    if (!res.ok) {
      throw new Error(`CDP service not responding (${res.status}), is MarkBun running?`);
    }
    const pages = (await res.json()) as CDPPageInfo[];
    const page =
      pages.find((p) => p.type === "page" && p.title.includes("MarkBun")) ||
      pages.find((p) => p.type === "page" && !p.url.includes("devtools")) ||
      pages[0];
    if (!page) {
      throw new Error("No available page found, please ensure MarkBun is running");
    }

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error(`WebSocket connection failed: ${page.webSocketDebuggerUrl}`));
      setTimeout(() => reject(new Error("WebSocket connection timeout")), 5000);
    });

    return new Page(ws);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.ws.close();
  }

  private send<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = this.msgId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timeout: ${method}`));
      }, DEFAULT_TIMEOUT);
      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        if (msg.error) {
          reject(new Error(`CDP error [${method}]: ${msg.error.message}`));
        } else {
          resolve(msg.result as T);
        }
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const result = await this.send<{ result?: { value?: T }; exceptionDetails?: { text: string } }>(
      "Runtime.evaluate",
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
      }
    );
    if (result.exceptionDetails) {
      const desc = result.exceptionDetails.exception?.description || result.exceptionDetails.text;
      throw new Error(`JS execution error: ${desc}`);
    }
    return result.result?.value as T;
  }

  async evaluateJSON<T>(expression: string): Promise<T> {
    return this.evaluate<T>(expression);
  }

  async click(selector: string): Promise<void> {
    const pos = await this.evaluate<{ x: number; y: number; found: true } | null>(
      `(function() {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width/2, y: r.top + r.height/2, found: true };
      })()`
    );
    if (!pos?.found) {
      throw new Error(`Element not found: ${selector}`);
    }
    await this.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: pos.x,
      y: pos.y,
      button: "left",
      clickCount: 1,
    });
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: pos.x,
      y: pos.y,
      button: "left",
      clickCount: 1,
    });
  }

  async type(text: string): Promise<void> {
    await this.send("Input.insertText", { text });
  }

  async key(keyName: string): Promise<void> {
    const keyMap: Record<string, string> = {
      Enter: "\r",
      Escape: "\u001b",
      Tab: "\t",
      Backspace: "\u0008",
      Delete: "\u007f",
      ArrowUp: "",
      ArrowDown: "",
      ArrowLeft: "",
      ArrowRight: "",
    };
    await this.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: keyName,
      text: keyMap[keyName] || "",
      windowsVirtualKeyCode: 0,
    });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", key: keyName });
  }

  async waitForSelector(
    selector: string,
    options: { timeout?: number; interval?: number } = {}
  ): Promise<void> {
    const timeout = options.timeout ?? 5000;
    const interval = options.interval ?? 200;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const found = await this.evaluate<boolean>(
        `Boolean(document.querySelector(${JSON.stringify(selector)}))`
      );
      if (found) {
        return;
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error(`waitForSelector timeout (${timeout}ms): "${selector}"`);
  }

  async screenshot(path?: string): Promise<Buffer> {
    const { data } = await this.send<{ data: string }>("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    const buffer = Buffer.from(data, "base64");
    if (path) {
      await Bun.write(path, buffer);
    }
    return buffer;
  }
}
