/**
 * ProseMirror search plugin for find & replace in WYSIWYG mode.
 *
 * Provides: text search with optional case-sensitive / regex modes,
 * DecorationSet-based highlighting, match navigation, and single /
 * replace-all operations.
 */

import { $prose } from '@milkdown/utils';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { Decoration, DecorationSet } from '@milkdown/prose/view';
import type { Node as ProseNode } from '@milkdown/prose/model';
import { EditorView as CMEditorView, Decoration as CMDecoration } from '@codemirror/view';
import type { DecorationSet as CMDecorationSet } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';

// ── Public types ────────────────────────────────────────────────────

export interface MatchRange {
  from: number;
  to: number;
}

export interface SearchPluginState {
  query: string;
  caseSensitive: boolean;
  useRegex: boolean;
  matches: MatchRange[];
  activeIndex: number;
  decorationSet: DecorationSet;
  error: string | null;
}

export type SearchStateCallback = (state: SearchPluginState) => void;

// ── Internal types ──────────────────────────────────────────────────

type SearchAction =
  | { type: 'setQuery'; query: string; caseSensitive: boolean; useRegex: boolean }
  | { type: 'nextMatch' }
  | { type: 'prevMatch' }
  | { type: 'replaceCurrent'; replacement: string }
  | { type: 'replaceAll'; replacement: string }
  | { type: 'replaceDone' }
  | { type: 'clear' };

// ── Plugin key ──────────────────────────────────────────────────────

export const searchPluginKey = new PluginKey('SEARCH');

// ── CodeMirror search highlight extension ────────────────────────────

interface CMHighlightInfo {
  from: number;
  to: number;
  isActive: boolean;
}

const setSearchCMHighlights = StateEffect.define<CMHighlightInfo[]>();

const cmSearchHighlightField = StateField.define<CMDecorationSet>({
  create() { return CMDecoration.none; },
  update(deco, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSearchCMHighlights)) {
        const highlights = effect.value;
        if (highlights.length === 0) return CMDecoration.none;
        const widgets = highlights.map(h =>
          CMDecoration.mark({
            class: h.isActive
              ? 'search-cm-match search-cm-match-active'
              : 'search-cm-match',
          }).range(h.from, h.to)
        );
        return CMDecoration.set(widgets, true);
      }
    }
    return deco.map(tr.changes);
  },
  provide: f => CMEditorView.decorations.from(f),
});

/** Ensure the CM search highlight extension is installed on a CM editor. */
function ensureCMHighlightExtension(cmView: CMEditorView) {
  try {
    cmView.state.field(cmSearchHighlightField);
  } catch {
    cmView.dispatch({
      effects: StateEffect.appendConfig.of([cmSearchHighlightField]),
    });
  }
}

// ── Constants ───────────────────────────────────────────────────────

const EMPTY_STATE: SearchPluginState = {
  query: '',
  caseSensitive: false,
  useRegex: false,
  matches: [],
  activeIndex: -1,
  decorationSet: DecorationSet.empty,
  error: null,
};

// ── Text extraction ─────────────────────────────────────────────────

interface TextblockInfo {
  node: ProseNode;
  /** Document position of the textblock itself. */
  pos: number;
}

/** Walk every textblock in the document (depth-first, document order).
 *  Includes code_block nodes because they contain searchable text. */
function collectTextblocks(doc: ProseNode): TextblockInfo[] {
  const result: TextblockInfo[] = [];
  doc.descendants((node, pos) => {
    if (node.inlineContent || node.type.name === 'code_block') {
      result.push({ node, pos });
    }
  });
  return result;
}

/** Concatenate child text inside a textblock, using `\ufffc` for non-text nodes. */
function textContentOf(node: ProseNode): string {
  let text = '';
  node.forEach((child) => {
    if (child.isText) {
      text += child.text ?? '';
    } else {
      text += '\ufffc';
    }
  });
  return text;
}

// ── Search ──────────────────────────────────────────────────────────

