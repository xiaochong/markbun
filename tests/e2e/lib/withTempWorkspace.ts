/**
 * Zero-config temporary workspace fixture for E2E tests.
 * Provides isolated filesystem and config directories.
 */

import { mkdirSync, rmSync, copyFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export interface TempWorkspace {
  /** Root directory of the temp workspace */
  dir: string;
  /** Directory for test files */
  filesDir: string;
  /** Directory for MarkBun config (~/.config/markbun will redirect here) */
  configDir: string;
  /** Copy seed files from tests/e2e/fixtures/ into filesDir */
  seed(files: string[]): void;
  /** Remove the temp workspace recursively */
  cleanup(): void;
}

export function withTempWorkspace(): TempWorkspace {
  const randomSuffix = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const dir = join(tmpdir(), "markbun-e2e", randomSuffix);
  const filesDir = join(dir, "files");
  const configDir = join(dir, ".config", "markbun");

  mkdirSync(filesDir, { recursive: true });
  mkdirSync(configDir, { recursive: true });

  return {
    dir,
    filesDir,
    configDir,
    seed(files: string[]) {
      const fixturesDir = join(import.meta.dir, "..", "fixtures");
      for (const file of files) {
        const src = join(fixturesDir, file);
        const dst = join(filesDir, file);
        if (existsSync(src)) {
          mkdirSync(join(dst, ".."), { recursive: true });
          copyFileSync(src, dst);
        } else {
          console.warn(`[withTempWorkspace] Seed file not found: ${src}`);
        }
      }
    },
    cleanup() {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        console.warn("[withTempWorkspace] Cleanup warning:", err);
      }
    },
  };
}
