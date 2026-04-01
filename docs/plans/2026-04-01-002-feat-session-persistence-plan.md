---
title: "feat: Workspace Session Persistence"
type: feat
status: completed
date: 2026-04-01
origin: docs/brainstorms/2026-04-01-session-persistence-requirements.md
---

# feat: Workspace Session Persistence

## Overview

Save and restore the full workspace editing context across app restarts: open file path, cursor position, scroll position, editor mode, and file explorer state. The existing `uiState.ts` pattern provides the storage foundation; the missing pieces are editor-level cursor/scroll APIs, a session state service, and startup restore integration into the priority chain.

## Problem Frame

MarkBun currently loses all editing context on restart. Users must manually re-open their file, scroll back, and re-navigate the file explorer. Competitive editors (VS Code, Typora, Obsidian) all restore workspace state. The infrastructure is largely in place — `uiState.ts` persists UI chrome, and crash recovery demonstrates JSON-based state serialization — but editor-level state is not captured. *(see origin: docs/brainstorms/2026-04-01-session-persistence-requirements.md)*

## Requirements Trace

- R1. Persist open file path to session state on open/close/new
- R2. Persist cursor position (line:column for both modes) periodically and on close
- R3. Persist scroll position periodically and on close
- R4. Startup restore priority: pending file → crash recovery → session restore → clean workspace
- R5. Restore exact cursor + scroll when file is unchanged (same mtime)
- R6. Open file with cursor at beginning when file was modified externally
- R7. Clean workspace when file is absent/unavailable; preserve session data
- R8. File explorer root derived from restored file's parent directory
- R9. Persist and restore expanded folder paths in file explorer
- R10. Select restored file in file explorer

## Scope Boundaries

- Multi-tab session restore is out of scope
- Session state is global (single-slot), not per-workspace
- Unsaved content recovery handled by existing auto-save + crash recovery
- Search bar state, dialog states, command palette history are not persisted by this feature
- Source mode dark-mode-toggle cursor loss (G6 in flow analysis) is an existing bug, not in scope

## Context & Research

### Relevant Code and Patterns

- **UI state service**: `src/bun/services/uiState.ts` — load/save/ensureConfigDir/merge-over-defaults pattern, `~/.config/markbun/ui-state.json`. Session state service will follow this pattern.
- **RPC three-file pattern**: `src/shared/types.ts` → `src/bun/index.ts` → `src/mainview/lib/electrobun.ts`. All new RPCs follow this.
- **Auto-save hook**: `src/mainview/hooks/useAutoSave.ts` — hybrid throttle+debounce (2s/500ms/10s), beforeunload flush. Session save will mirror this cadence.
- **MilkdownEditorRef**: `src/mainview/components/editor/types.ts` — exposes `getEditorView()` for reading cursor/scroll. Missing `setCursor()` and `setScrollPosition()`.
- **SourceEditorRef**: `src/mainview/components/editor/SourceEditor.tsx` — exposes `getValue/setValue/focus/isReady`. Missing cursor/scroll getters and setters.
- **useFileExplorer**: `src/mainview/hooks/useFileExplorer.ts` — `expandedPaths` Set, `toggleFolder()`, `setRootPath()`. Missing `restoreExpandedPaths()`.
- **App.tsx startup**: Lines 148-176 load UI state then check pending file. Session restore inserts after pending file check.
- **setMarkdown scroll reset**: `src/mainview/components/editor/hooks/useCrepeEditor.ts` lines 276-389 — forcibly resets scrollTop at three points. No "content load complete" signal.
- **File stat RPC**: `src/bun/index.ts` `getFileStats` returns `mtime` — already available for change detection.
- **Backup atomic write**: `src/bun/services/backup.ts` — `.tmp` + rename pattern for atomic writes.

### Institutional Learnings

- Command palette history fix (docs/solutions/ui-bugs/) — empty state fallback pattern and side-effect placement at call site, not deep in hooks. Session state should follow: treat corrupt/missing state as clean workspace.
- WebView clipboard shortcuts — editor-level focus events affect when to capture cursor position.

### Key Flow Analysis Findings

