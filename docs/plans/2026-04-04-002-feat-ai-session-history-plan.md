---
title: AI Session History Management
type: feat
status: completed
date: 2026-04-04
origin: docs/brainstorms/2026-04-02-v0.6-ai-requirements.md
---

# AI Session History Management

## Overview

Implement AI conversation history persistence and management. Users can view past sessions, restore them to continue conversations, and delete unwanted sessions. Sessions are automatically saved during active conversations and restored on app restart.

## Problem Frame

Currently, AI conversations in MarkBun are ephemeral:
- Chat messages are stored only in React state (memory)
- When the app restarts, all conversation history is lost
- Users cannot refer back to previous AI-assisted editing sessions
- No way to continue a previous conversation after switching files

This implementation fulfills requirements R13, R17, and R18 from the v0.6.0 AI Support specification.

## Requirements Trace

- **R13**: Session header displays model name + session operations menu (reset, view history)
- **R17**: Session management supports three operations: (a) reset, (b) view history list, (c) restore from history
- **R18**: Session data persists to `~/.config/markbun/ai-sessions/` using pi-ai Context format; app restart restores last active session

## Scope Boundaries

- **Included**: Session persistence, history list UI, restore/delete operations, auto-save during streaming
- **Not included**: Session search/filter, session naming/renaming, session folders/tags, session export/import
- **Not included**: Token usage statistics per session (R18 Context includes usage but no dashboard)

## Context & Research

### Relevant Code and Patterns

**Backend Service Pattern** (follow `src/bun/services/sessionState.ts`):
- Use `CONFIG_DIR = join(homedir(), '.config', 'markbun')`
- `ensureConfigDir()` helper for directory creation
- Load/save functions with fallback to defaults
- Return `{ success, error? }` result types

**List Management Pattern** (follow `src/bun/ipc/recentFiles.ts`):
- Maintain an index file for the list (sorted by timestamp)
- Trim old entries when exceeding max count
- Atomic read-modify-write with error handling

**Dialog UI Pattern** (follow `src/mainview/components/file-history/FileHistoryDialog.tsx`):
- Modal overlay with click-outside-to-close
- Fixed dimensions (e.g., `w-[600px] h-[400px]`)
- Header/body/footer layout structure
- List with selection and scroll-to-view behavior

**Hook State Pattern** (follow `src/mainview/hooks/useAIChat.ts`):
- Use refs to track current values for async callbacks
- Event-driven updates rather than effect-driven persistence
- Guard against race conditions with session IDs

### Institutional Learnings

From `docs/solutions/logic-errors/session-persistence-race-condition-react-effect-2026-04-02.md`:
- **Event-driven persistence over effect-driven**: Trigger saves from callbacks after user actions, not from useEffect dependencies
- **Guard mount-time writes**: Check that data is meaningful before writing to disk
- **Session files are disposable**: Use lightweight `writeFile` instead of atomic writes

From `docs/solutions/integration-issues/ai-tool-call-cascading-failures-rpc-stream-lifecycle-2026-04-04.md`:
- **Model messages as immutable snapshots**: Create new message objects rather than mutating existing ones
- **Integration-test the full loop early**: End-to-end tests catch cascading failures

## Key Technical Decisions

1. **Storage Format**: Use pi-ai's `Context` object directly as the serialization format. The `Context.messages` array contains all conversation state. Store metadata (id, title, timestamp) alongside.

2. **File Structure**:
   - `~/.config/markbun/ai-sessions/index.json` - Array of session metadata (id, title, model, timestamp, filePath)
   - `~/.config/markbun/ai-sessions/<sessionId>.json` - Full session data (Context + metadata)

3. **Session Identification**: Each session gets a UUID. The "active session" is tracked by ID in the Bun process. When restoring, we load the full Context and continue from where we left off.

4. **Auto-save Strategy**: Debounced save (2s) after each message completes. Also save immediately when streaming ends (done/error). Do not save mid-stream to avoid partial tool call states.

5. **Session Title Generation**: Use the first user message truncated to 40 chars as the title. Falls back to "Untitled Session" if no user message exists.

## Implementation Units

- [ ] **Unit 1: Backend AI Session Service**

**Goal:** Create the backend service for session persistence with CRUD operations.

**Requirements:** R18

**Dependencies:** None

**Files:**
- Create: `src/bun/services/ai-sessions.ts`
- Test: `tests/unit/bun/services/ai-sessions.test.ts`

**Approach:**
- Define `AISession` interface with metadata (id, title, model, filePath, createdAt, updatedAt) + pi-ai Context
- Implement `loadSessionIndex()`: returns sorted array of session metadata (newest first)
- Implement `saveSession(session)`: writes to `<id>.json` and updates index.json
- Implement `deleteSession(id)`: removes file and updates index
- Implement `loadSession(id)`: returns full session data
- Implement `getLatestSession()`: returns most recent session for auto-restore
- Set max session count to 50 (trim oldest when exceeded)

