---
title: "feat: Add AI Support (v0.6.0)"
type: feat
status: active
date: 2026-04-03
origin: docs/brainstorms/2026-04-02-v0.6-ai-requirements.md
---

# feat: Add AI Support (v0.6.0)

## Overview

Add AI as an intelligent editing assistant to MarkBun. Users configure a provider/model in settings, then interact with AI via a right-side Chat Panel or selection-aware right-click actions. AI reads and modifies documents through tool calls. All LLM communication flows through the Bun main process; the WebView only receives rendering events.

## Problem Frame

MarkBun v0.5.0 is a fully functional desktop Markdown editor but lacks AI-assisted writing. v0.6.0 integrates AI as a smart editing partner that can read documents, understand context, and directly manipulate content (rewrite, insert, replace) — not merely act as a sidebar chatbot. Target users: Chinese/English writers using MarkBun for technical docs, blog posts, and academic writing.

## Requirements Trace

- R1–R6: AI Settings and Configuration
- R7–R10: Streaming RPC Bridge
- R11–R18: AI Chat Panel (Right Sidebar)
- R19–R23a: AI Tool Calls (Editor Integration)
- R24–R28: Selection-Aware AI Actions
- R29–R30: i18n-Aware AI Prompts

## Scope Boundaries

- **Excludes** inline diff preview (red/green accept/reject UI)
- **Excludes** multi-provider routing or load balancing
- **Excludes** cost dashboard or token usage statistics panel
- **Excludes** multi-file agent (reading workspace files autonomously)
- **Excludes** semantic search
- **Excludes** standalone AI proofreading mode (inline annotations)
- **Excludes** ghost-text inline completion (Copilot-style)
- **Excludes** mobile support

## Context & Research

### Relevant Code and Patterns

- **RPC pattern**: `src/shared/types.ts` defines `MarkBunRPC` type → `src/bun/index.ts` registers handlers via `BrowserView.defineRPC<MarkBunRPC>()` → `src/mainview/lib/electrobun.ts` wraps client calls
- **Settings pattern**: Zod schema in `src/shared/settings/schema.ts` → flat `AppSettings` in `types.ts` → manual mapping in `index.ts` getSettings/saveSettings handlers → `SettingsDialog.tsx` renders tabs
- **Messages channel**: `MarkBunRPC.bun.messages` supports one-way Bun→WebView push; WebView subscribes via `electrobun.on('event', callback)` with `__electrobunListeners` pattern
- **Bun→WebView JS execution**: `webview.evaluateJavascriptWithResponse()` executes JS in WebView and returns result — for tool calls
- **Context menus**: `ContextMenu.showContextMenu()` in Bun process, actions dispatched as `menuAction` message to WebView
- **Backup service**: `src/bun/services/backup.ts` — `getPathHash()` for SHA1 file path hashing, `CONFIG_DIR = ~/.config/markbun`
- **Editor ref**: `MilkdownEditorRef` in `src/mainview/components/editor/types.ts` — `getMarkdown()`, `getSelectedMarkdown()`, `insertText()` already exist
- **Text commands**: `src/mainview/components/editor/commands/text.ts` — `insertText()` with ProseMirror transactions, Markdown parsing
- **i18n**: Dual-layer — Bun uses `i18next` (menu namespace, 8 locale JSONs in `src/bun/i18n/locales/`), WebView uses `react-i18next` (5 namespaces: common, dialog, editor, file, settings)

### External References

- **pi-ai SDK** (`@mariozechner/pi-ai` v0.64.0): Unified multi-provider LLM API. `getModel()` + `stream()` pattern, TypeBox tool schemas, JSON-serializable `Context` objects, Bun-compatible. OpenAI-compatible providers via custom `Model` objects with `api: 'openai-completions'`.
- Key streaming events: `text_delta`, `toolcall_start`, `toolcall_delta`, `toolcall_end`, `done`, `error`
- Tool results pushed as `role: 'toolResult'` messages into Context
- API key resolution: explicit option > env var > OAuth

## Key Technical Decisions