- ProseMirror doc offsets are unstable across chunked loads (>500 lines) and shifted by image processing (path→blob URL). **Decision: use line:column representation instead.**
- `sourceMode` stays in `uiState.json` (no migration needed — already loaded synchronously, and migration adds complexity without user benefit).
- `setRootPath` early-returns when path starts with current root. Session restore must handle this.
- `beforeunload` is unreliable in WKWebView. Periodic save is primary mechanism.

## Key Technical Decisions

- **Unified line:column cursor representation**: Both WYSIWYG and source mode store cursor as `{ line: number, column: number }`. During restore, convert to editor-specific offset (ProseMirror `TextSelection.create()` or CodeMirror `EditorView.dispatch()`). Rationale: avoids ProseMirror offset instability from chunked loading and image processing path-length shifts.
- **Separate session-state.json**: Stored at `~/.config/markbun/session-state.json`, not merged into `uiState.json`. Different lifecycle (frequently overwritten, disposable on corruption). Includes `version` field.
- **sourceMode stays in uiState**: `sourceMode` remains in `uiState.json` (already loaded synchronously at startup). It is NOT migrated to session state — none of R1-R10 require this, and migration adds complexity (UIState interface changes, migration code, backward-incompatibility) with no user-facing benefit. The session save hook reads `sourceMode` from React state (derived from uiState) and persists it in session state for restore-time reference, but `uiState.json` remains the source of truth for the initial load.
- **Startup init consolidation**: Multiple independent `useEffect` blocks involved in initialization must be consolidated into a single sequential `initializeApp()` to support the priority chain. The consolidation must cover: UI state load (lines 148-176), desktop workspace init (lines 379-387), crash recovery check, and session restore. Other effects (save listeners, menu config, etc.) remain independent. This restructuring is necessary because the current independent effects race — the desktop workspace init can set a root path that causes `setRootPath` early-return during session restore.
- **setMarkdown completion signal**: `setMarkdown` must accept an `onContentSet` callback that fires after all content (including chunks) is loaded AND after the internal scroll-reset-to-zero logic completes. When `onContentSet` is provided, the internal scroll-reset logic in `setMarkdown` must be skipped (or the caller takes responsibility for scroll position). This is the trigger for cursor+scroll restore.
- **Absolute expanded paths**: Stored as absolute paths since session is global single-slot. Failed paths (deleted/unavailable) are silently skipped.
 Restore depth-ordered loading is required for nested paths (`findNode` needs parent in tree before child).
 `setRootPath` early-return must be handled by ensuring session restore runs before desktop-default init.
 | **Periodic + close save**: Debounced save (matching auto-save cadence ~2s) is primary. `beforeunload` flush is a safety net only. Content-change events restart the debounce timer; cursor-only updates update a pending ref but do NOT restart the timer. | **Loading state during restore**: The editor renders with default empty content briefly during session restore. Accepted trade-off for v1 — the restore typically completes in <200ms for local files. | **No user feedback on restore fallback**: Silent fallback to clean workspace when file is deleted, session state is corrupt, or cursor is out of bounds. This matches the "disposable on corruption" lifecycle of session state. |

## Open Questions

### Resolved During Planning

- **ProseMirror offset stability**: Line:column representation avoids instability entirely. Convert to ProseMirror offset during restore via line/column-to-offset lookup on the parsed document.
- **restoreExpandedPaths approach**: Batch-load children using `Promise.allSettled`, skip failed paths silently. No cap needed for typical usage (usually <20 expanded folders).
- **Expanded paths: absolute vs relative**: Absolute paths — session is global, no workspace concept to make relative to.

### Deferred to Implementation

- **setMarkdown completion callback timing**: Whether to add `onContentSet` to `setMarkdown` itself or wrap it in the session restore code. Exact timing depends on reading the chunked-load internals.
- **Cursor restore fallback for out-of-bounds positions**: After app updates or content changes, line:column may point beyond the document. Must fall back to cursor-at-top gracefully.

## Implementation Units

- [x] **Unit 1: Session State Service & RPC**

**Goal:** Backend service for persisting session state to `session-state.json`, with load/save RPCs exposed to the renderer.

**Requirements:** R1, R2, R3 (storage foundation)

**Dependencies:** None

