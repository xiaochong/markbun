// ChatMessageList — renders AI conversation messages with streaming support
import { memo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AIMessage } from '../../hooks/useAIChat';
import { ToolCallCard } from './ToolCallCard';
import { ReadToolBody } from './ReadToolBody';
import { EditToolBody } from './EditToolBody';
import { WriteToolBody } from './WriteToolBody';

interface ChatMessageListProps {
  messages: AIMessage[];
  isStreaming: boolean;
}

export const ChatMessageList = memo(function ChatMessageList({ messages, isStreaming }: ChatMessageListProps) {
  const { t } = useTranslation('ai');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">{t('message.empty')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.map(msg => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {/* Streaming cursor */}
      {isStreaming && messages[messages.length - 1]?.role === 'assistant' && (
        <StreamingCursor />
      )}
      <div ref={bottomRef} />
    </div>
  );
});

// Individual message bubble
interface ChatMessageProps {
  message: AIMessage;
}

const ChatMessage = memo(function ChatMessage({ message }: ChatMessageProps) {
  const { t } = useTranslation('ai');
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  // Tool messages: render as ToolCallCard
  if (isTool) {
    const toolName = message.toolName || 'tool';
    const toolBody = toolName === 'read' ? <ReadToolBody message={message} />
      : toolName === 'edit' ? <EditToolBody message={message} />
      : toolName === 'write' ? <WriteToolBody message={message} />
      : null;

    return <ToolCallCard message={message}>{toolBody}</ToolCallCard>;
  }

  const roleLabel = isUser
    ? t('message.user')
    : t('message.assistant');

  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <span className="text-xs text-muted-foreground font-medium">{roleLabel}</span>
      <div
        className={cn(
          'rounded-lg px-3 py-2 text-sm max-w-[90%] break-words whitespace-pre-wrap',
          isUser
            ? 'bg-primary text-primary-foreground'
            : isTool
            ? 'bg-muted border border-border text-muted-foreground text-xs font-mono'
            : 'bg-muted text-foreground',
          message.error && 'border border-destructive/50 bg-destructive/10'
        )}
      >
        {message.error ? (
          <span className="text-destructive">
            {t('message.error', { error: message.error })}
          </span>
        ) : message.isStreaming && !message.content ? (
          <span className="text-muted-foreground">{t('message.thinking')}</span>
        ) : (
          <MessageContent content={message.content} />
        )}
      </div>
    </div>
  );
});

// Simple message content renderer (basic markdown-like formatting)
interface MessageContentProps {
  content: string;
}

const MessageContent = memo(function MessageContent({ content }: MessageContentProps) {
  // Simple rendering: split by double newlines for paragraphs,
  // handle code blocks (```...```) and inline code (`...`)
  const renderContent = useCallback(() => {
    const parts: React.ReactNode[] = [];
    let remaining = content;
    let key = 0;

    while (remaining.length > 0) {
      // Check for code blocks
      const codeBlockStart = remaining.indexOf('```');
      if (codeBlockStart !== -1) {
        // Text before code block
        if (codeBlockStart > 0) {
          parts.push(
            <span key={key++}>{renderInlineContent(remaining.substring(0, codeBlockStart))}</span>
          );
        }

        // Find end of code block
        const codeBlockEnd = remaining.indexOf('```', codeBlockStart + 3);
        if (codeBlockEnd !== -1) {
          const codeContent = remaining.substring(codeBlockStart + 3, codeBlockEnd);
          // Skip language identifier on first line
          const firstNewline = codeContent.indexOf('\n');
          const code = firstNewline !== -1 ? codeContent.substring(firstNewline + 1) : codeContent;
          parts.push(
            <pre key={key++} className="bg-background rounded p-2 mt-1 mb-1 overflow-x-auto text-xs">
              <code>{code}</code>
            </pre>
          );
          remaining = remaining.substring(codeBlockEnd + 3);
        } else {
          // Unclosed code block — render as-is
          parts.push(
            <code key={key++} className="bg-background rounded px-1 text-xs">
              {remaining.substring(codeBlockStart + 3)}
            </code>
          );
          remaining = '';
        }
      } else {
        // No code blocks — render inline content
        parts.push(<span key={key++}>{renderInlineContent(remaining)}</span>);
        remaining = '';
      }
    }

    return parts;
  }, [content]);

  return <>{renderContent()}</>;
});

// Render inline formatting (bold, italic, inline code)
function renderInlineContent(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Simple regex-based splitting for inline code
  const inlineCodeRegex = /`([^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = inlineCodeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    parts.push(
      <code key={`ic-${key++}`} className="bg-background rounded px-1 text-xs">
        {match[1]}
      </code>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

// Streaming cursor animation
const StreamingCursor = memo(function StreamingCursor() {
  return (
    <div className="flex items-center gap-1 pl-2">
      <span className="w-1.5 h-4 bg-primary/70 rounded-sm animate-pulse" />
    </div>
  );
});
