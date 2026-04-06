/**
 * i18n Key Completeness Validator
 *
 * Recursively compares all locale key structures against the `en` reference.
 * Reports missing and extra keys with dot-notation paths.
 *
 * Usage:
 *   bun run scripts/validate-i18n.ts [locale-dir]
 *
 * Default locale-dir: src/shared/i18n/locales
 * Exit code: 0 = all clean, 1 = mismatches found or error
 */

import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';

interface Mismatch {
  namespace: string;
  lang: string;
  missing: string[];
  extra: string[];
}

function collectKeyPaths(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return prefix ? [prefix] : [];
  }
  const paths: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      paths.push(...collectKeyPaths(value, path));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content) as Record<string, unknown>;
}

async function validateLocales(localesDir: string): Promise<Mismatch[]> {
  const absDir = resolve(localesDir);

  let entries: string[];
  try {
    entries = await readdir(absDir);
  } catch {
    console.error(`Error: locale directory not found: ${absDir}`);
    process.exit(1);
  }

  // Find language directories
  const langs = entries.filter(async (e) => {
    try {
      const stat = await import('fs/promises').then((m) => m.stat(join(absDir, e)));
      return stat.isDirectory();
    } catch {
      return false;
    }
  });

  // Actually read directories synchronously-style
  const { statSync } = await import('fs');
  const langDirs = entries.filter((e) => {
    try {
      return statSync(join(absDir, e)).isDirectory();
    } catch {
      return false;
    }
  });

  if (!langDirs.includes('en')) {
    console.error(`Error: 'en' reference locale not found in ${absDir}`);
    process.exit(1);
  }

  // Get all namespaces from en
  const enFiles = (await readdir(join(absDir, 'en')))
    .filter((f) => f.endsWith('.json'));

  const mismatches: Mismatch[] = [];

  for (const nsFile of enFiles) {
    const namespace = nsFile.replace('.json', '');
    const enData = await readJson(join(absDir, 'en', nsFile));
    const enKeys = new Set(collectKeyPaths(enData));

    for (const lang of langDirs) {
      if (lang === 'en') continue;

      const langFilePath = join(absDir, lang, nsFile);
      let langData: Record<string, unknown>;
      try {
        langData = await readJson(langFilePath);
      } catch {
        mismatches.push({
          namespace,
          lang,
          missing: [...enKeys],
          extra: [],
        });
        continue;
      }

      const langKeys = collectKeyPaths(langData);
      const langKeySet = new Set(langKeys);

      const missing = [...enKeys].filter((k) => !langKeySet.has(k));
      const extra = langKeys.filter((k) => !enKeys.has(k));

      if (missing.length > 0 || extra.length > 0) {
        mismatches.push({ namespace, lang, missing, extra });
      }
    }
  }

  return mismatches;
}

function reportMismatches(mismatches: Mismatch[]): void {
  if (mismatches.length === 0) {
    console.log('✓ All locale keys are in sync');
    return;
  }

  let totalMissing = 0;
  let totalExtra = 0;

  for (const m of mismatches) {
    console.error(`\n[${m.namespace}] ${m.lang}:`);
    for (const key of m.missing) {
      console.error(`  missing: ${key}`);
      totalMissing++;
    }
    for (const key of m.extra) {
      console.error(`  extra:   ${key}`);
      totalExtra++;
    }
  }

  console.error(
    `\n✗ ${mismatches.length} locale(s) with mismatches: ${totalMissing} missing, ${totalExtra} extra keys`
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const localesDir = process.argv[2] || 'src/shared/i18n/locales';

const mismatches = await validateLocales(localesDir);
reportMismatches(mismatches);

if (mismatches.length > 0) {
  process.exit(1);
}