- **pi-ai as LLM abstraction layer**: Unified API across 22+ providers, JSON-serializable Context, TypeBox schemas. Avoids per-provider SDK integration. Bun-compatible (confirmed via research).
- **Bun main process as LLM proxy**: API keys never reach WebView. All LLM calls in Bun process, streaming events pushed via RPC messages. WebView is rendering-only.
- **evaluateJavascriptWithResponse for tool calls**: Bun→WebView JS execution for `readDocument`, `readSelection`, `insertAtCursor`, `replaceSelection`. Avoids extending `webview.requests` RPC schema.
- **按需读取文档上下文**: System prompt only contains file path, not content. AI reads documents via `readDocument` tool when needed. Saves context window space and lets AI control read strategy.
- **Buffered streaming (50ms / 3 tokens)**: Avoids RPC message channel saturation during high-frequency token streaming.
- **Global single session with file-path context**: One active conversation, current file path in system prompt. File switches update path but keep conversation history.
- **Direct replacement + Undo**: AI modifications applied as single ProseMirror transactions, user-safe via Ctrl+Z. No preview-then-apply UI.

## Open Questions

### Resolved During Planning

- **pi-ai Bun compatibility**: Confirmed via research — pi-ai binary itself is Bun-compiled, multiple projects run pi-ai under Bun.
- **Electrobun RPC throughput**: Adopt 50ms buffered batching approach; tune parameters during implementation based on real-world testing.

### Deferred to Implementation

- [Affects R7-R9] RPC message buffer tuning parameters (batch interval, token threshold) — tune during integration testing
- [Affects R16-R18] Session file structure (single file vs per-conversation) and Context size management strategy
- [Affects R1-R3] pi-ai per-provider API key injection details (explicit `apiKey` option in `stream()` call)
- [Affects R22] `replaceSelection` implementation details in ProseMirror (parsing markdown, capturing selection, transaction replacement)

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Data Flow: Chat Interaction

```
WebView (React)                          Bun Main Process
┌─────────────────┐                     ┌──────────────────────┐
│ ChatPanel        │                     │                      │
│  Input → send()  │─── aiChat RPC ────▶│  Build Context       │
│                  │                     │  + system prompt     │
│                  │                     │  + file path         │
│                  │                     │  + conversation      │
│                  │                     │  ↓                   │
│                  │                     │  pi-ai stream()      │
│                  │                     │  ↓                   │
│  text_delta      │◀── RPC message ────│  Buffer (50ms/3tok)  │
│  toolcall_start  │◀── RPC message ────│  Buffer              │
│  toolcall_end    │◀── RPC message ────│                      │
│                  │                     │  Tool execution:     │
│                  │◀── evalJS ─────────│  readDocument()      │
│                  │─── evalJS resp ────▶│  readSelection()     │
│                  │                     │  insertAtCursor()    │
│                  │                     │  replaceSelection()  │
│  done            │◀── RPC message ────│                      │
└─────────────────┘                     └──────────────────────┘
```

### AI Tool Call Execution Pattern

```
AI requests toolcall → Bun process receives toolcall_end event
  → Bun constructs JS string (e.g., `window.__markbunAI.readDocument()`)
  → Bun calls webview.evaluateJavascriptWithResponse(jsString)
  → WebView executes, returns document content / selection / success
  → Bun pushes result into Context as toolResult message
  → Bun continues stream() loop (AI may call more tools or produce text)
```

### Provider Model

```
User selects "DeepSeek" in Settings
  → Stored as: { provider: 'deepseek', model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/v1' }
  → Bun constructs: Model<'openai-completions'> object with api, provider, baseUrl
  → stream(customModel, context, { apiKey: keyFromFile })
```

## Implementation Units

- [ ] **Unit 1: AI Settings Schema and Service**

**Goal:** Add AI configuration to the Zod settings schema, create API key storage service, and update RPC types.

**Requirements:** R1, R3, R6

**Dependencies:** None

**Files:**
- Modify: `src/shared/settings/schema.ts`
- Modify: `src/shared/types.ts`
- Create: `src/bun/services/ai-keys.ts`
- Test: `tests/unit/bun/services/ai-keys.test.ts`

**Approach:**
- Add `ai` section to Zod schema with `enabled`, `provider`, `model`, `baseUrl`, `localOnly` fields
- Extend `AppSettings` type with flat AI fields
- Create `ai-keys.ts` service: read/write `~/.config/markbun/ai-keys.json` with 0600 permissions, mask keys for RPC responses
- Update `MarkBunRPC.bun.requests` with AI-related RPC endpoints (getAISettings, saveAISettings, testAIConnection, getAIKeyMasked)
- Update `index.ts` Settings↔AppSettings mapping to include AI fields
- Update `mergeWithDefaults` in `settings.ts` for `ai` section

