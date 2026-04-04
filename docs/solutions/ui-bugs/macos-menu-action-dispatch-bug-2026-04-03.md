---
title: "macOS Menu Action Dispatch Bug: Toggle AI Panel Silent Failure"
date: 2026-04-03
category: ui-bugs
module: menu-system
problem_type: ui_bug
component: tooling
severity: medium
symptoms:
  - Clicking "Toggle AI Panel" in View menu on macOS had no visible response
  - AI panel failed to appear or toggle
  - Issue was macOS-specific; other platforms worked via RPC handler
root_cause: missing_workflow_step
resolution_type: code_fix
tags: [electrobun, macos, menu, application-menu-clicked, rpc, webview, dispatch]
---

# macOS Menu Action Dispatch Bug: Toggle AI Panel Silent Failure

## Problem

In MarkBun (Electrobun desktop app: Bun main process + WebView renderer), clicking "Toggle AI Panel" in the View menu on macOS had no visible response. The AI panel did not appear, and no error was thrown. The action was silently ignored.

## Symptoms

- Clicking View > "Toggle AI Panel" (Cmd+Shift+A) on macOS produced no response
- The AI panel failed to appear or toggle as expected
- The keyboard shortcut also had no effect
- No error logs or exceptions were thrown — silent failure
- The issue was macOS-specific; the `handleMenuAction` RPC path used by Windows/Linux worked correctly

## What Didn't Work

1. **Checking RPC handlers**: The `handleMenuAction` RPC and `actionToEvent` mapping table were correctly configured — this path works for Windows/Linux but is NOT used by macOS native menu clicks
2. **Checking frontend listeners**: `electrobun.on('toggle-ai-panel', ...)` in `App.tsx` was correctly registered
3. **Checking menu definition**: `menu.ts` had the correct action `'toggle-ai-panel'` and accelerator
4. **Checking RPC types**: `types.ts` had `toggleAIPanel: {}` properly registered
5. **Checking RPC messages**: `electrobun.ts` had the `toggleAIPanel` message handler correctly dispatching to `toggle-ai-panel` event

All of these were correct. The issue was in an entirely separate dispatch path that was overlooked.

## Solution

Added the missing case to the macOS `ApplicationMenu.on('application-menu-clicked', ...)` switch-case handler in `src/bun/index.ts`:

```typescript
// Added after the view-toggle-source-mode case:

case 'toggle-ai-panel':
  // @ts-ignore
  fw?.win.webview.rpc.send.toggleAIPanel({});
  break;
```

## Why This Works

Electrobun dispatches menu clicks through **two separate mechanisms** depending on the platform:

| Platform | Dispatch Path | Location |
|----------|---------------|----------|
| **macOS** | `ApplicationMenu.on('application-menu-clicked', ...)` switch-case | `src/bun/index.ts` ~line 1974 |
| **Windows/Linux** | `handleMenuAction` RPC → `actionToEvent` mapping table | `src/bun/index.ts` ~line 1425 |

The `toggle-ai-panel` action was registered in the RPC handler (`actionToEvent` table + `handlers.messages`) but was **missing from the macOS native handler**. On macOS, the native application menu click event fires `application-menu-clicked`, which has its own independent switch-case. Without a matching case, the action fell through all cases silently — no error, no response.

## Prevention

**Cross-platform menu action checklist** when adding a new menu item:

1. Add action to `src/bun/menu.ts` (menu definition with action string)
2. Add RPC message to `src/shared/types.ts` (in `MarkBunRPC.bun.messages`)
3. Add client message handler to `src/mainview/lib/electrobun.ts` (dispatch to event listeners)
4. Add event listener to `src/mainview/App.tsx` (`electrobun.on(...)`)
5. Add to `actionToEvent` mapping in `src/bun/index.ts` (for Windows/Linux RPC path)
6. **CRITICAL**: Add case to `ApplicationMenu.on('application-menu-clicked', ...)` switch-case in `src/bun/index.ts` (for macOS native path)

The RPC Pattern documented in project memory covers steps 1-5 but omits step 6. Any new menu action must appear in **both** the `actionToEvent` table AND the `application-menu-clicked` handler to work cross-platform.

## Related Issues

- `docs/solutions/ui-bugs/command-palette-history-and-discovery-2026-04-01.md` — related action routing pattern
- `docs/solutions/ui-bugs/webview-clipboard-shortcuts-input-fields-2026-04-01.md` — related platform-specific event handling
