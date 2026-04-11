---
date: 2026-04-11
topic: mermaid-render-cache
---

# Cache Mermaid Renders by Content Hash

## Problem Frame

Mermaid diagrams re-render from scratch on every editor preview refresh, mode switch, and export. For unchanged diagrams this is wasted work: `mermaid.render()` is async, can be slow for complex diagrams, and currently blocks the export pipeline. Users typing near a Mermaid block, switching preview modes, reopening the standalone viewer, or re-exporting a file all pay this penalty repeatedly even when the diagram source has not changed.

## Requirements

**Cache Mechanics**
- R1. Maintain an in-memory `Map<hash, svgString>` cache for successful Mermaid renders.
- R2. Cache key must be a deterministic hash of `(diagramSource + theme + mermaidConfig)`. Theme and configuration differences produce separate entries so dark-mode switches do not invalidate the whole cache.
- R3. Implement LRU eviction with a 100-entry cap to prevent unbounded memory growth.
- R4. Do not cache failed renders; errors should be re-attempted on the next request in case the source or library state changes.

**Consumers**
- R5. Editor code-block preview (`useCrepeEditor.ts` CodeMirror `renderPreview` callback) must check the cache before calling `mermaid.render()`.
- R6. Standalone Mermaid viewer (`MermaidDiagramViewer.tsx`) must check the cache before calling `mermaid.render()`.
- R7. Image export (`useExport.ts`) must check the cache before calling `mermaid.run()`. Cached SVG strings should be injected directly into the export iframe instead of being re-rendered.
- R8. HTML export may optionally use the cache; the primary target is PNG export because it is the slowest path.

**Scope Exclusions**
- R9. KaTeX renders are out of scope for this change; the editor currently has no live KaTeX preview, so caching would only benefit export and adds marginal value compared to Mermaid.
- R10. Persistent on-disk cache is out of scope; only an in-memory per-session cache is required.

## Success Criteria

- Typing or scrolling near an unchanged Mermaid block does not trigger a new `mermaid.render()` call.
- Reopening the standalone Mermaid viewer with the same diagram is instant (no loading spinner).
- Exporting a document with unchanged Mermaid diagrams completes faster because diagram rendering is skipped.
- Memory usage remains bounded regardless of document size or number of unique diagrams.

## Scope Boundaries

- KaTeX caching is explicitly excluded.
- No disk persistence or cross-session caching.
- No pre-rendering or background rendering of off-screen diagrams.

## Key Decisions

- **Mermaid only**: The highest-leverage improvement. KaTeX can plug into the same cache module later if live math preview is added.
- **LRU 100-entry cap**: Balances typical large-document editing sessions against memory safety.
- **Hash includes theme and config**: Avoids complex global invalidation on dark-mode toggles; each theme gets its own cache shard implicitly.

## Dependencies / Assumptions

- `mermaid.render()` returns an SVG string that can be safely cached and re-injected into different DOM contexts (editor preview, viewer, export iframe).
- The export iframe is same-origin, so the shared cache module can be imported and used directly rather than passing data across a boundary.

## Outstanding Questions

### Deferred to Planning
- [Affects R7][Technical] Should the export iframe refactor inject cached SVGs by replacing placeholder elements, or by bypassing `mermaid.run()` entirely and manually constructing the DOM?
- [Affects R2][Technical] Use a simple string concatenation + `djb2`/`fnv1a` hash, or rely on the browser's `crypto.subtle.digest`? The latter is async and may add unnecessary complexity for a non-cryptographic cache key.

## Next Steps

→ `/ce:plan` for structured implementation planning
