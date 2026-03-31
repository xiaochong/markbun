/**
 * React hook bridging SearchBar UI with the ProseMirror search plugin.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { EditorView } from '@milkdown/prose/view';
import {
  searchPluginKey,
  dispatchSearchAction,
  type SearchPluginState,
} from '../editor/plugins/searchPlugin';

export interface UseSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  replacement: string;
  setReplacement: (r: string) => void;
  caseSensitive: boolean;
  toggleCaseSensitive: () => void;
  useRegex: boolean;
  toggleRegex: () => void;
  matchCount: number;
  activeIndex: number;
  error: string | null;
  nextMatch: () => void;
  prevMatch: () => void;
  replaceCurrent: () => void;
  replaceAll: () => void;
}

export function useSearch(
  getEditorView: (() => EditorView | null) | null,
): UseSearchReturn {
  const [query, setQueryInternal] = useState('');
  const [replacement, setReplacement] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  // Keep latest options in refs so the plugin callback can read them
  const caseSensitiveRef = useRef(caseSensitive);
  const useRegexRef = useRef(useRegex);
  caseSensitiveRef.current = caseSensitive;
  useRegexRef.current = useRegex;

  // Register a callback with the search plugin so React re-renders on state changes.
  // The callback is set once when the view becomes available.
  useEffect(() => {
    if (!getEditorView) return;
    const view = getEditorView();
    if (!view) return;

    // We piggyback on ProseMirror's dispatch — every time the view updates,
    // read the plugin state and sync to React.
    const origDispatch = view.dispatch.bind(view);
    const patchedDispatch = (tr: any) => {
      origDispatch(tr);
      const state = searchPluginKey.getState(view.state);
      if (state) syncFromPlugin(state);
    };
    (view as any).dispatch = patchedDispatch;

    return () => {
      (view as any).dispatch = origDispatch;
    };
  }, [getEditorView]);

  function syncFromPlugin(state: SearchPluginState) {
    setMatchCount(state.matches.length);
    setActiveIndex(state.activeIndex);
    setError(state.error);
  }

  const setQuery = useCallback((q: string) => {
    setQueryInternal(q);
    if (!getEditorView) return;
    const view = getEditorView();
    if (!view) return;
    if (!q) {
      dispatchSearchAction(view, { type: 'clear' });
      return;
    }
    dispatchSearchAction(view, {
      type: 'setQuery',
      query: q,
      caseSensitive: caseSensitiveRef.current,
      useRegex: useRegexRef.current,
    });
  }, [getEditorView]);

  const toggleCaseSensitive = useCallback(() => {
    const next = !caseSensitiveRef.current;
    setCaseSensitive(next);
    if (!getEditorView) return;
    const view = getEditorView();
    if (!view || !query) return;
    dispatchSearchAction(view, {
      type: 'setQuery',
      query,
      caseSensitive: next,
      useRegex: useRegexRef.current,
    });
  }, [getEditorView, query]);

  const toggleRegex = useCallback(() => {
    const next = !useRegexRef.current;
    setUseRegex(next);
    if (!getEditorView) return;
    const view = getEditorView();
    if (!view || !query) return;
    dispatchSearchAction(view, {
      type: 'setQuery',
      query,
      caseSensitive: caseSensitiveRef.current,
      useRegex: next,
    });
  }, [getEditorView, query]);

  const nextMatch = useCallback(() => {
    if (!getEditorView) return;
    const view = getEditorView();
    if (!view) return;
    dispatchSearchAction(view, { type: 'nextMatch' });
  }, [getEditorView]);

  const prevMatch = useCallback(() => {
    if (!getEditorView) return;
    const view = getEditorView();
    if (!view) return;
    dispatchSearchAction(view, { type: 'prevMatch' });
  }, [getEditorView]);

  const replaceCurrent = useCallback(() => {
    if (!getEditorView) return;
    const view = getEditorView();
    if (!view) return;
    dispatchSearchAction(view, { type: 'replaceCurrent', replacement });
  }, [getEditorView, replacement]);

  const replaceAll = useCallback(() => {
    if (!getEditorView) return;
    const view = getEditorView();
    if (!view) return;
    dispatchSearchAction(view, { type: 'replaceAll', replacement });
  }, [getEditorView, replacement]);

  return {
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
  };
}
