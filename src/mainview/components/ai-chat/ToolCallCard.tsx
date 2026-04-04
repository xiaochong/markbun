// ToolCallCard — structured, collapsible card for AI tool call results
import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AIMessage } from '../../hooks/useAIChat';

// ── Inline SVG icons (project pattern) ──────────────────────────────────────

const EyeIcon = memo(function EyeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M1 12s4-8 11-8 11 8-4 8-11 8-11-8zm" />
      <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
});

const PencilIcon = memo(function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
    </svg>
  );
});

const FileTextIcon = memo(function FileTextIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      <line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      <line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
      <polyline points="10,9 9,9 8,9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
    </svg>
  );
});

const CheckCircleIcon = memo(function CheckCircleIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
});

const XCircleIcon = memo(function XCircleIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
});

const AlertTriangleIcon = memo(function AlertTriangleIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
});

const ChevronIcon = memo(function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className={cn('w-3 h-3 transition-transform duration-150', expanded && 'rotate-90')}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
});

// ── Tool configuration ────────────────────────────────────────────────────────

const TOOL_CONFIG = {
  read:  { icon: EyeIcon,       colorClass: 'text-blue-500',   borderClass: 'border-l-blue-500' },
  edit:  { icon: PencilIcon,   colorClass: 'text-amber-500',  borderClass: 'border-l-amber-500' },
  write: { icon: FileTextIcon, colorClass: 'text-green-500',  borderClass: 'border-l-green-500' },
} as const;

type ToolConfig = typeof TOOL_CONFIG[keyof typeof TOOL_CONFIG];

// ── Status indicator ───────────────────────────────────────────────────────────

function StatusIndicator({ status }: { status: AIMessage['status'] }) {
  switch (status) {
    case 'executing':
      return (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      );
    case 'success':
      return <CheckCircleIcon />;
    case 'failed':
      return <XCircleIcon />;
    case 'timeout':
      return <AlertTriangleIcon />;
    default:
      return null;
  }
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
  const config = TOOL_CONFIG[toolName];
  const ToolIcon = config?.icon;
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
        <ChevronIcon expanded={expanded} />

        {ToolIcon && (
          <span className={cn('flex-shrink-0', config?.colorClass)}>
            <ToolIcon />
          </span>
        )}

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