**Patterns to follow:**
- `src/bun/services/backup.ts` — service pattern with CONFIG_DIR
- `src/bun/services/settings.ts` — Zod validation and file I/O
- Existing `MarkBunRPC` type extension pattern in `types.ts`

**Test scenarios:**
- Happy path: save and load AI keys, verify file permissions (0600)
- Happy path: get masked key returns `sk-...xxxx` format
- Edge case: key file doesn't exist — returns null
- Edge case: malformed JSON in key file — graceful fallback
- Error path: directory creation failure — returns error
- Integration: AI settings included in `mergeWithDefaults` output

**Verification:**
- AI settings round-trip through Zod schema validation
- API key file has correct permissions
- `getSettings` RPC returns AI settings without API key values

---

- [ ] **Unit 2: AI Settings UI Tab**

**Goal:** Add "AI" tab to SettingsDialog with provider/model selection, API key input, and test connection button.

**Requirements:** R2, R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `src/mainview/components/settings/SettingsDialog.tsx`
- Modify: `src/mainview/lib/electrobun.ts` — add AI settings RPC client methods
- Create: `src/mainview/i18n/locales/en/settings.json` — add AI settings keys (and all 8 locales)

**Approach:**
- Add 6th "AI" tab to SettingsDialog with provider dropdown, model dropdown, API key password input, base URL override, local-only toggle, test connection button
- Provider presets organized in two groups: International (Ollama/Anthropic/OpenAI/Google/OpenRouter) and Domestic (DeepSeek/Kimi/GLM/Qwen/MiniMax/Doubao) + Custom option
- Model dropdown populated based on selected provider (hardcoded model lists per provider)
- When `localOnly=true`: filter to Ollama only, hide API key field
- Test Connection: calls Bun RPC → Bun creates a minimal pi-ai request → returns success/failure with latency
- Update `electrobun.ts` with `testAIConnection()`, `getAISettings()`, `saveAISettings()` methods

**Patterns to follow:**
- Existing `SettingsDialog.tsx` tab pattern (tab definitions array, form state, handleChange callback)
- `useTranslation('settings')` for i18n

**Test scenarios:**
- Happy path: provider dropdown shows both international and domestic groups
- Happy path: selecting Ollama auto-fills base URL and hides API key
- Happy path: Test Connection button shows success/failure feedback
- Edge case: custom provider shows base URL input field
- Edge case: `localOnly` toggle filters provider list and hides API key

**Verification:**
- AI tab renders correctly with all form fields
- Provider/model selection updates form state
- Test Connection triggers RPC and displays result

---

- [ ] **Unit 3: Streaming RPC Bridge**

**Goal:** Build the message-based streaming channel from Bun to WebView for AI events, with buffered batching.

**Requirements:** R7, R8, R9, R10

**Dependencies:** Unit 1

**Files:**
- Modify: `src/shared/types.ts` — add streaming message types
- Modify: `src/mainview/lib/electrobun.ts` — add streaming event listeners and abort RPC
- Create: `src/bun/services/ai-stream.ts` — buffering and stream management
- Test: `tests/unit/bun/services/ai-stream.test.ts`

**Approach:**
- Add streaming message types to `MarkBunRPC.bun.messages`: `aiStreamEvent` with typed payload (`text_delta`, `toolcall_start`, `toolcall_delta`, `toolcall_end`, `done`, `error`)
- Create `ai-stream.ts` service: wraps pi-ai `AssistantMessageEventStream`, buffers events (50ms interval or 3 tokens), pushes buffered messages via `webview.rpc.send.aiStreamEvent()`
- Add `aiChat` RPC request: WebView sends message + context, Bun creates/reuses pi-ai Context, calls `stream()`, pipes through buffer
- Add `aiAbort` RPC request: Bun calls `AbortController.abort()`, keeps partial text
- WebView side: register `aiStreamEvent` message handler in `electrobun.ts`, expose `on('ai-stream-event', callback)` subscription
- Error handling: `error` events mark partial text as truncated with inline error + retry button

**Patterns to follow:**
- `MarkBunRPC.bun.messages` extension pattern (add new message types)
- `electrobun.on()` listener pattern with `__electrobunListeners`

**Test scenarios:**
- Happy path: buffer accumulates 3 text_delta events, sends single batch
- Happy path: buffer sends after 50ms even with 1 event
- Happy path: done event includes token usage data
- Edge case: abort during streaming — partial text preserved
- Error path: provider error — error event with retry flag
- Error path: tool call error — error fed back to AI (not silently dropped)