**Files:**
- Create: `src/bun/services/sessionState.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/bun/index.ts`
- Modify: `src/mainview/lib/electrobun.ts`
- Test: `tests/unit/bun/services/sessionState.test.ts`

**Approach:**
- Create `SessionState` interface: `{ version: number, filePath: string | null, cursor: { line: number, column: number } | null, scrollTop: number, expandedPaths: string[] }`
- Follow `uiState.ts` pattern for load/merge-with-defaults structure, but use `backup.ts`'s `atomicWrite` for actual disk writes (not `uiState.ts`'s plain `writeFile` — session state is overwritten frequently and needs crash safety)
- Add `getSessionState` and `saveSessionState` RPCs to `MarkBunRPC` type
- In-memory `currentSessionState` variable in `index.ts` (same pattern as `currentUIState`)
- `saveSessionState` accepts `Partial<SessionState>`, merges with current, writes to disk
- Atomic write via `.tmp` + rename (follow `backup.ts` `atomicWrite` pattern)

**Patterns to follow:**
- `src/bun/services/uiState.ts` — service structure
- `src/bun/services/backup.ts` — `atomicWrite` pattern
- `src/bun/ipc/recentFiles.ts` — simple JSON read/write

**Test scenarios:**
- Happy path: load returns default state when file absent; save writes valid JSON; load after save returns saved values
- Edge case: corrupt JSON file treated as absent (default state returned, no throw); empty file treated as absent
- Edge case: partial state (only `filePath` set) merges correctly with defaults for other fields
- Error path: write failure (permission denied, disk full) returns `{ success: false, error }` without crashing
- Integration: save with `Partial<SessionState>` merges with in-memory current state, subsequent load reflects merged result

**Verification:**
- `bun test tests/unit/bun/services/sessionState.test.ts` passes
- RPC round-trip: renderer calls `saveSessionState` then `getSessionState` and gets consistent data

---

- [x] **Unit 2: Editor Ref Extensions**

**Goal:** Add cursor and scroll position getters/setters to both editor refs, plus a content-load completion signal for WYSIWYG mode.

**Requirements:** R2, R3 (position capture/restore), R5, R6

**Dependencies:** None (can be developed in parallel with Unit 1)

**Files:**
- Modify: `src/mainview/components/editor/types.ts`
- Modify: `src/mainview/components/editor/MilkdownEditor.tsx`
- Modify: `src/mainview/components/editor/SourceEditor.tsx`
- Modify: `src/mainview/components/editor/hooks/useCrepeEditor.ts`

**Approach:**

**MilkdownEditorRef extensions:**
- Add `setCursor(line: number, column: number): void` — resolves line:column to ProseMirror offset via `view.state.doc` traversal, dispatches `TextSelection.create(view.state.doc, offset)`. Clamps to document length, falls back to doc end if out of bounds.
- Add `getCursor(): { line: number, column: number } | null` — reads `view.state.selection.from`, resolves to line:column using `view.state.doc.textBetween(0, from, "\n")` to get the text with block separators, then counting newlines. (Note: `doc.textContent` omits block boundaries — must use `textBetween` with `"\n"` separator.)
- Add `getScrollTop(): number` — returns `.ProseMirror` container `scrollTop`.
- Add `setScrollTop(top: number): void` — sets `.ProseMirror` container `scrollTop` after a `requestAnimationFrame` (to ensure layout is complete).

**SourceEditorRef extensions:**
- Add `getCursor(): { line: number, column: number } | null` — reads `view.state.selection.main.head`, converts to line:column.
- Add `setCursor(line: number, column: number): void` — resolves line:column to offset, dispatches `EditorView.dispatch({ selection })`.
- Add `getScrollTop(): number` — reads `view.scrollDOM.scrollTop`.
- Add `setScrollTop(top: number): void` — sets `view.scrollDOM.scrollTop`.

**setMarkdown completion callback:**
- Add optional `options` parameter to `useCrepeEditor.setMarkdown`: `setMarkdown(md, options?: { onContentSet?: () => void })`
- For sync (small file): call `onContentSet` in the next `requestAnimationFrame` (after scroll-reset RAF fires)
- For chunked (large file): call `onContentSet` after final chunk's `requestIdleCallback` completes
- The session restore code uses this callback to trigger cursor + scroll restore

