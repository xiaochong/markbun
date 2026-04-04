/**
 * AI Stream Service — Buffered streaming bridge from pi-ai to WebView
 *
 * Wraps the pi-ai `stream()` function, buffers events (50ms interval or 3
 * text_delta tokens, whichever comes first), then dispatches them as RPC
 * messages to the WebView for rendering.
 *
 * Responsibilities:
 *  - Buffering / batching to avoid RPC channel saturation
 *  - Abort handling via AbortController
 *  - Tool call execution bridge (toolcall_end -> evaluateJavascriptWithResponse)
 *  - Error propagation with retryability flag
 */

import { stream } from '@mariozechner/pi-ai';
import type {
  Api,
  AssistantMessage,
  AssistantMessageEvent,
  AssistantMessageEventStream,
  Context,
  Model,
  ProviderStreamOptions,
  ToolCall,
} from '@mariozechner/pi-ai';
import { randomUUID } from 'crypto';

// ── Configuration ─────────────────────────────────────────────────────────────

/** Maximum text_delta events to buffer before flushing */
const BUFFER_TOKEN_THRESHOLD = 3;

/** Maximum time (ms) to hold buffered events before flushing */
const BUFFER_FLUSH_INTERVAL_MS = 50;

/** Timeout (ms) for tool call execution via evaluateJavascriptWithResponse */
const TOOL_CALL_TIMEOUT_MS = 10_000;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Stream event type matching the RPC message definition in types.ts */
export type AIStreamEventType =
  | 'text_delta'
  | 'toolcall_start'
  | 'toolcall_delta'
  | 'toolcall_end'
  | 'done'
  | 'error';

/** Payload sent to WebView for each streaming event */
export interface AIStreamEvent {
  sessionId: string;
  type: AIStreamEventType;
  data: Record<string, unknown>;
}

/** Result of initiating a chat stream */
export interface AIChatResult {
  sessionId: string;
}

/** Callback for executing an AI tool via RPC in the WebView */
export type ExecuteToolRPCFn = (tool: string, args?: string) => Promise<{ success: boolean; result?: string; error?: string }>;

/** Callback for pushing events to the WebView */
export type SendEventFn = (event: AIStreamEvent) => void;

/** Tool executor function — takes a ToolCall, returns JSON-serializable result */
export type ToolExecutorFn = (toolCall: ToolCall) => Promise<{ result: unknown; isError: boolean }>;

// ── Active Session Tracking ───────────────────────────────────────────────────

interface ActiveSession {
  sessionId: string;
  abortController: AbortController;
}

/** Currently active streaming session (at most one at a time) */
let activeSession: ActiveSession | null = null;

// ── Event Buffer ──────────────────────────────────────────────────────────────

class EventBuffer {
  private queue: AIStreamEvent[] = [];
  private textDeltaCount = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly sendEvent: SendEventFn;

  constructor(sendEvent: SendEventFn) {
    this.sendEvent = sendEvent;
  }

  /** Push an event into the buffer */
  push(event: AIStreamEvent): void {
    this.queue.push(event);

    if (event.type === 'text_delta') {
      this.textDeltaCount++;
    }

    // Flush immediately if we hit the token threshold
    if (this.textDeltaCount >= BUFFER_TOKEN_THRESHOLD) {
      this.flush();
      return;
    }

    // Flush immediately for terminal/control events (low frequency, high urgency)
    if (
      event.type === 'done' ||
      event.type === 'error' ||
      event.type === 'toolcall_end' ||
      event.type === 'toolcall_start'
    ) {
      this.flush();
      return;
    }

    // Start timer on first event if not already running
    if (!this.flushTimer && this.queue.length === 1) {
      this.startFlushTimer();
    }
  }

  /** Force-flush any buffered events */
  flush(): void {
    this.stopFlushTimer();

    if (this.queue.length === 0) return;

    for (const event of this.queue) {
      this.sendEvent(event);
    }

    this.queue = [];
    this.textDeltaCount = 0;
  }

  /** Dispose the buffer, discarding any pending events */
  dispose(): void {
    this.stopFlushTimer();
    this.queue = [];
    this.textDeltaCount = 0;
  }

