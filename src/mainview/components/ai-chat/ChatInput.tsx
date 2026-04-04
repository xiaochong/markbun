// ChatInput — text input + send/stop button
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}

export const ChatInput = memo(function ChatInput({ onSend, onStop, isStreaming, disabled }: ChatInputProps) {
  const { t } = useTranslation('ai');
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    onSend(input);
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isStreaming, onSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const isDisabled = disabled || (!input.trim() && !isStreaming);

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-end gap-2 bg-muted/50 rounded-lg border border-border p-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('panel.placeholder')}
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none min-h-[24px] max-h-[120px]',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex-shrink-0 p-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
            title={t('input.stop')}
          >
            <StopIcon />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={isDisabled}
            className={cn(
              'flex-shrink-0 p-1.5 rounded-md transition-colors',
              isDisabled
                ? 'text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
            title={t('input.send')}
          >
            <SendIcon />
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1 text-center">{t('input.sendHint')}</p>
    </div>
  );
});

const SendIcon = memo(function SendIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
});

const StopIcon = memo(function StopIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
});
