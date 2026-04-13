---
date: 2026-04-13
topic: e2e-coverage-gaps
focus: 端到端测试还有哪些高价值测试没有覆盖到
---

# Ideation: MarkBun 端到端测试高价值覆盖缺口

## Codebase Context

**Project:** MarkBun — Electrobun-based desktop Markdown editor (Bun main process + WebView renderer, React + TypeScript + Milkdown + shadcn/ui).

**Existing E2E tests (5 files):**
- `editor-operations.test.ts` — formatting marks, headings, lists, blockquotes, inserts (HR, code/math/mermaid blocks, table), table CRUD, undo/redo, copy-paste plain text, source-mode toggle, search/find-replace (dialog only), image insert dialog (opened only), export HTML dialog (opened only), AI panel toggle, UI toggles.
- `file-lifecycle.test.ts` — save/open round-trip for many markdown variants (headings, lists, tables, code blocks, math, frontmatter, unicode, emoji, links, images, inline HTML, blockquotes, task lists, nested paths, large files).
- `menu-dispatch.test.ts` — about dialog, quick open, settings, file history dialog (opened only), search/find-replace, UI toggles via quick open, filtering, backdrop closes.
- `settings-ui.test.ts` — auto-save toggle, version history, tabs, theme, font size, line height, language, max versions, retention days, recovery interval, AI enabled/local-only, reset defaults, cancel/discard, backdrop close.
- `page.health.test.ts` — runner baseline health checks.

**Documented high-severity historical bugs (from docs/solutions/):**
- macOS menu action dispatch silent failures (two-path divergence)
- AI tool-call cascading failures across RPC bridge + SSE stream lifecycle
- Editor content lost on file switch after AI edits (`isDirty` ratchet)
- Session persistence lost on restart (React effect race condition)
- Clipboard shortcuts broken in input fields inside WebView
- Milkdown HTML block rendering/DOMPurify preview pitfalls
- Mermaid flowchart blank nodes in WebKit
- Large-file chunked loading splitting through fenced code blocks
- Command palette history not recording

## Ranked Ideas

### 1. File History Version Restore
**Description:** Manually save a document multiple times, open the file history dialog, select an earlier version, click restore, and assert the editor reverts to that content.
**Rationale:** Version history is a safety net, but current E2E only verifies the dialog opens. The actual restore flow (crossing backup service + renderer dialog + content replacement) has zero coverage.
**Downsides:** Requires seeding backup files or waiting for auto-save to generate versions; also need to assert window title/path sync after restore.
**Confidence:** 95%
**Complexity:** Medium
**Status:** Unexplored

### 2. Export PNG End-to-End
**Description:** Trigger PNG export from a realistically complex document (tables, code blocks, math) and assert a non-empty PNG file is written to disk.
**Rationale:** The export image test in `editor-operations.test.ts` is currently skipped due to `html2canvas` dynamic-import issues in the WebView E2E environment. The project already has a dedicated plan for PNG export timeout removal (commit `6f46322`), making this a clear engineering priority.
**Downsides:** Depends on html2canvas availability in the E2E WebView; large documents may timeout.
**Confidence:** 85%
**Complexity:** Medium
**Status:** Unexplored

### 3. Large File with Fenced Code Block Rendering
**Description:** Open a markdown file larger than 500 lines containing fenced code blocks, and assert the editor renders the complete file without splitting any block into broken nodes.
**Rationale:** Direct regression test for the documented high-severity bug "large-file chunked loading splitting through fenced code blocks." Precise, deterministic, and high prevention value.
**Downsides:** Requires a large synthetic fixture file; test execution time is slightly longer.
**Confidence:** 92%
**Complexity:** Low-Medium
**Status:** Unexplored

### 4. Find-Replace Execution End-to-End
**Description:** Open the find/replace dialog, execute actual replace and replace-all operations across headings, paragraphs, and code blocks, and assert the editor buffer updates correctly.
**Rationale:** Existing E2E tests only verify the dialog opens/closes. The actual editorial transformation — the feature's core value proposition — is completely untested.
**Downsides:** Must handle both CodeMirror source-mode and Milkdown WYSIWYG find-replace paths.
**Confidence:** 90%
**Complexity:** Low-Medium
**Status:** Unexplored

