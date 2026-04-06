---
date: 2026-04-05
topic: open-ideation
focus:
---

# Ideation: Open Exploration

## Codebase Context

**Project shape:** Cross-platform markdown desktop editor (Typora-like), built with TypeScript + React + Vite + Tailwind CSS, powered by Electrobun (Bun-native desktop framework) and Milkdown (ProseMirror-based WYSIWYG editor).

**Top-level layout:** `src/bun/` (main process), `src/mainview/` (renderer), `src/shared/` (types, settings schema, command registry, i18n).

**Notable patterns:** Chromeless-by-default UI, blob-url image caching, strict pre-commit gates (`typecheck` + `bun test`), i18n split by process, Zod-validated settings with atomic writes / crash recovery / version history.

**Obvious pain points / gaps:** Windows known issues (double cursor on high-DPI, garbled non-ASCII text in menus, no native file association, blocked on upstream Electrobun bugs); dependency on Electrobun v1.16.0 with node-modules overrides for `@codemirror/state` and `@codemirror/view`; no E2E or integration tests yet; `src/shared/` is thin; more logic could be centralized.

**Past learnings — recurring themes:** two independent menu dispatch paths (macOS native menu clicks vs Windows/Linux RPC-based `actionToEvent` mapping); WebView lacks native clipboard support for input fields; no synchronous JS evaluation with return value; React effect timing and async race conditions (session persistence overwritten on startup, editor content lost on file switch); ProseMirror/Milkdown integration complexity (Crepe's `markdownUpdated` only fires for user-initiated edits, normalization causes duplicate dispatches, frontmatter support requires workaround); AI tool call lifecycle and streaming protocol had cascading failures; adding a menu item requires updating six separate locations; editor change detection and dirty state is fragile; CSS flexbox defaults causing UI bugs (missing `min-w-0`).

## Ranked Ideas

### 1. Single-Source Command & Menu Manifest
**Description:** Replace the six-location menu/command registration (`menu.ts`, `types.ts`, `electrobun.ts`, `App.tsx`, `actionToEvent` table, macOS `application-menu-clicked`) with one declarative command manifest that generates the native menu tree, RPC mappings, and frontend handlers.
**Rationale:** The codebase explicitly documents that "adding a menu item requires updating six separate locations" and the dual dispatch paths have already caused silent macOS failures. v0.5.0's command palette and tabbed editing will add many new commands, so this debt compounds quickly.
**Downsides:** Requires a one-time refactor of the existing command bridge; Electrobun's native `ApplicationMenu` may force platform-specific shapes that need escape hatches.
**Confidence:** 90%
**Complexity:** Medium
**Status:** Unexplored

### 2. Document Model & Tabbed Editing Foundation
**Description:** Introduce a lightweight document model above the current `filePath` singleton. Support multiple open buffers with tabbed editing, and bind the blob URL image cache to document-session lifecycles so URLs are auto-revoked on tab close/switch.
**Rationale:** v0.5.0 tabbed editing is a roadmap headline feature, but `WindowState` treats `filePath` as a singleton, which does not naturally extend to multiple documents. Blob URLs are also a known WebView memory-leak vector; without session-scoped cleanup, tabs would multiply the leak surface.
**Downsides:** Touches editor initialization, auto-save, and session persistence simultaneously; Milkdown instance recycling needs careful design.
**Confidence:** 85%
**Complexity:** High
**Status:** Unexplored

### 3. Consolidated i18n Source of Truth
**Description:** Collapse the mirrored `src/bun/i18n/` and `src/mainview/i18n/` trees into a single canonical source under `src/shared/i18n/`. Keep static imports (the JSONs are tiny) rather than introducing build-time sharding complexity.
**Rationale:** 8 languages maintained in two process trees means ~16 files to keep in sync. As v0.5.0 adds find/replace, command palette, and tab chrome, string volume multiplies translation maintenance cost and drift risk.
**Downsides:** Requires adjusting import paths in both processes and possibly Vite aliases; must preserve current static-import behavior to avoid async-loading menu text on startup.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 4. Electrobun Integration Test Harness
**Description:** Build a lightweight integration-test fixture that spins up the Bun main process with a mocked WebView RPC peer. Target the most fragile boundaries first: menu actions, file open/save, settings atomic writes, and session persistence on startup.
**Rationale:** There are no integration or E2E tests yet, while the highest-severity bugs (session overwritten on startup, content lost on file switch, menu dispatch drift) all live at async process boundaries that unit tests cannot reproduce.
**Downsides:** Electrobun v1.16.0 is young and CI WebView spawning can be flaky, especially across platforms. Scope should be bounded to core RPC paths rather than full UI E2E.
**Confidence:** 70%
**Complexity:** Medium–High
**Status:** Unexplored

### 5. Native-First Clipboard Service with Renderer Fallback
**Description:** Create a small `src/bun/services/clipboard.ts` that uses the host OS clipboard (via system commands or a thin native helper) and expose it over RPC. The renderer falls back to browser APIs only when necessary.
**Rationale:** Electrobun's WebView lacks native clipboard support for input fields, and the recent ProseMirror-native copy/cut refactor does not cover non-editor surfaces (command palette input, inline rename, AI chat input). A unified service removes duplicated platform-specific logic.
**Downsides:** The recent `feat(clipboard)` commit already solved the editor's primary pain points; further abstraction yields diminishing returns unless tightly scoped.
**Confidence:** 65%
**Complexity:** Low–Medium
**Status:** Unexplored

### 6. Pre-Commit Documentation Path Guard
**Description:** Add a lightweight script to the existing pre-commit flow (`typecheck` + `bun test`) that parses relative paths and code examples in `README.md`, `AGENTS.md`, `ROADMAP.md`, and `docs/`, failing the commit if any file reference is stale or broken.
**Rationale:** Doc drift is explicitly identified as a pain point (e.g., `AGENTS.md` referencing `doc/architecture.md` instead of `docs/architecture.md`). It erodes onboarding trust, and this automation turns a manual check into a mechanical gate.
**Downsides:** Only covers path references in Markdown; intentional references to not-yet-created files may need a small allow-list.
**Confidence:** 85%
**Complexity:** Low
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Document-Aware AI Context Engine | Ahead of prerequisites; v0.5.0 document model does not yet exist. |
| 2 | AI Tool Call Transaction Log with Interactive Replay | Engineer-only observability for a feature that has no visible execution path yet. |
| 3 | AI Provider Abstraction / Protocol Layer | `@mariozechner/pi-ai` already provides provider abstraction; another layer is over-engineering. |
| 4 | Shared Services & Settings Backbone Expansion | Vague open-ended refactor; only valuable if tightly scoped to a concrete capability. |
| 5 | Editor State Machine with Content Checksums | ProseMirror already is the state machine; checksums solve an unobserved corruption problem. |
| 6 | ProseMirror Tracing & Replay Log | Developer-tooling luxury with zero user value; breaks plugin state and hurts performance. |
| 7 | Binary Differential Version History | Markdown text snapshots are already small and debuggable; binary diffs add unnecessary native deps. |
| 8 | Treat Electrobun as a Temporary Host; Abstract Host Boundary | Effectively a full rewrite of IPC/menus/windows for a hypothetical migration not on the roadmap. |
| 9 | Offline-First Sync-Ready Document Graph | Three milestones ahead; building CRDT/sync infrastructure before tabs exist is premature. |
| 10 | Streaming Recovery for Gigabyte-Scale Markdown | 1GB markdown is not a credible use case for a note editor; project already caps at >10MB targets. |
| 11 | Cooperative File Locking with Cross-Window Save Arbitration | Single-window app building distributed consensus for multi-window conflicts that do not yet exist. |
| 12 | Internal shadcn component registry with story-like previews | Zero user value meta-project for a small team that already uses shadcn/ui successfully. |
| 13 | Unified Document Orchestrator (over-architected variant) | "Orchestrator" framing risks creating a god object; the essential value was kept as Idea #2. |
| 14 | Native-First Clipboard Service (over-generalized variant) | A generic MIME plugin architecture would be overkill; the essential value was kept as Idea #5. |

## Session Log

- 2026-04-05: Initial open ideation — 6 agents generated ~45 raw ideas, merged and deduped to ~30 candidates, 6 survived after adversarial filtering.
