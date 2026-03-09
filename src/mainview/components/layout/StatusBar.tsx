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
  const words = countWords(content);
  const chars = countCharacters(content);
  const lines = countLines(content);

  const saveStatusText = {
    saving: 'Saving...',
    saved: 'Saved',
    error: 'Save failed',
  }[onSaveStatus || 'saved'];

  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-1 text-xs border-t bg-background text-muted-foreground',
      className
    )}>
      <div className="flex items-center gap-4">
        {/* File info */}
        <span className="truncate max-w-[200px]">
          {filePath ? filePath.split('/').pop() : 'Untitled'}
        </span>
        {isDirty && <span className="text-primary">●</span>}
      </div>

      <div className="flex items-center gap-4">
        {/* Stats */}
        <span>{words} words</span>
        <span>{chars} characters</span>
        <span>{lines} lines</span>
        
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
