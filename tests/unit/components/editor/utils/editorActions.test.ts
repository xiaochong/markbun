/**
 * Editor Actions 单元测试
 * 测试编辑器操作工具函数: execCommand, hasSelection, insertParsedMarkdown
 */
import { describe, it, expect, mock } from 'bun:test';
import { execCommand, hasSelection, insertParsedMarkdown } from '../../../setup';

// ===== Mock for TextSelection — avoid real ProseMirror dependency =====
const mockTextSelectionCreate = mock((doc: any, pos: number) => ({
  type: 'text',
  anchor: pos,
  head: pos,
}));

// We mock the module that TextSelection comes from
// Note: milkdown/prose/state re-exports from prosemirror-state
mock.module('@milkdown/prose/state', () => ({
  TextSelection: { create: mockTextSelectionCreate },
  NodeSelection: { create: mock((doc: any, pos: number) => ({ type: 'node', anchor: pos })) },
  Selection: { create: mockTextSelectionCreate },
  EditorState: { create: mock((config: any) => config?.doc || {}) },
}));

// ===== Helpers =====

/**
 * Build a mock that matches real milkdown context keys by .name property
 */
function buildMockCtx(viewState: any, parserFn: any = null) {
  return {
    get: mock((key: any) => {
      if (key?.name === 'editorView') {
        return {
          state: viewState,
          dispatch: mock(() => {}),
          focus: mock(() => {}),
        };
      }
      if (key?.name === 'parser') {
        return parserFn;
      }
      return null;
    }),
  };
}

function makeRef(ctx: any, actionImpl?: Function) {
  return {
    current: {
      editor: {
        ctx,
        action: actionImpl || mock((fn: Function) => fn(ctx)),
      },
    },
  };
}

function makeTrChain() {
  const tr: any = {};
  tr.replaceWith = mock(() => tr);
  tr.insert = mock(() => tr);
  tr.setSelection = mock(() => tr);
  tr.doc = { content: { size: 200 } };
  tr.mapping = { map: (p: number) => p };
  return tr;
}

// ===== execCommand =====

describe('execCommand', () => {
  it('should return false when editor is null', () => {
    expect(execCommand({ current: null } as any, { key: 'test' })).toBe(false);
  });

  it('should return false when editor has no ctx', () => {
    expect(execCommand({ current: { editor: {} } } as any, { key: 'test' })).toBe(false);
  });

  // Note: execCommand internally calls milkdown's callCommand which requires
  // a real milkdown context. Full behavior tested via integration tests.
});

// ===== hasSelection =====

describe('hasSelection', () => {
  it('should return false when editor is null', () => {
    expect(hasSelection({ current: null } as any)).toBe(false);
  });

  it('should return false when editor has no ctx', () => {
    expect(hasSelection({ current: { editor: {} } } as any)).toBe(false);
  });

  it('should return true when selection exists (from !== to)', () => {
    const mockAction = mock((fn: Function) => {
      return fn(buildMockCtx({
        selection: { from: 10, to: 20 },
      }));
    });
    const ref = makeRef({}, mockAction);
    const result = hasSelection(ref as any);
    // hasSelection returns editor.action((ctx) => { ... return from !== to })
    expect(result).toBe(true);
  });

  it('should return false when no selection (from === to)', () => {
    const mockAction = mock((fn: Function) => {
      return fn(buildMockCtx({
        selection: { from: 10, to: 10 },
      }));
    });
    const ref = makeRef({}, mockAction);
    const result = hasSelection(ref as any);
    expect(result).toBe(false);
  });
});

// ===== insertParsedMarkdown =====

