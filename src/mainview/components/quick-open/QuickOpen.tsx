import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { QuickOpenItem } from '@/shared/types';

interface QuickOpenProps {
  isOpen: boolean;
  query: string;
  items: QuickOpenItem[];
  selectedIndex: number;
  onQueryChange: (query: string) => void;
  onSelect: (path: string) => void;
  onClose: () => void;
  onSelectNext: () => void;
  onSelectPrevious: () => void;
}

export function QuickOpen({
  isOpen,
  query,
  items,
  selectedIndex,
  onQueryChange,
  onSelect,
  onClose,
  onSelectNext,
  onSelectPrevious,
}: QuickOpenProps) {
  const { t } = useTranslation('file');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        onSelectNext();
        break;
      case 'ArrowUp':
        e.preventDefault();
        onSelectPrevious();
        break;
      case 'Enter':
        e.preventDefault();
        const item = items[selectedIndex];
        if (item) {
          onSelect(item.path);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [items, selectedIndex, onSelect, onClose, onSelectNext, onSelectPrevious]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[600px] max-w-[90vw] bg-popover rounded-lg shadow-xl border border-border overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <SearchIcon className="w-5 h-5 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('quickOpen.placeholder')}
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          <kbd className="px-2 py-0.5 text-xs bg-muted rounded text-muted-foreground">
            {t('quickOpen.esc')}
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              {query.trim() ? t('quickOpen.noResults') : t('quickOpen.startTyping')}
            </div>
          ) : (
            items.map((item, index) => (
              <QuickOpenItem
                key={item.path}
                item={item}
                isSelected={index === selectedIndex}
                query={query}
                onClick={() => onSelect(item.path)}
                recentLabel={t('quickOpen.recent')}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground border-t border-border bg-muted/30">
          <span>{t('quickOpen.fileCount', { count: items.length })}</span>
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd> {t('quickOpen.navigate')}
            <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd> {t('quickOpen.open')}
          </span>
        </div>
      </div>
    </div>
  );
}

// Quick Open Item Component
interface QuickOpenItemProps {
  item: QuickOpenItem;
  isSelected: boolean;
  query: string;
  onClick: () => void;
  recentLabel: string;
}

function QuickOpenItem({ item, isSelected, query, onClick, recentLabel }: QuickOpenItemProps) {
  const highlightedName = useHighlight(item.name, query);

  return (
    <button
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
      )}
      onClick={onClick}
    >
      <FileIcon className={cn('w-4 h-4 flex-shrink-0', isSelected ? 'text-accent-foreground' : 'text-muted-foreground')} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{highlightedName}</div>
        <div className={cn('text-xs truncate', isSelected ? 'text-accent-foreground/70' : 'text-muted-foreground')}>
          {item.path}
        </div>
      </div>
      {item.isRecent && (
        <span className={cn(
          'px-1.5 py-0.5 text-[10px] rounded',
          isSelected ? 'bg-accent-foreground/20' : 'bg-muted'
        )}>
          {recentLabel}
        </span>
      )}
    </button>
  );
}

// Highlight matching text
function useHighlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="bg-primary/30 rounded px-0.5">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Icons
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
