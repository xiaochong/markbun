---
title: refactor - Lazy markdown serialization for WYSIWYG editor
type: refactor
status: active
date: 2026-04-11
origin: docs/brainstorms/2026-04-11-avoid-full-doc-serialization-requirements.md
---

# Refactor: Lazy Markdown Serialization for WYSIWYG Editor

## Overview

The Milkdown WYSIWYG editor currently serializes the entire ProseMirror document to markdown on every keystroke inside a `$prose` plugin. For large documents this is O(n) per keystroke and creates input lag. This refactor removes that serialization from the typing path by:

1. Making the WYSIWYG editor emit a lightweight change signal (no payload).
2. Batching markdown reads, UI sync, and session-save scheduling into a debounced callback in `App.tsx`.
3. Updating save, export, and AI-tool callers to fetch markdown lazily from editor refs when they actually need it.

## Problem Frame

Every ProseMirror transaction in `useCrepeEditor.ts` triggers `serializer(view.state.doc)` to produce the full markdown string, which is then compared against a baseline to decide whether `onChange` should fire. For a 5,000-line document this means a full AST traversal and stringification on every keystroke. The real consumers—auto-save, status-bar stats, outline parsing, and session persistence—do not need continuous synchronization; they can tolerate a short debounce.

## Requirements Trace

- R1. WYSIWYG editor emits a lightweight change signal with no payload. *(origin: Change-Detection Contract)*
- R2. Source editor keeps its existing full-string `onChange` contract. *(origin: Change-Detection Contract)*
- R3. Save and auto-save paths fetch markdown lazily via `editorRef.current.getMarkdown()`. *(origin: Lazy Content Access)*
- R4. Session save and recovery writes also use lazy/live content. *(origin: Lazy Content Access)*
- R5. `App.tsx` batches WYSIWYG changes into a ~200 ms debounced sync that updates `fileState.content`, `editorContent`, outline, and session-save scheduling. *(origin: Debounced UI Sync)*
- R6. Manual save, blur save, and beforeunload save bypass the debounce and fetch markdown synchronously. *(origin: Debounced UI Sync)*

## Scope Boundaries

- Does not modify Milkdown serializer, parser, or AST structure.
- Does not change how export or AI tools obtain markdown conceptually—they still call `getMarkdown()`.
- Does not remove or alter outline-parsing logic; only when and how often it is triggered.
- Does not unify Source editor into a signal-only model (it remains eager, per requirements).

## Context & Research

### Relevant Code and Patterns

- `src/mainview/components/editor/hooks/useCrepeEditor.ts` — Location of the per-keystroke serialization plugin (lines ~396-427).
- `src/mainview/App.tsx` — Owns `editorRef` and `sourceEditorRef`; `handleEditorChange` currently receives full markdown synchronously.
- `src/mainview/hooks/useFileOperations.ts` — `handleSave` and `handleAutoSave` read `fileStateRef.current.content`.
- `src/mainview/hooks/useAutoSave.ts` — Hybrid throttle + debounce; saves on blur and beforeunload.
- `src/mainview/hooks/useSessionSave.ts` — Event-driven session persistence; does not need markdown content directly.
- `src/mainview/lib/commandHandlers.ts` — Export handlers read `ctx.contentRef.current`.
- `src/mainview/lib/ai-tools.ts` — `edit` and `write` call `setMarkdown` then immediately `getMarkdown`, which can return partial content during chunked loading.
- `src/mainview/lib/utils.ts` — Existing `debounce<T>` helper with `.cancel()` available.

### Institutional Learnings

- From `docs/solutions/logic-errors/editor-content-lost-on-file-switch-2026-04-04.md`: ProseMirror normalization can produce duplicate events; deduplication must be robust. A one-way `isDirty` ratchet is preferred over raw equality checks.
- From `docs/solutions/logic-errors/session-persistence-race-condition-react-effect-2026-04-02.md`: Prefer event-driven persistence over effect-driven; guard writes with data validation.
- From `docs/solutions/ui-bugs/clipboard-editor-multimode-race-conditions-2026-04-05.md`: Use `requestAnimationFrame` polling for post-mount content setting, not `setTimeout(fn,0)` inside state updaters.

