/**
 * Search & Replace bar for WYSIWYG mode.
 * Rendered at the top of the editor area, below the toolbar.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useSearch } from './useSearch';
import type { EditorView } from '@milkdown/prose/view';

interface SearchBarProps {
  getEditorView: (() => EditorView | null) | null;
  isVisible: boolean;
  onClose: () => void;
  showReplace: boolean;
}

export function SearchBar({ getEditorView, isVisible, onClose, showReplace }: SearchBarProps) {
  const { t } = useTranslation('editor');
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  const {
    query,
    setQuery,
    replacement,
    setReplacement,
    caseSensitive,
    toggleCaseSensitive,
    useRegex,
    toggleRegex,
    matchCount,
    activeIndex,
    error,
    nextMatch,
    prevMatch,
    replaceCurrent,
    replaceAll,
  } = useSearch(isVisible ? getEditorView : null);

  // Auto-focus find input when opened
  useEffect(() => {
    if (isVisible) {
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isVisible]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          prevMatch();
        } else {
          nextMatch();
        }
      }
    },
    [onClose, nextMatch, prevMatch],
  );

  if (!isVisible) return null;

  return (
    <div className="flex flex-col border-b border-border bg-background px-3 py-2 text-sm">
      {/* Find row */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('search.findPlaceholder', 'Find')}
          className={cn(
            'flex-1 min-w-0 rounded border bg-transparent px-2 py-1 text-foreground outline-none',
            'placeholder:text-muted-foreground',
            error
              ? 'border-red-500 focus:border-red-500'
              : 'border-border focus:border-primary',
          )}
        />

        {/* Match count */}
        <span className="shrink-0 text-xs text-muted-foreground min-w-[60px] text-center tabular-nums">
          {query
            ? matchCount > 0
              ? `${activeIndex + 1}/${matchCount}`
              : t('search.noResults', 'No results')
            : ''}
        </span>

        {/* Option toggles */}
        <button
          onClick={toggleCaseSensitive}
          className={cn(
            'rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
            caseSensitive
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground',
          )}
          title={t('search.caseSensitive', 'Match Case')}
        >
          Aa
        </button>
        <button
          onClick={toggleRegex}
          className={cn(
            'rounded px-1.5 py-0.5 text-xs font-medium transition-colors',
            useRegex
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-muted-foreground',
          )}
          title={t('search.regex', 'Use Regular Expression')}
        >
          .*
        </button>

        {/* Navigation */}
        <button
          onClick={prevMatch}
          disabled={matchCount === 0}
          className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-40"
          title={t('search.prevMatch', 'Previous Match')}
        >
          <ChevronUpIcon />
        </button>
        <button
          onClick={nextMatch}
          disabled={matchCount === 0}
          className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-40"
          title={t('search.nextMatch', 'Next Match')}
        >
          <ChevronDownIcon />
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted text-muted-foreground"
          title={t('search.close', 'Close')}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Replace row (collapsible) */}
      {showReplace && (
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={replaceInputRef}
            type="text"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.replacePlaceholder', 'Replace')}
            className="flex-1 min-w-0 rounded border border-border bg-transparent px-2 py-1 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <button
            onClick={replaceCurrent}
            disabled={matchCount === 0}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted text-muted-foreground disabled:opacity-40"
            title={t('search.replace', 'Replace')}
          >
            {t('search.replace', 'Replace')}
          </button>
          <button
            onClick={replaceAll}
            disabled={matchCount === 0}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted text-muted-foreground disabled:opacity-40"
            title={t('search.replaceAll', 'Replace All')}
          >
            {t('search.replaceAll', 'Replace All')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Inline SVG icons (tiny, no external dep) ────────────────────────

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