**Verification:**
- Streaming events arrive in WebView in order
- Buffer reduces message frequency by ≥3x
- Abort preserves already-rendered text
- Error events display with inline error UI

---

- [ ] **Unit 4: AI Chat Panel (Right Sidebar)**

**Goal:** Build the right-side AI Chat Panel with conversation UI, message rendering, input area, and session management.

**Requirements:** R11, R12, R13, R14, R15, R16, R17, R18

**Dependencies:** Unit 2, Unit 3

**Files:**
- Create: `src/mainview/components/ai-chat/AIChatPanel.tsx`
- Create: `src/mainview/components/ai-chat/ChatMessageList.tsx`
- Create: `src/mainview/components/ai-chat/ChatInput.tsx`
- Create: `src/mainview/components/ai-chat/SessionHeader.tsx`
- Create: `src/mainview/components/ai-chat/AISetupGuide.tsx`
- Create: `src/mainview/hooks/useAIChat.ts`
- Create: `src/mainview/hooks/useAISession.ts`
- Modify: `src/mainview/App.tsx` — integrate AI panel layout
- Modify: `src/shared/types.ts` — add UIState fields for AI panel
- Modify: `src/bun/menu.ts` — add "Toggle AI Panel" to View menu
- Modify: `src/bun/index.ts` — add session persistence RPCs
- Create: `src/bun/services/ai-sessions.ts` — session file management
- Create: `src/mainview/i18n/locales/en/ai.json` — AI panel i18n (+ all 8 locales)
- Create: `src/bun/i18n/locales/en/menu.json` — AI menu items (+ all 8 locales)

**Approach:**
- AIChatPanel as independent right-side container, resizable (280–600px), default hidden
- App.tsx layout: 3-column flex (left sidebar | editor | right AI panel), editor min 50% width
- Panel visibility and width stored in UIState
- useAIChat hook: manages messages state, streaming accumulation, send/abort actions
- useAISession hook: session CRUD (create, list, load, reset), auto-save to `~/.config/markbun/ai-sessions/`
- Session data: pi-ai Context objects serialized as JSON, one file per session
- Session persistence service: `getPathHash(filePath)` for directory naming, store in `~/.config/markbun/ai-sessions/<hash>/`
- System prompt: only contains current file path + language info, AI reads content via readDocument tool
- ChatMessageList: renders messages with Markdown support (reuse existing markdown rendering or lightweight renderer)
- AISetupGuide: shown when AI not configured, guides user to settings
- First-time cloud notice: when using a non-local provider for the first time, show one-time dialog explaining that document content will be sent to the cloud service. Store dismissal flag in `~/.config/markbun/ai-settings.json`. Not shown for Ollama/local providers.
- View menu: "Toggle AI Panel" with Cmd+Shift+A shortcut
- On file switch: update system prompt file path, keep conversation history

**Patterns to follow:**
- `src/mainview/hooks/useSidebar.ts` — panel state management
- `src/mainview/components/settings/SettingsDialog.tsx` — dialog/tab pattern
- `src/bun/services/backup.ts` — `getPathHash()` for file-based storage
- UIState persistence pattern via `saveUIState` RPC

**Test scenarios:**
- Happy path: panel opens/closes via menu and keyboard shortcut
- Happy path: user sends message, streaming text appears incrementally
- Happy path: switch files — system prompt updates file path, conversation continues
- Happy path: reset session clears messages, creates new Context
- Edge case: panel width resize respects 280–600px bounds
- Edge case: both sidebars open — editor retains ≥50% width
- Edge case: AI not configured — shows setup guide instead of chat
- Integration: session auto-saves on each message, restores on app restart

**Verification:**
- Chat panel works as independent right sidebar
- Streaming text renders in real-time
- Session persists across app restarts
- File switches update context without losing conversation

---

- [ ] **Unit 5: AI Tool Calls (Editor Integration)**

**Goal:** Implement the 4 tool calls that let AI read and modify the document: readDocument, readSelection, insertAtCursor, replaceSelection.

**Requirements:** R19, R20, R21, R22, R23, R23a

**Dependencies:** Unit 3, Unit 4