## Key Technical Decisions

- **Signal-based change notification for WYSIWYG**: Removes O(n) serialization from the typing path. The existing `lastSerializedRef` dedup check in the ProseMirror plugin is removed; debouncing in `App.tsx` handles coalescing.
- **Debounced sync lives in `App.tsx`**: One timer manages markdown read, `updateContent`, `setEditorContent`, `outline.setHeadings`, and `scheduleSave`. This keeps the sync boundary explicit and avoids scattered debounces.
- **`handleSave` accepts optional `overrideContent`**: Manual saves fetch markdown live from the active editor ref and pass it in, bypassing any pending debounced sync.
- **Export handlers read from editor refs**: `commandHandlers.ts` replaces `contentRef` with a `getContent` callback that reads `editorRef` or `sourceEditorRef` depending on `sourceModeRef`.
- **AI tools wait for `setMarkdown` completion**: Use the existing `onContentSet` callback in `MilkdownEditorRef.setMarkdown` to ensure `getMarkdown()` is called only after chunked loading finishes.

## Open Questions

### Resolved During Planning

- **Should Source editor also switch to signal-only?** → No; requirements explicitly allow it to remain eager, and keeping it unchanged reduces blast radius. The debounced sync only applies to WYSIWYG.
- **How do we prevent saving stale content on Ctrl+S?** → Immediate-save callers flush the debounce, read live markdown from the active editor ref, and pass it as `overrideContent` to `handleSave`.
- **What debounce delay is appropriate?** → ~200 ms. Tight enough to keep status-bar counts responsive, long enough to batch rapid keystrokes.

### Deferred to Implementation

- None.

## Implementation Units

- [ ] **Unit 1: Emit lightweight change signal from WYSIWYG editor**

