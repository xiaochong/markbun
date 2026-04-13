---
title: File History Version Restore E2E Test
type: feat
status: active
date: 2026-04-13
origin: docs/brainstorms/2026-04-13-file-history-restore-e2e-requirements.md
---

# File History Version Restore E2E Test

## Overview

Add an end-to-end test that exercises the full File History restore flow: save a markdown file multiple times to generate version backups, open the File History dialog, select an earlier version, click Restore, and assert the editor reverts to that version while keeping the original file path and marking the document as dirty.

## Problem Frame

MarkBun's three-layer backup system includes Version History, but the existing E2E suite only verifies that the File History dialog opens and closes (`menu-dispatch.test.ts`). The actual restore path — crossing `src/bun/services/backup.ts`, `FileHistoryDialog.tsx`, and `App.tsx`'s `handleRestoreVersion` — has no automated regression coverage.

## Requirements Trace

- **R1.** Isolate the test workspace using `withTempWorkspace` and seed a markdown file.
- **R2.** Generate at least two version backups through real save operations.
- **R3.** Open the File History dialog and select a non-latest version entry.
- **R4.** Click Restore and assert the editor content matches the selected backup.
- **R5.** Assert the file path remains unchanged and the document is marked dirty after restore.
- **R6.** Wrap the test in `withTrace` for automatic failure forensics.

## Scope Boundaries

- **Non-goals:** Testing version deletion, empty history state, or auto-prune behavior.
- **Non-goals:** Covering Source Mode restore (WYSIWYG only for this test).
- **Deferred:** Adding `FileHistoryPage` methods for deletion or keyboard navigation.

## Context & Research

### Relevant Code and Patterns

- `src/bun/services/backup.ts` — `createVersionBackup`, `getVersionBackups`, `readVersionBackupContent` are the backup service primitives.
- `src/mainview/components/file-history/FileHistoryDialog.tsx` — Dialog UI; left panel lists versions, right panel shows preview; restore is triggered by the footer `Restore` button calling `onRestore(previewContent)`.
- `src/mainview/App.tsx:1242` — `handleRestoreVersion` receives content, flushes debounced sync, and sets markdown into the editor (WYSIWYG path clears first then `setMarkdown`).
- `src/mainview/hooks/useFileOperations.ts` — `fileState` tracks `path` and `isDirty`; `updateContent` is called after restore, which should set `isDirty = true` because restored content differs from disk.
- `src/mainview/lib/test-api.ts` — Defines `window.__markbunTestAPI`; only available in dev builds.
- `tests/e2e/menu-dispatch.test.ts` — Existing pattern for triggering menu actions via `window.__electrobunListeners['open-file-history']` and using `DialogPage`.
- `tests/e2e/lib/withTempWorkspace.ts` — Zero-config isolated workspace fixture.
- `tests/e2e/lib/runner.ts` — Auto-discovers all `tests/e2e/**/*.test.ts` files via `bun test tests/e2e/`.

### Institutional Learnings

- The backup service unit tests (`tests/unit/bun/services/backup.test.ts`) use `mock.module('os')` to redirect `homedir()`. The E2E suite uses `MARKBUN_E2E_HOME` + `withTempWorkspace()` for process-level isolation.
- Editor content-setting side effects must not go inside `setState` updaters; `handleRestoreVersion` already uses `requestAnimationFrame` for WYSIWYG mode.

## Key Technical Decisions

- **Seed backups via real saves (D1):** Instead of writing directly into `~/.config/markbun/backups/`, the test will use `EditorPage.setMarkdown()` + `EditorPage.saveFile()` twice. This keeps the test decoupled from internal SHA1 path hashing and backup directory structure.
- **Select version by list index (D2):** The left panel renders versions newest-first. The test will select the second `li > button` (`li:nth-child(2) button`) to pick an older version, avoiding locale-dependent date formatting assertions.
- **Assert dirty state via `__markbunTestAPI` (D3):** The test API will expose `getFileState(): { path: string | null; isDirty: boolean }` so the E2E test can read renderer-side state without parsing UI text.

## Implementation Units

- [ ] **Unit 1: Expose `getFileState` on `__markbunTestAPI`**

**Goal:** Allow E2E tests to assert the current file path and dirty flag after a restore.

**Requirements:** R5

**Dependencies:** None

**Files:**
- Modify: `src/mainview/lib/test-api.ts`
- Modify: `src/mainview/App.tsx`

**Approach:**
- Add `getFileState: () => { path: string | null; isDirty: boolean }` to the `MarkbunTestAPI` interface.
- In `App.tsx`, where `__markbunTestAPI` is mounted (near the existing test API setup), implement `getFileState` by returning `{ path, isDirty }` from the current `fileState`.

**Patterns to follow:**
- `src/mainview/lib/test-api.ts` already declares `isEditorReady`, `getEditorMarkdown`, etc.

**Test scenarios:**
- **Happy path:** `window.__markbunTestAPI.getFileState()` returns the current `path` and `isDirty` after opening a file.
- **Edge case:** Returns `path: null, isDirty: false` before any file is opened.

**Verification:**
- A quick CDP `evaluate` in an existing E2E test can read `window.__markbunTestAPI.getFileState()` without errors.

---

- [ ] **Unit 2: Add `FileHistoryPage` Page Object**

**Goal:** Encapsulate File History dialog interactions so the test reads like prose and is resilient to minor DOM changes.

