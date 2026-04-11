---
title: feat - Cache Mermaid Renders by Content Hash
type: feat
status: active
date: 2026-04-11
origin: docs/brainstorms/2026-04-11-mermaid-render-cache-requirements.md
---

# Cache Mermaid Renders by Content Hash

## Overview

Add an in-memory LRU cache for Mermaid SVG renders so unchanged diagrams are not re-rendered on every editor preview refresh, standalone viewer reopen, or image export. This directly reduces input lag near Mermaid blocks and speeds up export for documents with diagrams.

## Problem Frame

Mermaid diagrams currently re-render from scratch in three places:
- **Editor preview**: `useCrepeEditor.ts` calls `mermaid.render()` every time Milkdown asks for a code-block preview.
- **Standalone viewer**: `MermaidDiagramViewer.tsx` calls `mermaid.render()` on every modal open.
- **Image export**: `useExport.ts` calls `mermaid.run()` inside an iframe for every export.

For large or complex diagrams this is noticeable slow; for unchanged diagrams it is entirely avoidable.

## Requirements Trace

- R1. In-memory `Map<hash, svgString>` cache for successful Mermaid renders.
- R2. Cache key hashes `(diagramSource + theme + mermaidConfig)` so different modes do not collide.
- R3. LRU eviction with a 100-entry cap.
- R4. Failed renders are not cached.
- R5. Editor preview checks the cache before calling `mermaid.render()`.
- R6. Standalone viewer checks the cache before calling `mermaid.render()`.
- R7. Image export checks the cache before calling `mermaid.run()` and injects cached SVGs directly.
- R8. HTML export is optional; focus on PNG export.

## Scope Boundaries

- KaTeX caching is excluded.
- No disk persistence.
- No pre-rendering of off-screen diagrams.

## Context & Research

### Relevant Code and Patterns

- `src/mainview/lib/image/cache.ts` — existing `Map`-based LRU with singleton + factory pattern and `bun:test` unit tests. This is the blueprint for the new cache.
- `src/mainview/components/editor/hooks/useCrepeEditor.ts` — CodeMirror `renderPreview` callback at ~line 292 calls `mermaid.render(id, code)`.
- `src/mainview/components/mermaid-viewer/MermaidDiagramViewer.tsx` — `useEffect` at ~line 47 calls `mermaid.render(id, mermaidSource)`.
- `src/mainview/hooks/useExport.ts` — iframe-based image export at ~line 304 calls `win.mermaid.run({ querySelector: '.language-mermaid, .mermaid' })`.

### Institutional Learnings

- `docs/solutions/ui-bugs/mermaid-flowchart-blank-nodes-and-svg-collapse-webkit-2026-04-08.md` warns that **preview** uses `htmlLabels: false` while the **viewer** uses Mermaid defaults (`htmlLabels: true`). These two contexts produce structurally different SVGs and must be treated as distinct render configs in the cache key (see origin doc R2).
- `docs/solutions/integration-issues/milkdown-html-block-rendering-with-dompurify-2026-04-07.md` notes that Milkdown's preview panel runs `DOMPurify.sanitize()`, which strips children of `<foreignObject>` and non-HTTP image `src` attributes. When injecting cached SVGs into the editor preview, we should verify the SVG survives insertion intact; the preview already strips some advanced Mermaid features because of `htmlLabels: false`, so the impact may be limited.

## Key Technical Decisions

- **Simple synchronous hash**: Use a lightweight string hash (e.g. `djb2` or `fnv1a`) on the concatenation of source + theme + JSON-stringified config. `crypto.subtle.digest` is async and unnecessary for a non-cryptographic cache key.
- **Cache key includes full config object**: Because `htmlLabels: false` and `htmlLabels: true` produce different SVGs, the key must encode the exact config passed to `mermaid.render()`. Theme and `htmlLabels` are the primary variables today.
- **Export injection strategy**: In the iframe, after `marked.parse()` produces the DOM, find all mermaid elements, replace cached ones with their SVG strings, and pass only the remaining uncached elements to `mermaid.run({ nodes: uncachedElements })`. This avoids re-rendering cached diagrams while still letting Mermaid handle uncached ones natively.

## Open Questions

### Resolved During Planning

- **Hash algorithm**: A simple sync string hash is preferred over `crypto.subtle.digest` because it avoids async complexity and is sufficient for cache-key uniqueness.
- **Export iframe approach**: Inject cached SVGs into the DOM before calling `mermaid.run()`, then invoke `mermaid.run({ nodes: [...] })` only on the uncached subset.