**Goal:** Remove full-document serialization from the ProseMirror change listener.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/mainview/components/editor/hooks/useCrepeEditor.ts`
- Modify: `src/mainview/components/editor/types.ts`
- Test: `tests/unit/components/editor/hooks/index.test.ts` (ensure hook still loads; DOM-dependent logic is hard to unit-test in Bun)

**Approach:**
- Change `MilkdownEditorProps.onChange` from `(markdown: string) => void` to `() => void`.
- In the `$prose` change listener, remove the `serializer(view.state.doc)` call and `lastSerializedRef` comparison. When `!view.state.doc.eq(prevState.doc)` and not inside `isSettingContentRef` / `suppressChangesUntilRef`, call `onChangeRef.current?.()` with no argument.
- Keep `getMarkdown()` unchanged (live serialization via `crepeRef.current?.getMarkdown()`).

**Patterns to follow:**
- Existing `isSettingContentRef` and `suppressChangesUntilRef` guards in `useCrepeEditor.ts` must stay.

**Test scenarios:**
- Happy path: Typing a single character does not call `serializerCtx` inside the change listener.
- Edge case: ProseMirror normalization transactions during `setMarkdown` do not fire the signal because `isSettingContentRef` / `suppressChangesUntilRef` guard them.
- Integration: `getMarkdown()` still returns correct markdown when called explicitly.

**Verification:**
- `bun run typecheck` passes.
- A runtime check confirms `serializer(view.state.doc)` is no longer executed on every keystroke.

---

- [ ] **Unit 2: Add debounced markdown sync in App.tsx for WYSIWYG changes**

**Goal:** Batch markdown reads and UI updates so they run at most once per debounce window.

**Requirements:** R1, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `src/mainview/App.tsx`

**Approach:**
- Introduce a debounced sync callback (using the `debounce` helper from `src/mainview/lib/utils.ts`) with ~200 ms delay.
- `handleEditorChange` becomes a signal handler: cancel if `isSwitchingFileRef.current`, otherwise schedule the debounced sync.
- The sync callback:
  1. Checks `sourceModeRef.current === false` and `editorRef.current` exist.
  2. Reads markdown via `editorRef.current.getMarkdown()`.
  3. Calls `updateContent(markdown)`, `setEditorContent(markdown)`, `outline.setHeadings(markdown)`, and `scheduleSave()`.
- Expose a `flushDebouncedSync` helper:
  - Calls `.cancel()` on the debounce.
  - Immediately executes the sync callback if needed.
- On file switch (inside `loadFileByPath` and any other switch paths), call `flushDebouncedSync` to prevent stale content from the previous file leaking into the new file.

**Patterns to follow:**
- `useOutline.ts` already uses `debounce(...)` from `lib/utils`; mirror that pattern.
- Use refs to avoid stale closures in the sync callback.

**Test scenarios:**
- Happy path: Rapidly typing 10 characters triggers exactly one sync after the debounce window.
- Integration: File switch immediately flushes/cancels any pending sync.
- Edge case: If `editorRef.current` is null when the sync fires (e.g., user toggled to source mode), skip the sync silently.

**Verification:**
- Typing in a large document no longer blocks the main thread on every keystroke.
- Status-bar counts update within ~300 ms of typing stop.

---

- [ ] **Unit 3: Update save paths to accept live markdown override**

**Goal:** Ensure manual save, blur save, and auto-save always persist the exact current document content.

**Requirements:** R3, R4, R6

**Dependencies:** Unit 2

**Files:**
- Modify: `src/mainview/hooks/useFileOperations.ts`
- Modify: `src/mainview/App.tsx`

**Approach:**
- In `useFileOperations.ts`:
  - Update `handleSave` signature to accept optional `overrideContent?: string`.
  - If `overrideContent` is provided, use it after `restoreOriginalImagePaths(overrideContent)`; otherwise fall back to `fileStateRef.current.content`.
  - Optionally update `handleAutoSave` with the same signature for consistency (blur/beforeunload call `handleAutoSave`).
- In `App.tsx`:
  - Update the `handleSave` wrapper (menu/keyboard-triggered) to:
    1. `flushDebouncedSync()`.
    2. Read live markdown from the active editor ref (`editorRef` if not source mode, `sourceEditorRef` if source mode).
    3. Call `handleSave(liveMarkdown)`.
  - Ensure blur and beforeunload paths in `useAutoSave` also flush the debounced sync before `handleAutoSave` runs. Since `useAutoSave` is a generic hook, the simplest pattern is to have `App.tsx` provide an `onSave` callback that first flushes, then fetches live markdown, then calls `handleAutoSave(overrideContent)`.
- Recovery writes (`scheduleRecoveryWrite`) can continue reading `fileStateRef.current.content`; recovery is best-effort and already debounced to 5 s, which is longer than the new 200 ms sync debounce.

**Patterns to follow:**
- One-way `isDirty` ratchet from institutional learnings (`contentChanged ? true : prev.isDirty`).

**Test scenarios:**
- Happy path: Manual save (Ctrl+S) mid-debounce persists the live markdown visible in the editor.
- Integration: Blur save after typing flushes the debounce and persists correct content.
- Edge case: Save triggered with no open file still opens the save dialog and behaves as before.

**Verification:**
- Auto-save and manual save always write the latest content.

---

- [ ] **Unit 4: Update export handlers and AI tools for lazy live reads**

**Goal:** Remove reliance on stale `contentRef` and fix AI race with chunked loading.

**Requirements:** R3, R6

**Dependencies:** Unit 3

**Files:**
- Modify: `src/mainview/lib/commandHandlers.ts`
- Modify: `src/mainview/App.tsx`
- Modify: `src/mainview/lib/ai-tools.ts`

**Approach:**
- In `commandHandlers.ts`:
  - Replace `contentRef: React.RefObject<string>` with `getContent: () => string` in `HandlerContext`.
  - Update the export command handlers (`file-export-html`, `file-export-image`) to call `ctx.getContent()` instead of `ctx.contentRef.current`.
- In `App.tsx`:
  - Remove `contentRef` from the `setupRendererHandlers` context.
  - Provide `getContent: () => string` that checks `sourceModeRef.current` and returns `sourceEditorRef.current?.getValue() ?? ''` or `editorRef.current?.getMarkdown() ?? ''`.
- In `ai-tools.ts`:
  - Update `edit` and `write` tools to pass `onContentSet` to `editor.setMarkdown`:
    ```ts
    editor.setMarkdown(contentToLoad, {
      onContentSet: () => {
        const newMarkdown = editor.getMarkdown();
        onContentChanged?.(newMarkdown);
      },
    });
    ```
  - Remove the synchronous `getMarkdown()` and `onContentChanged` calls that follow `setMarkdown`.

**Patterns to follow:**
- Existing `onContentSet` option in `MilkdownEditorRef.setMarkdown`.

**Test scenarios:**
- Happy path: Export HTML immediately after typing exports the live document content.
- Integration: AI write on a 2,000-line document waits for all chunks to load before calling `onContentChanged`.
- Error path: If `editorRef.current` is null during export, `getContent()` returns empty string gracefully.

**Verification:**
- Export produces content matching the editor.
- AI edit on large documents no longer truncates content.

---

- [ ] **Unit 5: Typecheck and runtime verification**

**Goal:** Ensure the refactor is type-safe and meets success criteria.

**Requirements:** All

**Dependencies:** Units 1-4

**Files:**
- N/A (verification step)

**Approach:**
- Run `bun run typecheck` and fix any errors.
- Run `bun run lint`.
- Perform a manual smoke test:
  1. Open a 5,000-line markdown file.
  2. Type several characters rapidly; confirm no `serializer(view.state.doc)` call on every keystroke (can be verified with a devtools performance profile or a temporary console log).
  3. Hit Ctrl+S immediately after typing; confirm the saved file reflects the latest edits.
  4. Trigger Export HTML; confirm the exported content is current.
  5. Switch files rapidly; confirm no stale content from the previous file persists.

**Test scenarios:**
- Integration: Full typing → debounced sync → manual save → export flow works end-to-end.

**Verification:**
- `bun run typecheck` shows no errors in `src/`.
- Status-bar counts, outline, and save all reflect the correct document content.

## System-Wide Impact

- **Interaction graph:** `App.tsx` becomes the single owner of the markdown-sync debounce. `useCrepeEditor.ts` becomes a pure signal emitter. `useFileOperations.ts` receives content either from the debounced sync (auto-save path) or via override (immediate save path).
- **Error propagation:** If `editorRef.current` becomes null during a pending debounce, the sync is skipped harmlessly. If `getMarkdown()` throws, the error should be caught and logged without crashing the sync.
- **State lifecycle risks:** Pending debounces must be cancelled on file switch and component unmount to prevent stale updates. `flushDebouncedSync()` must be called before every immediate-save and mode-switch.
- **Unchanged invariants:**
  - `useOutline.ts` parsing logic is unchanged; only when it is invoked.
  - `useSessionSave.ts` cursor/scroll capture remains imperative.
  - Image handling (`restoreOriginalImagePaths`) still runs at the save boundary.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Manual save saves stale content because debounce hasn't flushed | Immediate-save wrappers always flush + read live markdown before calling `handleSave`. |
| AI tools truncate large documents after `setMarkdown` | Use `onContentSet` callback to wait for chunked loading completion. |
| Debounced sync fires after file switch with old content | Cancel/flush debounce on every file-switch path. Capture `currentFilePath` in sync callback if extra safety is needed. |
| Source and WYSIWYG mode get out of sync during toggle | Mode-switch already calls `editorRef.current?.getMarkdown()` / `sourceEditorRef.current?.getValue()` directly; ensure it also flushes debounce first. |

## Documentation / Operational Notes

- No user-facing documentation changes required.
- No rollout or migration steps required.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-11-avoid-full-doc-serialization-requirements.md](../brainstorms/2026-04-11-avoid-full-doc-serialization-requirements.md)
- Relevant code: `src/mainview/components/editor/hooks/useCrepeEditor.ts`
- Relevant code: `src/mainview/App.tsx`
- Relevant code: `src/mainview/hooks/useFileOperations.ts`
- Institutional learning: `docs/solutions/logic-errors/editor-content-lost-on-file-switch-2026-04-04.md`
