---
title: Cancellable Async Task Queue
type: feat
status: active
date: 2026-04-11
origin: docs/brainstorms/2026-04-11-cancellable-async-task-queue-requirements.md
---

# Cancellable Async Task Queue

## Overview

Introduce a lightweight `TaskQueue` utility with keyed `AbortController` semantics to prevent race conditions during heavy renderer-thread async operations: PNG/HTML export, bulk image loading, and Mermaid preview rendering. When a new task of the same key starts, any previous task of that key is cleanly aborted, its result discarded, and its cleanup (`finally` blocks) allowed to run.

## Problem Frame

The renderer currently runs several heavy async operations without cancellation:
- PNG export creates an iframe, loads CDN scripts, and runs `html2canvas`.
- Image loading performs `readImageAsBase64` RPCs and creates blob URLs.
- Mermaid preview renders diagrams inside the Milkdown editor.

When a user rapidly switches files or triggers repeated exports, stale tasks continue executing, wasting CPU/memory and creating race conditions where outdated results may overwrite newer ones or leave orphaned DOM artifacts behind.

(origin: docs/brainstorms/2026-04-11-cancellable-async-task-queue-requirements.md)

## Requirements Trace

- R1, R2, R3 — TaskQueue abstraction with keyed `AbortController` support and simple API.
- R4, R5 — Export hooks (`useExport.ts`) wrapped for PNG and HTML generation.
- R6, R7 — Mermaid preview cancellation; other plugins can adopt same pattern. (R6 uses a local `AbortController` ref rather than the global keyed queue because Milkdown's `renderPreview` callback is synchronous and lacks a stable per-block ID.)
- R8 — Image loading (`processor.ts`) integrated with the queue.
- R9, R10 — Silent abort UX; cleanup code (`finally` blocks) survives abort.
- R11 — Non-signal-aware library wrappers discard stale results after abort.
- R12 — `loadLocalImage` accepts `AbortSignal` and checks `signal.aborted` before side effects.

## Scope Boundaries

- Out of scope: Bun/main-process async tasks (e.g., AI streaming RPC).
- Out of scope: Progress bars, explicit Cancel buttons, or throttling beyond the "one per key" rule.
- Out of scope: Disk-backed or persistent queues.

## Context & Research

### Relevant Code and Patterns

- `src/bun/services/ai-stream.ts` — Already uses `AbortController` with an active-session singleton (abort previous session on new start). This is the closest existing pattern.
- `src/mainview/App.tsx` — Uses `loadingCancelTokenRef` (mutable boolean token) to cooperatively skip stale `processMarkdownImages` results after file switches. This will be superseded by the queue.
- `src/mainview/components/mermaid-viewer/MermaidDiagramViewer.tsx` — Uses `let cancelled = false` in `useEffect` to discard stale `mermaid.render` results.
- `src/mainview/lib/image/cache.ts` / `src/mainview/lib/mermaid/cache.ts` — Singleton caches with `createX()` factories for tests. The TaskQueue will follow the same pattern.
- `src/mainview/hooks/useAutoSave.ts` — Extensive timer management pattern for cleanup in hooks.

### Institutional Learnings

- **Clipboard and Multi-Mode Editor Race Conditions** (`docs/solutions/ui-bugs/clipboard-editor-multimode-race-conditions-2026-04-05.md`) — ProseMirror callbacks run outside React cycles; defer reads with `requestAnimationFrame` polling. Relevant when guarding `applyPreview` calls.
- **Editor Content Lost on File Switch after AI Edits** (`docs/solutions/logic-errors/editor-content-lost-on-file-switch-2026-04-04.md`) — When bridging async work to React/ProseMirror state, always fully discard stale results rather than diff or merge.
- **AI Tools Image Path Blob URL Mismatch** (`docs/solutions/integration-issues/ai-tools-image-path-blob-url-mismatch-2026-04-06.md`) — `imageCache` blob URL lifecycle is sensitive; aborted tasks must not leave unrevoked blobs.

### Parallel Work

Two other plans from today touch the same files:
- `docs/plans/2026-04-11-001-refactor-lazy-markdown-serialization-plan.md` (modifies `useCrepeEditor.ts` change-detection contract)
- `docs/plans/2026-04-11-002-feat-mermaid-render-cache-plan.md` (already landed `mermaidCache` in `src/mainview/lib/mermaid/cache.ts`)

Coordinate with these changes to avoid conflicts.

## Key Technical Decisions

- **Queue rejects aborted promises uniformly via `Promise.race`, while still awaiting the original task internally** — When a new task replaces an old one, the queue aborts the old `AbortController`. The `enqueue` caller receives a `Promise.race` between the task promise and an abort promise, guaranteeing that all prior callers for that key receive an `AbortError` even if the underlying library (e.g., `html2canvas`) is not signal-aware. At the same time, the queue retains a reference to the original task promise and awaits it internally so that its `finally` blocks still run, satisfying R9 and R10 together.
- **Mermaid preview uses a local `AbortController` ref instead of the global queue** — Milkdown's `renderPreview` callback must return synchronously and does not provide a stable per-block ID. A single global queue key would serialize all Mermaid blocks in a document (only the last block would render). A local `AbortController` ref, matching the existing `MermaidDiagramViewer.tsx` pattern, achieves the same stale-render-discard semantics within the editor's constraints. (This deviates from a literal reading of R6 but is the only architecture that preserves correctness.)
- **Image loading uses a module-level queue singleton with key `'image-load'`** — Any new image processing (from file switch, mode toggle, etc.) aborts the previous one. Callers wrap `processMarkdownImages` with `taskQueue.enqueue('image-load', signal => processMarkdownImages(content, signal))`.
- **Export uses separate keys `'export-png'` and `'export-html'`** — These operate independently of image loading and each other.

## Open Questions

### Resolved During Planning

- **How should Mermaid preview integrate given `renderPreview` constraints?**
  → Local `AbortController` ref per editor instance, not the global keyed queue.
- **What happens to `enqueue` promises for non-signal-aware tasks when they are aborted?**
  → The queue uses `Promise.race(taskPromise, abortPromise)` so every caller receives an `AbortError` when the key is replaced.
- **Should `preloadImages` skip execution or just ignore results after a file switch?**
  → It is integrated with the queue under the same `'image-load'` key. Fire-and-forget callers do not await it, but queue replacement still aborts stale preloads.

### Deferred to Implementation

- Exact `AbortError` class variant to catch (`DOMException` vs custom error) — depends on runtime behavior in Bun/Electrobun webview.
- Whether `electrobun.readImageAsBase64` gains `AbortSignal` support in the future — currently not supported; wrapper checks `signal.aborted` before and after the RPC.

## Implementation Units

- [ ] **Unit 1: Introduce TaskQueue core**

**Goal:** Create the keyed replace-old-with-new queue abstraction.

**Requirements:** R1, R2, R3, R10, R11

**Dependencies:** None

**Files:**
- Create: `src/mainview/lib/taskQueue.ts`
- Test: `tests/unit/mainview/lib/taskQueue.test.ts`

**Approach:**
- Implement a `TaskQueue` class holding `Map<string, { controller: AbortController; promise: Promise<unknown> }>`.
- `enqueue<T>(key, task)` aborts any existing entry for `key`, creates a fresh `AbortController`, and stores the original task promise in the map alongside the controller. It returns a `Promise.race` between the original task promise and an abort promise that rejects with `AbortError` when the controller fires. This guarantees all prior callers of the same key see a rejection even if the library ignores the signal, while the queue continues to await the original task internally so its `finally` blocks still run.
- `abort(key)` and `abortAll()` for manual cleanup.
- Clean up the map entry when the original promise settles (via `finally`), not the raced promise.
- Export a module-level singleton and a `createTaskQueue()` factory for tests, following the image/mermaid cache pattern.

**Patterns to follow:**
- `src/bun/services/ai-stream.ts` — active-session `AbortController` lifecycle.
- `src/mainview/lib/image/cache.ts` — singleton + factory pattern.

**Test scenarios:**
- Happy path: `enqueue` returns the task's resolved value.
- Edge case: A second `enqueue` with the same key causes the first returned promise to reject with `AbortError`.
- Edge case: `abortAll()` causes all pending promises to reject with `AbortError`.
- Error path: A non-abort task error propagates to the caller unchanged.
- Integration: Tasks with different keys run concurrently without interference.

**Verification:**
- `bun test tests/unit/mainview/lib/taskQueue.test.ts` passes with 90%+ coverage.
- `bun run typecheck` passes.

---

- [ ] **Unit 2: Make image loading abort-aware**

**Goal:** Add `AbortSignal` support to the image processor so side effects (blob URL creation) can be skipped on abort.

**Requirements:** R8, R12

**Dependencies:** Unit 1

**Files:**
- Modify: `src/mainview/lib/image/processor.ts`
- Test: `tests/unit/mainview/lib/image/processor.test.ts`

**Approach:**
- Add optional `signal?: AbortSignal` to `loadLocalImage`, `processMarkdownImages`, and `preloadImages`.
- In `loadLocalImage`, check `signal?.aborted` **before** invoking `electrobun.readImageAsBase64` and **again** before writing to `imageCache`.
- In `processMarkdownImages`, pass `signal` into each `loadLocalImage` call; also check `signal?.aborted` before performing the markdown string replacements.
- In `preloadImages`, create a wrapper around the inner `Promise.all` that respects the signal.
- Do **not** make `processor.ts` depend directly on `TaskQueue` — keep it queue-agnostic. Callers will pass the signal.

**Execution note:** Add characterization tests for `loadLocalImage` abort behavior before refactoring the function.

**Patterns to follow:**
- `src/mainview/lib/image/cache.ts` — understand blob URL lifecycle for proper test assertions.

**Test scenarios:**
- Happy path: `processMarkdownImages` returns processed markdown with blob URLs.
- Edge case: `loadLocalImage` with an already-aborted signal returns `null` without calling `electrobun.readImageAsBase64`.
- Edge case: `signal` aborts mid-`Promise.all` — cached hits succeed, but pending RPCs short-circuit and do not write to `imageCache`.
- Error path: `electrobun.readImageAsBase64` failure still returns `null` and logs the error.
- Integration: `preloadImages` does not throw when aborted; errors are swallowed per existing `.catch(console.error)` behavior.

**Verification:**
- `bun test tests/unit/mainview/lib/image/processor.test.ts` passes.
- No `imageCache.set` calls occur after an abort.

---

- [ ] **Unit 3: Integrate queue into file loading and export**

**Goal:** Wrap renderer file-loading and export flows with the queue.

**Requirements:** R4, R5, R8, R11

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/mainview/App.tsx`
- Modify: `src/mainview/hooks/useExport.ts`
- Test: `tests/unit/mainview/hooks/useExport.test.ts` (new)

**Approach:**
- **App.tsx:** Replace the `loadingCancelTokenRef` cooperative-cancellation pattern for `processMarkdownImages` with `taskQueue.enqueue('image-load', signal => processMarkdownImages(content, signal))`. Remove `loadingCancelTokenRef` entirely if it is no longer used after this migration; do not leave a redundant guard in place.
- **useExport.ts:** Wrap `generateImage` and `generateHTML` with `taskQueue.enqueue('export-png', ...)` and `taskQueue.enqueue('export-html', ...)`. Inside each wrapper, catch `AbortError` and return `null` silently. Inside `generateImage`, pass the task's `signal` into `processMarkdownImages`.
- Ensure iframe cleanup in `generateImage`'s `finally` block still executes; the queue's abort behavior does not suppress it.
- Note: the `'export-png'` and `'export-html'` keys are global singletons. A rapid second export of the same type aborts the first, which is the desired "replace old with new" behavior because both exports read live `content` and `filePath` at execution time.

**Patterns to follow:**
- `src/mainview/App.tsx` — existing `loadingCancelTokenRef` flow (to guide migration).
- `src/bun/services/ai-stream.ts` — `AbortError` swallowing pattern.

**Test scenarios:**
- Happy path: `generateImage` returns a base64 PNG result.
- Happy path: `generateHTML` returns an HTML string.
- Edge case: Rapid double export of the same type → first wrapper returns `null` silently, second completes.
- Edge case: File switch during an in-flight PNG export → export task aborts, iframe is removed.
- Integration: Export HTML while images are loading for the current file → the two tasks use different keys and do not interfere.

**Verification:**
- `bun test tests/unit/mainview/hooks/useExport.test.ts` passes.
- Manual check: triggering "Export as PNG" twice rapidly results in only one export dialog.

---

- [ ] **Unit 4: Mermaid preview cancellation and call-site audit**

**Goal:** Guard Mermaid preview against stale renders and audit all `processMarkdownImages` call sites for safe cancellation.

**Requirements:** R6, R7, R11

**Dependencies:** Unit 2

**Files:**
- Modify: `src/mainview/components/editor/hooks/useCrepeEditor.ts`
- Modify (if needed): `src/mainview/lib/ai-tools.ts`, `src/mainview/lib/image/clipboard.ts`
- Test: `tests/unit/components/editor/hooks/useCrepeEditor.test.ts` (update existing)

**Approach:**
- Add a `mermaidAbortControllerRef` in `useCrepeEditor.ts`.
- Add a `useEffect` cleanup (or equivalent unmount handler) that aborts `mermaidAbortControllerRef.current` so file switches and unmounts do not apply stale previews.
- Inside the `renderPreview` callback for Mermaid:
  1. Abort the previous controller (if any).
  2. Create a new `AbortController` and store it in the ref.
  3. After `import('mermaid')` resolves, check `controller.signal.aborted`; if true, return early.
  4. After `mermaid.render` resolves, check `controller.signal.aborted` again before calling `applyPreview`.
  5. In the `.catch` handler, perform the same abort guard before applying the error placeholder.
- **Call-site audit:** Search all `processMarkdownImages` callers:
  - `App.tsx` — handled in Unit 3.
  - `useExport.ts` — handled in Unit 3.
  - `src/mainview/lib/image/clipboard.ts` — if it calls `processMarkdownImages` synchronously from a user action, it can be wrapped with the queue or accept that short clipboard calls are low-risk.
  - `src/mainview/lib/ai-tools.ts` — same consideration; wrap if it operates asynchronously at file-switch scale.
- Document any callers that remain intentionally unwrapped.

**Execution note:** Start by reading the existing `MermaidDiagramViewer.tsx` cancellation pattern and mirror it exactly in `useCrepeEditor.ts`.

**Patterns to follow:**
- `src/mainview/components/mermaid-viewer/MermaidDiagramViewer.tsx` — `let cancelled = false` guard pattern.

**Test scenarios:**
- Happy path: Typing a valid Mermaid block eventually renders and calls `applyPreview`.
- Edge case: Typing rapidly in a Mermaid block → only the last in-flight render calls `applyPreview`; older ones are discarded.
- Edge case: File switch or editor unmount while Mermaid is rendering → `applyPreview` is not called with stale results.
- Integration: verify no `processMarkdownImages` callers outside App.tsx and useExport.ts bypass cancellation without an explicit rationale.

**Verification:**
- `bun test tests/unit/components/editor/hooks/useCrepeEditor.test.ts` passes.
- No stale Mermaid error logs appear after rapid editing or file switches.

## System-Wide Impact

- **Interaction graph:** `App.tsx` file-switch handler now aborts image loading via `taskQueue.abort('image-load')` or replacement. Export commands abort via `taskQueue.enqueue('export-png', ...)`. Editor `renderPreview` aborts stale Mermaid renders via local `AbortController`.
- **Error propagation:** `AbortError` travels to the wrapper that called `enqueue`, which catches it and returns `null` silently. Non-abort errors propagate normally.
- **State lifecycle risks:** `finally` blocks in `generateImage` still run because the queue rejects the promise rather than suppressing settlement. `imageCache` writes are gated by `signal.aborted`, reducing orphaned blob URL risk.
- **API surface parity:** Command handlers in `src/mainview/lib/commandHandlers.ts` call the wrapped functions transparently; no handler changes required.
- **Unchanged invariants:** `useAutoSave.ts` timer logic remains independent of the TaskQueue. Bun-side `ai-stream.ts` remains independent.

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Mermaid blocks would serialize if forced into the global keyed queue, breaking multi-diagram documents | Mitigated by local `AbortController` ref approach (user decision). |
| Non-signal-aware libraries (`html2canvas`) continue consuming CPU/memory after abort | Accepted per requirements; wrapper discards the result once control returns. |
| Existing `loadingCancelTokenRef` in `App.tsx` partially overlaps with the new queue | Explicitly migrate the image-loading path to the queue in Unit 3. |
| Concurrent plans today touch `useCrepeEditor.ts` and `useExport.ts` | Rebase/merge with lazy-markdown-serialization and mermaid-cache changes before landing. |

## Documentation / Operational Notes

- No user-facing documentation changes required (silent abort UX).
- Consider a brief developer note in `src/mainview/lib/taskQueue.ts` explaining the `Promise.race` design for future maintainers.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-11-cancellable-async-task-queue-requirements.md](../brainstorms/2026-04-11-cancellable-async-task-queue-requirements.md)
- Related plans: `docs/plans/2026-04-11-001-refactor-lazy-markdown-serialization-plan.md`, `docs/plans/2026-04-11-002-feat-mermaid-render-cache-plan.md`
- Existing patterns: `src/bun/services/ai-stream.ts`, `src/mainview/App.tsx`, `src/mainview/components/mermaid-viewer/MermaidDiagramViewer.tsx`
