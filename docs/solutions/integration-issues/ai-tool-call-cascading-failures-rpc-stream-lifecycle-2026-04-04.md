---
title: "Cascading Failures in AI Tool Call Execution — RPC Bridge, Stream Lifecycle, and Event Protocol"
date: 2026-04-04
category: integration-issues
module: ai-streaming
problem_type: integration_issue
component: assistant
severity: critical
symptoms:
  - "evaluateJavascriptWithResponse is not a function — Electrobun webview has no synchronous JS eval with return value"
  - "AI tool call loop terminates after first tool execution — session destroyed by try/finally before model can respond to tool result"
  - "Intermediate done event (reason=toolUse) resets frontend sessionId/assistantId refs, all subsequent events dropped"
  - "Tool results appear at end of message list instead of between pre-tool and post-tool assistant text"
  - "AI stuck in retry loops — no tool for replacing arbitrary document text without user selection"
root_cause: wrong_api
resolution_type: code_fix
related_components:
  - frontend_stimulus
  - background_job
tags:
  - ai-tool-calls
  - electrobun-rpc
  - streaming-lifecycle
  - event-protocol
  - pi-ai
  - webview-bridge
  - message-ordering
---

# Cascading Failures in AI Tool Call Execution — RPC Bridge, Stream Lifecycle, and Event Protocol

## Problem

During v0.6.0 AI feature implementation, five cascading failures prevented the "AI calls tool, gets result, continues response" loop from working. The failures spanned Electrobun's RPC architecture, async control flow, event streaming protocol, message rendering, and missing editor tools. Each failure blocked the next step in the tool call lifecycle.

## Symptoms

- `fw.win.webview.evaluateJavascriptWithResponse is not a function` — the API does not exist in Electrobun
- AI tool call causes session destruction mid-loop — `buffer.dispose()` and `cleanupSession()` run before second model response
- After tool call completes, all subsequent SSE events silently dropped — frontend refs reset to null
- Tool results rendered at the end of combined assistant text, not interleaved between pre/post-tool text
- AI enters infinite loops trying to modify documents — only `replaceSelection` (needs selection) and `insertAtCursor` available

## What Didn't Work

### 1. `evaluateJavascriptWithResponse` assumed to exist

Hoped it would be available at runtime despite TypeScript errors. Electrobun only provides `evaluateJavascriptWithNoCompletion` (fire-and-forget, no return value). A quick `grep` in `node_modules/electrobun/dist/api/` for `evaluateJavascript` would have revealed only the `NoCompletion` variant.

### 2. `continue` in for-await inside try/finally

Using `continue` in the inner for-await loop to skip cleanup — `continue` only advances to the next iteration. When the for-await naturally ends, `finally` always executes, destroying session and buffer before the outer while loop re-iterates.

### 3. Frontend checking `reason` field on `done` events

Would require the frontend to understand the streaming protocol's internal state machine (intermediate vs terminal `done`), creating tight coupling. Filtering at the source is cleaner.

### 4. Single assistant message accumulating all text

One message object accumulating text across tool call boundaries cannot represent the interleaved structure `[text, tool, text]`. Tool result appears after all accumulated text regardless of when the tool was called.

### 5. `replaceSelection` for document modifications

Requires user to have text selected first — AI cannot control selection. `insertAtCursor` only inserts at cursor position. Neither supports find-and-replace.

## Solution

### Fix 1: Use Electrobun's WebView RPC request pattern

Electrobun supports bidirectional RPC. The Bun→WebView direction uses `webview.requests` handlers.

**`src/shared/types.ts`** — add to `webview.requests`:
```typescript
executeAITool: {
  params: { tool: string; args?: string };
  response: { success: boolean; result?: string; error?: string };
};
```

**`src/mainview/lib/electrobun.ts`** — register handler:
```typescript
requests: {
  executeAITool: ({ tool, args }) => {
    const aiTools = (window as any).__markbunAI;
    if (!aiTools?.[tool]) return { success: false, error: `Tool not found: ${tool}` };
    const result = aiTools[tool](args ? JSON.parse(args) : undefined);
    return { success: true, result: typeof result === 'string' ? result : JSON.stringify(result) };
  },
},
```

**Call from Bun** via `fw.win.webview.rpc.request.executeAITool({ tool, args })`.

### Fix 2: Flag-based cleanup instead of try/finally

