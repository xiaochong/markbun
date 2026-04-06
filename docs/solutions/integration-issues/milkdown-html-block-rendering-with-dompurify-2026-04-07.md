---
title: Milkdown HTML Block Rendering and DOMPurify Preview Pitfalls
date: 2026-04-07
category: integration-issues
module: MarkBun Editor
problem_type: integration_issue
component: frontend_stimulus
symptoms:
  - Raw HTML blocks in markdown were not rendering and were wrapped in paragraphs by Milkdown
  - DOMPurify inside Milkdown stripped local image src attributes, causing images to disappear in HTML previews
  - Returning undefined from renderPreview caused a persistent "Loading..." placeholder below the rendered HTML
root_cause: wrong_api
resolution_type: code_fix
severity: medium
tags:
  - milkdown
  - crepe
  - html-block
  - markdown-editor
  - dompurify
  - remark-plugin
---

# Milkdown HTML Block Rendering and DOMPurify Preview Pitfalls

## Problem

MarkBun needed Typora-like raw HTML block rendering in its Milkdown/Crepe editor. By default, Milkdown wraps block-level `html` nodes in paragraphs and displays them as plain text, breaking the WYSIWYG experience. Implementing a workaround using Milkdown's code-block preview pipeline revealed two subtle集成 pitfalls: Milkdown's internal DOMPurify strips non-HTTP image URLs from the preview DOM, and incorrect return values from `renderPreview` trigger a persistent "Loading..." placeholder.

## Symptoms

- `<div align="center"><img src="..." /></div>` appeared as raw text instead of rendered HTML.
- Images inside HTML previews had their `src` attribute removed after the preview DOM was mounted.
- A gray "Loading..." block rendered permanently below some HTML previews.
- Inline HTML tags (e.g., `<a>` inside paragraphs) were occasionally hoisted into code blocks, corrupting the document AST and causing content from later sections to appear inside the HTML block.

## What Didn't Work

- **Configuring DOMPurify externally:** Milkdown's `preview-panel.tsx` bundles its own `DOMPurify.sanitize()` call, so external configuration of `ALLOWED_URI_REGEXP` had no effect on the preview DOM.
- **Returning `null` from `renderPreview`:** Milkdown treats `null` as "no preview" and immediately hides the preview panel.
- **Returning `undefined` from `renderPreview` with async `applyPreview`:** Milkdown shows a "Loading..." placeholder when `undefined` is returned. If `applyPreview` was called synchronously afterward, the placeholder sometimes persisted.
- **Transforming ALL `html` remark nodes to code blocks:** An early version of the remark plugin converted every `html` node (including inline `<a>` tags inside paragraphs) into a code block, breaking paragraph AST structure and causing downstream content to render inside the HTML block.

## Solution

The fix follows the same bidirectional code-block pattern already used for LaTeX and Mermaid in MarkBun.

### 1. Remark plugin: transform block-level `html` to `code(lang="html")`

`src/mainview/components/editor/plugins/remarkHtmlBlock.ts`:

```typescript
import { visit } from 'unist-util-visit';
import type { Node } from 'unist';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';

const BLOCK_CONTAINER_TYPES = new Set(['root', 'blockquote', 'listItem']);

const remarkHtmlBlock: Plugin<[], Root> = function () {
  return (tree) => {
    visit(tree, 'html', (node: Node & { value: string }, index: number | null, parent: Node & { children: Node[]; type: string } | null) => {
      if (index === null || !parent) return;
      if (!BLOCK_CONTAINER_TYPES.has(parent.type)) return;

      const newNode = {
        type: 'code',
        lang: 'html',
        value: node.value,
      };

      parent.children.splice(index, 1, newNode as Node);
    });
  };
};

export default remarkHtmlBlock;
```

> **Critical:** The `BLOCK_CONTAINER_TYPES` guard prevents inline HTML (e.g., `<a>` inside a paragraph) from being hoisted into a code block.

### 2. Schema extension: serialize back to raw HTML on save

`src/mainview/components/editor/plugins/blockHtmlSchema.ts`:

```typescript
import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';

export const blockHtmlSchema = codeBlockSchema.extendSchema((prev) => {
  return (ctx) => {
    const baseSchema = prev(ctx);
    return {
      ...baseSchema,
      toMarkdown: {
        match: baseSchema.toMarkdown.match,
        runner: (state, node) => {
          const language = node.attrs.language ?? '';
          if (language.toLowerCase() === 'html') {
            state.addNode(
              'html',
              undefined,
              node.content.firstChild?.text || ''
            );
          } else {
            return baseSchema.toMarkdown.runner(state, node);
          }
        },
      },
    };
  };
});
```

### 3. Synchronous `renderPreview` with `data-src` mirroring

