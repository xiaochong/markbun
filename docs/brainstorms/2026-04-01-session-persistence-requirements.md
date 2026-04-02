---
date: 2026-04-01
topic: session-persistence
---

# Workspace Session Persistence

## Problem Frame

MarkBun currently loses all editing context on restart. The user must manually re-open their file, scroll back to where they were editing, and re-navigate the file explorer. Competitive editors (VS Code, Typora, Obsidian) all restore the full workspace state, creating a "never left" experience. The infrastructure is largely in place — `uiState.ts` already persists UI chrome state, and the crash recovery system demonstrates JSON-based state serialization — but editor-level state is not currently captured. Settings persistence and UI state both demonstrate the JSON-based `~/.config/markbun/` storage pattern. Session state will use a separate `session-state.json` file in the same directory (see Key Decisions).

## Requirements

**File and Editor State** (single-file only — multi-tab restore is out of scope)

- R1. When the open file path changes (open/close/new), persist it to session state
- R2. Periodically during editing and on close, persist the cursor position:
  - WYSIWYG mode: ProseMirror doc offset (`view.state.selection.from`)
  - Source mode: CodeMirror cursor position (line:column or character offset)
- R3. Periodically during editing and on close, persist the scroll position:
  - WYSIWYG mode: `.ProseMirror` element scrollTop
  - Source mode: CodeMirror scroll state
- R4. On startup, restore state using this priority order: pending file (CLI/open-url) → crash recovery dialog → session restore → clean workspace
- R5. On session restore, if the saved file is present and unchanged (same mtime), open it and restore the exact cursor position and scroll offset
- R6. On session restore, if the saved file is present but modified externally, open it with cursor at the beginning
- R7. On session restore, if the saved file is absent or on an unavailable volume, start with a clean workspace; preserve session data for next launch (do not discard it)
  - Together R5–R7 cover all restore cases: unchanged → exact restore; changed → cursor at top; absent/unavailable → clean workspace (session data retained)

**Workspace Layout**

- R8. On session restore, set the file explorer root to the restored file's parent directory (this is the existing auto-derived behavior, not a new independent field)
- R9. Persist the set of expanded folder paths in the file explorer and restore them on startup (requires new `restoreExpandedPaths` API in `useFileExplorer`)
- R10. On session restore, select the restored file in the file explorer (derived from R1, not independently persisted)

## Success Criteria

- Close MarkBun with a markdown file open at a specific editing position → reopen → same file is open, cursor is at the same position, scroll is at the same offset, file explorer shows the same expanded folders and selection
- Close MarkBun in source mode → reopen → source mode is active, cursor and scroll are restored
- If the file was modified by another process while MarkBun was closed → reopen → file opens correctly but cursor starts at the top
- If the saved file has been deleted or moved → reopen → start with a clean workspace (no error, no crash)
- If the saved file is on a temporarily unavailable volume → reopen → clean workspace, session data preserved for next launch
- If no file was open when MarkBun was closed → reopen → start with a clean workspace

## Scope Boundaries

- Multi-tab session restore is out of scope (depends on the multi-tab editing feature, which has not been implemented)
- Session state is global (single-slot), not per-workspace — opening a different folder overwrites the previous session
- Unsaved content recovery is handled by the existing auto-save and crash recovery systems, not by session persistence
- Search bar state (open/closed, query text) is not persisted
- Dialog states (settings, export, etc.) are not persisted
- Command palette history and recommended commands are already persisted separately and are not part of this feature

## Key Decisions

- **Smart restore strategy**: Use file mtime to detect external changes. When unchanged, restore exact cursor position and scroll offset. When changed, open the file but place cursor at the beginning. The existing `getFileStats` RPC already returns mtime at zero cost. Content hashing is deferred unless mtime proves unreliable in practice.
- **Dual editor position model**: Cursor and scroll positions require separate representations for WYSIWYG (ProseMirror doc offset + DOM scrollTop) and source mode (CodeMirror line:column + scroll state). The persisted `sourceMode` UI state determines which representation to use on restore.
- **Separate session storage**: Session state is stored in a separate `session-state.json` file rather than merged into `uiState.json`. Rationale: session state has different lifecycle semantics (frequently overwritten, disposable on corruption) from UI chrome state (rarely changes, user would notice if lost). The file includes a `version` field for forward compatibility. On load, unknown or structurally invalid data is treated as absent (clean workspace), following the same spread-merge-over-defaults pattern as `uiState.ts`.
- **sourceMode in session state**: The active editor mode is stored in session state itself (not read from `uiState.json`), ensuring the cursor representation and mode flag are always written atomically in the same save operation.
- **Periodic + close save**: Session state is saved periodically (debounced, matching the auto-save cadence) during editing, not just on app close. `beforeunload` flush is kept as a safety net but is not the primary save mechanism, since WKWebView's `beforeunload` is unreliable on app termination.

## Implementation Prerequisites

These gaps in the current codebase must be addressed during implementation:

- **MilkdownEditorRef**: Needs a `setCursor(offset: number)` method to restore cursor position after content load. The current `setMarkdown` replaces the entire document with no cursor/scroll restore hook. For chunked loading (>500 lines), cursor restore must be deferred until all chunks are processed.
- **SourceEditorRef**: Needs cursor position getters/setters and scroll position getters/setters. Currently only exposes `getValue`, `setValue`, `focus`, `isReady`. The CodeMirror `EditorView` is internal and not exposed.
- **setMarkdown scroll reset**: `useCrepeEditor.setMarkdown()` forcibly resets `scrollTop` to 0 (both sync and async). Must accept an optional target scroll position, or scroll restore must happen after editor signals content-load completion.

## Outstanding Questions

### Deferred to Planning

- [Affects R2][Technical] Validate that ProseMirror doc offset is stable across identical markdown re-parses (same content → same doc structure → same offset). Chunked loading for files >500 lines builds the doc incrementally, which may produce different offsets. If offsets prove unstable, resolved position (path + offset) should be used instead. A fallback to cursor-at-top must be implemented for out-of-bounds offsets after app updates.
- [Affects R9][Technical] Implementation of `restoreExpandedPaths` in `useFileExplorer` — whether to batch-load children for all expanded paths, or call `toggleFolder` sequentially. Also whether expanded paths should be stored as absolute or relative to workspace root, and whether there should be a cap for large projects.

## Next Steps

-> /ce:plan for structured implementation planning
