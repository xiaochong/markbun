/**
 * Auto-trace collection for failed E2E tests.
 */

import { readdirSync, statSync, writeFileSync, mkdirSync } from "fs";
import { join, relative } from "path";
import type { Page } from "./page";

export interface TraceContext {
  page: Page;
  workspaceDir: string;
}

export async function collectTrace(
  testName: string,
  ctx: TraceContext
): Promise<string> {
  const timestamp = Date.now();
  const traceDir = join(
    import.meta.dir,
    "..",
    "__traces__",
    `${testName}-${timestamp}`
  );
  mkdirSync(traceDir, { recursive: true });

  // Screenshot
  try {
    const screenshot = await ctx.page.screenshot();
    writeFileSync(join(traceDir, "screenshot.png"), screenshot);
  } catch (err: any) {
    writeFileSync(join(traceDir, "screenshot.error.txt"), err.message);
  }

  // DOM snapshot
  try {
    const html = await ctx.page.evaluate<string>(
      "document.documentElement.outerHTML"
    );
    writeFileSync(join(traceDir, "dom.html"), html);
  } catch (err: any) {
    writeFileSync(join(traceDir, "dom.error.txt"), err.message);
  }

  // Workspace file tree
  try {
    const tree = listFileTree(ctx.workspaceDir);
    writeFileSync(join(traceDir, "workspace-tree.txt"), tree);
  } catch (err: any) {
    writeFileSync(join(traceDir, "workspace-tree.error.txt"), err.message);
  }

  return traceDir;
}

function listFileTree(dir: string, prefix = ""): string {
  let out = "";
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    const rel = relative(dir, fullPath);
    if (stat.isDirectory()) {
      out += `${prefix}${rel}/\n`;
      out += listFileTree(fullPath, prefix + "  ");
    } else {
      out += `${prefix}${rel}\n`;
    }
  }
  return out || "(empty)\n";
}