`src/mainview/components/editor/hooks/useCrepeEditor.ts` (excerpt):

```typescript
if (lang === 'html' && content.trim()) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content.trim(), 'text/html');

  // Preserve width/height against Milkdown CSS resets
  doc.querySelectorAll('img').forEach((img) => {
    const widthAttr = img.getAttribute('width');
    const heightAttr = img.getAttribute('height');
    if (widthAttr && !img.style.width) {
      img.style.width = /\D/.test(widthAttr) ? widthAttr : `${widthAttr}px`;
    }
    if (heightAttr && !img.style.height) {
      img.style.height = /\D/.test(heightAttr) ? heightAttr : `${heightAttr}px`;
    }
  });

  // Mirror src to data-src so Milkdown's internal DOMPurify can't strip it permanently
  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src) {
      img.setAttribute('data-src', src);
    }
  });

  // MUST return synchronously to avoid Milkdown's "Loading..." placeholder
  return doc.body.innerHTML;
}
```

### 4. MutationObserver to recover `src` and load local images as blob URLs

`src/mainview/components/editor/hooks/useCrepeEditor.ts` (excerpt):

```typescript
const restoreHtmlPreviewImages = () => {
  const htmlBlocks = container.querySelectorAll('.milkdown-code-block[data-lang="html"]');
  htmlBlocks.forEach((block) => {
    const imgs = block.querySelectorAll('.preview img[data-src]');
    imgs.forEach((img) => {
      if (img.hasAttribute('data-resolved')) return;

      const dataSrc = img.getAttribute('data-src');
      if (!dataSrc) return;

      // Recover src if DOMPurify stripped it
      if (!img.getAttribute('src')) {
        img.setAttribute('src', dataSrc);
      }

      // Resolve local file paths to blob URLs (WebView cannot access file://)
      if (!/^(https?:|data:|blob:)/i.test(dataSrc)) {
        const resolvedPath = workspaceManager.resolvePath(dataSrc);
        loadLocalImage(resolvedPath, dataSrc)
          .then((blobUrl) => {
            if (blobUrl) {
              img.setAttribute('src', blobUrl);
              img.setAttribute('data-src', blobUrl);
            }
          })
          .catch((e) => {
            console.error('[HTML Preview] Failed to load local image:', dataSrc, e);
          });
      }

      img.setAttribute('data-resolved', 'true');
    });
  });
};

const observer = new MutationObserver(() => {
  updateLatexCodeBlocks();
  restoreHtmlPreviewImages();
});
observer.observe(container, {
  childList: true,
  subtree: true,
  characterData: true,
});
```

### 5. CSS for edit/preview toggle

`src/mainview/index.css` adds `data-lang="html"` selectors that mirror the existing LaTeX/Mermaid rules, using `.selected` to toggle between CodeMirror editor (visible) and rendered preview.

## Why This Works

1. **Intercepting before `remarkHtmlTransformer`:** Milkdown's built-in transformer wraps block-level `html` nodes in paragraphs. By converting them to code blocks first, we inherit Milkdown's first-class code-block UI (CodeMirror editing, preview panels, fenced-block styling).
2. **Bypassing an internal DOMPurify we don't control:** Milkdown's `preview-panel.tsx` sanitizes with its own bundled DOMPurify, making external configuration impossible. Mirroring `src` to `data-src` before sanitization and restoring it afterward via `MutationObserver` is the only reliable workaround without forking Milkdown internals.
3. **Avoiding the "Loading..." trap:** Milkdown shows a permanent loading block when `renderPreview` returns `undefined`. Moving all async work (local image blob resolution) into the `MutationObserver` keeps the preview render path synchronous and clean.
4. **Protecting inline HTML:** Restricting the remark transform to block containers preserves inline tags like `<a>` or `<sup>` inside paragraphs, preventing AST corruption.

## Prevention

- When integrating with Milkdown/Crepe code-block previews, always inspect `node_modules/@milkdown/components/src/code-block/view/components/preview-panel.tsx` to verify whether Milkdown runs its own DOMPurify pass.
- If `renderPreview` must be async, return the HTML string synchronously and defer async side effects (image loading, blob URL generation) to a `MutationObserver` or `useEffect` after the DOM mounts.
- Use `MutationObserver` attribute guards (e.g., `data-resolved`) to prevent duplicate async work on every subtree mutation.
- Add a parent-type guard in any remark plugin that converts AST nodes, so inline variants are not accidentally hoisted into block-level substitutes.

## Related Issues

- `docs/solutions/best-practices/milkdown-frontmatter-display-workaround-2026-04-04.md` — employs the same bidirectional code-block transformation pattern in `useCrepeEditor.ts` to display YAML frontmatter as a `yaml` code block.
