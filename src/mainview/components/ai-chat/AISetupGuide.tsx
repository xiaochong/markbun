// AISetupGuide — shown when AI is not configured or disabled
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface AISetupGuideProps {
  isDisabled?: boolean;
  onOpenSettings: () => void;
}

export const AISetupGuide = memo(function AISetupGuide({ isDisabled, onOpenSettings }: AISetupGuideProps) {
  const { t } = useTranslation('ai');

  const handleOpenSettings = useCallback(() => {
    onOpenSettings();
  }, [onOpenSettings]);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center max-w-[240px]">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <AIIcon />
        </div>
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">
            {isDisabled ? t('setup.disabled') : t('setup.title')}
          </h3>
          {!isDisabled && (
            <p className="text-xs text-muted-foreground">{t('setup.description')}</p>
          )}
        </div>
        <button
          onClick={handleOpenSettings}
          className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t('setup.openSettings')}
        </button>
      </div>
    </div>
  );
});

const AIIcon = memo(function AIIcon() {
  return (
    <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  );
});