```typescript
let shouldContinueToolLoop = false;

try {
  for await (const event of eventStream) {
    if (event.type === 'done' && event.reason === 'toolUse') {
      shouldContinueToolLoop = true;
      break; // exit for-await but NOT the outer while loop
    }
  }
} catch (err) { /* error handling */ }

// Only cleanup if NOT continuing
if (!shouldContinueToolLoop) {
  buffer.dispose();
  cleanupSession(sessionId);
}
```

### Fix 3: Filter intermediate done events at the source

In the SSE event transformer (`ai-stream.ts`), return `null` for `done` events with `reason=toolUse`:
```typescript
case 'done':
  if (event.reason === 'toolUse') {
    return null; // Don't forward to frontend
  }
  return { sessionId, type: 'done', data: { reason: event.reason, usage: event.message.usage } };
```

### Fix 4: Create new assistant message after tool completion

In `toolcall_end` handler, finalize current assistant message, append tool result, create new assistant message:
```typescript
case 'toolcall_end': {
  const newAssistantId = generateId();
  setMessages(prev => [
    ...prev.map(msg => msg.id === assistantId ? { ...msg, isStreaming: false } : msg),
    { id: generateId(), role: 'tool', content: toolResult, toolName, timestamp: Date.now() },
    { id: newAssistantId, role: 'assistant', content: '', timestamp: Date.now(), isStreaming: true },
  ]);
  currentAssistantIdRef.current = newAssistantId;
  break;
}
```

### Fix 5: Add `replaceInDocument` tool

```typescript
replaceInDocument: (args: { oldText: string; newText: string }) => {
  const content = editor.getMarkdown();
  if (!content.includes(args.oldText)) {
    return { error: `Text not found: "${args.oldText.substring(0, 50)}"` };
  }
  const newContent = content.split(args.oldText).join(args.newText);
  const replacements = content.split(args.oldText).length - 1;
  editor.setMarkdown(newContent);
  return { success: true, replacements };
},
```

Using `split/join` instead of `replaceAll` avoids regex metacharacter issues (`$1`, `*`, etc.).

## Why This Works

The five failures formed a dependency chain — each fix was prerequisite for the next:

1. **RPC architecture** — Electrobun's `webview.requests` is the canonical way for Bun→WebView request/response. Not `evaluateJavascript`.

2. **Control flow** — JavaScript `finally` is unconditional by design. A flag variable is the standard pattern for conditionally skipping cleanup when outer control flow still needs the resources.

3. **Event filtering** — The pi-ai protocol emits intermediate lifecycle events (`done` with `reason=toolUse`) meaningful only to the backend's tool loop. Filtering at the source keeps protocol details out of consumer code.

4. **Message ordering** — Each contiguous assistant text segment must be its own message, with tool messages inserted between. This matches the pattern used by OpenAI's and Anthropic's chat APIs.

5. **Tool capability** — `replaceInDocument` closes the gap between AI intent and execution by providing simple find-and-replace on the full document.

## Prevention

- **Verify API existence before coding.** Check `node_modules/electrobun/dist/api/` type definitions. A grep for `evaluateJavascript` would have immediately shown only `WithNoCompletion` exists.

- **Avoid `try/finally` for resources that may outlive the block.** If a resource is created before the `try` block, don't destroy it in `finally`. Use explicit cleanup guarded by a condition.

- **Filter events at protocol boundaries, not at consumers.** Create a transformer layer that strips protocol-internal events before they reach the UI.

- **Model messages as immutable snapshots, not accumulators.** When conversation structure changes (tool call inserted mid-response), create new message objects rather than mutating existing ones.

- **Design tools from the AI's perspective.** Enumerate what the AI needs to accomplish and ensure every capability has a tool. Walk through common scenarios: "fix this typo," "reformat section," "add heading."

- **Integration-test the full tool call loop early.** A single end-to-end test (prompt → streaming → tool call → tool execution → second response → session complete) catches failures 2, 3, and 4 simultaneously.

## Related Issues

- `docs/solutions/ui-bugs/macos-menu-action-dispatch-bug-2026-04-03.md` — platform-specific RPC dispatch patterns in Electrobun
- `docs/solutions/logic-errors/session-persistence-race-condition-react-effect-2026-04-02.md` — async timing patterns in React effects
- `docs/plans/2026-04-03-001-feat-ai-support-plan.md` — original AI feature implementation plan
