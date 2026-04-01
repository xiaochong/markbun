import { useState, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { electrobun } from '@/lib/electrobun';
import { COMMANDS } from '../../shared/commandRegistry';
import type { PaletteItem, FocusedGroup, GroupedResults } from '../../shared/types';

export type { FocusedGroup, GroupedResults };

export interface UseQuickOpenReturn {
  isOpen: boolean;
  query: string;
  groupedResults: GroupedResults;
  selectedIndex: number;
  focusedGroup: FocusedGroup;
  open: () => void;
  close: () => void;
  setQuery: (query: string) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  confirmSelection: () => PaletteItem | null;
  onTabGroup: () => void;
  onShiftTabGroup: () => void;
}

const MAX_PER_GROUP = 7;

export function useQuickOpen(
  onSelect: (path: string) => void,
  onCommandSelect: (action: string) => void,
): UseQuickOpenReturn {
  const { t } = useTranslation('menu');
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQueryState] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [fileItems, setFileItems] = useState<PaletteItem[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [focusedGroup, setFocusedGroup] = useState<FocusedGroup>('files');
  const debounceTimerRef = useRef<number | null>(null);

  // Build command items from registry (re-resolve when locale changes)
  const allCommandItems: PaletteItem[] = useMemo(() => {
    return COMMANDS.map(cmd => ({
      type: 'command' as const,
      action: cmd.action,
      label: t(cmd.i18nKey),
      accelerator: cmd.accelerator,
    }));
  }, [t]);

  // Load data when opening
  const open = useCallback(async () => {
    const [fileResult, historyResult] = await Promise.all([
      electrobun.quickOpen(),
      electrobun.getCommandHistory(),
    ]);

    const fr = fileResult as { success: boolean; items?: { path: string; name: string; isRecent: boolean }[] };
    const hr = historyResult as { success: boolean; history?: string[] };

    if (fr.success && fr.items) {
      setFileItems(fr.items.map(item => ({
        type: 'file' as const,
        path: item.path,
        name: item.name,
        isRecent: item.isRecent,
      })));
    } else {
      setFileItems([]);
    }

    if (hr.success && hr.history) {
      setCommandHistory(hr.history);
    } else {
      setCommandHistory([]);
    }

    setSelectedIndex(0);
    setFocusedGroup('files');
    setQueryState('');
    setDebouncedQuery('');
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQueryState('');
    setDebouncedQuery('');
    setSelectedIndex(0);
    setFocusedGroup('files');
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
    setSelectedIndex(0);
    // New query resets focusedGroup to null (search both groups)
    setFocusedGroup(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      setDebouncedQuery(newQuery);
    }, 150);
  }, []);

  // Scored and filtered results
  const groupedResults = useMemo((): GroupedResults => {
    const q = debouncedQuery.trim().toLowerCase();
    const historySet = new Set(commandHistory);

    if (!q) {
      // Empty query: show recent files + recent commands (by history order)
      const recentFiles = fileItems
        .filter((f): f is PaletteItem & { type: 'file' } => f.type === 'file' && f.isRecent)
        .slice(0, MAX_PER_GROUP);
      const recentCommands = commandHistory
        .map(action => allCommandItems.find(c => c.type === 'command' && c.action === action))
        .filter((c): c is PaletteItem & { type: 'command' } => c != null)
        .slice(0, MAX_PER_GROUP);
      return { files: recentFiles, commands: recentCommands };
    }

    // Fuzzy score files
    const scoredFiles = fileItems
      .filter((f): f is PaletteItem & { type: 'file'; name: string } => f.type === 'file')
      .map(item => ({
        ...item,
        score: fuzzyScore(item.name.toLowerCase(), q),
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, MAX_PER_GROUP);

    // Fuzzy score commands (search against label)
    const scoredCommands = allCommandItems
      .filter((item): item is PaletteItem & { type: 'command' } => item.type === 'command')
      .map(item => {
        let score = fuzzyScore(item.label.toLowerCase(), q);
        // Recency bonus for commands in history
        if (score > 0 && historySet.has(item.action)) {
          score += 2;
        }
        return { ...item, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, MAX_PER_GROUP);

    return { files: scoredFiles, commands: scoredCommands };
  }, [fileItems, allCommandItems, debouncedQuery, commandHistory]);

  // Total selectable items based on focus mode
  const totalItems = useMemo(() => {
    if (focusedGroup === 'files') return groupedResults.files.length;
    if (focusedGroup === 'commands') return groupedResults.commands.length;
    return groupedResults.files.length + groupedResults.commands.length;
  }, [focusedGroup, groupedResults]);

  const selectNext = useCallback(() => {
    setSelectedIndex(prev =>
      prev < totalItems - 1 ? prev + 1 : prev
    );
  }, [totalItems]);

  const selectPrevious = useCallback(() => {
    setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
  }, []);

  const confirmSelection = useCallback(() => {
    const { files, commands } = groupedResults;
    let item: PaletteItem | null = null;

    if (focusedGroup === 'files') {
      item = files[selectedIndex] || null;
    } else if (focusedGroup === 'commands') {
      item = commands[selectedIndex] || null;
    } else {
      // null mode: virtual list is files first, then commands
      if (selectedIndex < files.length) {
        item = files[selectedIndex];
      } else {
        item = commands[selectedIndex - files.length] || null;
      }
    }

    if (!item) return null;

    if (item.type === 'file') {
      onSelect(item.path);
    } else {
      onCommandSelect(item.action);
      // Record command usage (fire and forget)
      void electrobun.recordCommandUsage(item.action);
    }
    close();
    return item;
  }, [groupedResults, selectedIndex, focusedGroup, onSelect, onCommandSelect, close]);

  const onTabGroup = useCallback(() => {
    const { files, commands } = groupedResults;
    if (files.length === 0 || commands.length === 0) return;

    setFocusedGroup(prev => {
      if (prev === 'files') return 'commands';
      return 'files';
    });
    setSelectedIndex(0);
  }, [groupedResults]);

  const onShiftTabGroup = useCallback(() => {
    const { files, commands } = groupedResults;
    if (files.length === 0 || commands.length === 0) return;

    setFocusedGroup(prev => {
      if (prev === 'commands') return 'files';
      return 'commands';
    });
    setSelectedIndex(0);
  }, [groupedResults]);

  return {
    isOpen,
    query,
    groupedResults,
    selectedIndex,
    focusedGroup,
    open,
    close,
    setQuery,
    selectNext,
    selectPrevious,
    confirmSelection,
    onTabGroup,
    onShiftTabGroup,
  };
}

// Fuzzy matching algorithm
function fuzzyScore(target: string, query: string): number {
  let score = 0;
  let targetIndex = 0;
  let queryIndex = 0;

  while (queryIndex < query.length && targetIndex < target.length) {
    if (target[targetIndex] === query[queryIndex]) {
      score += 1;
      if (targetIndex === 0) score += 2; // Bonus for matching start
      queryIndex++;
    }
    targetIndex++;
  }

  // Return 0 if not all query characters were found
  if (queryIndex < query.length) return 0;

  // Penalty for length difference
  score -= (target.length - query.length) * 0.1;

  return Math.max(0, score);
}
