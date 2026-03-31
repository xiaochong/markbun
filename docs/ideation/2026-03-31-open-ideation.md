---
date: 2026-03-31
topic: open-ideation
focus: open-ended
---

# Ideation: MarkBun Open Ideation

## Codebase Context

- **Project**: MarkBun — Typora-like markdown desktop editor
- **Stack**: Electrobun (Bun main process + WebView renderer), Milkdown/ProseMirror editor, React + TypeScript + Tailwind CSS + shadcn/ui
- **Key structure**: src/bun/ (main process), src/mainview/ (renderer), src/shared/ (types, settings, i18n)
- **Existing features**: Backup system (atomic write + crash recovery + version history), Export (HTML/PNG/PDF), i18n (8 locales), image handling with blob URLs, settings dialog, sidebar file explorer, outline view, quick-open (Cmd+P), recovery dialog, auto-save hook, clipboard handling
- **No past learnings** in docs/solutions/ — institutional knowledge lives in MEMORY.md and architecture docs
- **Pain points**: No in-document search, single-file-only editing, complex 3-file menu addition process, no plugin system, limited error feedback

## Ranked Ideas

### 1. In-Document Find and Replace
**Description:** Add Cmd+F search bar that works in both WYSIWYG and source mode, with text search, regex support, and batch replace. ProseMirror Decoration API handles highlighting in WYSIWYG; CodeMirror search extension handles source mode.
**Rationale:** MarkBun has zero in-document search capability. This is the first thing users try in any editor, and its absence is a trust-killer for power users.
**Downsides:** Needs separate implementations for ProseMirror (WYSIWYG) and CodeMirror (source) modes.
**Confidence:** 95%
**Complexity:** Medium
**Status:** Unexplored

### 2. Multi-Tab Editing
**Description:** Support opening multiple files simultaneously in tabs, each preserving its own editor state, scroll position, cursor location, and dirty flag. `useFileOperations` evolves from managing a single `fileState` to a file collection.
**Rationale:** Currently MarkBun is single-document — opening a new file triggers a full cancel-save-reset-reload cycle (~120 lines of defensive code in `openFileByPath`). This is the single biggest workflow limitation vs Typora/Obsidian.
**Downsides:** Significant architecture change. App.tsx state management needs refactoring. Editor instance lifecycle becomes more complex.
**Confidence:** 85%
**Complexity:** High
**Status:** Unexplored

### 3. Command Palette (Extending Quick-Open)
**Description:** Evolve Cmd+P quick-open into a full command palette (Cmd+Shift+P) that surfaces every action, setting, and file operation through a unified searchable interface. Built on existing quick-open component and RPC request map.
**Rationale:** Quick-open infrastructure exists. `MarkBunRPC` type already enumerates all available actions. Menu items have i18n keys across 8 locales. A command registry can be auto-generated from the type definition. Many menu actions (table ops, export, paragraph insert) currently have no keyboard shortcut — the palette is the universal escape hatch.
**Downsides:** Needs command registration mechanism design. UI must handle both file search and command search modes.
**Confidence:** 90%
**Complexity:** Medium
**Status:** Unexplored

### 4. Clipboard Image Paste
**Description:** When user pastes an image from clipboard (screenshot, copied image), automatically save to workspace assets folder and insert markdown image reference. Leverages existing `saveDroppedImage` RPC backend.
**Rationale:** All competitive editors support direct image paste. The backend infrastructure is complete (`saveDroppedImage` handles base64 → file save). Only the frontend clipboard event handler needs extension to intercept `image/*` MIME types. Reduces screenshot workflow from 5 steps to 2.
**Downsides:** Must handle various image formats and sizes gracefully.
**Confidence:** 95%
**Complexity:** Low
**Status:** Unexplored

### 5. Workspace Session Persistence
**Description:** Save and restore full workspace state: open files, cursor positions, scroll offsets, sidebar width, active tab. Uses existing JSON storage pattern from recovery system. Closing and reopening MarkBun returns to the exact same editing environment.
**Rationale:** Crash recovery system already serializes content + metadata to JSON. `uiState.ts` already persists sidebar/toolbar visibility. Adding editor scroll position and cursor state is nearly free. Every competitive editor (VS Code, Typora) does this.
**Downsides:** Depends partly on multi-tab architecture for full value, but single-file mode still benefits.
**Confidence:** 90%
**Complexity:** Low-Medium
**Status:** Unexplored

