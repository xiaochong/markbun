---
title: Clipboard and Multi-Mode Editor Race Conditions
date: 2026-04-05
category: docs/solutions/ui-bugs
module: markbun-editor
problem_type: ui_bug
component: tooling
severity: critical
symptoms:
  - Toggling source mode shows empty/stale content due to React state batching race
  - Pasting single-line text in WYSIWYG creates unwanted new paragraph blocks
  - Source mode paste replaces entire document instead of selected range
  - Undo/redo/copy/cut/select-all menu actions do nothing in source mode
  - Source mode cut loses text or paste leaves cursor at wrong position
root_cause: async_timing
resolution_type: code_fix
related_components:
  - src/mainview/App.tsx
  - src/mainview/components/editor/SourceEditor.tsx
  - src/mainview/components/editor/hooks/useCrepeEditor.ts
  - src/mainview/components/editor/commands/text.ts
  - src/mainview/hooks/useClipboard.ts
tags:
  - clipboard
  - paste
  - source-mode
  - codemirror
  - prosemirror
  - race-condition
  - milkdown
  - inserttext
---

# Clipboard and Multi-Mode Editor Race Conditions

## Problem

MarkBun's dual-mode editor (WYSIWYG via Milkdown/ProseMirror, source via CodeMirror 6) had six interconnected bugs in clipboard operations and mode switching: content lost on toggle due to React state batching, paste creating wrong paragraph structures, source mode paste replacing the entire document, and all editing shortcuts (undo/redo/copy/cut/select-all) silently failing in source mode.

## Symptoms

- Switching from WYSIWYG to source mode shows empty editor — `getMarkdown()` called inside `setSourceMode()` updater races with component mounting
- Switching back from source to WYSIWYG also loses content — same race condition
- Pasting a single line of text in WYSIWYG mode creates a new paragraph block instead of inserting at cursor
- Pasting in source mode replaces the entire document content
- Undo, redo, copy, cut, select-all menu items and keyboard shortcuts produce no effect in source mode
- Source mode cut deletes text but clipboard write races with deletion; paste cursor stays at start instead of moving to end

## What Didn't Work

- **`setTimeout(fn, 0)` inside state updater**: React batches the state update and the `setTimeout` fires before the new editor component's `useEffect` creates the CodeMirror instance — content sets on null ref
- **Direct `setMarkdown`/`setValue` after `setSourceMode`**: Editor ref is still pointing to the old component (Milkdown), not the new one (SourceEditor) — the ref update hasn't happened yet
- **`replaceWith(from, to, doc.content)` for all paste**: ProseMirror unwraps block nodes placed inside other blocks, creating unexpected sibling paragraphs even for single-line text
- **`view.state.selection.from/to` in CodeMirror 6**: CM6's `SelectionSet` doesn't expose `from`/`to` directly — must use `selection.main.from`/`selection.main.to`

## Solution

### 1. Source Mode Toggle: requestAnimationFrame Polling

**File:** `src/mainview/App.tsx` — `handleToggleSourceMode`

Moved side effects out of the `setSourceMode` updater and used `requestAnimationFrame` polling to wait for editor readiness:

```typescript
const handleToggleSourceMode = useCallback(() => {
  const newMode = !sourceModeRef.current;
  if (newMode) {
    // Read content BEFORE state change (old editor still mounted)
    const markdown = editorRef.current?.getMarkdown() ?? '';
    const markdownWithOriginalPaths = restoreOriginalImagePaths(markdown);
    setSourceMode(true);
    // Poll until new editor is ready
    const trySetContent = () => {
      if (sourceEditorRef.current?.isReady) {
        sourceEditorRef.current.setValue(markdownWithOriginalPaths);
        sourceEditorRef.current.focus();
      } else {
        requestAnimationFrame(trySetContent);
      }
    };
    requestAnimationFrame(trySetContent);
  } else {
    // Symmetric: read source, switch state, poll for Milkdown ready
    const markdown = sourceEditorRef.current?.getValue() ?? '';
    setSourceMode(false);
    void processMarkdownImages(markdown).then((processedMarkdown) => {
      const trySetContent = () => {
        if (editorRef.current?.isReady) {
          editorRef.current.setMarkdown(processedMarkdown);
          editorRef.current.focus();
        } else {
          requestAnimationFrame(trySetContent);
        }
      };
      requestAnimationFrame(trySetContent);
    });
  }
}, []);
```

### 2. WYSIWYG Paste: Three-Case Inline vs Block

**File:** `src/mainview/components/editor/hooks/useCrepeEditor.ts` — `insertMarkdown`

```typescript
if (doc.childCount === 1 && doc.firstChild?.type.name === 'paragraph') {
  // Single paragraph: unwrap to inline content (text + marks, no paragraph wrapper)
  const tr = view.state.tr.replaceWith(from, to, doc.firstChild.content);
  view.dispatch(tr);
  return;
}
const parent = $from.parent;
if (parent.type.name === 'paragraph' && parent.content.size === 0) {
  // Multi-block into empty paragraph: replace entire paragraph node
  const paraStart = $from.before();
  const paraEnd = $from.after();
  const tr = view.state.tr.replaceWith(paraStart, paraEnd, doc.content);
  view.dispatch(tr);
} else {
  // Normal multi-block: insert at selection
  const tr = view.state.tr.replaceWith(from, to, doc.content);
  view.dispatch(tr);
}
```

