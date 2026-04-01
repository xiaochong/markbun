---
title: "feat: Command Palette — Extend Cmd+P to Search Files and Commands"
type: feat
status: active
date: 2026-04-01
origin: docs/brainstorms/2026-04-01-command-palette-requirements.md
---

# feat: Command Palette

## Overview

Extend the existing Cmd+P Quick-Open into a unified palette that searches both files and menu commands in grouped display. This requires building a command registry, adding menu i18n to the renderer, persisting command usage history, and refactoring the QuickOpen component to support grouped results with dual item types.

## Problem Frame

MarkBun has ~58 menu actions but many lack keyboard shortcuts, forcing users to navigate the menu bar for every operation. The current Cmd+P only searches recent files. The command palette makes all operations searchable and executable from a single keyboard-driven interface. *(see origin: docs/brainstorms/2026-04-01-command-palette-requirements.md)*

## Requirements Trace

- R1. Cmd+P opens unified panel, searches files and commands
- R2. Results in two groups (files + commands) with titled sections, max 7 per group
- R3. Empty query shows recent commands + recent files
- R4-R7. Coverage: all menu actions, editor block inserts, view toggles, settings
- R8. Commands show i18n name + optional shortcut
- R9. File results match existing QuickOpen behavior
- R10. Command execution via sendMenuAction RPC through main process
- R11-R12. Command usage history with persistence
- R13-R14. Keyboard navigation: arrows, Enter, Escape, Tab between groups
- R15. Fuzzy matching against i18n display name
- R16. Hide empty group, disable Tab when only one group has results
- R17. Toggle commands show uniform label, not current state
- R18. New i18n keys for group headers and keyboard hints

## Scope Boundaries

- No multi-step command workflows (but single-step submenu actions are included)
- No custom commands or user-defined shortcuts
- No command result undo
- No context-aware command filtering (all commands always shown)
- file-export-pdf excluded (not present in menu.ts export submenu — no active filtering needed)

## Context & Research

### Relevant Code and Patterns

- **Menu definition**: `src/bun/menu.ts` — single source of truth for menu structure with `{ label, action, accelerator, submenu }` items. Recursive traversal extracts ~58 action strings
- **Action routing**: `src/bun/index.ts` — three routing paths:
  - Path A (~14 actions): `actionToEvent` map → named RPC messages
  - Path B (~5 actions): handled entirely in main process
  - Path C (~39 actions): forwarded as generic `menuAction({ action })` to renderer
- **QuickOpen**: `src/mainview/components/quick-open/QuickOpen.tsx` + `src/mainview/hooks/useQuickOpen.ts` — flat file-only list, fuzzy search, keyboard navigation
- **Recent files persistence**: `src/bun/ipc/recentFiles.ts` — JSON file at `~/.config/markbun/`, max 20 entries, dedup-on-add pattern
- **i18n split**: Main process uses `menu` namespace; renderer uses 5 namespaces (`common`, `dialog`, `settings`, `editor`, `file`) — no overlap
- **RPC client**: `src/mainview/lib/electrobun.ts` — wraps electrobun RPC, includes `sendMenuAction()` already
- **Find & Replace**: `src/mainview/components/search-bar/` — recently built, follows same hook+component pattern

### Institutional Learnings

- **WebView keyboard handling** (`docs/solutions/ui-bugs/webview-clipboard-shortcuts-input-fields-2026-04-01.md`): Global `capture: true` keyboard handler in App.tsx intercepts all Cmd combos. Must check `e.target.tagName` before dispatching to editor. Command palette input field needs same guard for Tab/Shift+Tab and Cmd shortcuts.

### External References

- None needed — all patterns established locally

## Key Technical Decisions

