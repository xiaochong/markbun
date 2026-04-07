---
title: Mermaid 11.x Flowcharts Render Blank Nodes in WebKit
date: 2026-04-08
category: ui-bugs
module: MarkBun Editor
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - Mermaid flowchart nodes render as blank boxes with no text inside
  - Standalone Mermaid viewer SVG collapses to 0×0 after htmlLabels fix
root_cause: config_error
resolution_type: code_fix
severity: medium
tags:
  - mermaid
  - webkit
  - htmlLabels
  - svg
  - electrobun
  - milkdown
  - crepe
---

# Mermaid 11.x Flowcharts Render Blank Nodes in WebKit

## Problem

Mermaid 11.x flowcharts rendered with completely empty node labels (blank boxes, no text) inside the MarkBun application. MarkBun uses Electrobun (Bun + WebKit WebView), and the issue affected both the inline Milkdown/Crepe editor preview and the standalone "View Diagram" modal viewer. The root cause was Mermaid 11.x's default `htmlLabels: true`, which generates SVG `<foreignObject>` elements containing HTML `<div>` labels. WebKit in Electrobun fails to render these HTML labels at all, resulting in blank nodes.

## Symptoms

- Flowchart nodes appeared as empty rectangles with no text.
- The issue occurred in two places:
  1. Inline diagram preview inside the Milkdown/Crepe editor.
  2. The standalone Mermaid diagram viewer modal.
- Other diagram types (e.g., sequence diagrams) were not necessarily affected, but flowcharts were consistently broken.
- No console errors were emitted by Mermaid; the SVG simply contained empty `<foreignObject>` content in the WebView.

## What Didn't Work

1. **Downgrading Milkdown**
   Initially suspected the Milkdown 7.20.0 upgrade. Downgrading to an earlier version did not resolve the blank nodes.

2. **DOMPurify hook in `src/mainview/main.tsx`**
   Attempted to configure DOMPurify globally to allow `<foreignObject>` tags. This failed because Milkdown's own `preview-panel.tsx` bundles a separate `DOMPurify.sanitize()` call with `FORBID_CONTENTS` that explicitly strips children of `<foreignObject>`, overriding any global configuration.

3. **MutationObserver hack (`restoreMermaidPreviews`)**
   Tried patching the preview DOM after render by observing mutations and re-injecting label content. This failed because the HTML labels were already emptied by sanitization *before* the SVG was mounted into the DOM, so there was no content to restore.

4. **`htmlLabels: false` alone in the standalone viewer (with `width="100%"` removed)**
   Disabling HTML labels fixed the label content, but in the standalone `MermaidDiagramViewer.tsx` the SVG collapsed to `0×0` because removing `width="100%"` left the SVG without an explicit size in a flex container. The wrapping `div` then had no layout size in WebKit.

## Solution

The fix had two parts: disable HTML labels globally for all Mermaid initialization paths, and explicitly set `width`/`height` attributes on the generated SVG for the standalone viewer.

### 1. Disable `htmlLabels` in all `mermaid.initialize()` calls

`src/mainview/components/editor/hooks/useCrepeEditor.ts`:
```typescript
mermaid.initialize({
  startOnLoad: false,
  theme: darkModeRef.current ? 'dark' : 'default',
  suppressErrorRendering: true,
  htmlLabels: false,
});
```

`src/mainview/hooks/useExport.ts` (both `mermaid.initialize` calls):
```typescript
mermaid.initialize({
  startOnLoad: false,
  theme: isDark ? 'dark' : 'default',
  suppressErrorRendering: true,
  htmlLabels: false,
});
```

`src/mainview/components/mermaid-viewer/MermaidDiagramViewer.tsx`:
```typescript
mermaid.initialize({
  startOnLoad: false,
  theme: isDark ? 'dark' : 'default',
  suppressErrorRendering: true,
  htmlLabels: false,
});
const { svg } = await mermaid.render(id, mermaidSource);
```

### 2. Inject explicit `width` and `height` into the standalone viewer SVG

In `src/mainview/components/mermaid-viewer/MermaidDiagramViewer.tsx`, after `mermaid.render()`:

```typescript
const { svg } = await mermaid.render(id, mermaidSource);

const viewBoxMatch = svg.match(/viewBox="([\d.\s]+)"/);
const maxWidthMatch = svg.match(/style="max-width:\s*([\d.]+)px;"/);
let fixedSvg = svg;
if (viewBoxMatch && maxWidthMatch) {
  const vbParts = viewBoxMatch[1].split(/[\s,]+/);
  const vw = parseFloat(vbParts[2]);
  const vh = parseFloat(vbParts[3]);
  const maxW = parseFloat(maxWidthMatch[1]);
  if (vw > 0 && vh > 0 && maxW > 0) {
    const h = (maxW / vw) * vh;
    fixedSvg = svg.replace(
      /style="max-width:\s*([\d.]+)px;"/,
      `width="${maxW}" height="${h}" style="max-width: ${maxW}px;"`
    );
  }
}
setSvgContent(fixedSvg);
```

Also removed the stale, ineffective DOMPurify hook from `src/mainview/main.tsx`.

## Why This Works

- **`htmlLabels: false` forces Mermaid to render text as native SVG `<text>` elements** instead of HTML `<div>` inside `<foreignObject>`. WebKit in Electrobun renders SVG `<text>` correctly, while it silently fails on the HTML-in-SVG foreignObject approach used by Mermaid 11.x flowcharts.
- **Explicit `width` and `height` attributes prevent the SVG from collapsing to zero size** in a flex container when `width="100%"` is no longer present. The `max-width` style is preserved for responsiveness, but WebKit now has concrete intrinsic dimensions to lay out the wrapper `div`.
- **Removing the DOMPurify hook cleans up dead code** that never had any effect because Milkdown's bundled sanitizer ran independently.

## Prevention

- **Avoid relying on HTML-in-SVG (`<foreignObject>`) in WebKit-based contexts.** If the stack includes a WebView (especially on macOS/iOS where WebKit is mandatory), prefer plain SVG rendering for Mermaid diagrams.
- **Centralize Mermaid config.** Instead of scattering `mermaid.initialize()` calls across hooks and components, consider a single shared initialization helper (e.g., `initMermaid(isDark)`) so defaults like `htmlLabels: false` are applied consistently and future upgrades do not accidentally revert the fix.
- **Test SVG viewer sizing explicitly after any change to Mermaid rendering or wrapper CSS.** The `0×0` collapse was a secondary bug triggered only by the combination of `htmlLabels: false` and the existing flex layout in the viewer modal.

## Related Issues

- `docs/solutions/integration-issues/milkdown-html-block-rendering-with-dompurify-2026-04-07.md` — sibling integration issue in the same Milkdown preview subsystem, but with different symptoms (DOMPurify stripping image `src`) and a different fix (`data-src` mirroring + `MutationObserver`).
- `docs/solutions/best-practices/milkdown-frontmatter-display-workaround-2026-04-04.md` — another code-block conversion pattern used in `useCrepeEditor.ts`.
