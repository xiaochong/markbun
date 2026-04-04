// AI Chat hook — manages conversation state, streaming, send/abort
// Enhanced with session persistence (auto-save, restore, history)
import { useState, useCallback, useRef, useEffect } from 'react';
import { electrobun } from '../lib/electrobun';
import type { AISessionData } from '@/shared/types';

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
  // Session persistence
  sessionId: string | null;
  loadSession: (session: AISessionData) => void;
  restoreLatestSession: () => Promise<void>;
}

export function useAIChat(): UseAIChatReturn {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Track current assistant message id for streaming updates
  const currentAssistantIdRef = useRef<string | null>(null);
  // Track active session ID to ignore stale events from previous sessions
  const activeSessionIdRef = useRef<string | null>(null);
  // Guard against double-send race condition
  const sendingRef = useRef(false);

  // ── Session Persistence Refs ───────────────────────────────────────────────
  const filePathRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<AIMessage[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  // ── Session Save ───────────────────────────────────────────────────────────

  const saveCurrentSession = useCallback(async (msgs?: AIMessage[]) => {
    const id = sessionIdRef.current;
    if (!id) return;
    const currentMessages = msgs ?? messagesRef.current;
    if (currentMessages.length === 0) return;
    // Don't save if any message is still streaming or executing
    if (currentMessages.some(m => m.isStreaming || m.status === 'executing')) return;

    const now = Date.now();
    const firstUserMsg = currentMessages.find(m => m.role === 'user');
    const title = firstUserMsg
      ? (firstUserMsg.content.trim().length > 40 ? firstUserMsg.content.trim().substring(0, 40) + '...' : firstUserMsg.content.trim())
      : 'Untitled Session';

    const sessionData: AISessionData = {
      id,
      title,
      model: '',
      filePath: filePathRef.current,
      createdAt: now,
      updatedAt: now,
      messageCount: currentMessages.length,
      messages: currentMessages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        isStreaming: m.isStreaming,
        error: m.error,
        toolName: m.toolName,
        toolResult: m.toolResult,
        toolArgs: m.toolArgs,
        status: m.status,
        startTime: m.startTime,
        duration: m.duration,
      })),
    };

    try {
      await electrobun.saveAISession(sessionData);
    } catch (err) {
      console.error('[AIChat] Failed to save session:', err);
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      void saveCurrentSession();
    }, 2000);
  }, [saveCurrentSession]);

  // ── Load / Restore ─────────────────────────────────────────────────────────

  const loadSession = useCallback((session: AISessionData) => {
    setSessionId(session.id);
    sessionIdRef.current = session.id;
    filePathRef.current = session.filePath;

    const loaded: AIMessage[] = session.messages.map(m => ({
      ...m,
      isStreaming: false,
    }));

    setMessages(loaded);
    setError(null);
    setIsStreaming(false);
    currentAssistantIdRef.current = null;
    activeSessionIdRef.current = null;
    sendingRef.current = false;
  }, []);

  const restoreLatestSession = useCallback(async () => {
    try {
      const result = await electrobun.getLatestAISession();
      if (result.success && result.session && result.session.messages.length > 0) {
        loadSession(result.session);
      }
    } catch (err) {
      console.error('[AIChat] Failed to restore latest session:', err);
    }
  }, [loadSession]);

  // ── Subscribe to stream events ─────────────────────────────────────────────

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

          const newAssistantId = generateId();
          setMessages(prev => {
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
          // Auto-save after streaming ends
          scheduleSave();
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
          // Save even on error
          scheduleSave();
          break;
        }
      }
    });

    return unsubscribe;
  }, [scheduleSave]);

  // ── Send ───────────────────────────────────────────────────────────────────

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

    // Auto-generate session ID if needed
    if (!sessionIdRef.current) {
      const newId = generateId();
      setSessionId(newId);
      sessionIdRef.current = newId;
    }

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
    // Save current session before clearing (if we have messages)
    if (sessionIdRef.current && messagesRef.current.length > 0) {
      void saveCurrentSession();
    }

    setMessages([]);
    setIsStreaming(false);
    setError(null);
    setSessionId(null);
    sessionIdRef.current = null;
    currentAssistantIdRef.current = null;
    activeSessionIdRef.current = null;
    sendingRef.current = false;
    // Reset server-side AI context so next message starts fresh
    electrobun.resetAIContext().catch(() => {});
  }, [saveCurrentSession]);

  return {
    messages,
    isStreaming,
    error,
    send,
    abort,
    resetSession,
    // Session persistence
    sessionId,
    loadSession,
    restoreLatestSession,
  };
}