- **Command registry as manually maintained static array**: The i18n keys in menu.ts are embedded as `t('key')` call arguments, not extractable at build time. The registry is a manually enumerated `CommandEntry[]` in `src/shared/commandRegistry.ts`, derived by reading menu.ts and mapping each action string to its i18n key. This excludes `file-export-pdf` (not in menu.ts) and deduplicates context-menu entries. New menu items require updating both menu.ts and the registry.
- **Menu i18n namespace added to renderer**: Import `menu.json` files from `src/bun/i18n/locales/` into renderer's i18n setup. Vite handles cross-directory JSON imports natively. Commands display via `t('format.strong', { ns: 'menu' })`.
- **Discriminated union for palette items**: `type PaletteItem = { type: 'file'; path: string; name: string; isRecent: boolean } | { type: 'command'; action: string; labelKey: string; accelerator?: string }`. Shared `score` field for sorting.
- **Command dispatch via sendMenuAction RPC**: All commands go through `electrobun.sendMenuAction(action)`, routing through main process back to renderer. This reuses the entire existing dispatch path and handles all three routing classes correctly.
- **Command history mirrors recent-files pattern**: Same IPC module shape, same `~/.config/markbun/` directory, same dedup-on-add + max-entry pattern.
- **Tab navigation with group focus**: Separate `focusedGroup: 'files' | 'commands' | null` state. Default to `'files'` on open. Tab toggles between groups, resets selectedIndex. Arrow keys constrained to focused group. New query resets focus to null (search both). When focusedGroup is null, both groups form a single sequential virtual list (files[0..N] then commands[0..M]); selectedIndex spans across both, Enter dispatches based on which range the index falls in.

## Open Questions

### Resolved During Planning

- **Command inventory**: 58 unique action strings identified across 3 routing paths. Complete inventory documented in research.
- **Command history format**: `{ action: string; usedAt: number }[]` in `~/.config/markbun/command-history.json`, max 30 entries, dedup-on-add
- **Registry design**: Static data structure built from menu.ts traversal, placed in `src/shared/`. ~50 commands after excluding role-based items and file-export-pdf.
- **Renderer i18n access**: Add `menu` namespace to renderer i18n, importing from `src/bun/i18n/locales/`. Vite resolves cross-directory JSON.

### Deferred to Implementation

- **Exact i18n key path for new UI strings**: Whether to add to `file.json` (existing quickOpen keys) or create a new `commandPalette` namespace — implementer decides based on proximity to existing keys
- **Toggle command label resolution**: Whether to use existing menu keys as-is or create new "toggle" variants (e.g., `view.toggleSidebar` vs existing `view.showSidebar`) — implementer resolves by checking current menu.ts labels
- **Empty-state messaging**: Exact text for "no matching commands" vs "no matching files" — implementer chooses consistent wording with existing QuickOpen empty states

## Implementation Units

- [ ] **Unit 1: Command Registry**

**Goal:** Create a static command registry data structure extracted from menu definitions, usable by both main and renderer processes.

**Requirements:** R4-R7, R8, R17

**Dependencies:** None

**Files:**
- Create: `src/shared/commandRegistry.ts`
- Test: `tests/unit/shared/commandRegistry.test.ts`

**Approach:**
- Define `CommandEntry { action: string; i18nKey: string; accelerator?: string; category: 'file'|'edit'|'format'|'paragraph'|'table'|'view'|'help' }` type
- Build `COMMANDS: CommandEntry[]` as a static array, manually enumerated from menu.ts inventory (~50 entries, excluding role-based items like `about`, `hide`, `hideOthers`, `quit` and the broken `file-export-pdf`)
- Export a `getCommandEntries(locale: string): { action: string; label: string; accelerator?: string }[]` function that resolves i18n keys to display labels (accepts a `t` function or locale string)
- Categories map to menu top-level sections for potential future grouping

**Patterns to follow:**
- `src/shared/types.ts` for type exports
- `src/bun/menu.ts` for the authoritative action string and i18n key values

**Test scenarios:**
- Happy path: `COMMANDS` array contains expected actions (format-strong, para-heading-1, table-insert, view-toggle-sidebar, etc.)
- Happy path: each entry has non-empty action and i18nKey
- Edge case: file-export-pdf is NOT in the registry
- Edge case: role-based items (hide, hideOthers, quit) are NOT in the registry
- Edge case: duplicate actions from context menus are deduplicated

**Verification:**
- Command registry exports a typed array with ~50 entries, no duplicates, no dead actions

---

- [ ] **Unit 2: Menu i18n Namespace in Renderer**

