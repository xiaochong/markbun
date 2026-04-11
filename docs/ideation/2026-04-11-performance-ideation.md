---
date: 2026-04-11
topic: performance-ideation
focus: performance improvements
---

# Ideation: Performance Improvements

## Codebase Context

**Project shape:** Cross-platform markdown desktop editor (Typora-like), built with TypeScript + React + Vite + Tailwind CSS, powered by Electrobun (Bun-native desktop framework) and Milkdown (ProseMirror-based WYSIWYG editor). v0.8.0.

**Top-level layout:** `src/bun/` (main process), `src/mainview/` (renderer), `src/shared/` (types, settings schema, command registry, i18n), `tests/unit/`, `scripts/`, `docs/`, `website/`.

**Notable patterns:** Chromeless-by-default UI, blob-url image caching, strict pre-commit gates (typecheck + bun test), i18n split by process, Zod-validated settings with atomic writes / crash recovery / version history.

**Performance-related pain points observed in the codebase:**
- `useCrepeEditor.ts` calls `serializer(view.state.doc)` on every editor update to detect changes, which is O(n) for the entire document on every keystroke.
- A global `MutationObserver` listening to `childList + subtree + characterData` triggers `updateLatexCodeBlocks`, `restoreHtmlPreviewImages`, and `injectMermaidHoverButtons` via full-document `querySelectorAll` scans on every DOM mutation.
- Mermaid and KaTeX re-render from scratch on every preview refresh, even when the source code block has not changed.
- `useExport.ts` uses a hardcoded `setTimeout(resolve, 3000)` when exporting PNG to wait for iframe CDN script loads.
- The search plugin performs a full-document `doc.descendants()` regex scan on every ProseMirror transaction while a search query is active.
- Image loading uses individual `readImageAsBase64` RPC calls per image, with `atob()` and Blob construction happening on the main renderer thread.
- Heavy async operations (export, Mermaid rendering, chunked loading) lack cancellation, leading to race conditions when users switch files or trigger repeated exports.

## Ranked Ideas

### 1. Avoid Full-Document Markdown Serialization on Every Keystroke
**Description:** `useCrepeEditor.ts` currently calls `serializer(view.state.doc)` on every editor update to produce the full Markdown string, then compares it with the previous result to detect changes. For large documents, this means every keystroke triggers an O(n) AST traversal and stringification.
**Rationale:** This is the largest performance tax on the typing path. Removing it directly eliminates noticeable input lag in large documents.
**Downsides:** Auto-save, AI tools, and export consumers must still be able to obtain the latest Markdown when they actually need it.
**Confidence:** 95%
**Complexity:** Low
**Status:** Unexplored

### 2. Replace Global MutationObserver with Precise Lifecycle Hooks
**Description:** The editor container currently registers a global `MutationObserver` listening to `childList + subtree + characterData`. Every DOM mutation triggers `updateLatexCodeBlocks`, `restoreHtmlPreviewImages`, and `injectMermaidHoverButtons`, each performing a full-document `querySelectorAll` scan. This should be replaced by ProseMirror plugin lifecycles, code-block NodeViews, and `IntersectionObserver` for on-demand updates.
**Rationale:** Converts every keystroke from O(DOM node count) full scans to precise, state-driven updates, directly addressing main-thread stalling during large-document editing.
**Downsides:** Requires deep understanding of Milkdown NodeViews and ProseMirror update cycles; risk of missing edge DOM changes.
**Confidence:** 85%
**Complexity:** Medium
**Status:** Unexplored

### 3. Cache Mermaid / KaTeX Renders by Content Hash
**Description:** Maintain a `Map<contentHash, renderedOutput>` cache for Mermaid diagrams and KaTeX math formulas. Skip `mermaid.render()` or `katex.render()` when the code block content is unchanged. The cache should be shared across editor preview refreshes, mode switches, and export flows (PNG/PDF/HTML).
**Rationale:** Unchanged diagrams are extremely common during scrolling, mode switching, and exporting. A single cache accelerates editor preview, all export formats, and the standalone Mermaid viewer simultaneously.
**Downsides:** Cache must be correctly invalidated on theme / darkMode changes; a large number of unique diagrams increases memory usage.
**Confidence:** 90%
**Complexity:** Low
**Status:** Unexplored

