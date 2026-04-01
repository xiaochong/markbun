---
title: "WebView clipboard shortcuts (Cmd+C/X/V) broken in input fields"
date: 2026-04-01
category: ui-bugs
module: editor/keyboard-shortcuts
problem_type: ui_bug
component: frontend_stimulus
severity: medium
symptoms:
  - Cmd+C/X/V keyboard shortcuts do nothing when focus is in an HTML input or textarea
  - No copy/cut/paste functionality in search bar or any text input field
  - Global capture:true keydown listener intercepts shortcuts before native browser handling
root_cause: logic_error
resolution_type: code_fix
tags:
  - clipboard
  - webview
  - input-fields
  - keyboard-shortcuts
  - electrobun
---

# WebView clipboard shortcuts (Cmd+C/X/V) broken in input fields

## Problem

In MarkBun (Electrobun desktop app with WebView renderer), a global `capture: true` keydown listener intercepts Cmd+C/X/V for the ProseMirror editor. This also intercepts these shortcuts when the user is typing in HTML input fields (e.g., the search bar). Electrobun's WebView does not support native clipboard shortcuts in input fields, so copy/cut/paste completely stopped working in any `<input>` or `<textarea>` element.

## Symptoms

- Cmd+C/X/V produce no effect when focus is inside an HTML input or textarea
- Right-click context menu may still work, but keyboard shortcuts are the primary workflow
- Affects all input fields globally, not just specific components

## What Didn't Work

- **Assuming native browser clipboard handling**: In Electrobun's WebView, `document.execCommand('copy')` and similar APIs don't work for clipboard operations in input fields the way they do in standard browsers.
- **Not checking event target**: The original handler dispatched all Cmd+C/X/V events to the ProseMirror clipboard API regardless of whether the user was in an input field or the editor.

## Solution

Check `e.target.tagName` in each clipboard shortcut case. When the target is `INPUT` or `TEXTAREA`, handle clipboard manually via Electrobun's IPC clipboard API.

**Cmd+C (copy) in input fields:**
```typescript
case 'c': {
  const cTarget = e.target as HTMLElement;
  if (cTarget.tagName === 'INPUT' || cTarget.tagName === 'TEXTAREA') {
    e.preventDefault();
    const el = cTarget as HTMLInputElement | HTMLTextAreaElement;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    if (start === end) break; // No selection — don't overwrite clipboard
    void electrobun.writeToClipboard(el.value.substring(start, end));
  } else {
    e.preventDefault();
    void clipboard.copy();
  }
  break;
}
```

**Cmd+X (cut) in input fields:**
```typescript
case 'x': {
  const xTarget = e.target as HTMLElement;
  if (xTarget.tagName === 'INPUT' || xTarget.tagName === 'TEXTAREA') {
    e.preventDefault();
    const el = xTarget as HTMLInputElement | HTMLTextAreaElement;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    if (start === end) break;
    const selectedText = el.value.substring(start, end);
    el.setRangeText(''); // Remove selection synchronously
    void electrobun.writeToClipboard(selectedText);
  } else {
    e.preventDefault();
    void clipboard.cut();
  }
  break;
}
```

**Cmd+V (paste) in input fields:**
```typescript
case 'v': {
  const vTarget = e.target as HTMLElement;
  if (vTarget.tagName === 'INPUT' || vTarget.tagName === 'TEXTAREA') {
    e.preventDefault();
    void electrobun.readFromClipboard().then((result) => {
      const res = result as { success: boolean; text?: string };
      if (res.success && res.text) {
        document.execCommand('insertText', false, res.text);
      }
    });
  } else {
    e.preventDefault();
    void clipboard.paste();
  }
  break;
}
```

## Why This Works

The root cause is twofold:

1. **Global capture listener**: `window.addEventListener('keydown', handleKeyDown, true)` with `capture: true` runs before any other event handlers, including the browser's native clipboard handling for input fields.

2. **WebView limitation**: Electrobun's WebView does not provide native clipboard shortcut support for input fields. The standard browser `execCommand('copy')` path doesn't work.

The fix detects when the event target is an input/textarea and routes to manual IPC-based clipboard operations:
- `electrobun.writeToClipboard(text)` writes to the system clipboard via Bun main process
- `electrobun.readFromClipboard()` reads from system clipboard via Bun main process
- `document.execCommand('insertText')` is used for paste because it correctly handles cursor placement in input fields
- `el.setRangeText('')` for cut removes the selected text synchronously (avoids race conditions)

## Prevention

- **Always check `e.target` before handling global keyboard shortcuts.** Form elements (`<input>`, `<textarea>`, `<select>`) often need different handling than contenteditable regions.
- **Test shortcuts in all interactive elements**, not just the main editor. Search bars, dialogs, and settings forms all have input fields.
- **Guard against empty selections** for copy/cut: `if (start === end) break` prevents overwriting clipboard with nothing when no text is selected.
- **When adding new global keyboard handlers in WebView/Electron apps**, verify that input field clipboard operations still work after adding the handler.

## Related

- `src/mainview/App.tsx` — keyboard handler with clipboard routing
- `src/mainview/hooks/useClipboard.ts` — ProseMirror clipboard operations
- `src/mainview/lib/electrobun.ts` — IPC clipboard methods (`writeToClipboard`, `readFromClipboard`)
- Commit: `77f4a2c fix(shortcuts): handle Cmd+C/X in input fields with proper clipboard support`
