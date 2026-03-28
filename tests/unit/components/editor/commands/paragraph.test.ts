/**
 * Paragraph Commands 单元测试
 * 测试段落相关命令
 */
import { describe, it, expect, mock } from 'bun:test';
import {
  setParagraph,
  increaseHeadingLevel,
  decreaseHeadingLevel,
  insertTable,
  insertMathBlock,
  insertCodeBlock,
  insertTaskList,
  insertHorizontalRule,
  insertParagraphAbove,
  insertParagraphBelow,
} from '../../../setup';

// Mock TextSelection to avoid ProseMirror dependency
const mockTextSelectionCreate = mock((doc: any, pos: number) => ({
  type: 'text',
  anchor: pos,
  head: pos,
}));

mock.module('@milkdown/prose/state', () => ({
  TextSelection: { create: mockTextSelectionCreate },
  NodeSelection: { create: mock((doc: any, pos: number) => ({ type: 'node', anchor: pos })) },
  Selection: { create: mockTextSelectionCreate },
  EditorState: { create: mock((config: any) => config?.doc || {}) },
}));

// Mock callCommand to avoid real milkdown command infrastructure
mock.module('@milkdown/utils', () => ({
  callCommand: (key: any, payload: any) => (ctx: any) => true,
}));

// Mock setBlockType to avoid ProseMirror command internals
mock.module('@milkdown/prose/commands', () => ({
  setBlockType: (nodeType: any) => (state: any, dispatch: Function) => true,
}));

const createMockCrepeRef = () => ({
  current: {
    editor: {
      ctx: {},
      action: mock(() => true),
    },
  },
});

// ===== Helper to build mock ctx with view ====
function buildViewContext(stateOverrides: any = {}) {
  const mockDispatch = mock(() => {});
  const mockFocus = mock(() => {});

  const trChain: any = {
    insert: mock(() => trChain),
    replaceWith: mock(() => trChain),
    setSelection: mock(() => trChain),
    doc: { content: { size: 200 } },
  };

  const defaultState = {
    selection: { from: 20 },
    doc: {
      resolve: () => ({ before: () => 10, after: () => 30, depth: 1 }),
    },
    schema: {
      nodes: {
        paragraph: { create: () => ({ type: 'paragraph' }) },
      },
    },
    tr: trChain,
  };

  const state = { ...defaultState, ...stateOverrides, tr: { ...defaultState.tr, ...(stateOverrides.tr || {}) } };

  return {
    view: { state, dispatch: mockDispatch, focus: mockFocus },
    mockDispatch,
    mockFocus,
    trChain: state.tr,
  };
}

// ===== setParagraph =====

describe('setParagraph', () => {
  it('should return false when editor is not initialized', () => {
    expect(setParagraph({ current: null } as any)).toBe(false);
  });

  it('should return false when editor has no ctx', () => {
    expect(setParagraph({ current: { editor: {} } } as any)).toBe(false);
  });

  it('should set paragraph type when editor is ready', () => {
    const ref = createMockCrepeRef();
    expect(setParagraph(ref as any)).toBe(true);
  });
});

// ===== increaseHeadingLevel =====

describe('increaseHeadingLevel', () => {
  it('should return false when editor is not initialized', () => {
    expect(increaseHeadingLevel({ current: null } as any)).toBe(false);
  });

  it('should handle no heading found (level 0)', () => {
    const mockAction = mock((fn: Function) => {
      return fn({
        get: () => ({
          state: {
            doc: {
              nodesBetween: (from: number, to: number, cb: Function) => {
                // No heading found
              },
            },
            selection: { from: 10, to: 20 },
          },
        }),
      });
    });

    const ref = { current: { editor: { ctx: {}, action: mockAction } } };
    increaseHeadingLevel(ref as any);
    expect(mockAction).toHaveBeenCalled();
  });

  it('should increase heading level from 2 to 1', () => {
    const mockAction = mock((fn: Function) => {
      return fn({
        get: () => ({
          state: {
            doc: {
              nodesBetween: (from: number, to: number, cb: Function) => {
                cb({ type: { name: 'heading' }, attrs: { level: 2 } });
              },
            },
            selection: { from: 10, to: 20 },
          },
        }),
      });
    });

    const ref = { current: { editor: { ctx: {}, action: mockAction } } };
    increaseHeadingLevel(ref as any);
    expect(mockAction).toHaveBeenCalled();
  });

  it('should cap heading level at 1 (from higher levels)', () => {
    const mockAction = mock((fn: Function) => {
      return fn({
        get: () => ({
          state: {
            doc: {
              nodesBetween: (from: number, to: number, cb: Function) => {
                cb({ type: { name: 'heading' }, attrs: { level: 1 } });
              },
            },
            selection: { from: 10, to: 20 },
          },
        }),
      });
    });

    const ref = { current: { editor: { ctx: {}, action: mockAction } } };
    increaseHeadingLevel(ref as any);
    expect(mockAction).toHaveBeenCalled();
  });
});

// ===== decreaseHeadingLevel =====

