// WriteToolBody — write tool display with stats and content preview
import { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AIMessage } from '../../hooks/useAIChat';

function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

interface WriteToolBodyProps {
  message: AIMessage;
}

export const WriteToolBody = memo(function WriteToolBody({ message }: WriteToolBodyProps) {
  const { t } = useTranslation('ai');
  const [showFull, setShowFull] = useState(false);

  // Data comes from toolArgs.content (the write arguments), NOT toolResult
  // write tool result is only { success: true }, content must come from args
  const content = String(message.toolArgs?.content ?? '');
  const charCount = content.length;
  const lineCount = content ? content.split('\n').length : 0;
  const tokenEstimate = estimateTokens(content);

  const toggleFull = useCallback(() => setShowFull(v => !v), []);

  if (!content) {
    return <span className="text-muted-foreground italic">{t('message.tool.write')} — empty</span>;
  }

  const previewText = content.length > 300 ? content.slice(0, 300) : content;
  const isTruncated = content.length > 300;

  return (
    <div className="space-y-2">
      {/* Stats line */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{t('message.tool.chars', { count: charCount })}</span>
        <span>·</span>
        <span>{t('message.tool.lines', { count: lineCount })}</span>
        <span>·</span>
        <span>{t('message.tool.tokens', { count: tokenEstimate })}</span>
      </div>

      {/* Content preview with gradient fade */}
      {showFull ? (
        <pre className="bg-background rounded p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
          {content}
        </pre>
      ) : (
        <div className="relative">
          <pre className="bg-background rounded p-2 text-xs font-mono overflow-hidden whitespace-pre-wrap break-words max-h-20">
            {previewText}
          </pre>
          {isTruncated && (
            <span className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          )}
        </div>
      )}

      {isTruncated && (
        <button
          type="button"
          onClick={toggleFull}
          className="text-[10px] text-primary hover:underline"
        >
          {showFull ? t('message.tool.collapse') : t('message.tool.viewFullContent')}
        </button>
      )}
    </div>
  );
});

export default WriteToolBody;
