---
title: AI Chat Panel Flex Shrink Layout Fix
date: 2026-04-04
category: ui-bugs
module: ai-chat-panel
problem_type: ui_bug
component: assistant
severity: medium
symptoms:
  - Tool call cards touched the right edge of the AI panel with no margin
  - User message bubbles overflowed and disappeared when resizing the AI panel narrower
  - AI panel got clipped when resizing the OS window from the right edge inward
root_cause: logic_error
resolution_type: code_fix
related_components:
  - frontend_stimulus
tags:
  - flexbox
  - tailwindcss
  - min-width
  - ai-chat
  - layout
  - overflow
---

# AI Chat Panel Flex Shrink Layout Fix

## Problem

In MarkBun's AI chat panel, tool call cards visually pressed against the right edge without any margin, and resizing the panel or the OS window caused chat messages to overflow and clip out of view.

## Symptoms

- Tool call cards (Read Document, Edit Document, Write Document) had no right margin and touched the panel border.
- User ("You") message bubbles overflowed their container and disappeared when the AI panel was dragged narrower.
- Resizing the OS window from the right edge inward clipped the AI panel because the layout refused to shrink.

## What Didn't Work

- Adding margin or padding to tool cards and message bubbles did not prevent overflow.
- Narrowing the panel from inside its resize handle appeared to work, but narrowing the window from outside still clipped the panel.
- The real issue was CSS flexbox's default `min-width: auto` on flex items, which prevents them from shrinking below their intrinsic content width.

## Solution

Apply `min-w-0` (Tailwind for `min-width: 0`) to flex containers that must shrink, and remove explicit `minWidth` constraints that fight narrowing.

### `src/mainview/App.tsx`

Replaced the conditional `minWidth: '50%'` on the `<main>` editor container with an unconditional `min-w-0` Tailwind class:

```tsx
// Before
<main
  ref={containerRef}
  className="flex-1 flex flex-col overflow-hidden"
  style={showAIPanel ? { minWidth: '50%' } : undefined}
>

// After
<main
  ref={containerRef}
  className="flex-1 flex flex-col overflow-hidden min-w-0"
>
```

The 50% minimum width was the root cause of the AI panel being pushed off-screen when the window was narrowed.

### `src/mainview/components/ai-chat/ChatMessageList.tsx`

Added `min-w-0` to the scroll container and wrapped tool messages to constrain them to the same 90% width as text bubbles:

```tsx
// Scroll container
<div className="flex-1 overflow-y-auto p-3 space-y-3 min-w-0">

// Tool message wrapper
<div className="flex flex-col gap-1 items-start min-w-0 w-full">
  <span className="text-xs text-muted-foreground font-medium">{t('message.assistant')}</span>
  <div className="max-w-[90%] w-full">
    <ToolCallCard message={message}>{toolBody}</ToolCallCard>
  </div>
</div>
```

Also added `min-w-0` to regular message flex columns:

```tsx
<div className={cn('flex flex-col gap-1 min-w-0', isUser ? 'items-end' : 'items-start')}>
```

### `src/mainview/components/ai-chat/ToolCallCard.tsx`

Ensured the card and its header button can shrink and truncate without breaking out of bounds:

```tsx
// Root card fills wrapper width
<div className="rounded-md border-l-4 my-1 overflow-hidden w-full ...">

// Header button clips overflow
<button className="... overflow-hidden min-w-0">

// Truncating spans shrink properly
<span className="text-xs font-medium text-foreground truncate min-w-0">
```

### `src/mainview/components/ai-chat/AIChatPanel.tsx`

Added `min-w-0` to the panel content div and a `NaN` guard on width clamping:

```tsx
const safeWidth = Number.isFinite(width) ? width : MIN_WIDTH;
const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, safeWidth));

<div className="flex flex-col h-full min-w-0 bg-background border-l border-border" style={{ width: clampedWidth - 2 }}>
```

## Why This Works

In CSS flexbox, the default `min-width: auto` on flex items prevents them from shrinking below the width of their content. When a container has long text, code blocks, or wide tool cards, the flex item refuses to shrink, causing either overflow (with `overflow: hidden`) or layout refusal to compress. Explicitly setting `min-width: 0` allows the flex item to shrink, and relying on inner elements (`break-words`, `truncate`, `overflow-x-auto`) handles the content gracefully.

## Prevention

- Apply `min-w-0` to any flex child that should shrink when its parent narrows, especially scrollable containers, chat areas, side panels, and truncating text spans.
- Avoid explicit `minWidth` percentages on flex children unless narrow-viewport behavior is carefully tested.
- When building new flex-based UI components, audit whether children need `min-w-0` to prevent resize-related overflow.

## Related Issues

- [macOS Menu Action Dispatch Bug: Toggle AI Panel Silent Failure](../ui-bugs/macos-menu-action-dispatch-bug-2026-04-03.md)
- [Cascading Failures in AI Tool Call Execution](../integration-issues/ai-tool-call-cascading-failures-rpc-stream-lifecycle-2026-04-04.md)