describe('insertParsedMarkdown', () => {
  // Clear mock before each test
  const clearMock = () => mockTextSelectionCreate.mockClear();

  it('should return false when editor is null', () => {
    expect(insertParsedMarkdown({ current: null } as any, '# Hello')).toBe(false);
  });

  it('should return false when editor has no ctx', () => {
    expect(insertParsedMarkdown({ current: { editor: {} } } as any, '# Hello')).toBe(false);
  });

  it('should throw when parser is null', () => {
    const ctx = buildMockCtx({
      selection: { from: 10 },
      doc: { resolve: () => ({ depth: 1, before: () => 5, after: () => 15 }), nodeAt: () => null },
    }, null);
    const ref = makeRef(ctx);
    expect(() => insertParsedMarkdown(ref as any, '# Hello')).toThrow();
  });

  it('should return false when parsed content has size 0', () => {
    const parserFn = mock(() => ({ content: { size: 0 } }));
    const ctx = buildMockCtx({
      selection: { from: 10 },
      doc: { resolve: () => ({ depth: 1 }), nodeAt: () => null },
    }, parserFn);
    const ref = makeRef(ctx);
    const result = insertParsedMarkdown(ref as any, '');
    expect(result).toBe(false);
    expect(parserFn).toHaveBeenCalledWith('');
  });

  it('should replace empty paragraph when cursorInside is true', () => {
    const trChain = makeTrChain();
    const parserFn = mock(() => ({ content: { size: 10 } }));
    const ctx = buildMockCtx({
      selection: { from: 10 },
      doc: {
        resolve: () => ({ depth: 1, before: () => 5, after: () => 15 }),
        nodeAt: () => ({ type: { name: 'paragraph' }, textContent: '' }),
      },
      tr: trChain,
    }, parserFn);
    const ref = makeRef(ctx);

    const result = insertParsedMarkdown(ref as any, '# Hello', true);
    expect(result).toBe(true);
    expect(trChain.replaceWith).toHaveBeenCalled();
  });

  it('should replace empty paragraph when cursorInside is false', () => {
    const trChain = makeTrChain();
    const parserFn = mock(() => ({ content: { size: 10 } }));
    const ctx = buildMockCtx({
      selection: { from: 10 },
      doc: {
        resolve: () => ({ depth: 1, before: () => 5, after: () => 15 }),
        nodeAt: () => ({ type: { name: 'paragraph' }, textContent: '' }),
      },
      tr: trChain,
    }, parserFn);
    const ref = makeRef(ctx);

    const result = insertParsedMarkdown(ref as any, '# Hello', false);
    expect(result).toBe(true);
  });

  it('should insert after non-empty paragraph', () => {
    const trChain = makeTrChain();
    const parserFn = mock(() => ({ content: { size: 20 } }));
    const ctx = buildMockCtx({
      selection: { from: 10 },
      doc: {
        resolve: () => ({ depth: 1, before: () => 5, after: () => 15 }),
        nodeAt: () => ({ type: { name: 'paragraph' }, textContent: 'existing' }),
      },
      tr: trChain,
    }, parserFn);
    const ref = makeRef(ctx);

    const result = insertParsedMarkdown(ref as any, '| Col1 |', false);
    expect(result).toBe(true);
    expect(trChain.insert).toHaveBeenCalled();
  });

  it('should handle setSelection error by falling back to doc end', () => {
    // First call to setSelection throws, second succeeds
    let setSelectionCallCount = 0;
    const trChain: any = {};
    trChain.replaceWith = mock(() => trChain);
    trChain.insert = mock(() => trChain);
    trChain.setSelection = mock(() => {
      setSelectionCallCount++;
      if (setSelectionCallCount === 1) throw new Error('invalid pos');
      return trChain;
    });
    trChain.doc = { content: { size: 200 } };

    const parserFn = mock(() => ({ content: { size: 10 } }));
    const ctx = buildMockCtx({
      selection: { from: 10 },
      doc: {
        resolve: () => ({ depth: 1, before: () => 5, after: () => 15 }),
        nodeAt: () => ({ type: { name: 'paragraph' }, textContent: '' }),
      },
      tr: trChain,
    }, parserFn);
    const ref = makeRef(ctx);

    const result = insertParsedMarkdown(ref as any, '# Hello', true);
    expect(result).toBe(true);
    // setSelection should have been called at least twice (first throws, second succeeds)
    expect(setSelectionCallCount).toBeGreaterThanOrEqual(2);
  });

  it('should clamp cursorPos to doc.content.size', () => {
    const trChain = makeTrChain();
    trChain.doc = { content: { size: 5 } }; // Very small doc
    const parserFn = mock(() => ({ content: { size: 100 } })); // Large content
    const ctx = buildMockCtx({
      selection: { from: 10 },
      doc: {
        resolve: () => ({ depth: 1, before: () => 5, after: () => 15 }),
        nodeAt: () => ({ type: { name: 'paragraph' }, textContent: '' }),
      },
      tr: trChain,
    }, parserFn);
    const ref = makeRef(ctx);

    const result = insertParsedMarkdown(ref as any, '# Big content', false);
    expect(result).toBe(true);
    // The cursorPos should have been clamped via Math.min
    expect(mockTextSelectionCreate).toHaveBeenCalled();
  });
});