**Goal:** Make menu translation labels available in the renderer process so command palette can display human-readable command names.

**Requirements:** R8, R15

**Dependencies:** None (parallel with Unit 1)

**Files:**
- Modify: `src/mainview/i18n/index.ts` — add `menu` namespace, import menu.json files
- Modify: `src/shared/i18n/types.ts` — add `menu` to namespace type if typed

**Approach:**
- Import each locale's `menu.json` from `src/bun/i18n/locales/{lang}/menu.json` into renderer's i18n resources
- Add `'menu'` to the `ns` array in renderer i18n init
- Verify `t('format.strong', { ns: 'menu' })` resolves correctly in renderer context

**Patterns to follow:**
- Existing namespace imports in `src/mainview/i18n/index.ts` for `common`, `dialog`, etc.
- JSON import pattern already used for other namespaces

**Test scenarios:**
- Happy path: `t('format.strong', { ns: 'menu' })` returns expected string in each locale
- Happy path: switching language updates menu namespace translations
- Edge case: missing key in one locale falls back to English

**Verification:**
- Renderer can resolve menu i18n keys for all 8 locales

---

- [ ] **Unit 3: Command History Persistence**

**Goal:** Backend RPC handlers for recording and retrieving command usage history, mirroring the recent-files pattern.

**Requirements:** R11, R12

**Dependencies:** None (parallel with Units 1-2)

**Files:**
- Create: `src/bun/ipc/commandHistory.ts`
- Modify: `src/shared/types.ts` — add `getCommandHistory` and `recordCommandUsage` to MarkBunRPC
- Modify: `src/bun/index.ts` — register new RPC handlers
- Modify: `src/mainview/lib/electrobun.ts` — add client methods
- Test: `tests/unit/bun/ipc/commandHistory.test.ts`

**Approach:**
- Create `commandHistory.ts` with functions: `getCommandHistory(): Promise<string[]>`, `recordCommandUsage(action: string): Promise<void>`
- Storage: `~/.config/markbun/command-history.json` as `{ action: string; usedAt: number }[]`
- Max 30 entries, dedup-on-add (remove existing entry for same action, prepend new)
- Follow `recentFiles.ts` patterns: `ensureConfigDir()`, read-modify-write, atomic JSON serialization
- Add RPC types to `MarkBunRPC.bun.requests` for both endpoints
- Add client methods to `electrobun.ts`

**Patterns to follow:**
- `src/bun/ipc/recentFiles.ts` — identical structure, max entries, dedup pattern
- `src/shared/types.ts` — RPC type definition pattern
- `src/mainview/lib/electrobun.ts` — client method pattern

**Test scenarios:**
- Happy path: record 3 commands, retrieve returns them in reverse chronological order
- Edge case: recording duplicate action moves it to front, does not create duplicate
- Edge case: recording when at max capacity evicts oldest entry
- Error path: corrupt/missing history file returns empty array (no crash)
- Edge case: concurrent writes handled by read-modify-write atomicity

**Verification:**
- RPC handlers respond correctly; history file created at expected path with correct format

---

- [ ] **Unit 4: Unified Palette Types and Hook**

**Goal:** Extend QuickOpen data model and hook to support both file and command items with grouped display and group-focused keyboard navigation.

**Requirements:** R1-R3, R11, R13-R16

**Dependencies:** Unit 1 (command registry), Unit 2 (menu i18n), Unit 3 (command history)

**Files:**
- Modify: `src/shared/types.ts` — add `PaletteItem` discriminated union type
- Modify: `src/mainview/hooks/useQuickOpen.ts` — major refactor for dual-type items, grouped results, Tab navigation, command history integration

