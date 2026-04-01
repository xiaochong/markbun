---
title: "Command palette history not recording and empty commands group"
date: 2026-04-01
category: ui-bugs
module: quick-open/command-palette
problem_type: ui_bug
component: frontend_stimulus
severity: medium
symptoms:
  - Commands group always shows "Strong" as the first item regardless of usage
  - Using commands from the palette does not update the commands shown on next open
  - Empty commands group when no history exists (no fallback recommendations)
root_cause: logic_error
resolution_type: code_fix
tags:
  - command-palette
  - quick-open
  - history
  - recommended-commands
  - react-hooks
---

# Command palette history not recording and empty commands group

## Problem

After implementing the Command Palette feature (Cmd+P) in MarkBun, two bugs appeared: (1) the Commands group always displayed "Strong" as the first/default item regardless of which commands the user had actually used, and (2) when command history was empty, the Commands section showed no items at all instead of showing recommended commands to guide discovery.

## Symptoms

- Commands group always shows "Strong" as first item even after using other commands
- Selecting commands from the palette does not persist to next session
- Empty Commands group when opening the palette for the first time (no guidance for new users)

## What Didn't Work

- **Placing `recordCommandUsage` inside the hook's `confirmSelection()`**: The QuickOpen component bypassed the hook's `confirmSelection()` by calling `onCommandSelect` directly on click and Enter handlers, so the recording logic was never reached.
- **Relying on command history for initial display**: When the history file didn't exist yet, the empty array produced an empty Commands group with zero items, making the palette appear broken.

## Solution

### Bug 1: History not recording

Moved `recordCommandUsage` from the hook to the `handleCommandSelect` callback in `App.tsx`, which is the actual entry point called by both click and keyboard selection:

```typescript
// src/mainview/App.tsx
function handleCommandSelect(action: string) {
  void electrobun.sendMenuAction(action);
  void electrobun.recordCommandUsage(action);  // <-- moved here
}
```

This ensures recording happens regardless of which code path triggers the command (click, Enter key, or any future trigger).

### Bug 2: Empty commands group

Added a recommended commands fallback in `useQuickOpen.ts` for when `commandHistory` is empty:

```typescript
// src/mainview/hooks/useQuickOpen.ts
if (commandHistory.length > 0) {
  // Show by recency order from history
  recentCommands = commandHistory
    .map(action => allCommandItems.find(c => c.type === 'command' && c.action === action))
    .filter(...)
    .slice(0, MAX_PER_GROUP);
} else {
  // No history yet: show recommended (most useful) commands
  const recommended = [
    'view-quick-open',
    'edit-find',
    'file-save',
    'format-strong',
    'format-emphasis',
    'view-toggle-sidebar',
    'view-toggle-theme',
  ];
  recentCommands = recommended
    .map(action => allCommandItems.find(c => c.type === 'command' && c.action === action))
    .filter(...)
    .slice(0, MAX_PER_GROUP);
}
```

## Why This Works

The root cause was a **dispatch gap**: the QuickOpen component called `onCommandSelect` (from App.tsx) directly instead of going through `confirmSelection()` (from the hook). The hook's `confirmSelection()` contained `recordCommandUsage`, so any path that bypassed it would silently skip recording. Moving the recording to the shared callback ensures it fires for all selection paths.

For the empty state, the fix adds a curated "recommended commands" list that serves as both a discovery aid for new users and a graceful degradation when history hasn't been populated yet. The recommended list prioritizes the most frequently useful commands (quick open, find, save, basic formatting, view toggles).

## Prevention

- **Action side effects belong at the call site, not deep in hooks**: When a component has multiple code paths that trigger the same action (click, keyboard, future drag-drop), place persistent side effects (recording, analytics) in the shared callback that all paths invoke, not in a single path's handler.
- **Always design empty-state fallbacks**: When building a recency/history-driven UI, explicitly design the zero-history case with curated defaults rather than leaving it empty.
- **Test the full dispatch path**: Unit tests for hooks won't catch bugs where the component bypasses the hook's methods. Integration-level tests that simulate the actual click/keyboard path are needed.

## Related Issues

- [WebView clipboard shortcuts in input fields](webview-clipboard-shortcuts-input-fields-2026-04-01.md) — same global handler bypass pattern
- [Command palette plan](../../plans/2026-04-01-001-feat-command-palette-plan.md) — original implementation plan
