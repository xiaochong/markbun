// EditToolBody — edit tool display with inline diff view
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AIMessage } from '../../hooks/useAIChat';

interface EditToolBodyProps {
  message: AIMessage;
}

export const EditToolBody = memo(function EditToolBody({ message }: EditToolBodyProps) {
  const { t } = useTranslation('ai');

  const toolArgs = message.toolArgs as Record<string, unknown> | undefined;
  const toolResult = message.toolResult as Record<string, unknown> | undefined;

  const oldText = String(toolArgs?.old_text ?? '');
  const newText = String(toolArgs?.new_text ?? '');
  const replacements = Number(toolResult?.replacements ?? 0);
  const affectedChars = Math.abs(newText.length - oldText.length) * replacements;

  if (replacements === 0) {
    return <span className="text-muted-foreground italic">No changes made</span>;
  }

  return (
    <div className="space-y-2">
      {/* Stats */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{t('message.tool.replacements', { count: replacements })}</span>
        <span>·</span>
        <span>{t('message.tool.affectedChars', { count: affectedChars })}</span>
      </div>

      {/* Inline diff: show old_text (red) → new_text (green) */}
      <div className="space-y-1">
        {/* Old text — red background with strikethrough */}
        <div className="bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 rounded px-2 py-1 text-xs font-mono line-through whitespace-pre-wrap break-words">
          {oldText.length > 200 ? oldText.slice(0, 200) + '...' : oldText}
        </div>

        {/* New text — green background */}
        <div className="bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300 rounded px-2 py-1 text-xs font-mono whitespace-pre-wrap break-words">
          {newText.length > 200 ? newText.slice(0, 200) + '...' : newText}
        </div>

        {replacements > 1 && (
          <span className="text-[10px] text-muted-foreground">
            × {replacements}
          </span>
        )}
      </div>
    </div>
  );
});

export default EditToolBody;
