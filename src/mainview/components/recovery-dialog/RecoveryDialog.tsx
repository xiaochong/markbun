import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { electrobun } from '@/lib/electrobun';
import type { RecoveryInfo } from '@/shared/types';

interface RecoveryDialogProps {
  isOpen: boolean;
  recoveries: RecoveryInfo[];
  onClose: () => void;
  onRecover: (content: string, path: string) => void | Promise<void>;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileName(path: string) {
  return path.split('/').pop() ?? path;
}

export function RecoveryDialog({ isOpen, recoveries, onClose, onRecover }: RecoveryDialogProps) {
  const [selected, setSelected] = useState<RecoveryInfo | null>(recoveries[0] ?? null);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = useCallback(async () => {
    if (!selected || isRestoring) return;
    setIsRestoring(true);
    try {
      const result = await electrobun.recoverFile(
        selected.recoveryPath,
        selected.originalPath,
      ) as { success: boolean; path?: string; content?: string; error?: string };

      if (result.success && result.content && result.path) {
        // Remove the recovery file so it doesn't show up again
        await electrobun.clearRecovery(selected.recoveryPath).catch(() => {});
        await onRecover(result.content, result.path);
        onClose();
      } else {
        console.error('[RecoveryDialog] Restore failed:', result.error);
      }
    } finally {
      setIsRestoring(false);
    }
  }, [selected, isRestoring, onRecover, onClose]);

  const handleDismiss = useCallback(async () => {
    if (selected) {
      await electrobun.clearRecovery(selected.recoveryPath).catch(() => {});
    }
    // Remove from list or close if no more
    if (recoveries.length <= 1) {
      onClose();
    } else {
      const next = recoveries.find(r => r.recoveryPath !== selected?.recoveryPath) ?? null;
      setSelected(next);
    }
  }, [selected, recoveries, onClose]);

  const handleDismissAll = useCallback(async () => {
    await Promise.all(
      recoveries.map(r => electrobun.clearRecovery(r.recoveryPath).catch(() => {}))
    );
    onClose();
  }, [recoveries, onClose]);

  if (!isOpen || recoveries.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[580px] max-h-[80vh] bg-background rounded-lg shadow-xl overflow-hidden border flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b bg-muted/30">
          <h2 className="text-base font-semibold">Recover unsaved changes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {recoveries.length === 1
              ? 'A file was not saved cleanly on last exit.'
              : `${recoveries.length} files were not saved cleanly on last exit.`}
          </p>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {recoveries.map(r => (
            <button
              key={r.recoveryPath}
              onClick={() => setSelected(r)}
              className={cn(
                'w-full text-left p-3 rounded-lg border transition-colors',
                selected?.recoveryPath === r.recoveryPath
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={r.originalPath}>
                    {fileName(r.originalPath)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{r.originalPath}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <p>{formatDate(r.lastModified)}</p>
                  <p>{formatBytes(r.size)}</p>
                </div>
              </div>
              {r.preview && (
                <p className="mt-2 text-xs text-muted-foreground font-mono bg-muted rounded px-2 py-1 line-clamp-2 whitespace-pre-wrap">
                  {r.preview}{r.preview.length >= 200 ? '…' : ''}
                </p>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-muted/30 flex items-center justify-between gap-2">
          <div className="flex gap-2">
            {recoveries.length > 1 && (
              <button
                onClick={handleDismissAll}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Dismiss all
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {recoveries.length === 1 ? 'Dismiss' : 'Dismiss selected'}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
            >
              Later
            </button>
            <button
              onClick={handleRestore}
              disabled={!selected || isRestoring}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
                !selected || isRestoring
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {isRestoring ? 'Restoring…' : 'Restore'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
