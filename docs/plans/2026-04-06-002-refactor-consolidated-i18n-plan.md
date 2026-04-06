---
title: "refactor: Consolidated i18n Source of Truth"
type: refactor
status: completed
date: 2026-04-06
origin: docs/brainstorms/2026-04-06-consolidated-i18n-requirements.md
---

# Consolidated i18n Source of Truth

## Overview

Consolidate i18n locale JSON files from two process trees (`src/bun/i18n/locales/` and `src/mainview/i18n/locales/`) into a single canonical source under `src/shared/i18n/locales/`. Add a key-completeness validation script and integrate it into the project's quality gate.

## Problem Frame

MarkBun's translation files are split across two process trees, with the renderer already cross-importing menu translations from the main process directory. Adding new languages or namespaces requires coordinated updates in multiple locations. Additionally, key drift already exists (~66 missing keys across 6 non-en languages), but no automated validation catches it. (See origin: `docs/brainstorms/2026-04-06-consolidated-i18n-requirements.md`)

**Two independent concerns addressed by this plan:**
1. Cross-process import hygiene — the renderer imports menu JSON from `../../bun/i18n/locales/`
2. Key drift detection — no automated check exists; 66 keys are already missing

The file consolidation (Units 2-3) addresses concern 1 and creates the single source of truth. The validation script (Unit 1) addresses concern 2. These are complementary but independent — the validation script works on any directory layout.

## Requirements Trace

- R1. All 7 namespace locale JSONs move to `src/shared/i18n/locales/{lang}/{namespace}.json`
- R2. Both processes and `types.ts` import only from shared, eliminating cross-process references
- R3. Each process keeps its own i18next init, updating only import paths
- R4. Validation script recursively compares all locale key sets against `en` (missing + extra keys, dot-notation paths)
- R5. Validation integrated into quality gate (lint script + pre-commit hook)
- R6. Validation failures output clear error: namespace, language, missing/extra key path
- R7. Backfill missing keys in non-en locales (de, es, fr, ja, ko, pt) before enabling the gate

## Scope Boundaries

- No dynamic/async locale loading — keep static imports
- No i18next config changes (namespace list, fallback strategy unchanged)
- No key naming convention or content changes
- No TypeScript compile-time key checking
- No merging of i18next instances across processes
- No shared resource builder helper — each process keeps its own init boilerplate

## Context & Research

### Relevant Code and Patterns

- `src/bun/i18n/index.ts` — main process init, plain i18next, imports 8 menu JSONs via `./locales/<lang>/menu.json`
- `src/mainview/i18n/index.ts` — renderer init, react-i18next, imports 48 renderer JSONs + 8 menu JSONs from `../../bun/i18n/locales/`
- `src/shared/i18n/types.ts` — `I18nResources` interface, 7 `import type` from both process trees
- `src/shared/i18n/config.ts` — `SUPPORTED_LANGUAGES`, `resolveLanguage()` — no locale file imports
- `vite.config.ts` — `@/shared` alias maps to `./src/shared` (already available but unused by i18n)
- `package.json` — `"lint": "bun run typecheck && bun test"` — existing quality gate, no pre-commit hook

### Test Setup

- Bun test runner, tests in `tests/unit/` mirroring `src/` structure
- No existing i18n tests — this plan adds the first

## Key Technical Decisions

- **Pure Bun validation script** (not i18next API): The script only needs to compare JSON key structures — no i18n framework dependency required. Runs as `scripts/validate-i18n.ts` via `bun run`.
- **Relative path imports** (not `@/shared` alias): Both processes already use relative paths. Maintaining this pattern avoids introducing a new import convention and works identically in Bun runtime and Vite build.
- **Single atomic commit for file move**: All 3 import files updated simultaneously to avoid a broken intermediate state.
- **Validation added to `lint` script**: Existing gate, zero new infrastructure. Optional `.git/hooks/pre-commit` as local convenience.
- **Backfill uses en values as placeholders**: i18next's `fallbackLng: 'en'` already serves English for missing keys at runtime. The backfill makes the validation script pass but does not change user-visible behavior. Proper translations are a separate follow-up task.

## Implementation Units

- [x] **Unit 1: Key completeness validation script**

