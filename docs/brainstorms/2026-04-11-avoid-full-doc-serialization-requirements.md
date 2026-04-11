---
date: 2026-04-11
topic: avoid-full-doc-serialization-on-keystroke
---

# Avoid Full-Document Markdown Serialization on Every Keystroke

## Problem Frame

In `src/mainview/components/editor/hooks/useCrepeEditor.ts`, the ProseMirror change-listener plugin calls `serializer(view.state.doc)` on every editor transaction to detect changes. This serializes the entire document to markdown on every keystroke—an O(n) operation for a task that only needs to know *that* something changed. For large documents this creates noticeable input lag.

## Requirements

**Change-Detection Contract**
- R1. The Milkdown WYSIWYG editor must emit a lightweight change signal (no payload) when the document is modified.
- R2. The Source editor may continue to emit the full markdown string on change; it already holds the raw text and has no serialization cost.

**Lazy Content Access**
- R3. Save and auto-save paths must fetch the latest markdown lazily via `editorRef.current.getMarkdown()` rather than relying on a continuously synchronized `fileState.content` string.
- R4. Session save and recovery writes must also fetch content lazily so they never save stale data.

**Debounced UI Sync**
- R5. `App.tsx` must batch WYSIWYG editor changes into a debounced sync (≈300 ms) that reads `getMarkdown()` and then updates:
  - `fileState.content` (via `updateContent`)
  - `editorContent` state (status-bar stats)
  - outline headings
  - session-save scheduling
- R6. Manual save (Ctrl+S), blur save, and beforeunload save must synchronously fetch the latest markdown before persisting, bypassing any pending debounced sync.

## Success Criteria

- Typing in a 5,000-line document does not call `serializer(view.state.doc)` on every keystroke.
- Auto-save and manual save always persist the exact content visible in the editor.
- Status-bar word/character/line counts remain within ~300 ms of typing stop.

## Scope Boundaries

- Does not modify the Milkdown serializer, parser, or AST structure.
- Does not change how export or AI tools obtain markdown (they already call `getMarkdown()`).
- Does not remove or alter the existing outline-parsing logic; only when it is triggered.

## Key Decisions

- **Signal-based change notification for WYSIWYG**: Removes O(n) work from the typing path with minimal code churn.
- **`useFileOperations` accepts a `getContent` callback**: Keeps the save logic centralized while allowing on-demand reads from the editor.

## Dependencies / Assumptions

- `editorRef.current.getMarkdown()` is fast enough to call synchronously during save (it is the same serializer, just invoked on demand instead of per-keystroke).

## Outstanding Questions

### Deferred to Planning
- [Affects R5][Technical] Should the debounce delay be fixed at 300 ms or made responsive to document size (e.g., larger documents = longer debounce)?
- [Affects R3][Technical] In `useFileOperations`, should `getContent` completely replace `fileState.content` for save paths, or should it act as a fallback only when the debounced sync may be stale?

## Next Steps

→ `/ce:plan` for structured implementation planning