**Files:**
- Create: `src/bun/services/ai-tools.ts` — tool definitions and execution bridge
- Modify: `src/mainview/components/editor/types.ts` — add `replaceSelection` to MilkdownEditorRef
- Create: `src/mainview/components/editor/commands/selection.ts` — replaceSelection implementation
- Modify: `src/mainview/components/editor/commands/index.ts` — export replaceSelection
- Modify: `src/bun/services/ai-stream.ts` — integrate tool execution into stream loop
- Test: `tests/unit/bun/services/ai-tools.test.ts`

**Approach:**
- Define 4 tools using pi-ai TypeBox schemas: `readDocument`, `readSelection`, `insertAtCursor`, `replaceSelection`
- Tool execution in Bun process: when `toolcall_end` event arrives, construct JS string and call `webview.evaluateJavascriptWithResponse()`
- `readDocument`: calls `window.__markbunAI.readDocument()` which returns `editorRef.getMarkdown()`
- `readSelection`: calls `window.__markbunAI.readSelection()` which returns `editorRef.getSelectedMarkdown()`
- `insertAtCursor`: calls `window.__markbunAI.insertAtCursor(text)` which calls `editorRef.insertText(text)`
- `replaceSelection`: needs new `replaceSelection` method on MilkdownEditorRef — captures selection, parses markdown to ProseMirror nodes, replaces selection via transaction
- WebView side: expose `window.__markbunAI` object with the 4 methods during AI panel initialization
- Tool results: push into pi-ai Context as `toolResult` messages, continue stream loop
- Tool call display: ChatMessageList renders tool calls as collapsible blocks with tool name + status icon
- Error feedback: tool call failures must be returned to AI as `isError: true` toolResult (R23a)

**Patterns to follow:**
- `src/mainview/components/editor/commands/text.ts` — ProseMirror transaction pattern with markdown parsing
- `src/mainview/components/editor/types.ts` — editor ref method pattern
- pi-ai TypeBox schema pattern for tool definitions

**Test scenarios:**
- Happy path: readDocument returns full markdown content
- Happy path: readSelection returns selected text
- Happy path: insertAtCursor inserts content at cursor, supports Undo
- Happy path: replaceSelection replaces selected text with new content, supports Undo
- Edge case: readSelection with no selection returns null
- Edge case: replaceSelection on changed document (selection text mismatch) — returns error
- Error path: editor not ready — tool call returns error message
- Integration: AI calls readDocument, receives content, generates response — full tool loop

**Verification:**
- All 4 tools work via evaluateJavascriptWithResponse
- Tool results appear in Chat Panel as collapsible blocks
- AI can chain multiple tool calls in sequence
- Error feedback maintains conversation state

---

- [ ] **Unit 6: Selection-Aware AI Actions**

**Goal:** Add right-click AI actions for selected text: Improve Writing, Make Concise, Explain, Translate.

**Requirements:** R24, R25, R26, R27, R28

**Dependencies:** Unit 4, Unit 5

**Files:**
- Modify: `src/bun/index.ts` — extend showDefaultContextMenu with AI submenu
- Modify: `src/bun/i18n/locales/*/menu.json` — add AI action labels (8 locales)
- Create: `src/mainview/hooks/useAIActions.ts` — selection action handler
- Modify: `src/mainview/App.tsx` — wire AI actions to menu events
- Create: `src/mainview/components/ai-chat/AILoadingIndicator.tsx` — inline loading state

**Approach:**
- Extend `showDefaultContextMenu` in `index.ts`: when text is selected, add AI submenu with 4 actions
- AI submenu only shown when AI is enabled and configured (checked via settings state)
- Actions are sent as menuAction messages to WebView, handled in `useAIActions` hook
- `useAIActions` hook: captures selection text + action type, sends to Bun via RPC
- Bun process: creates a single-turn Context with selection + action instruction, calls `stream()`
- AI result: streamed to Chat Panel AND applied as direct selection replacement
- Before replacement: call `createVersionBackup()` as safety checkpoint
- Selection validation: compare stored selection text with current ProseMirror position text; if changed, show "document modified, reselect" error
- Replacement: single ProseMirror transaction (Ctrl+Z undoes entire change)
- StatusBar: show "AI processing..." during operation
- Selection inline: subtle highlight animation on selection during AI processing

**Patterns to follow:**
- Existing context menu extension pattern in `showDefaultContextMenu`
- `createVersionBackup()` call from `backup.ts` — same pattern used in `saveFile`
- ProseMirror transaction pattern from `text.ts`