**Goal:** Create a standalone script that recursively compares all locale key structures against `en`, reporting missing and extra keys with dot-notation paths.

**Requirements:** R4, R6

**Dependencies:** None

**Files:**
- Create: `scripts/validate-i18n.ts`
- Test: `tests/unit/scripts/validate-i18n.test.ts`

**Approach:**
- Scan all `{lang}/{namespace}.json` files under the locale directory (initially `src/mainview/i18n/locales/` and `src/bun/i18n/locales/`; after Unit 2, `src/shared/i18n/locales/`)
- For each namespace, recursively collect all key paths from `en` as the reference set
- Compare each non-en locale's key set against `en`
- Report missing keys (in en but not in locale) and extra keys (in locale but not in en)
- Exit with code 1 if any mismatch found, 0 if all clean
- Accept locale directory path as CLI argument (defaulting to `src/shared/i18n/locales/`)
- Must work before AND after consolidation — use configurable path

**Patterns to follow:**
- `tests/unit/bun/services/backup.test.ts` — test structure for Bun services

**Test scenarios:**
- Happy path: all locales match en → exit 0
- Missing key: locale missing a key present in en → reported with dot path, exit 1
- Extra key: locale has key not in en → reported with dot path, exit 1
- Nested keys: deeply nested JSON (3+ levels) → recursive comparison works correctly
- Empty namespace: locale has empty `{}` where en has keys → all keys reported missing
- zh-CN passes: zh-CN is fully synced → no errors for zh-CN
- Multi-namespace error: errors in multiple namespaces → all reported, not just first
- Non-existent path: invalid directory argument → clear error message, exit 1

**Verification:**
- Script detects the 66 known missing keys when run against current locale files
- All tests pass via `bun test`

---

- [x] **Unit 2: Move locale files and update imports**

**Goal:** Move all 56 locale JSON files to `src/shared/i18n/locales/{lang}/{namespace}.json` and update all import paths in a single atomic commit.

**Requirements:** R1, R2, R3

**Dependencies:** None (can be done in parallel with Unit 1)

**Files:**
- Create: `src/shared/i18n/locales/{lang}/{namespace}.json` — 56 files (8 langs × 7 namespaces)
- Modify: `src/bun/i18n/index.ts` — update 8 menu import paths
- Modify: `src/mainview/i18n/index.ts` — update 56 import paths (48 renderer + 8 menu)
- Modify: `src/shared/i18n/types.ts` — update 7 type import paths
- Delete: `src/bun/i18n/locales/` — 8 menu JSON files
- Delete: `src/mainview/i18n/locales/` — 48 renderer JSON files

**Approach:**
1. Create directory structure `src/shared/i18n/locales/{lang}/` for all 8 languages
2. Copy all locale JSON files from both source trees into the new structure
3. Update `src/bun/i18n/index.ts`: change `./locales/<lang>/menu.json` → `../../shared/i18n/locales/<lang>/menu.json` (note: two levels up from `src/bun/i18n/` to reach `src/shared/`)
4. Update `src/mainview/i18n/index.ts`: change `./locales/<lang>/*.json` → `../../shared/i18n/locales/<lang>/*.json` and `../../bun/i18n/locales/<lang>/menu.json` → `../../shared/i18n/locales/<lang>/menu.json`
5. Update `src/shared/i18n/types.ts`: change `../../mainview/i18n/locales/en/*.json` → `./locales/en/*.json` and `../../bun/i18n/locales/en/menu.json` → `./locales/en/menu.json`
6. Delete old locale directories
7. Run `bun run typecheck && bun test` to verify no breakage
8. Run validation script (if Unit 1 complete) to confirm key counts unchanged

**Execution note:** Do this as a single atomic commit with no intermediate broken state. All 3 import files + all file moves in one commit.

**Test scenarios:**
- Test expectation: none — this is a pure file move with import path updates. Behavioral verification is covered by existing tests passing + manual runtime check.

**Verification:**
- `bun run typecheck` passes (all import paths resolve)
- `bun test` passes (existing tests unaffected)
- `grep -r "bun/i18n/locales" src/` returns nothing (no stale references)
- `grep -r "mainview/i18n/locales" src/` returns nothing (no stale references)
- App launches and displays correct translations in both processes

