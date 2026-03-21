import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { electrobun } from '@/lib/electrobun';
import type { BackupEntry } from '@/shared/types';

interface FileHistoryDialogProps {
  isOpen: boolean;
  filePath: string | null;
  onClose: () => void;
  onRestore: (content: string) => void | Promise<void>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileName(path: string) {
  return path.split('/').pop() ?? path;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FileHistoryDialog({ isOpen, filePath, onClose, onRestore }: FileHistoryDialogProps) {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [selected, setSelected] = useState<BackupEntry | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [deletingPaths, setDeletingPaths] = useState<Set<string>>(new Set());

  // Load backup list whenever dialog opens for a new file
  useEffect(() => {
    if (!isOpen || !filePath) {
      setBackups([]);
      setSelected(null);
      setPreviewContent(null);
      return;
    }
    setIsLoadingBackups(true);
    setSelected(null);
    setPreviewContent(null);

    electrobun.getVersionBackups(filePath)
      .then((result) => {
        const r = result as { success: boolean; backups?: BackupEntry[] };
        const list = r.success ? (r.backups ?? []) : [];
        setBackups(list);
        if (list.length > 0) setSelected(list[0]);
      })
      .catch(console.error)
      .finally(() => setIsLoadingBackups(false));
  }, [isOpen, filePath]);

  // Load preview content whenever selection changes
  useEffect(() => {
    if (!selected) {
      setPreviewContent(null);
      return;
    }
    setIsLoadingPreview(true);
    setPreviewContent(null);

    electrobun.restoreVersionBackup(selected.path)
      .then((result) => {
        const r = result as { success: boolean; content?: string };
        setPreviewContent(r.success ? (r.content ?? '') : null);
      })
      .catch(console.error)
      .finally(() => setIsLoadingPreview(false));
  }, [selected]);

  const handleRestore = useCallback(async () => {
    if (!previewContent || isRestoring) return;
    setIsRestoring(true);
    try {
      await onRestore(previewContent);
      onClose();
    } finally {
      setIsRestoring(false);
    }
  }, [previewContent, isRestoring, onRestore, onClose]);

  const handleDelete = useCallback(async (entry: BackupEntry) => {
    setDeletingPaths(prev => new Set(prev).add(entry.path));
    try {
      await electrobun.deleteVersionBackup(entry.path);
      setBackups(prev => {
        const next = prev.filter(b => b.path !== entry.path);
        // If we deleted the selected entry, auto-select the next one
        if (selected?.path === entry.path) {
          setSelected(next.length > 0 ? next[0] : null);
        }
        return next;
      });
    } catch (err) {
      console.error('[FileHistory] Delete failed:', err);
    } finally {
      setDeletingPaths(prev => {
        const next = new Set(prev);
        next.delete(entry.path);
        return next;
      });
    }
  }, [selected]);

  if (!isOpen) return null;

  const title = filePath ? `History — ${fileName(filePath)}` : 'File History';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex flex-col w-[760px] h-[540px] bg-background rounded-lg shadow-xl overflow-hidden border">

        {/* Header */}
        <div className="px-5 py-3.5 border-b bg-muted/30 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">{title}</h2>
            {backups.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {backups.length} version{backups.length !== 1 ? 's' : ''} saved
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">

          {/* Left — version list */}
          <div className="w-52 border-r flex flex-col bg-muted/10">
            {isLoadingBackups ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : backups.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
                <span className="text-2xl">🕐</span>
                <p className="text-xs text-muted-foreground">
                  No history yet. Versions are saved automatically before each save.
                </p>
              </div>
            ) : (
              <ul className="flex-1 overflow-y-auto py-1">
                {backups.map((entry) => (
                  <li key={entry.path}>
                    <button
                      onClick={() => setSelected(entry)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 transition-colors group relative',
                        selected?.path === entry.path
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted text-foreground',
                      )}
                    >
                      <p className="text-xs font-medium">{formatDate(entry.timestamp)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-between">
                        <span>{relativeTime(entry.timestamp)}</span>
                        <span>{formatBytes(entry.size)}</span>
                      </p>
                      {/* Delete button — visible on hover */}
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDelete(entry); }}
                        disabled={deletingPaths.has(entry.path)}
                        className={cn(
                          'absolute right-1.5 top-1/2 -translate-y-1/2',
                          'opacity-0 group-hover:opacity-100 transition-opacity',
                          'p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950',
                          deletingPaths.has(entry.path) && 'opacity-40 cursor-wait',
                        )}
                        title="Delete this version"
                        aria-label="Delete version"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 4h12M6 4V2h4v2M5 4l1 10h4l1-10"/>
                        </svg>
                      </button>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Right — content preview */}
          <div className="flex-1 flex flex-col min-w-0">
            {selected === null ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Select a version to preview
              </div>
            ) : isLoadingPreview ? (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Loading preview…
              </div>
            ) : previewContent === null ? (
              <div className="flex-1 flex items-center justify-center text-sm text-destructive">
                Could not load this version.
              </div>
            ) : (
              <pre className="flex-1 overflow-auto p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words text-foreground">
                {previewContent}
              </pre>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-muted/30 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => { void handleRestore(); }}
            disabled={!selected || previewContent === null || isRestoring}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              !selected || previewContent === null || isRestoring
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {isRestoring ? 'Restoring…' : 'Restore this version'}
          </button>
        </div>
      </div>
    </div>
  );
}