**Requirements:** R3, R4

**Dependencies:** None

**Files:**
- Create: `tests/e2e/lib/page-objects/FileHistoryPage.ts`

**Approach:**
- Provide `open()` via `__electrobunListeners['open-file-history']` event dispatch (same pattern as `DialogPage` triggers).
- Provide `selectVersionByIndex(index: number)` to click a version entry in the left list.
- Provide `getPreviewContent()` to read the right-panel `<pre>` text.
- Provide `clickRestore()` to click the footer `Restore` button.
- Provide `isDialogOpen()` and `getVersionCount()` for state assertions.
- Provide `close()` to click the `Close` button or backdrop.

**Patterns to follow:**
- `tests/e2e/lib/page-objects/DialogPage.ts` for dialog open/close patterns.
- `tests/e2e/lib/page-objects/EditorPage.ts` for evaluate-based selectors.

**Test scenarios:**
- **Happy path:** `FileHistoryPage.open()` makes the dialog appear within 5 seconds.
- **Happy path:** After `selectVersionByIndex(1)`, the preview panel shows non-empty text.
- **Edge case:** `selectVersionByIndex(999)` throws or returns false when out of bounds.

**Verification:**
- Page object compiles and can be imported into a test file.

---

- [ ] **Unit 3: Implement `file-history-restore.test.ts`**

**Goal:** Exercise the full restore user journey and assert content, path, and dirty state.

**Requirements:** R1, R2, R3, R4, R5, R6

**Dependencies:** Unit 1, Unit 2

**Files:**
- Create: `tests/e2e/file-history-restore.test.ts`

**Approach:**
1. Create a `withTempWorkspace` instance and set `MARKBUN_E2E_HOME`.
2. Use `runApp({ env: { MARKBUN_E2E_HOME: workspace.dir } })` to launch the app (or rely on the global runner if using `bun test` directly; the test should accept the injected `page` from `tests/e2e-setup.ts`).
3. Write `v1` content via `EditorPage.setMarkdown()`, save to `workspace.filesDir/history-test.md` via `EditorPage.saveFile()`.
4. Write `v2` content, save again to the same path. This triggers `createVersionBackup` for `v1`.
5. Open File History dialog via `FileHistoryPage.open()`.
6. Assert at least 1 version appears (the backup of `v1`).
7. Select the first (and only) older version entry.
8. Assert preview content equals `v1`.
9. Click `Restore`.
10. Assert dialog closes.
11. Assert `EditorPage.getMarkdown()` equals `v1`.
12. Assert `__markbunTestAPI.getFileState().path` ends with `history-test.md`.
13. Assert `__markbunTestAPI.getFileState().isDirty` is `true`.
14. Wrap the entire test body in `withTrace('file-history-restore', ...)`. Use `collectTrace` from `tests/e2e/lib/trace` on failure.

**Patterns to follow:**
- `tests/e2e/menu-dispatch.test.ts` for `withTrace` and `page.evaluate` patterns.
- `tests/e2e/file-lifecycle.test.ts` for save/open round-trip patterns.

**Test scenarios:**
- **Happy path:** Restore an earlier version after two saves → editor shows old content, path unchanged, dirty=true.
- **Edge case:** Open File History on a file with no prior saves → dialog shows empty state (can be a lightweight assertion if the dialog opens successfully).
- **Integration:** The backup file is read through the real `electrobun.restoreVersionBackup` RPC and rendered into the preview pane.

**Verification:**
- `bun test:e2e --filter file-history-restore` (or `bun test tests/e2e/file-history-restore.test.ts`) passes locally.
- Intentionally breaking `handleRestoreVersion` in `App.tsx` causes the test to fail.

## System-Wide Impact

- **Unchanged invariants:** No production code behavior changes. `getFileState` is only added to the dev-only `__markbunTestAPI` object.
- **Error propagation:** If `createVersionBackup` fails silently (e.g., file too large), the test will see zero versions and fail with a clear message. This is acceptable because the fixture file is small by design.
- **Test suite load:** One additional E2E test (~10-15s runtime). The runner already supports filtering if developers want to run it in isolation.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `getFileState` is not yet exposed on `__markbunTestAPI` | Unit 1 adds it before the test is written. |
| Editor `setMarkdown` + `requestAnimationFrame` timing causes flaky content assertion | Use `EditorPage.waitForReady()` and a small sleep before reading markdown, consistent with existing E2E patterns. |
| `saveFile` does not trigger a version backup if settings have backups disabled | Ensure the test runs with default settings (backups enabled by default) or inject settings via `_test` RPC if needed. |

## Documentation / Operational Notes

- No user-facing documentation changes.
- If the test is added successfully, update `docs/brainstorms/2026-04-13-e2e-coverage-gaps-ideation.md` to mark "File History Version Restore" status as `Planned` or `Done`.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-13-file-history-restore-e2e-requirements.md](../brainstorms/2026-04-13-file-history-restore-e2e-requirements.md)
- Backup service: `src/bun/services/backup.ts`
- Dialog component: `src/mainview/components/file-history/FileHistoryDialog.tsx`
- Restore handler: `src/mainview/App.tsx:1242`
- Test API mount: `src/mainview/lib/test-api.ts`
- Existing E2E patterns: `tests/e2e/menu-dispatch.test.ts`, `tests/e2e/file-lifecycle.test.ts`