**Patterns to follow:**
- Existing `MilkdownEditorRef` method signatures in `types.ts`
- Existing `SourceEditorRef` forwardRef pattern in `SourceEditor.tsx`
- `useCrepeEditor` chunked loading flow (lines 319-389)

**Test scenarios:**
- Happy path: `setCursor(5, 10)` then `getCursor()` returns `{ line: 5, column: 10 }` in both editors
- Edge case: `setCursor` with line beyond document length clamps to last line
- Edge case: `setCursor` with column beyond line length clamps to line end
- Edge case: `getCursor()` returns null when editor is not ready (no view)
- Happy path: `setScrollTop(200)` then `getScrollTop()` returns ~200 (may differ by sub-pixel)
- Integration: `setMarkdown(content, { onContentSet: callback })` fires callback after content is in DOM — verify for both small and chunked files

**Verification:**
- Manual: open a file in WYSIWYG mode, call `setCursor(10, 5)` via console, verify cursor position
- Manual: call `setScrollTop(500)`, verify scroll offset applied
- Manual: for a large file (>500 lines), verify `onContentSet` fires after all chunks loaded

---

- [x] **Unit 3: Session Save Hook**

**Goal:** Frontend hook that periodically captures and persists session state during editing, with beforeunload flush.

**Requirements:** R1, R2, R3 (save side), R9 (expanded paths save)

**Dependencies:** Unit 1 (RPC), Unit 2 (cursor/scroll getters)

**Files:**
- Create: `src/mainview/hooks/useSessionSave.ts`
- Modify: `src/mainview/App.tsx` (integrate hook, pass required refs and state)

**Approach:**
- Hook accepts: `filePath`, `editorRef`, `sourceEditorRef`, `sourceMode`, `expandedPaths`, `isReady`
- Internal debounced save function (2s debounce, matching auto-save cadence)
- `saveSession()` reads current state from editor refs and expanded paths, calls `electrobun.saveSessionState()` RPC
- Subscribes to: content changes (via existing dirty state), cursor/scroll changes (via ProseMirror/CodeMirror update listeners), expanded paths changes
- On `beforeunload`: flush current state synchronously (best-effort, acknowledged as unreliable)
- On file path change (open/close/new): immediate save to update filePath
- Skips save when no file is open (filePath is null) — clears filePath in session state

**Cursor capture strategy:**
- WYSIWYG: subscribe to ProseMirror `update` event via `editorRef.getEditorView()` — on each update where `docChanged` is true, read `getCursor()` and store in a pending ref. Only `docChanged` events restart the 2s debounce timer. Cursor position updates (selection-only) update the pending ref but do NOT restart the timer.
 This prevents hundreds of cursor-move events from blocking the save.

- Only the active mode's cursor is captured and saved

**Patterns to follow:**
- `src/mainview/hooks/useAutoSave.ts` — debounce/throttle structure
- `src/mainview/App.tsx` line 197-231 — UI state debounced save pattern (300ms debounce, beforeunload flush)

**Test scenarios:**
- Happy path: file is open, user edits, debounced timer fires, session state written with current cursor/scroll/expandedPaths
- Happy path: file path changes (open new file), immediate save with new filePath
- Happy path: source mode toggle, session state captures sourceMode=true with CodeMirror cursor
- Edge case: no file open, save writes filePath=null to session state
- Edge case: editor not ready (isReady=false), save skips cursor/scroll capture
- Error path: RPC save fails, next debounced interval retries silently

**Verification:**
- Open a file, edit for a few seconds, quit the app, inspect `~/.config/markbun/session-state.json` — contains correct filePath, cursor, scroll, expandedPaths
- Toggle source mode, verify session state reflects sourceMode=true

---

- [x] **Unit 4: File Explorer Restore**

**Goal:** Add `restoreExpandedPaths` API to `useFileExplorer` and persist expanded paths in session state.

**Requirements:** R8, R9, R10

**Dependencies:** Unit 1 (RPC)

**Files:**
- Modify: `src/mainview/hooks/useFileExplorer.ts`
- Test: `tests/unit/mainview/hooks/useFileExplorer.test.ts` (new or extend existing)

