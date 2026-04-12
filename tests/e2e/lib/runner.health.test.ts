import { describe, it, expect } from "bun:test";
import { runApp, stopApp, getProcessCounts, cleanupZombies } from "./runner";

describe("runner health", () => {
  it("starts the app, discovers CDP pages, and cleans up without zombies", async () => {
    const { child, pages, baselinePids } = await runApp();

    expect(pages.length).toBeGreaterThan(0);
    expect(child.pid).toBeDefined();

    await stopApp(child);
    await cleanupZombies(baselinePids);

    const after = await getProcessCounts();
    expect(after.electrobun).toBeLessThanOrEqual(baselinePids.electrobun.length);
    expect(after.cef).toBeLessThanOrEqual(baselinePids.cef.length);
  }, 120000);
});
