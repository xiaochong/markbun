---
title: Milkdown Frontmatter Display Workaround
date: 2026-04-04
category: best-practices
module: Markbun Markdown Editor
problem_type: workflow_issue
component: frontend_stimulus
severity: low
applies_when:
  - Using Milkdown/Crepe editor with YAML frontmatter
  - Standard remark-frontmatter plugin causes parsing errors
  - Need Typora-like frontmatter display without breaking serialization
tags:
  - milkdown
  - crepe
  - markdown
  - frontmatter
  - yaml
  - typora
---

# Milkdown Frontmatter Display Workaround

## Context

Markbun uses Milkdown (Crepe) as its Markdown editor. When users open Markdown files with YAML frontmatter (the `---` delimited metadata block at the start), the frontmatter was displayed as plain text rather than a styled gray code block like Typora does.

Initial attempt to use `@milkdown/plugin-frontmatter` failed with serialization errors (`Cannot read properties of undefined (reading 'tr')`), indicating Milkdown 7.x doesn't have native support for frontmatter AST nodes.

## Guidance

Use a **bidirectional format conversion pattern** that transforms frontmatter to/from YAML code blocks:

1. **Display Conversion**: Convert `---\nfrontmatter\n---` to `` ```yaml\nfrontmatter\n``` `` before parsing
2. **Storage Conversion**: Convert the YAML code block back to frontmatter format when saving
3. **CSS Styling**: Style the first `pre[data-language="yaml"]` element for Typora-like appearance

## Why This Matters

- **Plugin Compatibility**: Native frontmatter plugins conflict with Milkdown's serialization pipeline
- **User Experience**: Users expect frontmatter to be visually distinct (gray background, monospace font)
- **Data Integrity**: Files must retain standard `---` delimited frontmatter for tool compatibility
- **Zero Dependencies**: Uses built-in regex transformation, no additional npm packages

## When to Apply

Use this pattern when:
- Building Markdown editors needing visual frontmatter distinction
- Working with Milkdown/ProseMirror-based editors with limited frontmatter support
- Typora-like rendering is needed without breaking the content pipeline
- Plugin solutions cause serialization conflicts

## Examples

### Conversion Functions

```typescript
// Display: convert --- to ```yaml
function convertFrontmatterToCodeBlock(markdown: string): string {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;
  const match = markdown.match(frontmatterRegex);

  if (match) {
    const frontmatter = match[1];
    const content = markdown.slice(match[0].length);
    return "```yaml\n" + frontmatter + "\n```\n" + content;
  }
  return markdown;
}

// Save: convert ```yaml back to ---
function convertCodeBlockToFrontmatter(markdown: string): string {
  const codeBlockRegex = /^```yaml\s*\n([\s\S]*?)\n```\s*(?:\n|$)/;
  const match = markdown.match(codeBlockRegex);

  if (match) {
    const frontmatter = match[1];
    const content = markdown.slice(match[0].length);
    const normalizedFrontmatter = frontmatter.endsWith('\n')
      ? frontmatter
      : frontmatter + '\n';
    return "---\n" + normalizedFrontmatter + "---\n\n" + content;
  }
  return markdown;
}
```

### Integration Points

```typescript
// useCrepeEditor.ts

// 1. Initial display conversion
const initialValueRef = useRef(convertFrontmatterToCodeBlock(defaultValue));

// 2. setMarkdown - convert before parsing
const setMarkdown = useCallback((markdown: string, options?) => {
  const convertedMarkdown = convertFrontmatterToCodeBlock(markdown);
  // ... parse convertedMarkdown
}, []);

// 3. getMarkdown - convert before returning
const getMarkdown = useCallback(() => {
  const content = crepeRef.current?.getMarkdown() ?? '';
  return convertCodeBlockToFrontmatter(content);
}, []);

// 4. onChange - convert before notifying
const changeListenerPlugin = $prose((ctx) => {
  return new Plugin({
    view: () => ({
      update: (view, prevState) => {
        if (!view.state.doc.eq(prevState.doc)) {
          const serializer = ctx.get(serializerCtx);
          const markdown = serializer(view.state.doc);
          // Convert before notifying parent
          onChangeRef.current?.(convertCodeBlockToFrontmatter(markdown));
        }
      },
    }),
  });
});
```

### CSS Styling

```css
/* Typora-like gray background for frontmatter */
.milkdown-crepe-container .ProseMirror pre[data-language="yaml"]:first-child {
  background: #f5f5f5 !important;
  border-radius: 4px;
  padding: 12px 16px;
  margin: 0 0 16px 0;
  font-family: 'SF Mono', SFMono-Regular, ui-monospace, Menlo, Monaco, 'Courier New', monospace !important;
  font-size: 0.85em;
  line-height: 1.5;
  color: #666;
  border: none;
}

.dark .milkdown-crepe-container .ProseMirror pre[data-language="yaml"]:first-child {
  background: #2d2d2d !important;
  color: #999;
}
```

## Key Implementation Details

1. **Regex anchors matter**: Both patterns use `^` to match only at document start, preventing normal YAML code blocks from being converted
2. **Normalization**: The save conversion ensures frontmatter ends with newline before `---` for proper formatting
3. **Four integration points**: All content entry/exit points must apply the appropriate conversion

## Related

- [Editor Content Lost on File Switch](/docs/solutions/logic-errors/editor-content-lost-on-file-switch-2026-04-04.md) - Uses same change listener pattern
- Architecture docs: Milkdown integration section in `/docs/architecture.md`
