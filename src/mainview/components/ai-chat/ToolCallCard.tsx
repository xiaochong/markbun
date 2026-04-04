// ToolCallCard — structured, collapsible card for AI tool call results
import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AIMessage } from '../../hooks/useAIChat';

// ── Emoji icons ──────────────────────────────────────────────────────────────

const TOOL_EMOJI: Record<string, string> = {
  read: '👁',
  edit: '✏️',
  write: '📝',
};

const STATUS_EMOJI: Record<string, string> = {
  executing: '⏳',
  success: '✅',
  failed: '❌',
  timeout: '⚠️',
};

// ── Tool configuration ────────────────────────────────────────────────────────

const TOOL_CONFIG = {
  read:  { colorClass: 'text-blue-500',   borderClass: 'border-l-blue-500' },
  edit:  { colorClass: 'text-amber-500',  borderClass: 'border-l-amber-500' },
  write: { colorClass: 'text-green-500',  borderClass: 'border-l-green-500' },
} as const;

// ── Status indicator ───────────────────────────────────────────────────────────

function StatusIndicator({ status }: { status: AIMessage['status'] }) {
  const emoji = status ? STATUS_EMOJI[status] : null;
  if (!emoji) return null;
  if (status === 'executing') {
    return <span className="animate-pulse">{emoji}</span>;
  }
  return <span>{emoji}</span>;
}

// ── Duration formatter ─────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Status color mapping ───────────────────────────────────────────────────────

function getStatusColor(status: AIMessage['status']): string {
  switch (status) {
    case 'executing': return 'text-muted-foreground';
    case 'success':   return 'text-green-600';
    case 'failed':    return 'text-red-500';
    case 'timeout':   return 'text-orange-500';
    default:          return 'text-muted-foreground';
  }
}

// ── Live timer hook ────────────────────────────────────────────────────────────

function useLiveTimer(startTime: number | undefined, status: AIMessage['status']) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status !== 'executing' || !startTime) return;
    const update = () => setElapsed(Date.now() - startTime);
    update();
    intervalRef.current = setInterval(update, 200);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, startTime]);

  return elapsed;
}

// ── ToolCallCard ────────────────────────────────────────────────────────────────

interface ToolCallCardProps {
  message: AIMessage;
  children?: React.ReactNode;
}

export const ToolCallCard = memo(function ToolCallCard({ message, children }: ToolCallCardProps) {
  const { t } = useTranslation('ai');
  const [expanded, setExpanded] = useState(false);

  const toolName = message.toolName || 'tool';
  const config = TOOL_CONFIG[toolName as keyof typeof TOOL_CONFIG];
  const toolEmoji = TOOL_EMOJI[toolName] || '🔧';
  const status = message.status;
  const isExecuting = status === 'executing';

  const liveElapsed = useLiveTimer(message.startTime, status);
  const duration = isExecuting ? liveElapsed : message.duration;

  const statusLabel = t(`message.tool.${status === 'executing' ? 'executing' : status === 'success' ? 'completed' : status === 'failed' ? 'failed' : 'timeout'}`);

  const toolLabel = toolName === 'read' ? t('message.tool.read')
    : toolName === 'edit' ? t('message.tool.edit')
    : toolName === 'write' ? t('message.tool.write')
    : toolName;

  const toggleExpanded = useCallback(() => setExpanded(v => !v), []);

  // Error info for failed/timeout
  const errorSnippet = status === 'failed' || status === 'timeout'
    ? (message.content?.length ?? 0) > 30
      ? message.content!.slice(0, 30) + '...'
      : message.content
    : null;

  return (
    <div className={cn(
      'rounded-md border-l-4 my-1 overflow-hidden',
      config?.borderClass || 'border-l-muted-foreground',
      'bg-muted/50',
    )}>
      {/* Header — always visible, clickable to expand */}
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left hover:bg-muted/80 transition-colors"
        aria-expanded={expanded}
        aria-label={expanded ? t('message.tool.collapse') : t('message.tool.expand')}
      >
        <span className={cn('text-[10px] transition-transform duration-150', expanded && 'rotate-90')}>▶</span>

        <span className="text-sm flex-shrink-0">{toolEmoji}</span>

        <span className="text-xs font-medium text-foreground truncate">
          {toolLabel}
        </span>

        <span className="text-[10px] text-muted-foreground">·</span>

        <span className={cn('text-[10px] flex items-center gap-1', getStatusColor(status))}>
          <StatusIndicator status={status} />
          {statusLabel}
        </span>

        {duration != null && duration > 0 && (
          <>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {formatDuration(duration)}
            </span>
          </>
        )}

        {errorSnippet && (
          <>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-red-500 truncate max-w-[120px]">
              {errorSnippet}
            </span>
          </>
        )}
      </button>

      {/* Body — expandable second layer */}
      {expanded && (
        <div className="px-3 py-2 border-t border-border/50 text-xs">
          {children || <span className="text-muted-foreground">...</span>}
        </div>
      )}

      {/* Raw data — third layer (always in DOM, collapsed by <details>) */}
      {expanded && (
        <details className="border-t border-border/30">
          <summary className="px-3 py-1 text-[10px] text-muted-foreground cursor-pointer hover:bg-muted/50">
            {t('message.tool.rawData')}
          </summary>
          <pre className="px-3 py-2 text-[10px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
            {message.content}
          </pre>
        </details>
      )}
    </div>
  );
});

export default ToolCallCard;
