/**
 * E2E test runner for MarkBun.
 * Spawns the app via `bun run dev:hmr`, discovers CDP pages, and cleans up.
 */

import { spawn, type ChildProcess } from "child_process";
import { withTempWorkspace } from "./withTempWorkspace";

const CDP_URL = "http://127.0.0.1:9222/json";
const MAX_WAIT_MS = 90000;
const POLL_INTERVAL_MS = 500;

export interface RunAppOptions {
  env?: Record<string, string>;
}

export interface RunAppResult {
  child: ChildProcess;
  pages: any[];
  baselinePids: {
    electrobun: number[];
    cef: number[];
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCdpPages(): Promise<any[]> {
  try {
    const res = await fetch(CDP_URL, { signal: AbortSignal.timeout(2000) });
    if (res.ok) return await res.json();
  } catch {
    // ignore
  }
  return [];
}

async function listPgrepPids(pattern: string): Promise<number[]> {
  const proc = spawn("pgrep", ["-f", pattern]);
  let out = "";
  proc.stdout.on("data", (d) => (out += d.toString()));
  await new Promise<void>((resolve) => proc.on("close", () => resolve()));
  if (!out.trim()) return [];
  return out
    .trim()
    .split("\n")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

async function countPgrep(pattern: string): Promise<number> {
  const pids = await listPgrepPids(pattern);
  return pids.length;
}

async function killExistingProcesses(): Promise<void> {
  const pids = await listPgrepPids("electrobun");
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // ignore
    }
  }
  await sleep(500);
}

export async function runApp(options: RunAppOptions = {}): Promise<RunAppResult> {
  // Ensure no stale app instances are running (prevents CEF from reusing an old session)
  await killExistingProcesses();

  const baselinePids = {
    electrobun: await listPgrepPids("electrobun"),
    cef: await listPgrepPids("CEF"),
  };

  const env: Record<string, string> = {
    ...process.env,
    MARKBUN_TEST: "1",
    ...options.env,
  };

  if (options.env?.MARKBUN_E2E_HOME) {
    env.MARKBUN_E2E_HOME = options.env.MARKBUN_E2E_HOME;
  }

  const child = spawn("bun", ["run", "dev:hmr"], {
    detached: true,
    stdio: "ignore",
    env,
  });

  if (!child.pid) {
    throw new Error("Failed to spawn app: child.pid is undefined");
  }

  const start = Date.now();
  let pages: any[] = [];
  while (Date.now() - start < MAX_WAIT_MS) {
    pages = await getCdpPages();
    if (pages.length > 0) {
      break;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  if (pages.length === 0) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // ignore
    }
    throw new Error(`CDP did not respond with any pages within ${MAX_WAIT_MS}ms`);
  }

  return { child, pages, baselinePids };
}

export async function stopApp(child: ChildProcess): Promise<void> {
  if (!child.pid) {
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    // ignore
  }

  await sleep(3000);

  let alive = true;
  try {
    process.kill(child.pid, 0);
  } catch {
    alive = false;
  }

  if (alive) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // ignore
    }
    await sleep(1000);
  }
}

export async function cleanupZombies(baselinePids: { electrobun: number[]; cef: number[] }): Promise<void> {
  const maxRetries = 5;
  for (let i = 0; i < maxRetries; i++) {
    const currentElectrobun = await listPgrepPids("electrobun");
    const currentCef = await listPgrepPids("CEF");
    const leakedElectrobun = currentElectrobun.filter((pid) => !baselinePids.electrobun.includes(pid));
    const leakedCef = currentCef.filter((pid) => !baselinePids.cef.includes(pid));

    if (leakedElectrobun.length === 0 && leakedCef.length === 0) {
      break;
    }

    for (const pid of leakedElectrobun) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // ignore
      }
    }
    for (const pid of leakedCef) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // ignore
      }
    }
    await sleep(500);
  }
}

export async function runTests(args: string[] = []): Promise<number> {
  const testArgs = ["test", "--preload", "tests/e2e-setup.ts", ...args];
  if (args.length === 0) {
    testArgs.push("tests/e2e/");
  }

  return new Promise((resolve) => {
    const proc = spawn("bun", testArgs, {
      stdio: "inherit",
      env: { ...process.env },
    });

    proc.on("close", (code) => {
      resolve(code ?? 1);
    });

    proc.on("error", () => {
      resolve(1);
    });
  });
}

export async function getProcessCounts(): Promise<{
  electrobun: number;
  cef: number;
}> {
  const electrobun = await countPgrep("electrobun");
  const cef = await countPgrep("CEF");
  return { electrobun, cef };
}

export default { runApp, stopApp, runTests, getProcessCounts, cleanupZombies };

if (import.meta.main) {
  (async () => {
    const args = process.argv.slice(2);
    console.log("[runner] Starting MarkBun for E2E tests...");

    const workspace = withTempWorkspace();
    process.env.MARKBUN_E2E_HOME = workspace.dir;
    console.log(`[runner] Workspace: ${workspace.dir}`);

    let result: RunAppResult | undefined;
    let exitCode = 1;

    try {
      result = await runApp({ env: { MARKBUN_E2E_HOME: workspace.dir } });
      console.log(`[runner] App ready (pid=${result.child.pid}, pages=${result.pages.length})`);

      exitCode = await runTests(args);
      console.log(`[runner] Tests finished with exit code ${exitCode}`);
    } catch (err: any) {
      console.error("[runner] Failed:", err.message);
      exitCode = 1;
    } finally {
      if (result) {
        console.log("[runner] Stopping app...");
        await stopApp(result.child);
        console.log("[runner] Cleaning up zombies...");
        await cleanupZombies(result.baselinePids);
      }
      console.log("[runner] Cleaning up workspace...");
      workspace.cleanup();
      process.exit(exitCode);
    }
  })();
}
