---
title: "Session Persistence Lost on Restart — React Effect Race Condition"
date: 2026-04-02
category: logic-errors
module: session-persistence
problem_type: logic_error
component: frontend_stimulus
severity: high
symptoms:
  - "Session state file always contains filePath: null after app restart, despite correct in-session saves"
  - "ENOENT errors during session state save: rename 'session-state.json.tmp' -> 'session-state.json'"
  - "No file restored on app restart — session persistence feature completely non-functional"
root_cause: async_timing
resolution_type: code_fix
tags:
  - react-effect
  - race-condition
  - session-persistence
  - useSessionSave
  - mount-time-overwrite
  - electrobun
---

# Session Persistence Lost on Restart — React Effect Race Condition

## Problem

The session persistence feature (save/restore open file, cursor, scroll across restarts) was completely non-functional. Despite correct saves during an active session, restarting the app always showed a clean workspace. The `session-state.json` file was overwritten with `filePath: null` on every startup.

## Symptoms

- After restarting the app, no file was restored — always a clean workspace
- `~/.config/markbun/session-state.json` always contained `filePath: null` despite correct saves during the active session
- ENOENT errors in main process log: `rename 'session-state.json.tmp' -> 'session-state.json'`

## What Didn't Work

1. **Replacing `atomicWrite` with plain `writeFile`** in `sessionState.ts`. This fixed the ENOENT error (the `.tmp` file's parent path didn't resolve correctly) but did not fix the null filePath. The real issue was upstream — the hook was passing null data, not a write-mechanism failure.

2. **Adding `isFirstRenderRef` to skip the first render's save** in `useSessionSave`. This prevented the very first effect fire, but React's strict mode double-mount (or any re-render) caused the effect to fire again with `isFirstRenderRef` already `false`. The null filePath was still written to disk.

3. **Diagnostic logging** — this is what actually identified the root cause: on mount, `filePath` is `null` because `useFileOperations` initializes with `path: null`, and `useSessionSave`'s effect fires before `initializeApp` (an async operation) can restore the previous session.

## Solution

Three targeted changes:

### 1. Guard `captureAndSave` against null filePath

**File**: `src/mainview/hooks/useSessionSave.ts`

```typescript
// Before: unconditionally saved whatever filePathRef.current held (including null)
const captureAndSave = useCallback(async () => {
  const currentFilePath = filePathRef.current;
  // ... read cursor, scroll, etc.
  await electrobun.saveSessionState({ filePath: currentFilePath, ... });
}, [editorRef, sourceEditorRef]);

// After: early return when no file is open
const captureAndSave = useCallback(async () => {
  const currentFilePath = filePathRef.current;
  if (!currentFilePath) return;  // Don't overwrite previous session with null
  // ... rest of save logic
}, [editorRef, sourceEditorRef]);
```

This single guard at the save entry point prevents ALL paths (mount effect, beforeunload, scheduleSave) from writing null data.

### 2. Switch from atomicWrite to plain writeFile

**File**: `src/bun/services/sessionState.ts`

```typescript
// Before: atomicWrite (.tmp + rename) — caused ENOENT
// After: plain writeFile — session state is disposable, doesn't need crash safety
export async function saveSessionState(state: SessionState) {
  await ensureConfigDir();
  await writeFile(SESSION_STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  return { success: true };
}
```

### 3. Wire `scheduleSave` to content change handlers

**File**: `src/mainview/App.tsx`

```typescript
// Before: scheduleSave was returned from useSessionSave but never called
// After: trigger debounced session save on content changes
const handleEditorChange = useCallback((markdown: string) => {
  if (isSwitchingFileRef.current) return;
  updateContent(markdown);
  setEditorContent(markdown);
  outline.setHeadings(markdown);
  scheduleSave();  // Debounced session save on content changes
}, [updateContent, outline.setHeadings, scheduleSave]);
```

## Why This Works

The root cause was a race condition between React's synchronous effect lifecycle and the asynchronous session restore flow:

1. `useSessionSave` registers a `useEffect` that depends on `filePath`
2. On first render, `filePath` is `null` — the default initial state from `useFileOperations`
3. The effect fires immediately and calls `captureAndSave()` → writes `{filePath: null}` to disk
4. This **overwrites** the previous session's valid data **before** `initializeApp`'s async code can read it
5. `initializeApp` then reads `session-state.json`, finds `filePath: null`, falls through to clean workspace

The guard (`if (!currentFilePath) return`) is the critical fix: it prevents any save operation when no file is actually open, so the disk state from the previous session is never clobbered by the initial null state. This works regardless of React strict mode, double-mounts, or effect firing order.

## Prevention

- **Guard mount-time writes with data validation.** Any hook that persists state to disk should check that the data is meaningful (e.g., non-null filePath) before writing. Never trust that effect-scoped state will be populated by the time the effect fires.

- **Prefer event-driven persistence over effect-driven.** Instead of wiring persistence to `useEffect` dependencies (which fire on mount with initial/default values), trigger saves from event-driven callbacks (like `handleEditorChange`) that only fire after the app has fully initialized with real data.

- **Treat session state as a cache.** Session state files are disposable — if missing or corrupt, the worst case is a clean workspace. Use lighter-weight writes (`writeFile`) instead of atomic writes, which add unnecessary failure modes. Reserve atomic writes for user content files where data loss matters.

## Related

- **Plan**: `docs/plans/2026-04-01-002-feat-session-persistence-plan.md` (Units 3 and 5)
- **Requirements**: `docs/brainstorms/2026-04-01-session-persistence-requirements.md`
- **Pattern-related**: `docs/solutions/ui-bugs/command-palette-history-and-discovery-2026-04-01.md` — shares the lesson "place side-effects at call site, not deep in hooks"
