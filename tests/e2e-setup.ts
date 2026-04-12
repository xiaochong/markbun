/**
 * Global E2E test setup.
 * Preloaded by the runner via `bun test --preload tests/e2e-setup.ts`.
 */

import { beforeAll, afterAll, beforeEach, setDefaultTimeout } from "bun:test";
import { Page } from "./e2e/lib/page.ts";
import { getProcessCounts } from "./e2e/lib/runner";

export let page: Page | undefined;

setDefaultTimeout(60000);

beforeAll(async () => {
  const counts = await getProcessCounts();
  if (counts.electrobun > 5 || counts.cef > 10) {
    console.warn("[e2e-setup] Warning: high baseline process counts detected", counts);
  }

  console.log("[e2e-setup] Connecting to CDP...");
  page = await Page.connect();
  const title = await page.evaluate<string>("document.title");
  const url = await page.evaluate<string>("location.href");
  console.log(`[e2e-setup] CDP connected. Page: "${title}" at ${url}`);
  console.log("[e2e-setup] Waiting for app DOM...");
  await page.waitForSelector("#root", { timeout: 30000 });
  console.log("[e2e-setup] App DOM ready.");
  console.log("[e2e-setup] Waiting for React mount...");
  const start = Date.now();
  while (Date.now() - start < 30000) {
    const testApiReady = await page.evaluate<boolean>(
      "typeof window.__markbunTestAPI !== 'undefined'"
    );
    if (testApiReady) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log("[e2e-setup] React mount ready.");
});

beforeEach(async () => {
  // Dismiss any lingering overlays (QuickOpen, dialogs, etc.) between tests
  try {
    await page?.key("Escape");
    await new Promise((r) => setTimeout(r, 200));
    await page?.key("Escape");
    await new Promise((r) => setTimeout(r, 200));
  } catch {
    // ignore
  }
});

afterAll(async () => {
  console.log("[e2e-setup] Closing CDP connection...");
  await page?.close();
  page = undefined;
  console.log("[e2e-setup] CDP closed.");

  const counts = await getProcessCounts();
  if (counts.electrobun > 0 || counts.cef > 0) {
    console.warn("[e2e-setup] Note: app processes still running (runner will teardown)", counts);
  }
});