interface SearchResult {
  matches: MatchRange[];
  error: string | null;
}

/** Build position-mapping arrays for a textblock's inline content. */
function buildOffsetMap(node: ProseNode, nodePos: number): number[] {
  // offsets[i] = absolute doc position of concatenated-text position i
  // -1 means "inside a non-text inline" (match cannot start/overlap here)
  const offsets: number[] = [];
  let docOffset = nodePos + 1; // +1 past textblock opening boundary

  node.forEach((child) => {
    if (child.isText) {
      const len = child.text?.length ?? 0;
      for (let i = 0; i < len; i++) {
        offsets.push(docOffset++);
      }
    } else {
      // Non-text inline → sentinel
      offsets.push(-1);
      docOffset += child.nodeSize;
    }
  });

  return offsets;
}

/** Execute a text search over all textblocks. */
function findMatches(
  doc: ProseNode,
  query: string,
  caseSensitive: boolean,
  useRegex: boolean,
): SearchResult {
  if (!query) return { matches: [], error: null };

  // Build the search function
  let searchFn: (text: string) => number[];
  if (useRegex) {
    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const re = new RegExp(query, flags);
      searchFn = (text) => {
        const positions: number[] = [];
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text)) !== null) {
          if (m[0].length === 0) { re.lastIndex++; continue; }
          positions.push(m.index);
        }
        return positions;
      };
    } catch {
      return { matches: [], error: 'Invalid regular expression' };
    }
  } else {
    const q = caseSensitive ? query : query.toLowerCase();
    const queryLen = q.length;
    searchFn = (text) => {
      const haystack = caseSensitive ? text : text.toLowerCase();
      const positions: number[] = [];
      let idx = 0;
      while (true) {
        idx = haystack.indexOf(q, idx);
        if (idx === -1) break;
        positions.push(idx);
        idx += 1;
      }
      return positions;
    };
  }

  // Determine effective query length for offset calculation
  const queryLen = useRegex ? 0 : query.length; // regex match length varies

  const matches: MatchRange[] = [];
  const textblocks = collectTextblocks(doc);

  for (const { node, pos } of textblocks) {
    const rawText = textContentOf(node);
    const offsets = buildOffsetMap(node, pos);
    const hitPositions = searchFn(rawText);

    for (const start of hitPositions) {
      // For regex, determine match length from the text
      const matchLen = useRegex
        ? ((): number => {
            // Re-run the regex at this position to get match length
            const re = new RegExp(query, caseSensitive ? '' : 'i');
            const m = re.exec(rawText.substring(start));
            return m ? m[0].length : 0;
          })()
        : queryLen;

      if (matchLen === 0) continue;
      const end = start + matchLen;

      // Skip if match starts on a non-text boundary
      if (offsets[start] === -1) continue;
      // Skip if match extends beyond available offsets
      if (end > offsets.length) continue;
      // Skip if any character in the match is inside a non-text inline
      let blocked = false;
      for (let i = start; i < end; i++) {
        if (offsets[i] === -1) { blocked = true; break; }
      }
      if (blocked) continue;

      const docFrom = offsets[start];
      const docTo = offsets[end - 1] + 1;
      matches.push({ from: docFrom, to: docTo });
    }
  }

  return { matches, error: null };
}

// ── Decorations ─────────────────────────────────────────────────────

function buildDecorations(
  doc: ProseNode,
  matches: MatchRange[],
  activeIndex: number,
): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty;

  const decorations: Decoration[] = [];

  for (let i = 0; i < matches.length; i++) {
    const { from, to } = matches[i];
    const $pos = doc.resolve(from);

    // Code block matches are handled via CodeMirror decorations (see syncCodeMirrorHighlights)
    if ($pos.parent.type.name === 'code_block') continue;

    decorations.push(
      Decoration.inline(from, to, {
        class: i === activeIndex
          ? 'search-match search-match-active'
          : 'search-match',
      }),
    );
  }

  return DecorationSet.create(doc, decorations);
}

