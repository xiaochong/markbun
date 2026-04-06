---
title: AI Tools Image Path Blob URL Mismatch
date: 2026-04-06
category: docs/solutions/integration-issues
module: ai-tools
problem_type: integration_issue
component: tooling
severity: medium
symptoms:
  - AI read tool returns blob URLs (blob:http://localhost:5173/...) instead of original file paths, making image references opaque to the AI model
  - AI edit tool reports "Text not found" when old_text contains image paths, because editor has blob URLs but AI sends original paths
  - AI write tool sets content with local image paths that don't render because blob URL conversion is never applied
root_cause: wrong_api
resolution_type: code_fix
related_components:
  - src/mainview/lib/ai-tools.ts
  - src/mainview/lib/electrobun.ts
  - src/mainview/lib/image/processor.ts
tags:
  - ai-tools
  - blob-url
  - image-paths
  - editor-integration
  - rpc
  - processMarkdownImages
---

# AI Tools Image Path Blob URL Mismatch

## Problem

The AI chat tools (`read`/`edit`/`write`) operated on the Milkdown editor's raw markdown without accounting for the image path conversion layer. The editor internally converts local file paths to blob URLs for display, but the AI tools bypassed this conversion — exposing blob URLs to the AI and failing to convert original paths back when setting content.

## Symptoms

- `read()` returns markdown with `blob:http://localhost:5173/<uuid>` URLs — AI cannot reason about these opaque references
- `edit()` consistently reports "Text not found" even when text is visibly present — AI sends original paths as `old_text` but editor content has blob URLs
- `write()` inserts markdown with local image paths that never render in the editor
- After `edit`/`write` became async, `executeAITool` RPC handler returned unresolved Promises instead of actual results

## What Didn't Work

- **Fixing only `read()` without `edit`/`write`**: The round-trip requires symmetric conversions at both boundaries. Fixing read alone exposed the edit match failure.
- **Handling conversion at the streaming service level** (`ai-stream.ts`): The conversion is editor-specific and must happen at the tool boundary, not the transport layer.
- **Keeping tools synchronous**: `processMarkdownImages()` is inherently async (reads files from disk to create blob URLs). Synchronous tools can't call it.

## Solution

### read(): Restore original paths on output

```typescript
read: () => {
  const markdown = editor.getMarkdown();
  return { content: restoreOriginalImagePaths(markdown) };
},
```

### edit(): Restore paths before matching, process after replacing

```typescript
edit: async (args) => {
  // Restore original paths so old_text from read() can match
  const content = restoreOriginalImagePaths(editor.getMarkdown());
  if (!content.includes(args.old_text)) {
    return { error: `Text not found: "${args.old_text.substring(0, 80)}"` };
  }
  const newContent = content.split(args.old_text).join(args.new_text);
  // Convert back to blob URLs for editor display
  const contentToLoad = hasLocalImages(newContent)
    ? await processMarkdownImages(newContent)
    : newContent;
  editor.setMarkdown(contentToLoad);
  return { success: true, replacements };
},
```

### write(): Process images before setting content

```typescript
write: async (args) => {
  const contentToLoad = hasLocalImages(args.content)
    ? await processMarkdownImages(args.content)
    : args.content;
  editor.setMarkdown(contentToLoad);
  return { success: true };
},
```

### RPC handler: Support async tools

```typescript
// src/mainview/lib/electrobun.ts
executeAITool: async ({ tool, args }) => {
  const result = await aiTools[tool](parsedArgs);
  return { success: true, result: typeof result === 'string' ? result : JSON.stringify(result) };
},
```

## Why This Works

The editor uses two representations of image paths:
- **Internal**: blob URLs (e.g., `blob:http://localhost:5173/<uuid>`) — for rendering in ProseMirror
- **External**: original file paths (e.g., `![](image.png)`) — for file storage and AI consumption

The `imageCache` maintains a bidirectional map (`resolvedPath → blobUrl` and `blobUrl → originalPath`). The fix applies this conversion symmetrically at the tool boundary:

- **read**: blob → path (AI sees clean paths)
- **edit**: blob → path (for matching), path → blob (for display)
- **write**: path → blob (for display)

`hasLocalImages()` gates the async `processMarkdownImages()` call so pure-text operations remain fast.

## Prevention

- **Always apply path conversion at tool boundaries.** Any tool reading from or writing to the editor must use `restoreOriginalImagePaths()` on output and `processMarkdownImages()` on input. This is the same bidirectional pattern used by `convertFrontmatterToCodeBlock`/`convertCodeBlockToFrontmatter` for frontmatter handling.
- **All tool functions should be `async`.** Even if a tool currently has no async operations, declaring them async prevents the class of bug where an async call is added later but the RPC handler isn't updated. The `executeAITool` handler must always `await` results.
- **Treat editor's internal representation as a private format.** Blob URLs are an implementation detail of the ProseMirror rendering pipeline. External consumers (AI, clipboard, export) should never see them directly.

## Related Issues

- [AI Tool Call Cascading Failures](./ai-tool-call-cascading-failures-rpc-stream-lifecycle-2026-04-04.md) — foundational AI tools architecture and RPC bridge
- [Milkdown Frontmatter Display Workaround](../best-practices/milkdown-frontmatter-display-workaround-2026-04-04.md) — same bidirectional conversion pattern for frontmatter-to-codeblock
- [Clipboard Editor Multimode Race Conditions](../ui-bugs/clipboard-editor-multimode-race-conditions-2026-04-05.md) — `restoreOriginalImagePaths`/`processMarkdownImages` used in mode switching and clipboard