### 5. Open Folder and Sidebar Tree Navigation
**Description:** Use the menu to open a folder, then click through nested files in the sidebar file tree to open different markdown documents sequentially, asserting correct content load and no cross-contamination.
**Rationale:** This is a core differentiator of a desktop editor vs a web editor, and it is completely untested. Covers `file-open-folder` plus the main/renderer boundary for file explorer state.
**Downsides:** Requires creating a temporary folder hierarchy; DOM assertions on tree selection state may be granular.
**Confidence:** 88%
**Complexity:** Medium
**Status:** Unexplored

### 6. AI Chat Send-Receive Loop
**Description:** Open the AI panel, type a user prompt, send it, wait for the streamed response to complete, and assert the conversation history renders both user and assistant turns.
**Rationale:** Directly addresses one of the most historically failure-prone subsystems — "AI tool-call cascading failures across RPC bridge + SSE stream lifecycle." Current E2E only toggles the panel open/closed.
**Downsides:** Requires a way to inject a mock SSE stream without becoming a "test of the mock." Best implemented via `_test` RPC or `window.__markbunTestAPI` to push synthetic chunks into the real streaming pipeline.
**Confidence:** 80%
**Complexity:** High
**Status:** Unexplored

### 7. Rich Clipboard Round-Trip (Tables, HTML, and Math)
**Description:** Use a test-only API (avoiding the global system clipboard) to inject HTML, tables, and LaTeX math into the paste pipeline, then assert Milkdown parses and renders the structure correctly.
**Rationale:** WebView clipboard handling is a documented bug cluster (input-field shortcuts broken, editor multimode race conditions). Existing E2E copy-paste only covers plain text.
**Downsides:** If forced to use the real system clipboard, this becomes extremely flaky. Must rely on `DataTransfer` injection via `_test` APIs.
**Confidence:** 82% (contingent on avoiding system clipboard)
**Complexity:** Medium
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Auto-Save Stress Over Time | Timing-dependent and inherently flaky in CI; better covered by integration tests |
| 2 | Crash Recovery Dialog Flow | Simulating a real crash in Electrobun E2E leaves zombie CEF processes; too fragile |
| 3 | File Save-As Round-Trip | Heavily overlaps with existing `file-lifecycle.test.ts` save coverage; lower incremental value |
| 4 | Recent Files Menu Round-Trip | Backend logic already unit-tested; low architectural risk for E2E |
| 5 | Context Menu Accuracy | Largely an upstream Milkdown concern; testing via CDP is flaky UI-chrome testing |
| 6 | Command Palette History Orbit | Root cause was a unit-level dispatch gap; adequately covered by unit tests |
| 7 | Rapid Mode Switch Stress Test | Stress tests are timing-dependent and low signal-to-noise; a single mode switch is already covered |
| 8 | Concurrent Save and Edit Under Auto-save | True concurrency across Bun/WebView is hard to orchestrate deterministically via CDP |
| 9 | Cross-Platform Menu Dispatch Flood | "Flood" tests are slow and flaky; a single dispatch per action already covers the contract |
| 10 | AI Chat Loop Under Network Jitter | Network jitter simulation is beyond current infrastructure; documented AI bugs were local RPC/stream issues |
| 11 | Export PNG at Maximum DOM Complexity | Unclear threshold and duplicates #2; complexity should be folded into the main PNG export test |
| 12 | RPC Contract Fuzz — Menu Action Round-Trip | Fuzz testing belongs in the integration layer against mock peers |
| 13 | Renderer State Machine Audit | State machine verification is better done with unit tests and property-based tests |
| 14 | File-System Side-Effect Telemetry | Telemetry and atomicity are integration-layer concerns, not E2E user journeys |
| 15 | Chunked Loader Boundary Oracle | White-box chunk-boundary testing belongs in unit/integration tests |
| 16 | Export Pipeline Cross-Process Contract | Cross-process contract validation belongs in integration tests with mock WebView peers |

## Session Log

- 2026-04-13: Initial ideation — ~35 candidates generated across 5 frames (pain/friction, unmet need, inversion/automation, assumption-breaking, extreme cases), merged/deduped to ~26 unique candidates, 7 survivors retained after adversarial filtering.
