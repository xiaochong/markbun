// AI Chat hook — manages conversation state, streaming, send/abort
import { useState, useCallback, useRef, useEffect } from 'react';
import { electrobun } from '../lib/electrobun';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  error?: string;
  toolName?: string;
  toolResult?: unknown;
  toolArgs?: Record<string, unknown>;
  status?: 'executing' | 'success' | 'failed' | 'timeout';
  startTime?: number;
  duration?: number;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export interface UseAIChatReturn {
  messages: AIMessage[];
  isStreaming: boolean;
  error: string | null;
  send: (message: string) => Promise<void>;
  abort: () => Promise<void>;
  resetSession: () => void;
}

export function useAIChat(): UseAIChatReturn {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track current assistant message id for streaming updates
  const currentAssistantIdRef = useRef<string | null>(null);
  // Track active session ID to ignore stale events from previous sessions
  const activeSessionIdRef = useRef<string | null>(null);
  // Guard against double-send race condition
  const sendingRef = useRef(false);

  // Subscribe to stream events
  useEffect(() => {
    const unsubscribe = electrobun.on('ai-stream-event', (data) => {
      const event = data as {
        sessionId: string;
        type: 'text_delta' | 'toolcall_start' | 'toolcall_delta' | 'toolcall_end' | 'done' | 'error';
        data: Record<string, unknown>;
      };

      // Ignore events from stale sessions
      if (event.sessionId !== activeSessionIdRef.current) return;

      const assistantId = currentAssistantIdRef.current;
      if (!assistantId) return;

      switch (event.type) {
        case 'text_delta': {
          const delta = (event.data?.delta as string) || '';
          if (!delta) break;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, content: msg.content + delta }
                : msg
            )
          );
          break;
        }

        case 'toolcall_start': {
          const toolName = (event.data?.toolName as string) || undefined;
          const toolId = generateId();
          setMessages(prev => [
            ...prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, isStreaming: false }
                : msg
            ),
            {
              id: toolId,
              role: 'tool',
              content: '',
              timestamp: Date.now(),
              toolName: toolName || 'tool',
              status: 'executing',
              startTime: Date.now(),
            },
          ]);
          break;
        }

        case 'toolcall_delta': {
          const toolName = event.data?.toolName as string | undefined;
          if (!toolName) break;
          // Update the last tool message's toolName if it still undefined
          setMessages(prev => {
            const lastToolMsg = [...prev].reverse().find(m => m.role === 'tool' && m.status === 'executing');
            if (!lastToolMsg) return prev;
            return prev.map(msg =>
              msg.id === lastToolMsg.id && msg.toolName === 'tool'
                ? { ...msg, toolName }
                : msg
            );
          });
          break;
        }

        case 'toolcall_end': {
          const toolName = (event.data?.name as string) || ((event.data?.toolCall as any)?.name as string) || 'unknown';
          const toolResult = event.data?.result ?? event.data?.toolResult;
          const isError = Boolean(event.data?.isError);
          const toolCallData = event.data?.toolCall as Record<string, unknown> | undefined;
          const toolArgs = toolCallData?.arguments as Record<string, unknown> | undefined;
          const errorMsg = typeof toolResult === 'string' ? toolResult : (toolResult as any)?.error as string;

          const isTimeout = isError && errorMsg?.includes('timed out');
          const status = isTimeout ? 'timeout' : isError ? 'failed' : 'success';
          const duration = Date.now();

          // Finalize current assistant message and update executing tool message
          const newAssistantId = generateId();
          setMessages(prev => {
            // Find the LAST executing tool message (most recent tool call)
            let toolMsgIndex = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
              if (prev[i].role === 'tool' && prev[i].status === 'executing') {
                toolMsgIndex = i;
                break;
              }
            }
            return [
              ...prev.map(msg => {
                if (msg.id === assistantId) return { ...msg, isStreaming: false };
                if (toolMsgIndex !== -1 && msg.id === prev[toolMsgIndex].id) {
                  const finalized: AIMessage = {
                    ...msg,
                    status,
                    duration: duration - (msg.startTime || duration),
                    toolName: msg.toolName === 'tool' ? toolName : msg.toolName,
                    toolResult,
                    toolArgs,
                    content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
                  };
                  return finalized;
                }
                return msg;
              }),
              {
                id: newAssistantId,
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
                isStreaming: true,
              },
            ];
          });
          // Update ref so subsequent text_delta events write to the new message
          currentAssistantIdRef.current = newAssistantId;
          break;
        }

        case 'done': {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, isStreaming: false }
                : msg
            )
          );
          setIsStreaming(false);
          currentAssistantIdRef.current = null;
          activeSessionIdRef.current = null;
          sendingRef.current = false;
          break;
        }

        case 'error': {
          const errorMsg = (event.data?.error as string) || (event.data?.errorMessage as string) || 'Unknown error';
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, isStreaming: false, error: errorMsg }
                : msg
            )
          );
          setIsStreaming(false);
          setError(errorMsg);
          currentAssistantIdRef.current = null;
          activeSessionIdRef.current = null;
          sendingRef.current = false;
          break;
        }
      }
    });

    return unsubscribe;
  }, []);

  const send = useCallback(async (message: string) => {
    if (!message.trim() || isStreaming || sendingRef.current) return;

    // Guard against concurrent sends
    sendingRef.current = true;
    setError(null);

    // Add user message
    const userMsg: AIMessage = {
      id: generateId(),
      role: 'user',
      content: message.trim(),
      timestamp: Date.now(),
    };

    // Add empty assistant message for streaming
    const assistantId = generateId();
    const assistantMsg: AIMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    currentAssistantIdRef.current = assistantId;
    setIsStreaming(true);

    try {
      const result = await electrobun.aiChat(message.trim());
      if (!result.success) {
        // Mark assistant message with error
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, isStreaming: false, error: result.error || 'Failed to send message' }
              : msg
          )
        );
        setIsStreaming(false);
        setError(result.error || 'Failed to send message');
        currentAssistantIdRef.current = null;
        activeSessionIdRef.current = null;
        sendingRef.current = false;
      } else if (result.sessionId) {
        // Store the backend session ID for event filtering
        activeSessionIdRef.current = result.sessionId;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantId
            ? { ...msg, isStreaming: false, error: errorMsg }
            : msg
        )
      );
      setIsStreaming(false);
      setError(errorMsg);
      currentAssistantIdRef.current = null;
      activeSessionIdRef.current = null;
      sendingRef.current = false;
    }
  }, [isStreaming]);

  const abort = useCallback(async () => {
    try {
      await electrobun.aiAbort();
    } catch {
      // Ignore abort errors
    }

    // Mark current streaming message as stopped
 const assistantId = currentAssistantIdRef.current;
    if (assistantId) {
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id === assistantId) return { ...msg, isStreaming: false };
          // Clean up executing tool messages on abort
          if (msg.role === 'tool' && msg.status === 'executing') {
            return {
              ...msg,
              status: 'failed',
              duration: Date.now() - (msg.startTime || Date.now()),
            };
          }
          return msg;
        })
      );
    }
    setIsStreaming(false);
    currentAssistantIdRef.current = null;
    activeSessionIdRef.current = null;
    sendingRef.current = false;
  }, []);

  const resetSession = useCallback(() => {
    setMessages([]);
    setIsStreaming(false);
    setError(null);
    currentAssistantIdRef.current = null;
    activeSessionIdRef.current = null;
    sendingRef.current = false;
    // Reset server-side AI context so next message starts fresh
    electrobun.resetAIContext().catch(() => {});
  }, []);

  return {
    messages,
    isStreaming,
    error,
    send,
    abort,
    resetSession,
  };
}
