import { forwardRef, useImperativeHandle, useRef, useEffect, useCallback, memo } from 'react';
import { EditorView, keymap, lineNumbers, drawSelection, dropCursor, KeyBinding } from '@codemirror/view';
import { EditorState, Extension } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { oneDarkTheme } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { bracketMatching, syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export interface SourceEditorProps {
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  darkMode?: boolean;
}

export interface SourceEditorRef {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
  isReady: boolean;
  getCursor: () => { line: number; column: number } | null;
  setCursor: (line: number, column: number) => void;
  getScrollTop: () => number;
  setScrollTop: (top: number) => void;
}

// Syntax highlighting for light theme
const lightHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, fontWeight: 'bold', color: '#24292f' },
  { tag: tags.quote, color: '#57606a', fontStyle: 'italic' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.link, color: '#0969da' },
  { tag: tags.url, color: '#0969da' },
  { tag: tags.literal, color: '#0550ae' },
  { tag: tags.keyword, color: '#cf222e' },
  { tag: tags.comment, color: '#6e7781', fontStyle: 'italic' },
  { tag: tags.string, color: '#0a3069' },
]);

// Syntax highlighting for dark theme
const darkHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, fontWeight: 'bold', color: '#e5c07b' },
  { tag: tags.quote, color: '#7d8799', fontStyle: 'italic' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.link, color: '#61afef' },
  { tag: tags.url, color: '#61afef' },
  { tag: tags.literal, color: '#d19a66' },
  { tag: tags.keyword, color: '#c678dd' },
  { tag: tags.comment, color: '#7d8799', fontStyle: 'italic' },
  { tag: tags.string, color: '#98c379' },
]);

// Light theme - basic styling
const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: '#ffffff',
    color: '#24292f',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: 'SF Mono, -apple-system, BlinkMacSystemFont, monospace',
    fontSize: '14px',
    lineHeight: '1.6',
    padding: '24px 32px',
  },
  '.cm-gutters': {
    backgroundColor: '#f6f8fa',
    color: '#6e7781',
    border: 'none',
  },
}, { dark: false });

// Dark theme - basic styling (extends oneDarkTheme)
const darkTheme = EditorView.theme({
  '&': {
    height: '100%',
  },
  '.cm-content': {
    fontFamily: 'SF Mono, -apple-system, BlinkMacSystemFont, monospace',
    fontSize: '14px',
    lineHeight: '1.6',
    padding: '24px 32px',
  },
}, { dark: true });

export const SourceEditor = memo(forwardRef<SourceEditorRef, SourceEditorProps>(
  ({ defaultValue = '', onChange, className = '', darkMode = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const isReadyRef = useRef(false);
    const onChangeRef = useRef(onChange);

    // Keep onChange ref up to date
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);

    // Create or recreate editor when darkMode changes
    useEffect(() => {
      if (!containerRef.current || viewRef.current) return;

      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged && onChangeRef.current) {
          onChangeRef.current(update.state.doc.toString());
        }
      });

      const extensions: Extension[] = [
        markdown(),
        history(),
        lineNumbers(),
        drawSelection(),
        dropCursor(),
        bracketMatching(),
        highlightSelectionMatches(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap] as KeyBinding[]),
        updateListener,
        EditorView.lineWrapping,
      ];

      // Add theme
      if (darkMode) {
        extensions.push(oneDarkTheme, darkTheme, syntaxHighlighting(darkHighlightStyle));
      } else {
        extensions.push(lightTheme, syntaxHighlighting(lightHighlightStyle));
      }

      const state = EditorState.create({
        doc: defaultValue,
        extensions,
      });

      const view = new EditorView({
        state,
        parent: containerRef.current,
      });

      viewRef.current = view;
      isReadyRef.current = true;

      return () => {
        isReadyRef.current = false;
        view.destroy();
        viewRef.current = null;
      };
    }, [darkMode]); // Only recreate when darkMode changes, content updated via setValue

    // Expose imperative methods
    useImperativeHandle(ref, () => ({
      getValue: () => {
        return viewRef.current?.state.doc.toString() ?? '';
      },
      setValue: (value: string) => {
        const view = viewRef.current;
        if (!view) return;

        const currentValue = view.state.doc.toString();
        if (currentValue === value) return;

        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: value,
          },
        });
      },
      focus: () => {
        viewRef.current?.focus();
      },
      get isReady() {
        return isReadyRef.current;
      },
      getCursor: () => {
        const view = viewRef.current;
        if (!view) return null;
        const pos = view.state.selection.main.head;
        const line = view.state.doc.lineAt(pos);
        return { line: line.number, column: pos - line.from + 1 };
      },
      setCursor: (line: number, column: number) => {
        const view = viewRef.current;
        if (!view) return;
        const docLine = line <= view.state.doc.lines
          ? view.state.doc.line(line)
          : view.state.doc.line(view.state.doc.lines);
        const col = Math.min(column, docLine.length + 1);
        const pos = docLine.from + col - 1;
        view.dispatch({
          selection: { anchor: pos },
        });
      },
      getScrollTop: () => {
        return viewRef.current?.scrollDOM.scrollTop ?? 0;
      },
      setScrollTop: (top: number) => {
        const view = viewRef.current;
        if (!view) return;
        requestAnimationFrame(() => {
          view.scrollDOM.scrollTop = top;
        });
      },
    }), []);

    return (
      <div
        ref={containerRef}
        className={`source-editor-container ${className}`}
        spellCheck={false}
      />
    );
  }
));

SourceEditor.displayName = 'SourceEditor';
