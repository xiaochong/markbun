// SessionHistoryDialog — modal for browsing and restoring past AI sessions
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { electrobun } from '@/lib/electrobun';
import type { AISessionSummaryData, AISessionData } from '@/shared/types';

interface SessionHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (session: AISessionData) => void;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function SessionHistoryDialog({ isOpen, onClose, onRestore }: SessionHistoryDialogProps) {
  const { t } = useTranslation('ai');
  const [sessions, setSessions] = useState<AISessionSummaryData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Load session list when dialog opens
  useEffect(() => {
    if (!isOpen) {
      setSessions([]);
      setSelectedId(null);
      setConfirmDeleteId(null);
      return;
    }
    setIsLoading(true);
    setSelectedId(null);
    electrobun.getAISessionList()
      .then((result) => {
        if (result.success && result.sessions) {
          setSessions(result.sessions);
          if (result.sessions.length > 0) setSelectedId(result.sessions[0].id);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-session-id="${selectedId}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const handleRestore = useCallback(async () => {
    if (!selectedId) return;
    const result = await electrobun.getAISession(selectedId);
    if (result.success && result.session) {
      onRestore(result.session);
      onClose();
    }
  }, [selectedId, onRestore, onClose]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await electrobun.deleteAISession(id);
      setSessions(prev => {
        const next = prev.filter(s => s.id !== id);
        if (selectedId === id) {
          setSelectedId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('[SessionHistory] Delete failed:', err);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [selectedId]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (sessions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        e.preventDefault();
        const currentIndex = sessions.findIndex(s => s.id === selectedId);
        let nextIndex: number;
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < sessions.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : sessions.length - 1;
        }
        setSelectedId(sessions[nextIndex].id);
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (selectedId) void handleRestore();
        break;
      }
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        if (selectedId) {
          if (confirmDeleteId === selectedId) {
            void handleDelete(selectedId);
          } else {
            setConfirmDeleteId(selectedId);
            // Auto-dismiss confirmation after 3s
            setTimeout(() => setConfirmDeleteId(prev => prev === selectedId ? null : prev), 3000);
          }
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        if (confirmDeleteId) {
          setConfirmDeleteId(null);
        } else {
          onClose();
        }
        break;
      }
    }
  }, [sessions, selectedId, confirmDeleteId, handleRestore, handleDelete, onClose]);

  if (!isOpen) return null;

  const selectedSession = sessions.find(s => s.id === selectedId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col w-[600px] h-[400px] bg-background rounded-lg shadow-xl overflow-hidden border"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('sessionHistory.title')}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {t('sessionHistory.loading')}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <span className="text-2xl">💬</span>
              <p className="text-xs text-muted-foreground">{t('sessionHistory.empty')}</p>
            </div>
          ) : (
            <ul ref={listRef} className="h-full overflow-y-auto py-1">
              {sessions.map((session) => (
                <li key={session.id} data-session-id={session.id}>
                  <button
                    onClick={() => setSelectedId(session.id)}
                    onDoubleClick={() => {
                      setSelectedId(session.id);
                      electrobun.getAISession(session.id).then(result => {
                        if (result.success && result.session) {
                          onRestore(result.session);
                          onClose();
                        }
                      });
                    }}
                    className={cn(
                      'w-full text-left px-4 py-2.5 transition-colors group relative',
                      selectedId === session.id
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-muted text-foreground',
                    )}
                  >
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span>{relativeTime(session.updatedAt)}</span>
                      {session.filePath && (
                        <>
                          <span>·</span>
                          <span className="truncate">{session.filePath.split('/').pop()}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{session.messageCount} msgs</span>
                    </p>
                    {/* Delete button */}
                    {confirmDeleteId === session.id ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleDelete(session.id); }}
                        className={cn(
                          'absolute right-2 top-1/2 -translate-y-1/2',
                          'px-2 py-0.5 text-xs rounded bg-red-500 text-white',
                        )}
                      >
                        {t('sessionHistory.confirmDelete')}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(session.id); }}
                        disabled={deletingIds.has(session.id)}
                        className={cn(
                          'absolute right-2 top-1/2 -translate-y-1/2',
                          'opacity-0 group-hover:opacity-100 transition-opacity',
                          'p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950',
                          deletingIds.has(session.id) && 'opacity-40 cursor-wait',
                        )}
                        title={t('sessionHistory.delete')}
                        aria-label={t('sessionHistory.delete')}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 4h12M6 4V2h4v2M5 4l1 10h4l1-10" />
                        </svg>
                      </button>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t bg-muted/30 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md hover:bg-muted transition-colors"
          >
            {t('sessionHistory.close')}
          </button>
          <button
            onClick={() => { void handleRestore(); }}
            disabled={!selectedId}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              !selectedId
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {t('sessionHistory.restore')}
          </button>
        </div>
      </div>
    </div>
  );
}
