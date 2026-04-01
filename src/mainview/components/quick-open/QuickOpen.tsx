import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { PaletteItem, FocusedGroup, GroupedResults } from '@/shared/types';

interface QuickOpenProps {
  isOpen: boolean;
  query: string;
  groupedResults: GroupedResults;
  selectedIndex: number;
  focusedGroup: FocusedGroup;
  onQueryChange: (query: string) => void;
  onSelect: (path: string) => void;
  onCommandSelect: (action: string) => void;
  onClose: () => void;
  onSelectNext: () => void;
  onSelectPrevious: () => void;
  onTabGroup: () => void;
  onShiftTabGroup: () => void;
}

export function QuickOpen({
  isOpen,
  query,
  groupedResults,
  selectedIndex,
  focusedGroup,
  onQueryChange,
  onSelect,
  onCommandSelect,
  onClose,
  onSelectNext,
  onSelectPrevious,
  onTabGroup,
  onShiftTabGroup,
}: QuickOpenProps) {
  const { t } = useTranslation('file');
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { files, commands } = groupedResults;
  const totalItems = files.length + commands.length;
  const hasFiles = files.length > 0;
  const hasCommands = commands.length > 0;
  const hasBothGroups = hasFiles && hasCommands;

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  // Resolve the selected item from selectedIndex and focusedGroup
  const getSelectedItem = useCallback((): PaletteItem | null => {
    if (focusedGroup === 'files') return files[selectedIndex] || null;
    if (focusedGroup === 'commands') return commands[selectedIndex] || null;
    // null mode: virtual list is files first, then commands
    if (selectedIndex < files.length) return files[selectedIndex];
    return commands[selectedIndex - files.length] || null;
  }, [files, commands, selectedIndex, focusedGroup]);

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
        const item = getSelectedItem();
        if (item) {
          if (item.type === 'file') {
            onSelect(item.path);
          } else {
            onCommandSelect(item.action);
          }
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Tab':
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          onShiftTabGroup();
        } else {
          onTabGroup();
        }
        break;
    }
  }, [onSelectNext, onSelectPrevious, getSelectedItem, onSelect, onCommandSelect, onClose, onTabGroup, onShiftTabGroup]);

  // Scroll selected item into view using data-palette-index
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-palette-index="${selectedIndex}"]`) as HTMLElement;
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Build a virtual index for selection
  let virtualIndex = 0;

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
            placeholder={t('quickOpen.placeholderCommands')}
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          <kbd className="px-2 py-0.5 text-xs bg-muted rounded text-muted-foreground">
            {t('quickOpen.esc')}
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-[500px] overflow-y-auto">
          {totalItems === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              {query.trim() ? t('quickOpen.noResults') : t('quickOpen.startTyping')}
            </div>
          ) : (
            <>
              {/* Files Group */}
              {hasFiles && (
                <>
                  <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 sticky top-0">
                    {t('quickOpen.filesGroup')}
                  </div>
                  {files.map((item) => {
                    const fileItem = item as PaletteItem & { type: 'file' };
                    const idx = virtualIndex++;
                    const isSelected = isItemSelected(focusedGroup, selectedIndex, idx, files.length);
                    return (
                      <button
                        key={`file-${fileItem.path}`}
                        data-palette-index={idx}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                        )}
                        onClick={() => { onSelect(fileItem.path); onClose(); }}
                      >
                        <FileIcon className={cn('w-4 h-4 flex-shrink-0', isSelected ? 'text-accent-foreground' : 'text-muted-foreground')} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{useHighlight(fileItem.name, query)}</div>
                          <div className={cn('text-xs truncate', isSelected ? 'text-accent-foreground/70' : 'text-muted-foreground')}>
                            {fileItem.path}
                          </div>
                        </div>
                        {fileItem.isRecent && (
                          <span className={cn(
                            'px-1.5 py-0.5 text-[10px] rounded',
                            isSelected ? 'bg-accent-foreground/20' : 'bg-muted'
                          )}>
                            {t('quickOpen.recent')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
              {/* Commands Group */}
              {hasCommands && (
                <>
                  <div className="px-4 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 sticky top-0 border-t border-border/50">
                    {t('quickOpen.commandsGroup')}
                  </div>
                  {commands.map((item) => {
                    const cmdItem = item as PaletteItem & { type: 'command' };
                    const idx = virtualIndex++;
                    const isSelected = isItemSelected(focusedGroup, selectedIndex, idx, files.length);
                    return (
                      <button
                        key={`cmd-${cmdItem.action}`}
                        data-palette-index={idx}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                          isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
                        )}
                        onClick={() => { onCommandSelect(cmdItem.action); onClose(); }}
                      >
                        <CommandIcon className={cn('w-4 h-4 flex-shrink-0', isSelected ? 'text-accent-foreground' : 'text-muted-foreground')} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{useHighlight(cmdItem.label, query)}</div>
                        </div>
                        {cmdItem.accelerator && (
                          <kbd className={cn(
                            'px-1.5 py-0.5 text-[10px] rounded flex-shrink-0',
                            isSelected ? 'bg-accent-foreground/20 text-accent-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            {cmdItem.accelerator}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground border-t border-border bg-muted/30">
          <span>{t('quickOpen.resultCount', { count: totalItems })}</span>
          <span className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd> {t('quickOpen.navigate')}
            <kbd className="px-1.5 py-0.5 bg-muted rounded">↵</kbd> {t('quickOpen.open')}
            {hasBothGroups && (
              <>
                <kbd className="px-1.5 py-0.5 bg-muted rounded">Tab</kbd> {t('quickOpen.switchGroup')}
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

// Determine if an item at `idx` is selected based on focus mode
function isItemSelected(focusedGroup: FocusedGroup, selectedIndex: number, idx: number, filesLength: number): boolean {
  if (focusedGroup === 'files') return idx === selectedIndex;
  if (focusedGroup === 'commands') return (idx - filesLength) === selectedIndex;
  // null mode: virtual list is files first, then commands
  return idx === selectedIndex;
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

function CommandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
