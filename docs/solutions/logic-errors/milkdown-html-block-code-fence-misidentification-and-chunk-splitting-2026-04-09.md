---
title: Milkdown HTML Block Fence Misidentification and Chunked Loading Split Bug
date: 2026-04-09
category: logic-errors
module: MarkBun Editor
problem_type: logic_error
component: frontend_stimulus
symptoms:
  - Fenced ```html code blocks were preview-rendered as raw DOM and serialized back as raw HTML instead of fenced code blocks
  - Large ```html code blocks in markdown files >500 lines were broken into pieces by chunked loading, with the first chunk missing its closing fence
  - Full HTML documents were incorrectly passed through the HTML block preview pipeline, producing blank/invalid output
root_cause: logic_error
resolution_type: code_fix
severity: high
tags:
  - milkdown
  - crepe
  - html-block
  - fenced-code-block
  - chunked-loading
  - split-at-code-block-boundaries
---

# Milkdown HTML Block Fence Misidentification and Chunked Loading Split Bug

## Problem

MarkBun v0.7.0 introduced HTML block rendering for its Milkdown/Crepe editor. The implementation converted raw HTML blocks (e.g. `<div>...</div>`) into code blocks with `lang="html"` so Milkdown would render them via the code-block preview pipeline. This caused all fenced ` ```html ` code blocks to also be treated as raw HTML blocks—they were preview-rendered as actual DOM and serialized back as raw HTML instead of fenced code blocks on save.

Additionally, for markdown files larger than 500 lines, MarkBun uses chunked loading. The `splitAtCodeBlockBoundaries` function could accidentally split through closed fenced code blocks when there was no blank line after the closing `` ``` `` marker. This caused large ` ```html ` code blocks to be broken into pieces, with the first chunk missing its closing fence and being mis-parsed.

## Symptoms

- All fenced ` ```html ` code blocks were preview-rendered as actual DOM instead of being preserved as fenced code blocks.
- On save, fenced ` ```html ` blocks were serialized back as raw HTML instead of fenced code blocks.
- For markdown files larger than 500 lines, large ` ```html ` code blocks were split into pieces.
- The first chunk of a split code block lost its closing fence, causing mis-parsing.
- Full HTML documents (`<!DOCTYPE`, `<html`, `<head`) rendered as blank/unusable previews due to `DOMParser` stripping `<head>` and DOMPurify/global CSS conflicts.

## What Didn't Work

- **Relying on `lang="html"` for raw HTML blocks.** Milkdown could not distinguish raw HTML blocks from user-written fenced HTML code blocks, causing all ` ```html ` blocks to be treated as raw HTML and re-serialized incorrectly.
- **Splitting large files at blank lines near code block boundaries.** When there was no blank line after a closing fence, the split index backtracked into an already-closed fenced code block, breaking the fence in half.

## Solution

### 1. Introduce internal language `html-block` for raw HTML blocks

`src/mainview/components/editor/plugins/remarkHtmlBlock.ts`:

```typescript
const newNode = {
  type: 'code',
  lang: 'html-block',
  value: node.value,
};
```

`src/mainview/components/editor/plugins/blockHtmlSchema.ts`:

```typescript
if (language.toLowerCase() === 'html-block') {
  state.addNode(
    'html',
    undefined,
    node.content.firstChild?.text || ''
  );
} else {
  return baseSchema.toMarkdown.runner(state, node);
}
```

### 2. Guard chunked loading against splitting through closed fences

`src/mainview/components/editor/hooks/useCrepeEditor.ts` — added `getFenceRanges`:

```typescript
function getFenceRanges(lines: string[]): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let inFence = false;
  let fenceChar = '';
  let fenceLen = 0;
  let start = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inFence) {
      const m = line.match(/^(\`{3,}|~{3,})/);
      if (m) {
        inFence = true;
        fenceChar = m[1][0];
        fenceLen = m[1].length;
        start = i;
      }
    } else {
      const m = line.match(/^(\`+|~+)\s*$/);
      if (m && m[1][0] === fenceChar && m[1].length >= fenceLen) {
        ranges.push([start, i]);
        inFence = false;
      }
    }
  }

  return ranges;
}
```

Guard inside `splitAtCodeBlockBoundaries`:

```typescript
// Guard: do not split inside a closed fence range. If the split point
// falls between the open and close markers, move it to after the close
// marker so the fence stays intact in the current chunk.
const ranges = getFenceRanges(current);
for (const [start, end] of ranges) {
  if (splitIndex > start && splitIndex <= end) {
    splitIndex = end + 1;
    break;
  }
}
```

### 3. Skip preview for full HTML documents

```typescript
if (lang === 'html-block' && trimmed) {
  const isFullDocument = /<(html|!doctype|head)\b/i.test(trimmed);
  if (isFullDocument) return null;
  // ... DOMParser preview logic
}
```

## Why This Works

1. **`html-block` language tag:** Using an internal-only language tag `html-block` preserves the distinction between raw HTML blocks (which should render as DOM and serialize back to raw HTML) and user-written fenced ` ```html ` code blocks (which should remain as fenced code blocks). The AST, preview pipeline, CSS selectors, and click handlers all operate on `html-block` without conflating it with normal `html` code blocks.

2. **Fence-range guard:** `getFenceRanges` pre-computes all closed fenced code block ranges within the current chunk. Before finalizing the split index, the splitter verifies it does not land inside any closed fence range. If it does, it advances past the closing fence, preventing broken chunks and mis-parsing.

3. **Full-HTML skip:** `DOMParser` strips `<head>` elements when parsing full HTML documents, and DOMPurify/global CSS conflicts make previews useless or blank. Skipping the preview for documents that contain `<!DOCTYPE`, `<html`, or `<head>` avoids confusing users with broken output.

## Prevention

- Use distinct internal identifiers (e.g., `html-block`, `math-block`) for any syntax-transformed blocks that should not be conflated with user-written fenced code blocks.
- When writing text-splitting logic that backtracks, explicitly guard against inserting splits inside syntactic boundaries by pre-computing protected ranges.
- Add unit tests for split logic with edge cases: no blank line after closing fence, nested fences, and fence markers inside code.
- Review code-block preview pipelines for ambiguity between transformed blocks and native fenced blocks before releasing AST-level language changes.

## Related Issues

- `docs/solutions/integration-issues/milkdown-html-block-rendering-with-dompurify-2026-04-07.md` — the original HTML block rendering implementation.
