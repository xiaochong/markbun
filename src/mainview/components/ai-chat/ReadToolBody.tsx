// ReadToolBody — read tool display with stats and content preview
import { memo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { AIMessage } from '../../hooks/useAIChat';

function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

interface ReadToolBodyProps {
  message: AIMessage;
}

export const ReadToolBody = memo(function ReadToolBody({ message }: ReadToolBodyProps) {
  const { t } = useTranslation('ai');
  const [showFull, setShowFull] = useState(false);

  // Data comes from toolResult.content
  const content = (message.toolResult as any)?.content ?? '';
  const charCount = content.length;
  const lineCount = content ? content.split('\n').length : 0;
  const tokenEstimate = estimateTokens(content);

  const toggleFull = useCallback(() => setShowFull(v => !v), []);

  if (!content) {
    return <span className="text-muted-foreground italic">{t('message.tool.read')} — empty</span>;
  }

  const previewText = content.length > 500 ? content.slice(0, 500) : content;
  const isTruncated = content.length > 500;

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

      {/* Content preview or full */}
      {showFull ? (
        <pre className="bg-background rounded p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
          {content}
        </pre>
      ) : (
        <pre className="bg-background rounded p-2 text-xs font-mono overflow-hidden whitespace-pre-wrap break-words max-h-24 relative">
          {previewText}
          {isTruncated && (
            <span className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent" />
          )}
        </pre>
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

export default ReadToolBody;