### Deferred to Implementation

- Whether `mermaid.run({ nodes })` requires a minor API-shape check when the implementation reaches `useExport.ts`. The Mermaid v10/v11 docs indicate `nodes` is supported, but it should be verified against the bundled version.

## Implementation Units

- [ ] **Unit 1: Create Mermaid Render Cache Module**

**Goal:** Provide a shared, typed LRU cache for Mermaid SVG strings.

**Requirements:** R1, R2, R3, R4

**Dependencies:** None

**Files:**
- Create: `src/mainview/lib/mermaid/cache.ts`
- Test: `tests/unit/mainview/lib/mermaid/cache.test.ts`

**Approach:**
- Implement a `MermaidCache` class backed by a `Map<string, string>` storing `hash → svg`.
- Hash function: sync string hash on `source + ':' + theme + ':' + JSON.stringify(config)`.
- LRU eviction: manual scan for oldest access timestamp when size exceeds 100, matching the pattern in `src/mainview/lib/image/cache.ts`.
- Expose `get(source, theme, config) → svg | undefined` and `set(source, theme, config, svg) → void`.
- Export a singleton `mermaidCache` and a `createMermaidCache(capacity)` factory for tests.
- Do not cache failed renders; callers should only `set()` on success.

**Patterns to follow:**
- `src/mainview/lib/image/cache.ts` for Map-based LRU mechanics.
- `tests/unit/mainview/lib/image/cache.test.ts` for `bun:test` structure and deterministic eviction tests.

**Test scenarios:**
- **Happy path**: `get` returns cached SVG for identical source/theme/config; `set` stores a new entry.
- **Edge case**: Accessing an entry updates its LRU position so it is not evicted prematurely.
- **Edge case**: Adding the 101st unique entry evicts the least-recently-used entry.
- **Edge case**: Different `htmlLabels` values produce different cache keys and do not collide.
- **Edge case**: `get` returns `undefined` after `clear()`.

**Verification:**
- All unit tests pass (`bun test tests/unit/mainview/lib/mermaid/cache.test.ts`).
- TypeScript typecheck passes.

---

- [ ] **Unit 2: Integrate Cache into Editor Preview**

**Goal:** Skip `mermaid.render()` in the editor when the diagram is already cached.

**Requirements:** R5

**Dependencies:** Unit 1

**Files:**
- Modify: `src/mainview/components/editor/hooks/useCrepeEditor.ts`

**Approach:**
- In the CodeMirror `renderPreview` callback for `lang === 'mermaid'`, compute the cache key from `code`, `darkModeRef.current ? 'dark' : 'default'`, and the config object `{ startOnLoad: false, theme, suppressErrorRendering: true, htmlLabels: false }`.
- On cache hit, immediately call `applyPreview(fixedSvg)` (reusing the existing `width="100%"` strip logic) without importing or calling `mermaid.render()`.
- On cache miss, proceed with the existing `import('mermaid').then(...)` flow, but in the `.then` after `mermaid.render()` succeeds, store the resulting `svg` in the shared cache before calling `applyPreview()`.
- Keep the existing error handling and `applyPreview('<div class="mermaid-error">...')` path unchanged.

**Patterns to follow:**
- Existing dynamic `import('mermaid')` pattern for lazy loading.
- Existing `width="100%"` fix must still run on both cached and freshly rendered SVGs.

**Test scenarios:**
- **Happy path**: Preview of an unchanged Mermaid block does not trigger a new `mermaid.render()` call.
- **Integration**: First preview of a new diagram still renders via `mermaid.render()` and the result is cached.
- **Error path**: A syntax error in the diagram still shows the error UI and does not poison the cache.

**Verification:**
- Manual test: type near a Mermaid block in a large document and confirm no duplicate network/render activity in DevTools.
- Unit/integration test if feasible: mock the cache module and assert `mermaid.render` is not called on a cache hit.

---

- [ ] **Unit 3: Integrate Cache into Standalone Viewer**

**Goal:** Skip `mermaid.render()` in the standalone viewer when the diagram is already cached.

**Requirements:** R6

**Dependencies:** Unit 1

**Files:**
- Modify: `src/mainview/components/mermaid-viewer/MermaidDiagramViewer.tsx`