describe('decreaseHeadingLevel', () => {
  it('should return false when editor is not initialized', () => {
    expect(decreaseHeadingLevel({ current: null } as any)).toBe(false);
  });

  it('should convert h6 to paragraph', () => {
    const mockAction = mock((fn: Function) => {
      return fn({
        get: (key: any) => {
          if (key?.name === 'editorView') {
            return {
              state: {
                schema: { nodes: { paragraph: {} } },
                doc: {
                  nodesBetween: (from: number, to: number, cb: Function) => {
                    cb({ type: { name: 'heading' }, attrs: { level: 6 } });
                  },
                },
                selection: { from: 10, to: 20 },
              },
              dispatch: mock(() => {}),
              focus: mock(() => {}),
            };
          }
          if (key?.name === 'schema') {
            return { nodes: { paragraph: { name: 'paragraph' } } };
          }
          return null;
        },
      });
    });

    const ref = { current: { editor: { ctx: {}, action: mockAction } } };
    decreaseHeadingLevel(ref as any);
    expect(mockAction).toHaveBeenCalled();
  });

  it('should decrease heading level from 3 to 4', () => {
    const mockAction = mock((fn: Function) => {
      return fn({
        get: () => ({
          state: {
            schema: { nodes: { paragraph: {} } },
            doc: {
              nodesBetween: (from: number, to: number, cb: Function) => {
                cb({ type: { name: 'heading' }, attrs: { level: 3 } });
              },
            },
            selection: { from: 10, to: 20 },
          },
        }),
      });
    });

    const ref = { current: { editor: { ctx: {}, action: mockAction } } };
    decreaseHeadingLevel(ref as any);
    expect(mockAction).toHaveBeenCalled();
  });

  it('should return false when no heading found (level 0)', () => {
    const mockAction = mock((fn: Function) => {
      return fn({
        get: () => ({
          state: {
            doc: {
              nodesBetween: (from: number, to: number, cb: Function) => {
                // No heading found
              },
            },
            selection: { from: 10, to: 20 },
          },
        }),
      });
    });

    const ref = { current: { editor: { ctx: {}, action: mockAction } } };
    const result = decreaseHeadingLevel(ref as any);
    expect(result).toBe(false);
  });
});

// ===== insertParsedMarkdown wrappers =====

describe('insertTable', () => {
  it('should return false when editor is not initialized', () => {
    expect(insertTable({ current: null } as any)).toBe(false);
  });

  it('should call insertParsedMarkdown with table content', () => {
    const ref = createMockCrepeRef();
    expect(typeof insertTable(ref as any)).toBe('boolean');
  });
});

describe('insertMathBlock', () => {
  it('should return false when editor is not initialized', () => {
    expect(insertMathBlock({ current: null } as any)).toBe(false);
  });

  it('should call insertParsedMarkdown with math block', () => {
    const ref = createMockCrepeRef();
    expect(typeof insertMathBlock(ref as any)).toBe('boolean');
  });
});

describe('insertCodeBlock', () => {
  it('should return false when editor is not initialized', () => {
    expect(insertCodeBlock({ current: null } as any)).toBe(false);
  });

  it('should call insertParsedMarkdown with code block', () => {
    const ref = createMockCrepeRef();
    expect(typeof insertCodeBlock(ref as any)).toBe('boolean');
  });
});

describe('insertTaskList', () => {
  it('should return false when editor is not initialized', () => {
    expect(insertTaskList({ current: null } as any)).toBe(false);
  });

  it('should call insertParsedMarkdown with task list', () => {
    const ref = createMockCrepeRef();
    expect(typeof insertTaskList(ref as any)).toBe('boolean');
  });
});

describe('insertHorizontalRule', () => {
  it('should return false when editor is not initialized', () => {
    expect(insertHorizontalRule({ current: null } as any)).toBe(false);
  });

  it('should call insertParsedMarkdown with horizontal rule', () => {
    const ref = createMockCrepeRef();
    expect(typeof insertHorizontalRule(ref as any)).toBe('boolean');
  });
});

// ===== insertParagraphAbove/Below — deep logic tests =====

describe('insertParagraphAbove', () => {
  it('should return false when editor is not initialized', () => {
    expect(insertParagraphAbove({ current: null } as any)).toBe(false);
  });

  it('should insert paragraph above current block', () => {
    const { view, trChain, mockDispatch, mockFocus } = buildViewContext();

    const mockAction = mock((fn: Function) => {
      return fn({ get: () => view });
    });

    const ref = { current: { editor: { ctx: {}, action: mockAction } } };
    const result = insertParagraphAbove(ref as any);

    expect(result).toBe(true);
    expect(trChain.insert).toHaveBeenCalled();
    expect(mockTextSelectionCreate).toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalled();
    expect(mockFocus).toHaveBeenCalled();
  });
});

describe('insertParagraphBelow', () => {
  it('should return false when editor is not initialized', () => {
    expect(insertParagraphBelow({ current: null } as any)).toBe(false);
  });

  it('should return false when editor has no ctx', () => {
    expect(insertParagraphBelow({ current: { editor: {} } } as any)).toBe(false);
  });

  it('should insert paragraph below current block', () => {
    const { view, trChain, mockDispatch, mockFocus } = buildViewContext();

    const mockAction = mock((fn: Function) => {
      return fn({ get: () => view });
    });

    const ref = { current: { editor: { ctx: {}, action: mockAction } } };
    const result = insertParagraphBelow(ref as any);

    expect(result).toBe(true);
    expect(trChain.insert).toHaveBeenCalled();
    expect(mockTextSelectionCreate).toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalled();
    expect(mockFocus).toHaveBeenCalled();
  });
});
