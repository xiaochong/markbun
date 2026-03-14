import { useState, useCallback, useEffect, useMemo } from 'react';
import { electrobun } from '@/lib/electrobun';
import type { QuickOpenItem, RecentFile } from '@/shared/types';

export interface UseQuickOpenReturn {
  isOpen: boolean;
  query: string;
  items: QuickOpenItem[];
  selectedIndex: number;
  open: () => void;
  close: () => void;
  setQuery: (query: string) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  confirmSelection: () => QuickOpenItem | null;
}

export function useQuickOpen(onSelect: (path: string) => void): UseQuickOpenReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQueryState] = useState('');
  const [items, setItems] = useState<QuickOpenItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Load items when opening
  const open = useCallback(async () => {
    const result = await electrobun.quickOpen() as {
      success: boolean;
      items?: QuickOpenItem[];
      error?: string;
    };

    if (result.success && result.items) {
      setItems(result.items);
      setSelectedIndex(0);
      setIsOpen(true);
    }
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setQueryState('');
    setSelectedIndex(0);
  }, []);

  const setQuery = useCallback((newQuery: string) => {
    setQueryState(newQuery);
    setSelectedIndex(0);
  }, []);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;

    const q = query.toLowerCase();
    return items
      .map(item => ({
        ...item,
        score: fuzzyScore(item.name.toLowerCase(), q),
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [items, query]);

  const selectNext = useCallback(() => {
    setSelectedIndex(prev =>
      prev < filteredItems.length - 1 ? prev + 1 : prev
    );
  }, [filteredItems.length]);

  const selectPrevious = useCallback(() => {
    setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
  }, []);

  const confirmSelection = useCallback(() => {
    const item = filteredItems[selectedIndex];
    if (item) {
      onSelect(item.path);
      close();
    }
    return item || null;
  }, [filteredItems, selectedIndex, onSelect, close]);

  return {
    isOpen,
    query,
    items: filteredItems,
    selectedIndex,
    open,
    close,
    setQuery,
    selectNext,
    selectPrevious,
    confirmSelection,
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