**Test scenarios:**
- Happy path: select text → right-click → "Improve Writing" → text replaced, Ctrl+Z works
- Happy path: "Translate" auto-detects language (Chinese→English, English→Chinese)
- Edge case: AI action triggered but AI not configured — menu items grayed out
- Edge case: document changed between selection and AI response — error message shown
- Edge case: selection cleared before AI responds — graceful fallback
- Integration: version backup created before each AI replacement

**Verification:**
- Right-click AI submenu appears when text is selected and AI is configured
- AI actions replace selection content with Ctrl+Z support
- Version backup created before each AI modification
- Chat Panel shows what AI did

---

- [ ] **Unit 7: i18n-Aware AI Prompts**

**Goal:** Ensure AI responses match document language and all AI UI is localized.

**Requirements:** R29, R30

**Dependencies:** Unit 4, Unit 6

**Files:**
- Modify: `src/bun/services/ai-stream.ts` — inject language info into system prompt
- Modify: `src/mainview/i18n/locales/*/ai.json` — localize AI action prompts (8 locales)
- Modify: `src/mainview/i18n/locales/*/settings.json` — localize AI settings labels (8 locales)
- Modify: `src/bun/i18n/locales/*/menu.json` — localize AI menu items (8 locales)

**Approach:**
- System prompt includes document language instruction based on i18n setting or content detection (Chinese characters detection)
- Language instruction: "Respond in [language]" for Chat Panel and "Improve Writing"/"Make Concise"/"Explain" actions
- "Translate" action has separate language logic: detect source language, translate to opposite (zh→en, en→zh, other→zh)
- All 4 AI action instruction templates stored in i18n locale files
- AI settings tab labels localized in all 8 locales

**Patterns to follow:**
- Existing i18n pattern: keys in locale JSON files, `useTranslation()` hook

**Test scenarios:**
- Happy path: Chinese document → AI responds in Chinese
- Happy path: English document → AI responds in English
- Happy path: "Translate" on Chinese text produces English output
- Happy path: "Translate" on English text produces Chinese output
- Edge case: mixed-language document — uses i18n setting as tiebreaker

**Verification:**
- AI responses consistently match document language
- All AI UI elements display in current locale language
- Translate action auto-detects and reverses language

## System-Wide Impact

- **Interaction graph:** AI streaming events use existing `messages` channel. Tool calls use `evaluateJavascriptWithResponse`. Menu actions use existing `menuAction` message flow. Settings use existing getSettings/saveSettings RPC pattern.
- **Error propagation:** Provider errors → streaming `error` event → Chat Panel inline error + retry. Tool call failures → toolResult with `isError: true` → AI adapts. File I/O errors → standard `{ success: false, error }` RPC responses.
- **State lifecycle risks:** Session auto-save must debounce to avoid write amplification. Streaming state must clean up on abort (AbortController). Editor document snapshot cache must invalidate on edits.
- **API surface parity:** All AI features must respect the existing chromeless design philosophy — AI panel hidden by default, zero impact when not in use.
- **Integration coverage:** End-to-end test: configure provider → open chat panel → send message → AI reads document via tool → AI modifies document → user undoes → all works.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Electrobun RPC message throughput insufficient for streaming | Buffered batching (50ms/3 tokens); fallback to longer intervals if needed |
| pi-ai Context serialization breaks across versions | Graceful deserialization — start fresh session on failure (R18) |
| `evaluateJavascriptWithResponse` latency for tool calls | Bun-side document snapshot cache (debounced after edits) reduces readDocument RPC round-trips |
| Large documents exhaust context window | AI controls read strategy; system prompt only has file path, not content |
| Chinese AI providers' OpenAI compatibility varies | pi-ai `compat` field handles per-provider differences (maxTokensField, supportsDeveloperRole, etc.) |
| Session storage grows unbounded | Session file pruning strategy; old sessions archived or cleaned up |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-02-v0.6-ai-requirements.md](docs/brainstorms/2026-04-02-v0.6-ai-requirements.md)
- **pi-ai SDK:** [GitHub: badlogic/pi-mono](https://github.com/badlogic/pi-mono), [npm: @mariozechner/pi-ai](https://www.npmjs.com/package/@mariozechner/pi-ai)
- **Editor commands:** `src/mainview/components/editor/commands/text.ts`
- **RPC pattern:** `src/shared/types.ts`, `src/bun/index.ts`, `src/mainview/lib/electrobun.ts`
- **Backup service:** `src/bun/services/backup.ts`
