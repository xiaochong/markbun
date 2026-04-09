---
title: Mermaid 11.x Flowcharts Render Blank Nodes in WebKit
last_updated: 2026-04-10
date: 2026-04-08
category: ui-bugs
module: MarkBun Editor
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - Mermaid flowchart nodes render as blank boxes with no text inside
  - Sequence diagrams show "Mermaid syntax error" in preview or viewer
  - Hover button opens viewer with missing flowchart elements (subgraphs, styled nodes)
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
  - prosemirror
  - codemirror
---

# Mermaid 11.x Flowcharts Render Blank Nodes in WebKit

## Problem

Mermaid 11.x flowcharts rendered with completely empty node labels (blank boxes, no text) inside the MarkBun application. MarkBun uses Electrobun (Bun + WebKit WebView), and the issue affected both the inline Milkdown/Crepe editor preview and the standalone "View Diagram" modal viewer. The root cause was Mermaid 11.x's default `htmlLabels: true`, which generates SVG `<foreignObject>` elements containing HTML `<div>` labels. WebKit in Electrobun fails to render these HTML labels at all, resulting in blank nodes.

After the initial fix (disabling `htmlLabels` globally), two follow-up issues appeared: sequence diagrams began showing syntax errors due to a `<br/>` → `\n` source replacement that broke indentation parsing, and the hover button opened an incomplete viewer because it reused the `htmlLabels: false` preview SVG instead of re-rendering from source with Mermaid defaults.

## Symptoms

- Flowchart nodes appeared as empty rectangles with no text.
- The issue occurred in two places:
  1. Inline diagram preview inside the Milkdown/Crepe editor.
  2. The standalone Mermaid diagram viewer modal.
- After disabling `htmlLabels`, sequence diagrams reported syntax errors instead of rendering.
- Complex flowcharts opened via the hover button lost elements (subgraphs, styled nodes) compared to the right-click context-menu viewer.
- No console errors were emitted by Mermaid for the blank-node issue; the SVG simply contained empty `<foreignObject>` content in the WebView.

## What Didn't Work

1. **Downgrading Milkdown**
   Initially suspected the Milkdown 7.20.0 upgrade. Downgrading to an earlier version did not resolve the blank nodes.

2. **DOMPurify hook in `src/mainview/main.tsx`**
   Attempted to configure DOMPurify globally to allow `<foreignObject>` tags. This failed because Milkdown's own `preview-panel.tsx` bundles a separate `DOMPurify.sanitize()` call with `FORBID_CONTENTS` that explicitly strips children of `<foreignObject>`, overriding any global configuration.

3. **MutationObserver hack (`restoreMermaidPreviews`)**
   Tried patching the preview DOM after render by observing mutations and re-injecting label content. This failed because the HTML labels were already emptied by sanitization *before* the SVG was mounted into the DOM, so there was no content to restore.

4. **`<br/>` → `\n` replacement in preview/viewer**
   An earlier attempt normalized line breaks before `mermaid.render()` by replacing `<br/>` tags with `\n`. This broke indentation-sensitive `sequenceDiagram` syntax (e.g., indented `participant` or `note` lines), causing parse errors.

5. **Reusing `previewSvg.outerHTML` for the hover button viewer**
   Passing the already-rendered preview SVG to the viewer seemed efficient, but the preview was rendered with `htmlLabels: false` and produced a flattened SVG that lost complex flowchart elements.

6. **`flowchart: { htmlLabels: false }` in global `mermaid.initialize()`**
   Adding a nested `flowchart` config object to the preview initialization leaked into Mermaid's global singleton state and caused unexpected parse errors in the viewer.

7. **Fallback to `.cm-line` DOM extraction for hover button source**
   Querying `.cm-line` elements inside the code block failed because CodeMirror 6 virtual-scrolls inside a `height: 0` preview container, so only on-screen lines were present in the DOM.

## Solution

The final fix has three parts: (1) keep `htmlLabels: false` **only** for the inline preview to avoid WebKit blank nodes, (2) let the standalone viewer use Mermaid defaults (`htmlLabels: true`) and always re-render from complete original source, and (3) remove all source mutations and global config leaks.

### 1. Inline preview config (`useCrepeEditor.ts`)

```typescript
mermaid.initialize({
  startOnLoad: false,
  theme: darkModeRef.current ? 'dark' : 'default',
  suppressErrorRendering: true,
  htmlLabels: false,
});
mermaid.render(id, code)  // pass original code, no <br/> replacement
```