**Approach:**
- Add `restoreExpandedPaths(paths: string[]): Promise<void>` to `useFileExplorer` return value
- Implementation: sort paths by depth (shallowest first), then sequentially for each path (excluding root which is already loaded), call `readFolder` RPC. Sequential depth-ordered loading is required because `toggleFolder` uses `findNode` on the current `nodes` map — parent must exist before child can be expanded.
  - Success: add path to `expandedPaths` Set, merge children into `nodes` map
  - Failure: skip silently (directory deleted/unavailable)
- After all folders loaded, update `expandedPaths` state atomically
- File selection: expose or add a `selectFile(path: string)` method (or reuse existing selection logic) to select the restored file after expansion completes
- Handle `setRootPath` early-return: if root is already set and the new root is the same, call a `refresh()` or equivalent to ensure nodes are loaded before restoring expanded paths

**Patterns to follow:**
- `useFileExplorer.toggleFolder` — `readFolder` + state update pattern
- `useFileExplorer.setRootPath` — root path initialization

**Test scenarios:**
- Happy path: restore 3 expanded paths, all exist — tree shows all expanded with children loaded
- Edge case: one of 3 paths was deleted — remaining 2 restored, deleted one silently skipped
- Edge case: empty paths array — no-op
- Edge case: paths include root path — root is skipped (already loaded by setRootPath)
- Integration: restore expanded paths, then `selectFile(restoredFilePath)` — file is visible and selected in explorer

**Verification:**
- Restore session with 5 expanded folders — all appear expanded in file explorer
- One folder was deleted since last session — no error, remaining 4 expanded

---

- [x] **Unit 5: Startup Integration**

**Goal:** Integrate session restore into App.tsx startup flow following the priority chain. Note: crash recovery check is not currently wired into App.tsx startup — it must be implemented as part of this unit.

 `checkRecovery()` is called, dialog display, await for user dismiss/rerecover, then session restore proceeds.

 sourceMode stays in uiState (no migration).

 **Requirements:** R4, R5, R6, R7, R8, R10

**Dependencies:** Unit 1, Unit 2, Unit 3, Unit 4

 **Files:**
- Modify: `src/mainview/App.tsx`**Approach:**

**Startup restructuring:**
- Consolidate the independent init `useEffect` blocks into a single async `initializeApp()` function
- Priority chain:
  1. `electrobun.getUIState()` — load UI chrome (no sourceMode)
  2. `electrobun.getPendingFile()` — check CLI/open-url (priority 1)
  3. If no pending file: `electrobun.checkRecovery()` — check crash recovery (priority 2)
     - If recoveries exist and user dismisses dialog: proceed to session restore
     - If user recovers a file: skip session restore entirely
  4. If no pending file and no recovery: `electrobun.getSessionState()` — session restore (priority 3)
     - Check file exists via `electrobun.getFileStats()`
     - If absent/unavailable: clean workspace, preserve session data (R7)
     - If mtime changed: open file, cursor at beginning (R6)
     - If mtime unchanged: open file, restore exact cursor + scroll (R5)
  5. Clean workspace fallback (priority 4)

**Session restore flow (mtime unchanged):**
1. Set file explorer root to restored file's parent directory
2. Call `restoreExpandedPaths` with saved expanded folders
3. Read file content via `electrobun.readFile()`
4. Set editor content based on `sourceMode` flag:
   - WYSIWYG: `setMarkdown(content, { onContentSet: () => { setCursor(line, col); setScrollTop(top); } })`
   - Source: `setValue(content)` then `setCursor(line, col); setScrollTop(top);`
5. Select restored file in file explorer

**sourceMode handling:**
- `sourceMode` stays in `uiState.json` (no migration). Read from React state at session restore to determine editor mode.
 The session save hook reads `sourceMode` from React state (derived from uiState) and persists it in session state for restore-time reference, but `uiState.json` remains the initial source of truth for startup.- On first session state load: if `sessionState.sourceMode` is undefined, check old `uiState.sourceMode` value and use it as initial value, then save to session state
- The `saveUIState` calls in App.tsx that persist sourceMode are replaced by the session save hook

