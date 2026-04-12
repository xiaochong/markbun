---
date: 2026-04-11
topic: cancellable-async-task-queue
---

# Cancellable Async Task Queue

## Problem Frame

The app performs several heavy async operations on the renderer thread: PNG and HTML export (`src/mainview/hooks/useExport.ts`), Mermaid diagram rendering (`src/mainview/components/editor/hooks/useCrepeEditor.ts`), and bulk local-image loading (`src/mainview/lib/image/processor.ts`). None of these operations are currently cancellable. When a user rapidly switches files or triggers repeated exports, stale tasks continue running, wasting CPU/memory and creating race conditions where outdated results may overwrite newer ones or leave orphaned DOM artifacts behind.

## Requirements

**Task Queue Infrastructure**
- R1. Introduce a lightweight `TaskQueue` abstraction that can execute async tasks with `AbortController` support.
- R2. The queue must support keyed task types (e.g., `'export-png'`, `'mermaid-render'`, `'image-load'`). When a new task of the same key is enqueued, any previous running task of that key is automatically aborted.
- R3. The queue should expose a simple API for enqueuing tasks and for manually aborting a task by key.

**Export Operations**
- R4. `generateImage` in `src/mainview/hooks/useExport.ts` must be wrapped by the task queue. If the user triggers a second PNG export (or switches files) while one is in progress, the old export is cancelled, its iframe is cleaned up, and the result is discarded.
- R5. `generateHTML` must also be wrapped by the queue for consistency, even though it is typically faster.

**Editor Rendering**
- R6. Mermaid preview rendering inside `src/mainview/components/editor/hooks/useCrepeEditor.ts` must be wrapped by the task queue. If the user switches to a different file while Mermaid diagrams are still rendering from the previous file, the stale render is aborted and its result is ignored.
- R7. Any other async editor plugins that render heavy previews (e.g., future KaTeX bulk rendering) should be able to adopt the same queue with minimal boilerplate.

**Image Loading**
- R8. `processMarkdownImages` and `preloadImages` in `src/mainview/lib/image/processor.ts` must be integrated with the queue so that image loading for a previous file does not continue creating blob URLs after a file switch.

**Error Handling & UX**
- R9. Cancelled tasks must not surface error toasts or dialogs. Cancellation should be silent.
- R10. The queue must guarantee that cleanup code (e.g., `finally` blocks that remove iframes or revoke object URLs) still runs even when a task is aborted.

**Integration Safety**
- R11. For libraries that do not accept `AbortSignal` (e.g., `mermaid.render`, `html2canvas`), the subsystem wrapper must ensure stale results are discarded and not applied after abort.
- R12. `loadLocalImage` must accept an optional `AbortSignal` and check `signal.aborted` before invoking `electrobun.readImageAsBase64` or writing to `imageCache`, so that aborted image-load tasks do not create orphaned blob URLs.

## Success Criteria
- Triggering "Export as PNG" twice in rapid succession results in only one completed export; the first is cleanly cancelled.
- Switching files while Mermaid diagrams are rendering does not log stale-render errors or apply stale DOM updates.
- Switching files while images are loading does not create leftover blob URLs from the previous file.
- The `TaskQueue` abstraction is reusable and adopted by at least three existing subsystems.

## Scope Boundaries
- Out of scope: Bun/main-process level async tasks (e.g., AI streaming RPC) unless they can be trivially ported to the same pattern.
- Out of scope: Adding progress bars, loading spinners, or explicit Cancel buttons.
- Out of scope: Parallel execution limits or rate throttling beyond the "one per key" rule.
- Out of scope: Persistent or disk-backed task queues.

## Key Decisions
- **Replace-old-with-new per key**: Each task type can only have one active instance. A new instance automatically aborts the previous one. This prevents task pile-up and stale-result races with the simplest possible model.
- **Silent abort UX**: Cancelled tasks are invisible to the user. No toasts, no status flashes, no spinners. The app simply switches to the new task.
- **AbortController-based API**: The queue uses standard Web `AbortController`/`AbortSignal`. This natively supports `fetch`, iframe teardown, and any library that accepts an abort signal. For libraries that don't (e.g., `mermaid.render`, `html2canvas`), the wrapper is responsible for ignoring the result after abort.
- **Cleanup must survive abort**: The queue cannot suppress `finally` blocks or prevent resource cleanup.

## Dependencies / Assumptions
- Assumes `AbortController` is available in the Electrobun renderer context (standard since Chromium 66).
- Assumes the PNG export iframe cleanup logic in `src/mainview/hooks/useExport.ts` will be refactored so the iframe is torn down both on success and on abort.

## Outstanding Questions

### Resolve Before Planning
*(none — product direction is clear)*

### Deferred to Planning
- [Affects R1][Technical] Should `TaskQueue` be a global singleton, a React context, or a module-level instance per subsystem?
- [Affects R2][Technical] How should wrappers signal that a task is "done" when the underlying library (e.g., `mermaid.render`) does not accept `AbortSignal` and cannot be truly interrupted?
- [Affects R8][Technical] `preloadImages` currently fires and forgets with `Promise.all(...).catch(console.error)`. Should it skip preloading entirely if the file has already switched, or should it just ignore the results?

## Next Steps
→ `/ce:plan` for structured implementation planning
