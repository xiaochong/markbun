---
date: 2026-04-01
topic: session-persistence
---

# Workspace Session Persistence

## Problem Frame

MarkBun currently loses all editing context on restart. The user must manually re-open their file, scroll back to where they were editing, and re-navigate the file explorer. Competitive editors (VS Code, Typora, Obsidian) all restore the full workspace state, creating a "never left" experience. The infrastructure is largely in place — `uiState.ts` already persists UI chrome state, and the crash recovery system demonstrates JSON-based state serialization — but editor-level state is not captured.

## Requirements

**File and Editor State**

- R1. On app close (or periodically), persist the path of the currently open file
- R2. On app close (or periodically), persist the cursor position within that file (ProseMirror doc offset or equivalent)
- R3. On app close (or periodically), persist the scroll position (scrollTop in pixels)
- R4. On startup, if a saved file path exists and the file is still present on disk, automatically open that file
- R5. On startup, if the file is unchanged since last session (same mtime/content hash), restore the exact cursor position and scroll offset
- R6. On startup, if the file was modified externally since last session, open the file but reset cursor to the beginning (smart fallback)

**Workspace Layout**

- R7. Persist the workspace root path (file explorer root directory)
- R8. Persist the set of expanded folder paths in the file explorer
- R9. On startup, restore the file explorer to the saved root path with previously expanded folders re-expanded
- R10. Persist the selected file path in the file explorer and restore it on startup

## Success Criteria

- Close MarkBun with a markdown file open at a specific editing position → reopen → same file is open, cursor is at the same position, scroll is at the same offset, file explorer shows the same expanded folders and selection
- If the file was modified by another process while MarkBun was closed → reopen → file opens correctly but cursor starts at the top
- If the saved file has been deleted or moved → reopen → start with a clean workspace (no error, no crash)
- If no file was open when MarkBun was closed → reopen → start with a clean workspace

## Scope Boundaries

- Multi-tab session restore is out of scope (depends on the multi-tab editing feature, which has not been implemented)
- Unsaved content recovery is handled by the existing auto-save and crash recovery systems, not by session persistence
- Search bar state (open/closed, query text) is not persisted
- Dialog states (settings, export, etc.) are not persisted

## Key Decisions

- **Smart restore strategy**: Use file mtime (or content hash) to detect external changes. When unchanged, restore exact cursor position and scroll offset. When changed, open the file but place cursor at the beginning. This avoids the complexity of approximate position matching while handling the common case perfectly.
- **Extend existing UIState pattern**: Add session fields to the existing `uiState.ts` storage mechanism rather than creating a new persistence subsystem. The storage pattern (JSON file in `~/.config/markbun/`) and save/load lifecycle are already well-established.
- **Save timing**: Save session state using the same debounced approach as UI state (300ms debounce on changes, flush on beforeunload). This reuses the existing save infrastructure.

## Outstanding Questions

### Deferred to Planning

- [Affects R2, R3][Technical] ProseMirror cursor position representation — whether to use the raw doc offset, a resolved position (path + offset), or another scheme. Planning should evaluate what Milkdown/ProseMirror exposes for position save/restore.
- [Affects R8][Technical] Whether expanded folder paths should be stored as absolute paths or relative to workspace root, and whether there should be a cap on the number of persisted paths for large projects.
- [Affects R5][Technical] Whether to use file mtime or a lightweight content hash (e.g., first/last N bytes + length) to detect external changes. Mtime can be unreliable on some filesystems but is free to check.

## Next Steps

-> /ce:plan for structured implementation planning