**Approach:**
- Define `PaletteItem` union: `{ type: 'file'; path; name; isRecent; score? } | { type: 'command'; action; label; accelerator?; score? }`
- Refactor hook to:
  - Load commands from registry (static) + resolve labels via `t()` with menu namespace
  - Load command history via RPC on `open()`
  - Load recent files via existing RPC
  - Merge into grouped results: `files: PaletteItem[]`, `commands: PaletteItem[]`
  - Track `focusedGroup: 'files' | 'commands' | null` (default `'files'`). When null, treat both groups as a single sequential virtual list (files first, then commands). `selectedIndex` spans across both groups in this mode; Enter dispatches based on whether index falls in file or command range.
  - `selectedIndex` applies within focused group when non-null; spans virtual combined list when null
  - `confirmSelection()` dispatches differently: file items → `onSelect(path)`, command items → `onCommandSelect(action)` then `recordCommandUsage(action)` RPC
  - Tab/Shift+Tab toggles focusedGroup, resets selectedIndex to 0
  - New query input resets focusedGroup to null, searches both groups, resets selectedIndex to 0
- Fuzzy matching: reuse existing `fuzzyScore()` for both item types. Command label is the search target for commands. Apply recency score bonus from command history (+2 flat bonus to fuzzy score for commands in history).
- Return type expands to include `focusedGroup`, `files`, `commands`, `onTabGroup`, `onShiftTabGroup`
- Loading state: `open()` fires both RPC calls (quickOpen + getCommandHistory) in parallel via `Promise.all`. Set `isLoading: true` immediately, set `false` when both resolve. Commands (static, no RPC) are always available; only history and files are gated by loading.

**Patterns to follow:**
- Existing `useQuickOpen.ts` hook structure (state + returned API object)
- `fuzzyScore()` algorithm in current hook
- React `useCallback` for stable references

**Test scenarios:**
- Happy path: open() loads recent files + commands, returns grouped results
- Happy path: query "hea" matches heading commands and file "readme-header.md"
- Happy path: confirmSelection on file item calls onSelect(path)
- Happy path: confirmSelection on command item calls onCommandSelect(action) and records history
- Edge case: empty query shows recent files + recent commands
- Edge case: query matches only files → commands group hidden, Tab disabled
- Edge case: Tab switches group, resets selectedIndex to 0
- Edge case: new query text resets focusedGroup to null
- Integration: recency bonus applied to recently-used commands in search results

**Verification:**
- Hook returns correctly grouped, scored, and limited results for all query states

---

- [ ] **Unit 5: Palette UI Update**

**Goal:** Update QuickOpen component to render grouped results with file/command sections, group headers, Tab navigation hints, and command-specific styling.

**Requirements:** R2, R8-R9, R13-R14, R16, R18

**Dependencies:** Unit 4 (hook refactor)

**Files:**
- Modify: `src/mainview/components/quick-open/QuickOpen.tsx` — grouped rendering, group headers, Tab handling, command item styling
- Modify: `src/mainview/i18n/locales/*/file.json` (8 files) — add group header keys and Tab hint keys
- Modify: `src/mainview/App.tsx` — wire onCommandSelect callback

**Approach:**
- Add group header rows ("Files" / "Commands") as non-selectable dividers, styled as muted section labels
- Command items render: label text + optional accelerator badge (right-aligned, muted)
- File items render: existing pattern (icon + name + path + recent badge)
- Update `max-h` to accommodate up to 14 items + 2 headers (increase from 400px)
- **selectedIndex-to-DOM mapping**: Replace positional `listRef.children[selectedIndex]` with `data-palette-index` attributes on selectable items (not headers). Scroll-into-view queries `[data-palette-index="${selectedIndex}"]`. This decouples DOM structure from selection logic.
- Update keyboard handler: Tab/Shift+Tab calls hook's onTabGroup/onShiftTabGroup
- Update footer: show `Tab` hint alongside existing navigation hints
- Update placeholder text to "Search files and commands..."
- On command selection: call `electrobun.sendMenuAction(action)` then close palette
- On file selection: existing `onSelect(path)` behavior
- Add i18n keys for group headers, updated placeholder, Tab hint across 8 locales

**Patterns to follow:**
- Existing `QuickOpen.tsx` component structure (controlled props, modal overlay)
- Existing `QuickOpenItem` inline component for item rendering
- `src/mainview/i18n/locales/en/file.json` quickOpen.* key pattern

**Test scenarios:**
- Happy path: both groups render with headers, files above commands
- Happy path: selecting a command closes palette and dispatches action via sendMenuAction
- Happy path: Tab switches visual focus (highlight) between groups
- Edge case: only files group visible → commands header hidden, no Tab hint
- Edge case: arrow keys stay within focused group
- Edge case: Enter on group header does nothing (not selectable)