---

- [x] **Unit 3: Integrate validation into quality gate**

**Goal:** Add the validation script to the `lint` npm script and create a pre-commit hook.

**Requirements:** R5

**Dependencies:** Unit 1 (validation script), Unit 2 (files in final location)

**Files:**
- Modify: `package.json` — add validation to `lint` script
- Create: `.git/hooks/pre-commit` — call `bun run lint`

**Approach:**
- Update `lint` script in package.json: `"lint": "bun run typecheck && bun test && bun run scripts/validate-i18n.ts"`
- Create `.git/hooks/pre-commit` that runs `bun run lint`
- Note: `.git/hooks/` is gitignored by default and not shared across clones. Document the setup in AGENTS.md or CLAUDE.md so new clones get the same gate. Alternatively, consider adding a postinstall script or setup instruction.
- The pre-commit hook is a local convenience. The `lint` script is the actual enforcement point (run manually or in CI).

**Test scenarios:**
- Happy path: all keys complete → lint passes
- Validation failure: introduce a missing key → lint fails with clear error
- Pre-commit blocks: introduce a missing key, attempt commit → blocked by hook

**Verification:**
- `bun run lint` passes (no missing keys after Unit 4 backfill)
- Pre-commit hook runs lint on `git commit`

---

- [x] **Unit 4: Backfill missing translation keys**

**Goal:** Copy en values as placeholders for the ~66 missing keys across 6 non-en locales, so the validation script passes.

**Requirements:** R7

**Dependencies:** Unit 1 (validation script to verify), Unit 2 (files in final location)

**Files:**
- Modify: `src/shared/i18n/locales/{de,es,fr,ja,ko,pt}/editor.json` — add ~10 search-related keys per language
- Modify: `src/shared/i18n/locales/{de,es,fr,ja,ko,pt}/ai.json` — add 1 key (`session.history`) per language

**Approach:**
- For each of the 6 affected languages (de, es, fr, ja, ko, pt):
  - Copy the missing `search.*` key values from `en/editor.json` into the locale's `editor.json`
  - Copy the missing `session.history` key value from `en/ai.json` into the locale's `ai.json`
- These are English placeholder values — functionally identical to i18next's existing `fallbackLng: 'en'` behavior at runtime
- Proper translations should be done as a separate follow-up task by someone fluent in each language

**Test scenarios:**
- Test expectation: none — this is data-only (JSON content changes). Verification is the validation script passing.

**Verification:**
- `bun run scripts/validate-i18n.ts` exits with code 0 (no missing or extra keys)
- `bun run lint` passes

## System-Wide Impact

- **Interaction graph:** `src/bun/menu.ts` and `src/bun/index.ts` consume `t()` from `src/bun/i18n/index.ts` — no direct locale imports, unaffected by file move. 32+ React components use `useTranslation()` from renderer i18n — unaffected.
- **Unchanged invariants:** All runtime behavior is identical — same i18next instances, same fallback strategy, same translation content. The only change is where the JSON files live on disk.
- **API surface parity:** N/A — no external API changes.
- **Integration coverage:** Existing unit tests + manual app launch verification covers the migration.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| File move breaks imports mid-commit | Single atomic commit with all 3 import files updated simultaneously |
| Vite resolves new import paths differently in dev vs build | Relative paths use same traversal depth as current `../../bun/` pattern — Vite handles identically |
| Pre-commit hook not shared across git clones | `lint` script is the canonical gate; pre-commit is local convenience only. Document setup. |
| Backfill with English placeholders masks translation quality issues | Placeholder values are functionally identical to existing i18next fallback behavior — no runtime change. Proper translations are a separate task. |
| v0.5.0 feature branches add translation keys during consolidation | File moves may create merge conflicts for branches touching locale files. Time the consolidation to avoid active feature development periods, or communicate the move clearly. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-06-consolidated-i18n-requirements.md](docs/brainstorms/2026-04-06-consolidated-i18n-requirements.md)
- Main process i18n: `src/bun/i18n/index.ts`
- Renderer i18n: `src/mainview/i18n/index.ts`
- Shared types: `src/shared/i18n/types.ts`
- Shared config: `src/shared/i18n/config.ts`
- Vite config: `vite.config.ts`