### 3. Source Mode Paste: Use Actual Selection Range

**File:** `src/mainview/components/editor/SourceEditor.tsx` — `insertText`

```typescript
insertText: (text: string) => {
  const view = viewRef.current;
  if (!view) return;
  const { from, to } = view.state.selection.main; // NOT view.state.selection
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length }, // Move cursor to end
  });
},
```

### 4. Source Mode Shortcuts: Dispatch to CodeMirror

**Files:** `src/mainview/App.tsx` (menu action handler), `src/mainview/components/editor/SourceEditor.tsx`

Added source mode branching for all editing menu actions and exposed new methods on `SourceEditorRef`:

```typescript
// App.tsx menu action handler
case 'editor-undo':
  if (sourceModeRef.current) sourceEditorRef.current?.undo();
  else editorRef.current?.undo();
  break;
case 'editor-cut': {
  if (sourceModeRef.current) {
    const selectedText = sourceEditorRef.current?.getSelectedText?.();
    if (selectedText) {
      sourceEditorRef.current?.insertText(''); // Delete BEFORE async write
      void electrobun.writeToClipboard(selectedText);
    }
  } else { void clipboard.cut(); }
  break;
}
```

New methods on `SourceEditorRef`: `undo()`, `redo()`, `getSelectedText()`, `selectAll()`.

## Why This Works

**Race condition (Bug 1):** React's `setState` updater function runs synchronously during render, but the actual DOM update and child `useEffect` hooks fire after commit. `setTimeout(fn, 0)` from inside the updater fires in the next microtask — before React has committed the render. `requestAnimationFrame` polling on `isReady` defers until after the new editor's `useEffect` has run and set `isReady = true`.

**Paragraph creation (Bug 2):** ProseMirror's document model enforces schema constraints — block nodes cannot nest inside other block nodes. When `replaceWith` receives a paragraph node and the target position is inside another paragraph, ProseMirror lifts it to a sibling, creating a new block. Extracting `doc.firstChild.content` (inline nodes: text, marks) avoids this because inline nodes are valid inside paragraphs.

**Selection API (Bug 3):** CodeMirror 6's `EditorSelection` is a collection of ranges (multi-cursor support). The primary selection is at `selection.main`, which has `{from, to, anchor, head}`. Using `from: 0, to: doc.length` was a hardcoded "replace all" — the correct behavior is to use the actual selection range.

**Menu dispatch (Bug 4/5):** Source mode uses a completely separate CodeMirror instance with its own API. The menu action handler was only dispatching to Milkdown's editor ref. Each editing operation needs a source-mode branch that calls the corresponding CodeMirror method. For cut, the delete must happen synchronously before the async clipboard write to prevent state inconsistency.

## Prevention

- **Use `requestAnimationFrame` polling for post-mount editor content setting**, never `setTimeout` inside state updaters. Pattern: read content before state change → set state → poll `ref.isReady` via rAF → set content
- **Always unwrap single-paragraph paste to `.firstChild.content`** in ProseMirror to avoid block-nesting side effects. Test paste with single-line, multi-line, and empty-paragraph targets
- **Use `view.state.selection.main` for CodeMirror 6 selection**, never `view.state.selection.from/to`
- **Add new methods to both editor refs simultaneously** — when adding an editing operation, ensure it's available on both `MilkdownEditorRef` and `SourceEditorRef`, and the menu action handler dispatches to the correct backend based on `sourceMode`
- **Follow "sync first, async second" for cut/delete** — synchronous state mutations must complete before async I/O (clipboard writes) to prevent inconsistent rollback
- **Cross-platform menu action checklist**: when adding a menu action, verify it appears in: (1) `src/bun/menu.ts` action table, (2) `src/bun/index.ts` `application-menu-clicked` handler, (3) `src/mainview/App.tsx` `menuAction` handler with source mode branch

## Related Issues

- [WebView Clipboard Shortcuts in Input Fields](./webview-clipboard-shortcuts-input-fields-2026-04-01.md) — same clipboard domain, complementary depth (input fields vs ProseMirror/CodeMirror internals)
- [macOS Menu Action Dispatch Bug](./macos-menu-action-dispatch-bug-2026-04-03.md) — the missing source mode dispatch is a recurrence of the same pattern; prevention checklist should be enforced
- [Editor Content Lost on File Switch](../logic-errors/editor-content-lost-on-file-switch-2026-04-04.md) — shared ProseMirror-to-React state bridge timing patterns
- [Session Persistence Race Condition](../logic-errors/session-persistence-race-condition-react-effect-2026-04-02.md) — same React state race condition category, different module