**Verification:**
- Palette renders grouped results, Tab navigation works, command execution dispatches correctly

---

- [ ] **Unit 6: Integration and Keyboard Handling**

**Goal:** Wire the unified palette into the existing Cmd+P flow and ensure the global keyboard handler doesn't interfere with palette input.

**Requirements:** R1, R10, R13

**Dependencies:** Unit 5

**Files:**
- Modify: `src/mainview/App.tsx` — update Cmd+P handler, add global keyboard guard for palette input, wire onCommandSelect to sendMenuAction

**Approach:**
- Update Cmd+P handler in `handleKeyDown`: add `if (quickOpen.isOpen) { quickOpen.close(); } else { quickOpen.open(); }` toggle logic (existing code only calls `open()`, causing re-open race)
- Add early return guard at top of the global capture handler's Cmd+switch block: `if (quickOpen.isOpen && key !== 'p') return;` — this prevents Cmd+B/I/F/H/S etc from dispatching to editor while palette is open. Only Cmd+P passes through for toggle.
- Add `onCommandSelect` callback: calls `electrobun.sendMenuAction(action)` and records command usage via RPC
- Verify Cmd+P toggle behavior (close if already open)

**Patterns to follow:**
- `docs/solutions/ui-bugs/webview-clipboard-shortcuts-input-fields-2026-04-01.md` — INPUT/TEXTAREA guard pattern in global keyboard handler
- Existing Cmd+P handler in App.tsx

**Test scenarios:**
- Happy path: Cmd+P opens palette with recent files + commands
- Happy path: Cmd+P while palette is open closes it
- Integration: typing in palette search does not trigger editor shortcuts (e.g., Cmd+B while focused on search)
- Integration: Tab in palette switches groups, does not move focus out of palette
- Integration: executing "format-strong" command applies bold to selected editor text
- Integration: executing "file-new" command triggers new file dialog

**Verification:**
- Cmd+P opens unified palette; command execution works for all routing paths; no keyboard conflicts

## System-Wide Impact

- **Interaction graph:** Cmd+P handler in App.tsx, global keyboard handler (capture phase), menuAction event listener, sendMenuAction RPC
- **Error propagation:** Command execution failures propagate through existing menu action handlers (silent no-op for unavailable commands, per scope boundary)
- **State lifecycle risks:** Command history write on every command execution — use debounced or async write to avoid blocking UI. History file corruption handled by returning empty array.
- **API surface parity:** The command palette dispatches through the same `sendMenuAction` RPC that Windows AppMenuBar uses — no new dispatch path introduced
- **Integration coverage:** End-to-end test needed: Cmd+P → type query → select command → verify action dispatched → verify history recorded
- **Unchanged invariants:** Existing QuickOpen file search behavior is preserved. The `quickOpen` RPC still returns file items. File selection callback unchanged. Menu action dispatch path unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Global keyboard handler intercepts Cmd combos while palette input focused | Guard in capture handler: check palette open state before dispatching to editor (proven pattern from clipboard solution) |
| Command registry becomes stale when new menu items added | Registry is in `src/shared/` — new menu items require updating both menu.ts AND the registry, which is already an improvement over the current 4-location scattering. Document in code comments. |
| i18n menu namespace import path fragile across build configs | Vite JSON imports are stable; test in both dev and production builds |
| Tab key conflicts with browser focus behavior | Capture Tab in palette's onKeyDown with `e.preventDefault()` and `e.stopPropagation()` |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-01-command-palette-requirements.md](docs/brainstorms/2026-04-01-command-palette-requirements.md)
- Related plan: `docs/plans/2026-03-31-001-feat-find-replace-plan.md` — parallel feature, shares keyboard handler and menu action patterns
- Related learning: `docs/solutions/ui-bugs/webview-clipboard-shortcuts-input-fields-2026-04-01.md`
- Key code: `src/bun/menu.ts` (menu definition), `src/mainview/hooks/useQuickOpen.ts` (hook to refactor), `src/bun/ipc/recentFiles.ts` (persistence pattern to mirror)