**Patterns to follow:**
- `src/bun/services/sessionState.ts` - service structure and error handling
- `src/bun/ipc/recentFiles.ts` - index file management

**Test scenarios:**
- Happy path: save session, load returns same data
- Edge case: empty sessions directory returns empty list
- Edge case: corrupt session file returns null, doesn't crash
- Integration: save 51 sessions, verify oldest is auto-deleted
- Error path: disk full returns proper error object

**Verification:**
- Service functions can save/load/delete sessions correctly
- Index file stays synchronized with session files
- Unit tests pass

---

- [ ] **Unit 2: RPC Bridge and Types**

**Goal:** Extend RPC types and Bun handlers for session operations.

**Requirements:** R17, R18

**Dependencies:** Unit 1

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/bun/index.ts`
- Modify: `src/mainview/lib/electrobun.ts`

**Approach:**
- Add `AISessionSummary` type (metadata without full messages) for list view
- Add `AISession` type (metadata + messages array)
- Add RPC requests: `getAISessionList`, `getAISession(id)`, `saveAISession`, `deleteAISession`
- Add Bun handlers that call ai-sessions service
- Add `electrobun.ts` client methods

**Patterns to follow:**
- Existing RPC patterns in `types.ts` (e.g., `getRecentFiles`, `saveSessionState`)
- Error handling with `{ success, error? }` result types

**Test scenarios:**
- Happy path: all RPC endpoints return expected data
- Error path: invalid session ID returns proper error
- Integration: save via RPC, verify file on disk

**Verification:**
- TypeScript compiles without errors
- RPC methods available in frontend

---

- [ ] **Unit 3: Frontend useAIChat Hook Enhancement**

**Goal:** Extend useAIChat to support session persistence and restoration.

**Requirements:** R17, R18

**Dependencies:** Unit 2

**Files:**
- Modify: `src/mainview/hooks/useAIChat.ts`

**Approach:**
- Add `sessionId` state (null when no active session)
- Add `loadSession(id)` function: loads from RPC, sets messages and sessionId
- Add `saveCurrentSession()` function: debounced save of current messages
- Modify `resetSession()`: saves current session before clearing, generates new session ID
- Modify `send()`: auto-save after successful message completion
- Add `restoreLatestSession()` function: called on app mount if no active session
- Track `filePath` in session metadata (for display in history list)

**Technical design:**
```typescript
// Session state additions
const [sessionId, setSessionId] = useState<string | null>(null);
const [filePath, setFilePath] = useState<string | null>(null);