**Approach:**
- Before the existing `import('mermaid')` in the `useEffect`, compute the cache key from `mermaidSource`, `isDark ? 'dark' : 'default'`, and the config object `{ startOnLoad: false, theme, suppressErrorRendering: true }` (viewer uses default `htmlLabels`).
- On cache hit, skip `mermaid.render()` entirely: set `svgContent` directly with the cached SVG (after stripping `width="100%"` to match current behavior), set `isLoading(false)`, and return.
- On cache miss, proceed with the existing render flow and store the successful SVG in the cache.
- Preserve the existing `cancelled` guard and error handling.

**Patterns to follow:**
- Same caching pattern as Unit 2.

**Test scenarios:**
- **Happy path**: Reopening the viewer with the same source shows the diagram instantly (no loading spinner).
- **Edge case**: Switching dark mode changes the cache key and re-renders once; reopening after that uses the new theme's cached entry.

**Verification:**
- Manual test: open viewer, close it, reopen it — second open should be instantaneous.

---

- [ ] **Unit 4: Integrate Cache into Image Export**

**Goal:** Skip `mermaid.run()` for cached diagrams during PNG export.

**Requirements:** R7, R8

**Dependencies:** Unit 1

**Files:**
- Modify: `src/mainview/hooks/useExport.ts`

**Approach:**
- After `contentDiv.innerHTML = html` inside the iframe, query all `.language-mermaid, .mermaid` elements.
- For each element, extract its text content (the raw Mermaid source), compute the cache key using the export theme (`isDark ? 'dark' : 'default'`) and export config (`{ startOnLoad: false, theme, htmlLabels: false }`), and check the shared cache.
- If cached, replace the element with a `<div>` containing the cached SVG string.
- Collect all uncached elements into an array.
- If there are uncached elements, call `win.mermaid.run({ nodes: uncachedElements })` instead of the global `querySelector` approach.
- If all diagrams were cached, skip `mermaid.run()` entirely.
- After `mermaid.run()` (or skip), cache any newly rendered SVGs that were produced. Because `mermaid.run()` mutates the DOM in place, the resulting SVGs can be read back from the DOM and stored in the cache for future exports.

**Patterns to follow:**
- Existing iframe DOM construction pattern.
- Same cache singleton used in Units 2 and 3.

**Test scenarios:**
- **Happy path**: Exporting a document with unchanged Mermaid diagrams completes faster because `mermaid.run()` is skipped or minimized.
- **Integration**: Exporting a document with a mix of cached and new diagrams renders only the new ones via Mermaid.
- **Edge case**: Exporting after a theme switch uses the correct theme cache shard.

**Verification:**
- Manual test: export a document with Mermaid diagrams twice; second export should be meaningfully faster.
- Existing export-related functionality remains intact.

## System-Wide Impact

- **Interaction graph**: The cache module is a pure utility with no lifecycle hooks. Three UI paths read from it.
- **Error propagation**: Cache lookup failures (e.g. hash collision, though extremely unlikely) simply fall through to the existing render path. There is no new failure mode.
- **State lifecycle risks**: LRU eviction prevents unbounded memory growth. No cleanup is needed on file switch because the cache is per-session and bounded.
- **API surface parity**: The cache is internal; no RPC types, settings schema, or CLI changes are required.
- **Unchanged invariants**: `mermaid.initialize()` is still called by consumers before rendering; the cache does not mutate Mermaid global state.

## Risks & Dependencies

| Risk | Mitigation |
|------|-----------|
| DOMPurify in Milkdown preview strips injected SVG content | Verified via learnings: preview already uses `htmlLabels: false`, which avoids `<foreignObject>`; cached SVGs for preview should survive sanitization. Monitor for regressions. |
| Export iframe `mermaid.run({ nodes })` API subtlety | Verify during implementation against the bundled Mermaid version; fallback to `mermaid.render()` per-element if needed. |
| Hash collisions causing wrong SVG display | Use a decent string hash and include source length in the key material; collision probability is negligible for this use case. |

## Documentation / Operational Notes

- No user-facing settings or documentation changes are required. This is a pure performance improvement.
- CHANGELOG entry: "perf: cache Mermaid renders to reduce re-rendering during editing and export."

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-11-mermaid-render-cache-requirements.md](docs/brainstorms/2026-04-11-mermaid-render-cache-requirements.md)
- Related learnings: `docs/solutions/ui-bugs/mermaid-flowchart-blank-nodes-and-svg-collapse-webkit-2026-04-08.md`
- Related learnings: `docs/solutions/integration-issues/milkdown-html-block-rendering-with-dompurify-2026-04-07.md`
