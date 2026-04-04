// SessionHeader — AI chat session header with reset button
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface SessionHeaderProps {
  onReset: () => void;
  onClose: () => void;
}

export const SessionHeader = memo(function SessionHeader({ onReset, onClose }: SessionHeaderProps) {
  const { t } = useTranslation('ai');

  const handleReset = useCallback(() => {
    onReset();
  }, [onReset]);

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
      <h2 className="text-sm font-medium text-foreground">{t('panel.title')}</h2>
      <div className="flex items-center gap-1">
        <button
          onClick={handleReset}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title={t('session.newChat')}
        >
          <NewChatIcon />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Close"
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
});

const NewChatIcon = memo(function NewChatIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
});

const CloseIcon = memo(function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
});