### 2. Standalone viewer config (`MermaidDiagramViewer.tsx`)

```typescript
mermaid.initialize({
  startOnLoad: false,
  theme: isDark ? 'dark' : 'default',
  suppressErrorRendering: true,
  // Use Mermaid defaults (htmlLabels: true) for maximum compatibility
});
const { svg } = await mermaid.render(id, mermaidSource);
```

### 3. Hover button extracts source from ProseMirror AST (`useCrepeEditor.ts`)

```typescript
let source: string | null = null;
const view = crepeRef.current?.editor?.ctx?.get(editorViewCtx);

if (view) {
  view.state.doc.descendants((node, pos) => {
    if (node.type.name === 'code_block' || node.type.name === 'fence') {
      try {
        const dom = view.nodeDOM(pos);
        if (dom && (block === dom || block.contains(dom as Node) || (dom as Element).contains(block))) {
          source = node.textContent;
          return false;
        }
      } catch {
        // nodeDOM may fail, continue
      }
    }
  });
}

// Fallback to CodeMirror lines (may be truncated when container height is 0)
if (!source) {
  const lines = Array.from(block.querySelectorAll('.cm-line')).map((el) => el.textContent || '');
  source = lines.join('\n');
}

if (source && typeof (window as any).__openMermaidViewer === 'function') {
  (window as any).__openMermaidViewer(source);
}
```

Also removed the stale, ineffective DOMPurify hook from `src/mainview/main.tsx`.

## Why This Works

- **`htmlLabels: false` forces Mermaid to render text as native SVG `<text>` elements** instead of HTML `<div>` inside `<foreignObject>`. WebKit in Electrobun renders SVG `<text>` correctly, while it silently fails on the HTML-in-SVG foreignObject approach used by Mermaid 11.x flowcharts.
- **Passing original `code` (no `<br/>` replacement)** preserves whitespace-sensitive Mermaid syntax such as indented sequence diagram lines. The `<br/>` tags were a false problem; Mermaid's SVG text mode handles them correctly.
- **Extracting source from the ProseMirror AST** bypasses CodeMirror 6 virtual scrolling. The AST always contains the complete document, so the hover button receives the full, unmodified Mermaid source even when the DOM only shows a subset of lines.
- **Re-rendering the viewer from source with `htmlLabels: true`** produces full-fidelity diagrams (including complex flowchart subgraphs) because the standalone viewer is not constrained by WebKit inline-preview issues. The preview and viewer are treated as distinct render contexts.
- **Removing `flowchart: { htmlLabels: false }`** eliminates global singleton pollution. Mermaid 11.x's `initialize()` mutates shared state; nested config objects can leak across renders and cause parse errors for unrelated diagram types.

## Prevention

- **Separate preview and viewer render contexts.** The inline preview and standalone viewer should not share the same DOM output or config. Always render the viewer from original source rather than reusing preview DOM.
- **Avoid mutating Mermaid source before `render()`.** Do not perform string substitutions (e.g., `<br/>` → `\n`) unless the syntax genuinely requires it. Mermaid parsers are whitespace-sensitive.
- **Prefer editor document models over DOM queries for source extraction.** CodeMirror 6 (and similar virtualized editors) intentionally omit off-screen nodes from the DOM. Use `view.state.doc` or equivalent AST APIs when retrieving code-block content.
- **Avoid non-universal keys in global `mermaid.initialize()`.** Nested objects like `flowchart: { ... }` can pollute Mermaid's singleton. Keep global init minimal and render-specific configs close to the `render()` call if the API supports it.
- **Test SVG viewer sizing explicitly after any change to Mermaid rendering or wrapper CSS.** The `0×0` collapse was a secondary bug triggered only by the combination of `htmlLabels: false` and the existing flex layout in the viewer modal.

## Related Issues

- `docs/solutions/integration-issues/milkdown-html-block-rendering-with-dompurify-2026-04-07.md` — sibling integration issue in the same Milkdown preview subsystem, but with different symptoms (DOMPurify stripping image `src`) and a different fix (`data-src` mirroring + `MutationObserver`).
- `docs/solutions/best-practices/milkdown-frontmatter-display-workaround-2026-04-04.md` — another code-block conversion pattern used in `useCrepeEditor.ts`.
