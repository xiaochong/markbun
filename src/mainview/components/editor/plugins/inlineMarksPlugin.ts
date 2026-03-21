import { markRule } from '@milkdown/prose';
import { toggleMark } from '@milkdown/prose/commands';
import {
  $command,
  $inputRule,
  $markSchema,
} from '@milkdown/utils';

// ===== Highlight: ==text== → <mark> =====

export const highlightSchema = $markSchema('highlight', () => ({
  parseDOM: [{ tag: 'mark' }],
  toDOM: () => ['mark', {}] as any,
  parseMarkdown: {
    match: (node) => node.type === 'highlight',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next((node as any).children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'highlight',
    runner: (state, mark) => {
      state.withMark(mark, 'highlight');
    },
  },
}));

export const toggleHighlightCommand = $command(
  'ToggleHighlight',
  (ctx) => () => toggleMark(highlightSchema.type(ctx))
);

export const highlightInputRule = $inputRule((ctx) =>
  markRule(/==([^=\n]+)==$/, highlightSchema.type(ctx))
);

// ===== Superscript: ^text^ → <sup> =====

export const superscriptSchema = $markSchema('superscript', () => ({
  parseDOM: [{ tag: 'sup' }],
  toDOM: () => ['sup', {}] as any,
  parseMarkdown: {
    match: (node) => node.type === 'superscript',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next((node as any).children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'superscript',
    runner: (state, mark) => {
      state.withMark(mark, 'superscript');
    },
  },
}));

export const toggleSuperscriptCommand = $command(
  'ToggleSuperscript',
  (ctx) => () => toggleMark(superscriptSchema.type(ctx))
);

export const superscriptInputRule = $inputRule((ctx) =>
  markRule(/\^([^\^\n]+)\^$/, superscriptSchema.type(ctx))
);

// ===== Subscript: ~text~ → <sub> =====

export const subscriptSchema = $markSchema('subscript', () => ({
  parseDOM: [{ tag: 'sub' }],
  toDOM: () => ['sub', {}] as any,
  parseMarkdown: {
    match: (node) => node.type === 'subscript',
    runner: (state, node, markType) => {
      state.openMark(markType);
      state.next((node as any).children);
      state.closeMark(markType);
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'subscript',
    runner: (state, mark) => {
      state.withMark(mark, 'subscript');
    },
  },
}));

export const toggleSubscriptCommand = $command(
  'ToggleSubscript',
  (ctx) => () => toggleMark(subscriptSchema.type(ctx))
);

// No input rule for subscript to avoid conflict with GFM ~~strikethrough~~

// ===== Combined plugin array for Milkdown registration =====
// $markSchema returns a [ctx, mark] tuple, so .flat() expands it correctly

export const inlineMarksPlugin = [
  highlightSchema,
  toggleHighlightCommand,
  highlightInputRule,
  superscriptSchema,
  toggleSuperscriptCommand,
  superscriptInputRule,
  subscriptSchema,
  toggleSubscriptCommand,
].flat();