// Debounced save using useRef for timeout
const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const scheduleSave = useCallback(() => {
  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  saveTimeoutRef.current = setTimeout(() => {
    if (sessionId && messages.length > 0) {
      electrobun.saveAISession({ id: sessionId, messages, filePath, ... });
    }
  }, 2000);
}, [sessionId, messages, filePath]);
```

**Patterns to follow:**
- `useSessionSave.ts` - debounced save pattern
- Guard against saving empty/meaningless sessions

**Test scenarios:**
- Happy path: conversation auto-saves after messages
- Edge case: rapid messages don't trigger multiple concurrent saves
- Integration: restore session loads correct messages
- Error path: save failure doesn't crash UI

**Verification:**
- Hook maintains backward compatibility
- Sessions save automatically during conversation
- Restoration works correctly

---

- [ ] **Unit 4: Session History Dialog Component**

**Goal:** Create the dialog UI for browsing and restoring past sessions.

**Requirements:** R13, R17

**Dependencies:** Unit 2, Unit 3

**Files:**
- Create: `src/mainview/components/ai-chat/SessionHistoryDialog.tsx`
- Modify: `src/mainview/App.tsx` (add dialog state)

**Approach:**
- Dialog receives `isOpen`, `onClose`, `onRestore`, `sessions[]` props
- List displays: title, model name, file path, date (relative: "2 hours ago")
- Selection with keyboard navigation (arrow keys, Enter to restore, Delete to delete)
- Click to select, double-click to restore
- Delete button with confirmation
- Empty state: "No previous sessions" message

**Patterns to follow:**
- `FileHistoryDialog.tsx` - modal structure and styling
- `QuickOpen.tsx` - list selection and keyboard navigation

**Test scenarios:**
- Happy path: click session, click restore, dialog closes and session loads
- Happy path: double-click session immediately restores
- Edge case: empty list shows proper empty state
- Keyboard: arrow keys navigate, Enter restores, Delete prompts then removes
- Error path: restore failure shows error message in dialog

**Verification:**
- Dialog renders correctly with test data
- Keyboard navigation works
- Restore/delete operations function properly

---

- [ ] **Unit 5: Update SessionHeader Component**

**Goal:** Add "View History" button to session header.

**Requirements:** R13

**Dependencies:** Unit 4

**Files:**
- Modify: `src/mainview/components/ai-chat/SessionHeader.tsx`
- Modify: `src/mainview/components/ai-chat/AIChatPanel.tsx` (pass onViewHistory prop)

**Approach:**
- Add "View History" button next to "New Chat" button
- Use clock/history icon
- Tooltip: "View History"
- Click opens SessionHistoryDialog

**Patterns to follow:**
- Existing button styling in SessionHeader (p-1.5 rounded-md hover:bg-accent)

**Test scenarios:**
- Happy path: click history button, dialog opens

**Verification:**
- Button renders and is clickable
- Dialog opens on click

---

- [ ] **Unit 6: i18n Translations**

**Goal:** Add all necessary translations for session history feature.

**Requirements:** R29-R30 (i18n for AI features)

**Dependencies:** Units 4-5

**Files:**
- Modify: `src/mainview/i18n/locales/en/ai.json`
- Modify: `src/mainview/i18n/locales/zh-CN/ai.json`
- Modify: 6 other locale files (de, fr, ja, ko, pt, es)

**Approach:**
- Add keys:
  - `session.history`: "View History"
  - `session.restore`: "Restore Session"
  - `session.delete`: "Delete Session"
  - `session.deleteConfirm`: "Delete this session permanently?"
  - `session.empty`: "No previous sessions"
  - `session.untitled`: "Untitled Session"
  - `dialog.title`: "Session History"

**Patterns to follow:**
- Existing ai.json structure
- Keep translations concise for UI constraints

**Test scenarios:**
- All keys exist in all 8 locale files
- UI displays translated strings correctly

**Verification:**
- No missing translation warnings in console
- UI text displays correctly in all languages

---

- [ ] **Unit 7: App Integration and Auto-Restore**

**Goal:** Wire up all components and implement startup auto-restore.

**Requirements:** R18

**Dependencies:** Units 3-6

**Files:**
- Modify: `src/mainview/App.tsx`

**Approach:**
- Add `showSessionHistoryDialog` state
- Add `SessionHistoryDialog` component with proper props
- In AI panel, pass `onViewHistory` callback to `AIChatPanel`
- On app mount (after settings loaded), check if AI is enabled and no active session:
  - Call `electrobun.getAISessionList()`
  - If sessions exist and AI panel is closed, optionally restore latest (or just leave for user)
  - Do NOT auto-open AI panel (respect user preference)

**Patterns to follow:**
- Existing dialog integration pattern in App.tsx (e.g., RecoveryDialog, SettingsDialog)
- Event handler placement (avoid deep prop drilling where possible)

**Test scenarios:**
- Integration: app start with AI enabled → latest session available for restore
- Integration: restore session → messages appear in panel
- Integration: delete session → removed from list
- Edge case: corrupted session data → graceful fallback (show error, don't crash)

**Verification:**
- Full end-to-end flow works: chat → save → restart → restore
- All edge cases handled gracefully

## System-Wide Impact

- **Interaction graph:** 
  - `useAIChat` now triggers saves after message updates
  - `App.tsx` loads session list on mount for potential restore
  - Session operations (save/delete) interact with filesystem via RPC

- **Error propagation:** 
  - RPC errors bubble up to UI via error states
  - Save failures are logged but don't block user
  - Restore failures show error in dialog

- **State lifecycle risks:**
  - Partial save during streaming: we only save on done/error, not mid-stream
  - Race condition between multiple saves: debounced save prevents this
  - Disk space exhaustion: trim old sessions automatically (keep 50)

- **Integration coverage:**
  - End-to-end: send message → verify file created → restart app → restore → verify messages match

- **Unchanged invariants:**
  - File switching still clears AI context (R16)
  - System prompt still only contains file path, not content
  - Tool calls continue to work as before

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Session files grow large with long conversations | Limit to 50 sessions; each session file contains only message text (not full file content read by AI) |
| Corrupted session file prevents startup | Load functions return null on error, don't crash; index.json corruption rebuilds from individual files |
| Race between save and delete | Sequential file operations; delete removes file then updates index |
| Privacy concerns with local storage | Sessions stored locally same as settings; document contents (via read tool) stored in session |

## Documentation / Operational Notes

- Session files are user data in `~/.config/markbun/ai-sessions/`
- No migration needed for v0.6.0 (new feature)
- Future considerations: session export/import, search, folders

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-02-v0.6-ai-requirements.md](../brainstorms/2026-04-02-v0.6-ai-requirements.md)
- **Related code patterns:**
  - `src/bun/services/sessionState.ts` - service pattern
  - `src/bun/ipc/recentFiles.ts` - list management
  - `src/mainview/components/file-history/FileHistoryDialog.tsx` - dialog UI
  - `src/mainview/hooks/useAIChat.ts` - hook state management