**Patterns to follow:**
- Current `App.tsx` init flow (lines 148-176)
- Current file open flow in `useFileOperations` (resetFileState → setMarkdown → addRecentFile)

**Test scenarios:**
- Happy path: close with file open at line 50, col 10, scroll 300px → restart → same file open, cursor at line 50 col 10, scroll ~300px
- Happy path: close in source mode → restart → source mode active, cursor and scroll restored
- Edge case: pending file from CLI/open-url → session restore skipped entirely (R4 priority 1)
- Edge case: file modified externally (mtime changed) → file opens, cursor at line 1 col 1
- Edge case: file deleted → clean workspace, session data preserved in session-state.json
- Edge case: no previous session → clean workspace, no errors
- Edge case: corrupt session-state.json → treated as absent, clean workspace
- Integration: crash recovery dialog shown → user dismisses (recovery files remain on disk for next launch) → session restore runs → correct file opens
- Integration: crash recovery dialog shown → user recovers → session restore skipped
- Integration: sourceMode stays in uiState → session restore reads sourceMode from React state (set by uiState load) → correct editor mode activated
 The restored file
- Edge case: global session — user works on Project A (file at ~/proj-a/notes.md), then opens Project B (file at ~/proj-b/README.md) → restart → Project B restored (Project A's session overwritten as expected)
this is the accepted trade-off of global single-slot sessions)

**Verification:**
- Full end-to-end: open file, scroll to middle, quit, restart → exact restore
- File changed externally: open file, close app, modify file externally, restart → file opens at top
- File deleted: open file, close app, delete file, restart → clean workspace, no crash
- Source mode: open file in source mode, quit, restart → source mode restored with cursor position

## System-Wide Impact

- **Interaction graph:** Session save hook subscribes to ProseMirror update events and CodeMirror update listeners. `beforeunload` event handler added (coexists with auto-save's handler). File open/close flows in `useFileOperations` trigger immediate session save.
- **Error propagation:** Session state write failures are silent (non-blocking). Session state load failures fall back to clean workspace. Editor ref methods return null when editor is not ready.
- **State lifecycle risks:** Race between periodic session save and file switch — `isSwitchingFileRef` guard in App.tsx prevents capturing stale state. Source mode toggle updates session state immediately via the save hook.
- **API surface parity:** `sourceMode` stays in `UIState` — no interface changes needed. Session save hook reads `sourceMode` from React state (derived from uiState) for session-state persistence only.
- **Integration coverage:** Full end-to-end startup restore sequence cannot be tested by unit tests alone — requires manual verification or CDP-based self-test.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| ProseMirror line:column → offset conversion is wrong for complex markdown (tables, code blocks) | Clamp out-of-bounds, fall back to cursor-at-top. Test with real markdown files containing complex structures. |
| `setMarkdown` completion callback timing is unreliable for chunked loads | Defer to implementation: if `onContentSet` fires too early, add explicit chunk-completion tracking. |
| `setRootPath` early-return prevents explorer root from updating during restore | Add force-refresh option or ensure restore calls setRootPath before desktop-default initialization. |
| Startup init restructuring breaks existing flows (pending file, crash recovery) | Restructure incrementally: first wire crash recovery into the startup, then add session restore as new code path. Verify each existing path still works. |
| `setMarkdown` scroll-reset race with cursor/scroll restore | When `onContentSet` is provided, skip the internal scroll-reset. Otherwise restore happens after scroll-reset — user may see brief flash. Accepted trade-off for v1. |
| `setRootPath` early-return in session restore | Session restore must call `setRootPath` before desktop-default init, or add force-refresh. The consolidated `initializeApp()` resolves this by sequencing init. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-01-session-persistence-requirements.md](docs/brainstorms/2026-04-01-session-persistence-requirements.md)
- UI state service: `src/bun/services/uiState.ts`
- Auto-save hook: `src/mainview/hooks/useAutoSave.ts`
- Editor types: `src/mainview/components/editor/types.ts`
- Crepe editor hook: `src/mainview/components/editor/hooks/useCrepeEditor.ts`
- File explorer hook: `src/mainview/hooks/useFileExplorer.ts`
- App component: `src/mainview/App.tsx`
