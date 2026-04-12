---
title: fix: Remove the fixed 3-second timeout in PNG export
type: fix
status: active
date: 2026-04-12
origin: docs/brainstorms/2026-04-12-remove-png-export-fixed-timeout-requirements.md
---

# fix: Remove the fixed 3-second timeout in PNG export

## Overview

Replace the hardcoded 3-second `setTimeout` in PNG export script loading with event-driven resolution (`onload`/`onerror`) plus a longer fallback timeout. This eliminates the fixed wait on fast networks and gives slow networks a more reasonable grace period.

## Problem Frame

`src/mainview/hooks/useExport.ts` waits for three CDN scripts to load inside an iframe before rendering math and Mermaid diagrams for PNG export. It currently resolves as soon as either:
1. All three scripts fire `onload`/`onerror`, **or**
2. 3000 ms elapse unconditionally.

The timeout:
- Leaves a dangling timer when scripts finish early.
- Cuts off slow connections too aggressively, silently producing exports missing math/diagrams.

## Requirements Trace

- **R1.** Event-driven resolution: proceed immediately once all three scripts have fired `onload` or `onerror`.
- **R2.** Fallback timeout (e.g. 10 seconds) that is cleared once scripts finish, to avoid dangling timers.
- **R3.** Log a warning on individual `onerror` so failures are observable.

## Scope Boundaries

- Only the iframe script-loading block in `generateImage` is in scope.
- The separate 1-second image-loading timeout (`img.onload`/`img.onerror`) is out of scope.

## Context & Research

### Relevant Code and Patterns

- `src/mainview/hooks/useExport.ts` — `generateImage` contains the script-loading promise (lines ~225–241).
- `tests/unit/mainview/hooks/useExport.test.ts` — test stubs already simulate immediate `onload` via the `src` setter on stub elements. The `installFastTimers` helper currently fast-forwards only the 3000 ms fallback timeout.
- Recent adjacent work: `src/mainview/lib/taskQueue.ts` was added; exports already run through `taskQueue.enqueue('export-png', …)`.

## Key Technical Decisions

- **Keep `onerror` counted toward completion.** Export should continue even if one CDN script fails, matching current behavior but without the arbitrary cutoff.
- **Fallback timeout: 10 seconds.** Prevents indefinite hangs while being forgiving on slower connections.
- **Clear the fallback timer on completion.** Prevents dangling timers and avoids timer-based test hacks.

## Implementation Units

- [ ] **Unit 1: Refactor script-loading wait in `useExport.ts`**

**Goal:** Replace the unconditional 3-second timeout with event-driven resolution and a clearable fallback timeout.

**Requirements:** R1, R2, R3

**Dependencies:** None

**Files:**
- Modify: `src/mainview/hooks/useExport.ts`

**Approach:**
- In the `Promise<void>` that waits for scripts, introduce a local `loaded` counter and a `timeoutId` variable.
- Create a `checkDone()` helper that increments `loaded` and, when `loaded >= 3`, clears the fallback timeout and resolves the promise.
- Assign `checkDone` to `onload` and `onerror` for all three script elements.
- Start `setTimeout(resolve, 10000)` and store its ID so `checkDone` can `clearTimeout(timeoutId)`.
- In `onerror`, also `console.warn` the failed script URL.

**Test scenarios:**
- Happy path: all three scripts fire `onload` in any order — promise resolves immediately after the third.
- Edge case: one or more scripts fire `onerror` — promise still resolves after the third event, export continues.
- Error path: no events fire within 10 seconds — fallback timeout resolves the promise so export does not hang indefinitely.

**Verification:**
- Exported PNG with fast network no longer incurs a fixed 3-second penalty.
- No dangling timers remain after script events fire.

- [ ] **Unit 2: Update `useExport.test.ts` timer stub**

**Goal:** Align the test timer stub with the new fallback timeout duration.

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**
- Modify: `tests/unit/mainview/hooks/useExport.test.ts`

**Approach:**
- Update `installFastTimers` to fast-forward the new fallback timeout value (10000 ms) instead of 3000 ms.
- Because the stub script elements trigger `onload` immediately on `src` assignment, the test already proceeds via events before the fallback timer fires; updating the intercepted delay keeps the test from waiting the full fallback duration.

**Test scenarios:**
- Happy path (integration): `generateImage` still completes quickly under the stubbed environment.
- Edge case: `taskQueue` abortion of an in-flight export still works when a new export is triggered.

**Verification:**
- `bun test tests/unit/mainview/hooks/useExport.test.ts` passes.

## System-Wide Impact

- **Unchanged invariants:** The HTML export path (`generateHTML`) is untouched. The `taskQueue` integration and cancellation behavior remain unchanged. The `mermaidCache` usage in `generateImage` is unaffected.
- **Error propagation:** A script `onerror` now logs a warning but does not abort the export; downstream rendering simply skips the unavailable library, which matches current silent-failure behavior.

## Risks & Dependencies

| Risk | Mitigation |
|------|-----------|
| Fallback timeout too short on very slow networks | 10 seconds is 3× the previous value; this is a quick fix and can be revisited if user reports persist. |
| Tests relying on the exact 3000 ms timeout value | Update `installFastTimers` intercept value in the same PR. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-12-remove-png-export-fixed-timeout-requirements.md](docs/brainstorms/2026-04-12-remove-png-export-fixed-timeout-requirements.md)
- Related code: `src/mainview/hooks/useExport.ts`
- Related test: `tests/unit/mainview/hooks/useExport.test.ts`