### 4. Remove the Fixed 3-Second Timeout in PNG Export
**Description:** `useExport.ts` uses a hardcoded `setTimeout(resolve, 3000)` when exporting PNG to wait for KaTeX / Mermaid CDN scripts to load inside an iframe. Replace this with `script.onload/error` event listeners so the screenshot is taken immediately after scripts are ready.
**Rationale:** Wastes 3 seconds on fast networks and may still be too short on slow networks. A nearly zero-cost, high-visibility fix.
**Downsides:** Must handle both CDN and local bundle loading paths gracefully; needs a fallback timeout in case script loading fails.
**Confidence:** 95%
**Complexity:** Low
**Status:** Unexplored

### 5. Incremental Text Index for Active Search
**Description:** The current search plugin executes a full-document `doc.descendants()` regex scan on every ProseMirror transaction (i.e., every keystroke) whenever a search query is active. Replace this with a flat text index that is updated only for modified textblocks via transaction mapping.
**Rationale:** Reduces search from "O(document length) per keystroke" to "O(edited range)", making typing with an active search query smooth even in large documents.
**Downsides:** Position mapping must be carefully maintained across node insertions/deletions; regex modes and case sensitivity add implementation complexity.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 6. Introduce a Cancellable Async Task Queue
**Description:** Introduce a lightweight `TaskQueue` with `AbortController` support for heavy async operations such as export, image processing, Mermaid rendering, and chunked loading. Automatically cancel stale tasks when the user switches files or triggers repeated exports.
**Rationale:** Prevents race conditions and wasted computation during rapid file switches or repeated exports. An infrastructure improvement that benefits all future heavy async paths.
**Downsides:** Requires auditing all async call sites for safe cancellation; some third-party libraries may not accept abort signals.
**Confidence:** 85%
**Complexity:** Medium
**Status:** Unexplored

### 7. Unified Image Loading Pipeline: Batch RPC + Web Worker
**Description:** Combine two optimizations: (1) replace N individual `readImageAsBase64` RPC calls with a single `readImagesAsBase64Batch(paths)` round-trip; (2) perform `atob()` → `Uint8Array` → `Blob` conversion inside a Web Worker. The renderer main thread receives only ready-to-use Blob URLs.
**Rationale:** Addresses both IPC overhead and main-thread blocking simultaneously, providing noticeable smoothing when opening notes with many images or restoring sessions with heavy image content.
**Downsides:** Requires changes to Bun-side RPC types and introduces Web Worker lifecycle management; benefits may be less visible for documents with only a few images.
**Confidence:** 70%
**Complexity:** Medium
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Bun-Side Rendering to Replace iframe+html2canvas Export | Too vague; no ready-made Bun-side rendering solution exists, and Electrobun isolation limits make this impractical. |
| 2 | ProseMirror Virtual Rendering for Huge Documents | Framework-level change; Milkdown/Crepe does not easily support virtualization. |
| 3 | Incremental Outline Parsing | Existing >1000-line file handling with a 300ms debounce is already sufficient mitigation. |
| 4 | Background Image Index Preloading on Folder Open | Unclear user benefit; unnecessarily consumes battery and memory. |
| 5 | Persistent On-Disk Image Cache for Local Images | Over-engineering for temporary Blob objects; re-reading local files is already fast. |

## Session Log

- 2026-04-11: Performance-focused ideation — 4 agents generated ~32 raw ideas, merged and deduped to ~20 candidates, 7 survived after adversarial filtering. All survivors are tightly anchored to observable hot paths in `useCrepeEditor.ts`, `useExport.ts`, and the search/Mermaid plugins.