// ── CodeMirror highlight sync ────────────────────────────────────────

/** Group matches by the code_block node that contains them. */
function groupMatchesByCodeBlock(
  doc: ProseNode,
  matches: MatchRange[],
): Map<number, { cmFrom: number; cmTo: number; matchIndex: number }[]> {
  const groups = new Map<number, { cmFrom: number; cmTo: number; matchIndex: number }[]>();

  for (let i = 0; i < matches.length; i++) {
    const { from, to } = matches[i];
    const $pos = doc.resolve(from);
    if ($pos.parent.type.name !== 'code_block') continue;

    const cbPos = $pos.pos - $pos.parentOffset - 1;
    // Convert ProseMirror positions to CodeMirror positions
    // code_block content starts at cbPos + 1 in ProseMirror
    const cmFrom = from - cbPos - 1;
    const cmTo = to - cbPos - 1;

    let list = groups.get(cbPos);
    if (!list) {
      list = [];
      groups.set(cbPos, list);
    }
    list.push({ cmFrom, cmTo, matchIndex: i });
  }

  return groups;
}

/** Push search highlights into every visible CodeMirror editor. */
function syncCodeMirrorHighlights(view: EditorView, state: SearchPluginState): void {
  const { matches, activeIndex } = state;
  if (matches.length === 0) {
    clearAllCMHighlights(view);
    return;
  }

  const doc = view.state.doc;
  const groups = groupMatchesByCodeBlock(doc, matches);

  // For each code block that has matches, find its CM EditorView and dispatch highlights
  for (const [cbPos, cmMatches] of groups) {
    const dom = view.nodeDOM(cbPos);
    if (!dom) continue;

    // Find the CodeMirror editor inside this code block
    const cmEditorDom = (dom as HTMLElement).querySelector('.cm-editor');
    if (!cmEditorDom) continue;

    let cmView: CMEditorView | null;
    try {
      cmView = CMEditorView.findFromDOM(cmEditorDom as HTMLElement);
    } catch {
      continue;
    }
    if (!cmView) continue;

    ensureCMHighlightExtension(cmView);

    const highlights = cmMatches.map(m => ({
      from: m.cmFrom,
      to: m.cmTo,
      isActive: m.matchIndex === activeIndex,
    }));

    cmView.dispatch({
      effects: setSearchCMHighlights.of(highlights),
    });
  }
}

/** Clear CM search highlights from all visible code block editors. */
function clearAllCMHighlights(view: EditorView): void {
  // Find all code block nodes in the document
  view.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'code_block') return false;
    const dom = view.nodeDOM(pos);
    if (!dom) return false;

    const cmEditorDom = (dom as HTMLElement).querySelector('.cm-editor');
    if (!cmEditorDom) return false;

    try {
      const cmView = CMEditorView.findFromDOM(cmEditorDom as HTMLElement);
      if (cmView) {
        try {
          cmView.state.field(cmSearchHighlightField);
          cmView.dispatch({ effects: setSearchCMHighlights.of([]) });
        } catch {
          // Extension not installed, nothing to clear
        }
      }
    } catch {
      // Ignore
    }
    return false;
  });
}

// ── Plugin factory ──────────────────────────────────────────────────