### 6. Workspace Search & Wiki-Links
**Description:** Two complementary features: (a) extend Quick-Open to search entire workspace by file content, not just recent 20 files by name; (b) support `[[wiki-links]]` for cross-document navigation within the same project folder. Bun process indexes files via existing `readFolder`/`readFile` RPCs.
**Rationale:** Current Quick-Open only searches 20 recent file names — useless for projects with 200+ files. Wiki-links transform a file tree into a connected knowledge graph (Obsidian's killer feature). The sidebar `search` tab type is already defined but unimplemented. Bun process has all needed file access primitives.
**Downsides:** Full-text index needs design. Wiki-link parsing needs ProseMirror custom node. Two features can be delivered independently.
**Confidence:** 80%
**Complexity:** Medium-High
**Status:** Unexplored

### 7. External File Change Detection
**Description:** Detect when an open file is modified by another process (git pull, sync tool, another editor) and prompt user to reload or keep their version. Compare file mtime on auto-save timer or file focus events.
**Rationale:** If auto-save is on and git pulls changes, auto-save silently overwrites pulled content — a data loss scenario. File explorer uses 5s polling but editor content is never re-checked against disk. `getFileStats` RPC exists. Every mature editor handles this.
**Downsides:** Needs careful UX to avoid false positives from auto-save itself triggering mtime changes.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Markdown-as-API Local HTTP Endpoints | Too experimental, far from core product |
| 2 | Settings as Living Documents | Interesting but impractical UX |
| 3 | Plugin RPC Bridge | Premature abstraction, too complex for current stage |
| 4 | Reverse RPC (Bun drives UI) | Vague, not actionable |
| 5 | WebView Multi-View (Kanban/Slides) | Too vague, unbounded scope |
| 6 | Multi-Language Live Preview | Narrow audience (multilingual writers) |
| 7 | Remove Save Button Entirely | Too risky, breaks user mental model |
| 8 | Remove Custom File Dialog | Native dialogs may not work well on Electrobun |
| 9 | Unify Dual Menu System | DX-only, not user-visible |
| 10 | Auto-wire Menu Actions Registry | DX-only, not user-visible |
| 11 | Settings/AppSettings Type Merge | Pure maintenance task |
| 12 | Event Listener Bridge Unification | DX-only, too small scope |
| 13 | Bidirectional Markdown Transforms | Vague, not grounded enough |
| 14 | Document Intelligence Pipeline | Too ambitious for current stage |
| 15 | Custom Themes/CSS Injection | Medium value but not priority |
| 16 | Batch Export | Nice-to-have, not core |
| 17 | Version Diff View | Interesting but depends on heavy version history usage |
| 18 | Image Cache Memory Protection | Important but non-functional optimization |
| 19 | Recovery File Corruption Guard | Edge case, small impact surface |
| 20 | Export Progress/Timeout | Improvement, not feature breakthrough |
| 21 | RPC Code Generation | DX-only, unrelated to user value |
| 22 | i18n Auto-Sync | DX-only |
| 23 | Typewriter/Focus Mode | Medium value, can add later |
| 24 | Inline Error Feedback Toast | Important but improvement, not feature breakthrough |
| 25 | Auto-Save Content Diffing | Optimization, not feature |
| 26 | File Watcher Replace Polling | Important but incremental |
| 27 | Undo History Across File Switches | Depends on multi-tab, standalone value limited |
| 28 | Native Print Dialog | Low priority |
| 29 | New File in Current Folder | Small improvement, limited value |
| 30 | Template System | Good feature but not core |

## Session Log
- 2026-03-31: Initial ideation — 47 raw ideas generated (6 agents x ~8 ideas), ~30 after dedup, 3 cross-cutting combinations identified, 7 survived adversarial filtering