  private startFlushTimer(): void {
    this.stopFlushTimer();
    this.flushTimer = setTimeout(() => {
      this.flush();
    }, BUFFER_FLUSH_INTERVAL_MS);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// ── Helper: convert pi-ai event to our stream event ───────────────────────────

function piEventToStreamEvent(
  sessionId: string,
  event: AssistantMessageEvent,
): AIStreamEvent | null {
  switch (event.type) {
    case 'text_delta':
      return {
        sessionId,
        type: 'text_delta',
        data: {
          delta: event.delta,
          contentIndex: event.contentIndex,
        },
      };

    case 'toolcall_start':
      return {
        sessionId,
        type: 'toolcall_start',
        data: {
          contentIndex: event.contentIndex,
        },
      };

    case 'toolcall_delta':
      return {
        sessionId,
        type: 'toolcall_delta',
        data: {
          delta: event.delta,
          contentIndex: event.contentIndex,
        },
      };

    // toolcall_end during streaming is used only for internal bookkeeping
    // (tracking the partial assistant message). The definitive toolcall_end
    // event (with results) is emitted by handleToolCalls after execution.
    case 'toolcall_end':
      return null;

    // done with toolUse reason is an intermediate state — don't forward
    // to frontend. The final done (reason=stop/length) is sent after all
    // tool calls are resolved and the model produces its final response.
    case 'done':
      if (event.reason === 'toolUse') {
        return null;
      }
      return {
        sessionId,
        type: 'done',
        data: {
          reason: event.reason,
          usage: event.message.usage,
        },
      };

    case 'error':
      return {
        sessionId,
        type: 'error',
        data: {
          reason: event.reason,
          errorMessage: event.error.errorMessage ?? 'Unknown error',
          isRetryable: isRetryableError(event.error),
        },
      };

    // Events we don't forward to the WebView (internal bookkeeping)
    case 'start':
    case 'text_start':
    case 'text_end':
    case 'thinking_start':
    case 'thinking_delta':
    case 'thinking_end':
      return null;

    default:
      return null;
  }
}

/**
 * Determine if an error is likely retryable (transient network/API issues).
 * Non-retryable errors include auth failures, invalid requests, and user aborts.
 */
function isRetryableError(message: AssistantMessage): boolean {
  const msg = message.errorMessage?.toLowerCase() ?? '';
  if (msg.includes('abort')) return false;
  if (msg.includes('unauthorized') || msg.includes('401')) return false;
  if (msg.includes('forbidden') || msg.includes('403')) return false;
  if (msg.includes('invalid') && msg.includes('key')) return false;
  if (msg.includes('rate_limit') || msg.includes('429')) return true;
  if (msg.includes('timeout') || msg.includes('504') || msg.includes('502')) return true;
  if (msg.includes('network') || msg.includes('connection') || msg.includes('econnrefused')) return true;
  // Default to retryable for unknown errors
  return true;
}

// ── Default Tool Executor ─────────────────────────────────────────────────────

/**
 * Create a tool executor that calls the WebView via RPC request (executeAITool).
 * The WebView must expose `window.__markbunAI` with methods for each tool.
 */
export function createDefaultToolExecutor(
  executeToolRPC: ExecuteToolRPCFn,
): ToolExecutorFn {
  return async (toolCall: ToolCall): Promise<{ result: unknown; isError: boolean }> => {
    const { name, arguments: args } = toolCall;

    try {
      const argsJson = args ? JSON.stringify(args) : undefined;

      // Execute with timeout
      let timeoutId: ReturnType<typeof setTimeout>;
      const rpcResult = await Promise.race([
        executeToolRPC(name, argsJson),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Tool call timed out')), TOOL_CALL_TIMEOUT_MS);
        }),
      ]);
      clearTimeout(timeoutId);

      if (!rpcResult.success) {
        return { result: { error: rpcResult.error ?? 'Tool execution failed' }, isError: true };
      }

      // Parse the result string back to a value
      let parsed: unknown;
      try {
        parsed = rpcResult.result ? JSON.parse(rpcResult.result) : null;
      } catch {
        parsed = rpcResult.result;
      }

      return { result: parsed, isError: false };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[AI Stream] Tool '${name}' execution failed:`, errorMsg);
      return { result: { error: errorMsg }, isError: true };
    }
  };
}

// ── Main Streaming Function ───────────────────────────────────────────────────

export interface StartStreamOptions {
  /** pi-ai model to use */
  model: Model<Api>;
  /** pi-ai context (system prompt + messages + tools) */
  context: Context;
  /** API key for the provider */
  apiKey?: string;
  /** Function to push events to WebView */
  sendEvent: SendEventFn;
  /** Function to execute AI tools in WebView via RPC */
  executeToolRPC: ExecuteToolRPCFn;
  /** Optional custom tool executor (overrides default) */
  toolExecutor?: ToolExecutorFn;
  /** Optional base URL override */
  baseUrl?: string;
}

/**
 * Start a new AI streaming session.
 *
 * Returns the session ID immediately. Events are pushed to the WebView
 * asynchronously via the `sendEvent` callback as they arrive from pi-ai.
 *
 * Only one session can be active at a time. If a session is already running,
 * it is aborted before starting the new one.
 */
export function startStream(options: StartStreamOptions): AIChatResult {
  // Abort any existing session
  if (activeSession) {
    activeSession.abortController.abort();
    activeSession = null;
  }

  const sessionId = randomUUID();
  const abortController = new AbortController();
  activeSession = { sessionId, abortController };

  // Run the stream loop in the background (do not await)
  runStreamLoop(sessionId, abortController, options).catch((err) => {
    console.error('[AI Stream] Unexpected error in stream loop:', err);

    // Send error event if session is still active
    if (activeSession?.sessionId === sessionId) {
      options.sendEvent({
        sessionId,
        type: 'error',
        data: {
          reason: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
          isRetryable: true,
        },
      });
      activeSession = null;
    }
  });

  return { sessionId };
}

/**
 * Abort the currently active streaming session.
 * Returns true if a session was aborted, false if none was active.
 */
export function abortStream(): boolean {
  if (!activeSession) return false;

  const session = activeSession;
  session.abortController.abort();
  activeSession = null;

  console.log(`[AI Stream] Aborted session ${session.sessionId}`);
  return true;
}

/**
 * Check if a streaming session is currently active.
 */
export function isStreaming(): boolean {
  return activeSession !== null;
}

/**
 * Get the current active session ID, or null if none.
 */
export function getActiveSessionId(): string | null {
  return activeSession?.sessionId ?? null;
}

// ── Internal Stream Loop ──────────────────────────────────────────────────────

async function runStreamLoop(
  sessionId: string,
  abortController: AbortController,
  options: StartStreamOptions,
): Promise<void> {
  const { model, context, apiKey, sendEvent, executeToolRPC, toolExecutor, baseUrl } = options;

  const buffer = new EventBuffer(sendEvent);
  const resolveToolCall = toolExecutor ?? createDefaultToolExecutor(executeToolRPC);

  // Build model with optional base URL override
  const effectiveModel: Model<Api> = baseUrl
    ? { ...model, baseUrl }
    : model;

  const streamOptions: ProviderStreamOptions = {
    signal: abortController.signal,
    ...(apiKey ? { apiKey } : {}),
  };

  // Outer loop handles multi-turn tool calls. Each iteration calls
  // pi-ai stream() which produces events until the model stops.
  // If the stop reason is 'toolUse', we execute tools, push results
  // into context, and loop again for the model's follow-up response.
  let continueLoop = true;

  while (continueLoop) {
    continueLoop = false;

    let eventStream: AssistantMessageEventStream;

    try {
      eventStream = stream(effectiveModel, context, streamOptions);
    } catch (err) {
      // Failed to initiate stream (e.g., invalid model, missing key)
      sendEvent({
        sessionId,
        type: 'error',
        data: {
          reason: 'error',
          errorMessage: err instanceof Error ? err.message : String(err),
          isRetryable: false,
        },
      });
      cleanupSession(sessionId);
      buffer.dispose();
      return;
    }

    let shouldContinueToolLoop = false;

    try {
      let lastAssistantMessage: AssistantMessage | null = null;

      for await (const event of eventStream) {
        // Check if user aborted
        if (abortController.signal.aborted) {
          break;
        }

        // Convert and buffer the event
        const streamEvent = piEventToStreamEvent(sessionId, event);
        if (streamEvent) {
          buffer.push(streamEvent);
        }

        // Track the partial assistant message for tool call handling.
        // The `partial` field contains the accumulated AssistantMessage so far.
        if (event.type === 'toolcall_end') {
          lastAssistantMessage = event.partial;
        }

        // On done, check if we need to handle tool calls
        if (event.type === 'done') {
          buffer.flush();
          lastAssistantMessage = event.message;

          // If the model stopped to use tools, execute them and continue
          if (event.reason === 'toolUse' && lastAssistantMessage) {
            continueLoop = await handleToolCalls(
              sessionId,
              lastAssistantMessage,
              context,
              resolveToolCall,
              sendEvent,
              abortController,
            );
            if (continueLoop) {
              // Signal that we're continuing — skip cleanup in finally
              shouldContinueToolLoop = true;
              break; // exit for-await, but NOT the while loop
            }
          }

          // Normal completion (no tool calls) — clean up and exit.
          cleanupSession(sessionId);
          buffer.dispose();
          return;
        }

        // On error, clean up and stop
        if (event.type === 'error') {
          buffer.flush();
          cleanupSession(sessionId);
          buffer.dispose();
          return;
        }
      }
    } catch (err) {
      // Stream iteration error
      if (abortController.signal.aborted) {
        // User-initiated abort, not an error
        buffer.flush();
        sendEvent({
          sessionId,
          type: 'done',
          data: {
            reason: 'aborted',
            usage: zeroUsage(),
          },
        });
      } else {
        buffer.flush();
        sendEvent({
          sessionId,
          type: 'error',
          data: {
            reason: 'error',
            errorMessage: err instanceof Error ? err.message : String(err),
            isRetryable: true,
          },
        });
      }
    }

    // Only cleanup if we're NOT continuing the tool call loop
    if (!shouldContinueToolLoop) {
      buffer.dispose();
      cleanupSession(sessionId);
    }
  }
}

/**
 * Handle tool calls from an assistant message that stopped with reason 'toolUse'.
 * Executes each tool, pushes results into context, and returns true if the
 * stream should continue (i.e., the model needs to respond again).
 */
async function handleToolCalls(
  sessionId: string,
  assistantMessage: AssistantMessage,
  context: Context,
  resolveToolCall: ToolExecutorFn,
  sendEvent: SendEventFn,
  abortController: AbortController,
): Promise<boolean> {
  // Extract tool calls from assistant message content
  const toolCalls = assistantMessage.content.filter(
    (block): block is ToolCall => block.type === 'toolCall',
  );

  if (toolCalls.length === 0) return false;

  // Push the assistant message (with tool calls) into context
  context.messages.push(assistantMessage);

  // Execute each tool and push results
  for (const toolCall of toolCalls) {
    if (abortController.signal.aborted) return false;

    const { result, isError } = await resolveToolCall(toolCall);

    const toolResultMessage = {
      role: 'toolResult' as const,
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      content: [
        {
          type: 'text' as const,
          text: typeof result === 'string' ? result : JSON.stringify(result),
        },
      ],
      isError,
      timestamp: Date.now(),
    };

    context.messages.push(toolResultMessage);

    // Send tool execution result event to WebView for display.
    // The `toolResult` field distinguishes this from the earlier
    // `toolcall_end` event emitted during streaming (which only
    // has the tool call request, not the result).
    sendEvent({
      sessionId,
      type: 'toolcall_end',
      data: {
        toolCall: {
          id: toolCall.id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
        toolResult: result,
        isError,
      },
    });
  }

  // Return true so the outer loop calls stream() again with updated context
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanupSession(sessionId: string): void {
  if (activeSession?.sessionId === sessionId) {
    activeSession = null;
  }
}

function zeroUsage() {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}
