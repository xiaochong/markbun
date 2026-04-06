/**
 * validate-i18n.ts unit tests
 *
 * Tests the key comparison logic in isolation using temp locale directories.
 * Does NOT depend on the actual project locale files.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, writeFile, rm, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

async function createTempLocaleDir(
  structure: Record<string, Record<string, Record<string, unknown>>>
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'validate-i18n-test-'));
  for (const [lang, namespaces] of Object.entries(structure)) {
    const langDir = join(dir, lang);
    await mkdir(langDir, { recursive: true });
    for (const [ns, data] of Object.entries(namespaces)) {
      await writeFile(join(langDir, `${ns}.json`), JSON.stringify(data, null, 2));
    }
  }
  return dir;
}

function runValidate(dir: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`bun run scripts/validate-i18n.ts "${dir}" 2>&1`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (e: any) {
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    };
  }
}

describe('validate-i18n', () => {
  let tempDir: string;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('passes when all locales match en', async () => {
    tempDir = await createTempLocaleDir({
      en: { common: { button: { ok: 'OK' } } },
      de: { common: { button: { ok: 'OK DE' } } },
    });

    const result = runValidate(tempDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('All locale keys are in sync');
  });

  it('detects missing keys with dot-notation paths', async () => {
    tempDir = await createTempLocaleDir({
      en: { common: { button: { ok: 'OK', cancel: 'Cancel' } } },
      de: { common: { button: { ok: 'OK' } } },
    });

    const result = runValidate(tempDir);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('button.cancel');
    expect(result.stdout).toContain('missing');
  });

  it('detects extra keys not in en', async () => {
    tempDir = await createTempLocaleDir({
      en: { common: { button: { ok: 'OK' } } },
      de: { common: { button: { ok: 'OK DE', extra: 'Extra' } } },
    });

    const result = runValidate(tempDir);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('button.extra');
    expect(result.stdout).toContain('extra');
  });

  it('handles deeply nested JSON (3+ levels)', async () => {
    tempDir = await createTempLocaleDir({
      en: { deep: { a: { b: { c: 'C', d: 'D' } } } },
      de: { deep: { a: { b: { c: 'C DE' } } } },
    });

    const result = runValidate(tempDir);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('a.b.d');
  });

  it('reports all keys missing when locale has empty object', async () => {
    tempDir = await createTempLocaleDir({
      en: { common: { ok: 'OK', cancel: 'Cancel' } },
      fr: { common: {} },
    });

    const result = runValidate(tempDir);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('ok');
    expect(result.stdout).toContain('cancel');
  });

  it('passes for zh-CN when fully synced', async () => {
    tempDir = await createTempLocaleDir({
      en: { editor: { bold: 'Bold', italic: 'Italic' } },
      'zh-CN': { editor: { bold: '加粗', italic: '斜体' } },
    });

    const result = runValidate(tempDir);
    expect(result.exitCode).toBe(0);
  });

  it('reports errors across multiple namespaces', async () => {
    tempDir = await createTempLocaleDir({
      en: {
        common: { ok: 'OK', cancel: 'Cancel' },
        editor: { bold: 'Bold' },
      },
      ja: {
        common: { ok: 'OK JA' },
        // editor.json missing entirely → all editor keys missing
      },
    });

    const result = runValidate(tempDir);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('[common]');
    expect(result.stdout).toContain('cancel');
    expect(result.stdout).toContain('[editor]');
    expect(result.stdout).toContain('bold');
  });

  it('reports clear error for non-existent directory', async () => {
    const result = runValidate('/nonexistent/path/locales');
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('not found');
  });
});
