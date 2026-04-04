---
title: Editor content lost on file switch after AI edits
date: 2026-04-04
category: logic-errors
module: mainview/editor
problem_type: logic_error
component: tooling
symptoms:
  - AI-generated edits lost when switching files via sidebar
  - Manual edits survived file switching but AI edits did not
  - Auto-save never triggered for AI modifications
  - isDirty briefly flipped to true then immediately back to false
root_cause: async_timing
resolution_type: code_fix
severity: high
tags: [prosemirror, milkdown, auto-save, isdirty, stale-closure, react-refs, ai-tools]
---

# Editor content lost on file switch after AI edits

## Problem

When switching files in MarkBun's sidebar, content changes made by AI tools (via `window.__markbunAI.edit()`/`write()`) were silently lost. The editor displayed the changes, but `isDirty` was reset to `false` before auto-save could trigger, so the file on disk was never updated.

## Symptoms

- AI edits visible in editor but lost after switching to another file and back
- Manual edits (typing) sometimes survived, AI edits never did
- `checkUnsavedChanges` reported `isDirty: false` even immediately after AI modification
- No auto-save logs appeared for AI-modified content

## What Didn't Work

- **Fix 1 — Refs for stale closures in `useAutoSave`**: Added `isDirtyRef` and `enabledRef` to avoid stale closures. Partially helped but Crepe's `markdownUpdated` listener never fired at all for programmatic content changes, so no downstream fix could detect them.

- **Fix 2 — Replace Crepe listener with ProseMirror `$prose` plugin**: Manual edits now worked (producing single dispatch), but AI edits still lost because ProseMirror's normalization produced a second dispatch with identical content, resetting `isDirty`.

## Solution

Three coordinated fixes:

### Fix 1 — Deduplicate change listener (`useCrepeEditor.ts`)

ProseMirror normalizes content after `setMarkdown`, dispatching multiple transactions that serialize to the same markdown. Track last serialized value and only call `onChange` when it differs:

```typescript
let lastSerializedMarkdown = '';
const changeListenerPlugin = $prose((ctx) => {
  return new Plugin({
    key: new PluginKey('markbun-change-listener'),
    view: () => ({
      update: (view, prevState) => {
        if (!view.state.doc.eq(prevState.doc)) {
          const serializer = ctx.get(serializerCtx);
          const markdown = serializer(view.state.doc);
          if (markdown !== lastSerializedMarkdown) {
            lastSerializedMarkdown = markdown;
            onChangeRef.current?.(markdown);
          }
        }
      },
    }),
  });
});
crepe.editor.use(changeListenerPlugin);
```

### Fix 2 — One-way isDirty ratchet (`useFileOperations.ts`)

Never reset `isDirty` to `false` when content is unchanged — only set it to `true` on actual changes. `isDirty` is explicitly cleared only after successful save or file reset:

```typescript
const contentChanged = newContent !== prev.content;
const isDirty = prev.path !== null
  ? (contentChanged ? true : prev.isDirty)  // ratchet: never clear via updateContent
  : newContent.length > 0;
```

### Fix 3 — Defer isDirty check in auto-save (`useAutoSave.ts`)

`triggerSave` runs synchronously from the ProseMirror plugin callback, before React re-renders. At that point `isDirtyRef.current` is stale. Fix: remove the `isDirty` check from `triggerSave` entirely. The actual gate lives in `executeSave`, which runs after a `setTimeout` delay when React has re-rendered and refs are current.

Also converted `isDirty` and `enabled` from closure values to refs throughout the hook.

## Why This Works

The root cause was a **semantic mismatch** between ProseMirror's transaction-level granularity and the application's content-level dirty tracking:

1. **Crepe's `markdownUpdated` never fires** for programmatic `setMarkdown` calls — it only tracks user-initiated edits. The `$prose` plugin listens at the ProseMirror view level, catching all dispatches.

2. **ProseMirror double-dispatch**: After `setMarkdown`, ProseMirror may dispatch a normalization transaction that changes document structure but serializes to the same markdown. Without deduplication, the second `updateContent(newLen=541, prevLen=541)` recomputed `isDirty = false`.

3. **Stale ref window**: `triggerSave` checked `isDirtyRef.current` synchronously within the ProseMirror plugin callback, before React had a chance to re-render. The ref was always one render behind.

## Prevention

- **Never recompute derived boolean state from raw equality checks when the source can produce duplicate events.** Use one-way ratchets (`isDirty = isDirty || contentChanged`) instead of full recomputation (`isDirty = a !== b`).

- **When bridging ProseMirror transactions to React state, serialize and deduplicate.** ProseMirror's `doc.eq()` catches structural changes, but normalization passes can produce structurally different docs that serialize identically.

- **Never read React state synchronously from a ProseMirror plugin callback.** The callback runs outside React's render cycle. Use `setTimeout(0)` or defer reads until after the next render.

- **Prefer refs over closures for values read in async/deferred callbacks.** When a `useCallback` reads a value that changes between renders, capture it in a ref to avoid stale closures.

## Related Issues

- [Session persistence race condition](./session-persistence-race-condition-react-effect-2026-04-02.md) — same module, different root cause (React effect timing vs ProseMirror dispatch timing)
- [AI tool call cascading failures](../integration-issues/ai-tool-call-cascading-failures-rpc-stream-lifecycle-2026-04-04.md) — same AI integration, different failure mode
