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

        case 'toolcall_end': {
          const toolName = (event.data?.name as string) || ((event.data?.toolCall as any)?.name as string) || 'unknown';
          const toolResult = event.data?.result ?? event.data?.toolResult;

          // Finalize current assistant message, add tool result, create new assistant message
          const newAssistantId = generateId();
          setMessages(prev => [
            ...prev.map(msg =>
              msg.id === assistantId
                ? { ...msg, isStreaming: false }
                : msg
            ),
            {
              id: generateId(),
              role: 'tool',
              content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
              timestamp: Date.now(),
              toolName,
              toolResult,
            },
            {
              id: newAssistantId,
              role: 'assistant',
              content: '',
              timestamp: Date.now(),
              isStreaming: true,
            },
          ]);
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
        prev.map(msg =>
          msg.id === assistantId
            ? { ...msg, isStreaming: false }
            : msg
        )
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