/** Create a search plugin with an optional React bridge callback. */
export function createSearchPlugin(cb?: SearchStateCallback) {
  return $prose(() => {
    const callback = cb ?? null;

    return new Plugin({
      key: searchPluginKey,

      state: {
        init(): SearchPluginState {
          return EMPTY_STATE;
        },

        apply(tr, prev): SearchPluginState {
          const meta = tr.getMeta(searchPluginKey) as SearchAction | undefined;

          // Document changed without explicit search action — re-search to keep in sync
          if (!meta) {
            if (!tr.docChanged || prev.matches.length === 0) return prev;
            return reSearch(tr.doc, prev);
          }

          switch (meta.type) {
            case 'clear':
              return EMPTY_STATE;

            case 'setQuery': {
              if (!meta.query) return EMPTY_STATE;
              const { matches, error } = findMatches(
                tr.doc, meta.query, meta.caseSensitive, meta.useRegex,
              );
              const activeIndex = matches.length > 0 ? 0 : -1;
              return {
                query: meta.query,
                caseSensitive: meta.caseSensitive,
                useRegex: meta.useRegex,
                matches,
                activeIndex,
                decorationSet: buildDecorations(tr.doc, matches, activeIndex),
                error,
              };
            }

            case 'nextMatch': {
              if (prev.matches.length === 0) return prev;
              const next = (prev.activeIndex + 1) % prev.matches.length;
              return {
                ...prev,
                activeIndex: next,
                decorationSet: buildDecorations(tr.doc, prev.matches, next),
              };
            }

            case 'prevMatch': {
              if (prev.matches.length === 0) return prev;
              const p =
                (prev.activeIndex - 1 + prev.matches.length) % prev.matches.length;
              return {
                ...prev,
                activeIndex: p,
                decorationSet: buildDecorations(tr.doc, prev.matches, p),
              };
            }

            case 'replaceCurrent': {
              // Actual text replacement is done by the caller (useSearch hook) via
              // tr.replaceWith on a fresh transaction, then dispatching with replaceDone.
              // This case is kept for backward compat but should not modify tr here.
              return prev;
            }

            case 'replaceAll': {
              // Same as replaceCurrent — the caller handles the transaction.
              return prev;
            }

            case 'replaceDone': {
              // After a replacement transaction has been applied, re-search the new doc.
              return reSearch(tr.doc, prev);
            }

            default:
              return prev;
          }
        },
      },

      props: {
        decorations(state) {
          return searchPluginKey.getState(state)?.decorationSet ?? DecorationSet.empty;
        },
      },

      view() {
        return {
          update(view: EditorView) {
            const state = searchPluginKey.getState(view.state);
            if (state) {
              syncCodeMirrorHighlights(view, state);
              // Scroll active match into view (DOM-based, no transaction dispatch)
              if (state.activeIndex >= 0 && state.activeIndex < state.matches.length) {
                requestAnimationFrame(() => {
                  // First try the ProseMirror decoration element
                  const activeEl = view.dom.querySelector('.search-match-active');
                  if (activeEl) {
                    activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    return;
                  }
                  // For code blocks, find the code block node containing the match
                  const match = state.matches[state.activeIndex];
                  if (!match) return;
                  const $pos = view.state.doc.resolve(match.from);
                  if ($pos.parent.type.name === 'code_block') {
                    const cbPos = $pos.pos - $pos.parentOffset - 1;
                    const nodeDom = view.nodeDOM(cbPos);
                    if (nodeDom) {
                      (nodeDom as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
                    }
                  }
                });
              }
              if (callback) callback(state);
            }
          },
        };
      },
    });
  });
}

/** Re-run search on new doc, preserving active index if possible. */
function reSearch(doc: ProseNode, prev: SearchPluginState): SearchPluginState {
  const { matches, error } = findMatches(doc, prev.query, prev.caseSensitive, prev.useRegex);
  let activeIndex = prev.activeIndex;
  if (activeIndex >= matches.length) {
    activeIndex = matches.length > 0 ? matches.length - 1 : -1;
  }
  return {
    ...prev,
    matches,
    activeIndex,
    decorationSet: buildDecorations(doc, matches, activeIndex),
    error,
  };
}

// ── Public helpers ──────────────────────────────────────────────────

/** Read the current search plugin state from an EditorView. */
export function getSearchState(view: EditorView): SearchPluginState | null {
  return searchPluginKey.getState(view.state) ?? null;
}

/** Dispatch a search action through ProseMirror. */
export function dispatchSearchAction(
  view: EditorView,
  action: SearchAction,
): void {
  view.dispatch(view.state.tr.setMeta(searchPluginKey, action));
}
