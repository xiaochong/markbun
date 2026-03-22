import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { countWords, countCharacters, countLines } from '@/lib/utils';

interface StatusBarProps {
  className?: string;
  filePath?: string;
  isDirty?: boolean;
  content?: string;
  onSaveStatus?: 'saving' | 'saved' | 'error';
}

export function StatusBar({
  className,
  filePath,
  isDirty,
  content = '',
  onSaveStatus,
}: StatusBarProps) {
  const { t: te } = useTranslation('editor');
  const { t: tc } = useTranslation('common');

  const words = countWords(content);
  const chars = countCharacters(content);
  const lines = countLines(content);

  const saveStatusText = {
    saving: tc('status.saving'),
    saved: tc('status.saved'),
    error: tc('status.saveFailed'),
  }[onSaveStatus || 'saved'];

  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-1 text-xs border-t bg-background text-muted-foreground',
      className
    )}>
      <div className="flex items-center gap-4">
        {/* File info */}
        <span className="truncate max-w-[200px]">
          {filePath ? filePath.split('/').pop() : te('statusBar.untitled')}
        </span>
        {isDirty && <span className="text-primary">●</span>}
      </div>

      <div className="flex items-center gap-4">
        {/* Stats */}
        <span>{words} {te('statusBar.words')}</span>
        <span>{chars} {te('statusBar.characters')}</span>
        <span>{lines} {te('statusBar.lines')}</span>

        {/* Save status */}
        {onSaveStatus && (
          <span className={cn(
            onSaveStatus === 'saving' && 'text-muted-foreground',
            onSaveStatus === 'saved' && 'text-green-600',
            onSaveStatus === 'error' && 'text-red-600'
          )}>
            {saveStatusText}
          </span>
        )}
      </div>
    </div>
  );
}
