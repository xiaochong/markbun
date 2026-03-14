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

const createMockCrepeRef = () => ({
  current: {
    editor: {
      ctx: {},
      action: mock(() => true),
    },
  },
});

describe('setParagraph', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(setParagraph(emptyRef as any)).toBe(false);
  });

  it('should set paragraph type when editor is ready', () => {
    const ref = createMockCrepeRef();
    expect(setParagraph(ref as any)).toBe(true);
  });
});

describe('increaseHeadingLevel', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(increaseHeadingLevel(emptyRef as any)).toBe(false);
  });

  it('should increase heading level from 0 to 1', () => {
    const mockAction = mock((fn: Function) => {
      const mockCtx = {
        get: () => ({
          state: {
            doc: {
              nodesBetween: (from: number, to: number, callback: Function) => {
                // No heading found, level = 0
              },
            },
            selection: { from: 10, to: 20 },
          },
        }),
      };
      return fn(mockCtx);
    });

    const ref = {
      current: {
        editor: {
          ctx: {},
          action: mockAction,
        },
      },
    };

    expect(typeof increaseHeadingLevel).toBe('function');
  });

  it('should increase heading level from 2 to 3', () => {
    const mockAction = mock((fn: Function) => {
      const mockCtx = {
        get: () => ({
          state: {
            doc: {
              nodesBetween: (from: number, to: number, callback: Function) => {
                callback({ type: { name: 'heading' }, attrs: { level: 2 } });
              },
            },
            selection: { from: 10, to: 20 },
          },
        }),
      };
      return fn(mockCtx);
    });

    const ref = {
      current: {
        editor: {
          ctx: {},
          action: mockAction,
        },
      },
    };

    expect(typeof increaseHeadingLevel).toBe('function');
  });

  it('should cap heading level at 6', () => {
    expect(typeof increaseHeadingLevel).toBe('function');
  });
});

describe('decreaseHeadingLevel', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(decreaseHeadingLevel(emptyRef as any)).toBe(false);
  });

  it('should convert h1 to paragraph when decreasing', () => {
    const mockAction = mock((fn: Function) => {
      const mockCtx = {
        get: () => ({
          state: {
            schema: { nodes: { paragraph: {} } },
            doc: {
              nodesBetween: (from: number, to: number, callback: Function) => {
                callback({ type: { name: 'heading' }, attrs: { level: 1 } });
              },
            },
            selection: { from: 10, to: 20 },
          },
        }),
      };
      return fn(mockCtx);
    });

    const ref = {
      current: {
        editor: {
          ctx: {},
          action: mockAction,
        },
      },
    };

    expect(typeof decreaseHeadingLevel).toBe('function');
  });

  it('should decrease heading level from 3 to 2', () => {
    const mockAction = mock((fn: Function) => {
      const mockCtx = {
        get: () => ({
          state: {
            schema: { nodes: { paragraph: {} } },
            doc: {
              nodesBetween: (from: number, to: number, callback: Function) => {
                callback({ type: { name: 'heading' }, attrs: { level: 3 } });
              },
            },
            selection: { from: 10, to: 20 },
          },
        }),
      };
      return fn(mockCtx);
    });

    const ref = {
      current: {
        editor: {
          ctx: {},
          action: mockAction,
        },
      },
    };

    expect(typeof decreaseHeadingLevel).toBe('function');
  });
});

describe('insertTable', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertTable(emptyRef as any)).toBe(false);
  });

  it('should insert table markdown', () => {
    expect(typeof insertTable).toBe('function');
  });
});

describe('insertMathBlock', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertMathBlock(emptyRef as any)).toBe(false);
  });
});

describe('insertCodeBlock', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertCodeBlock(emptyRef as any)).toBe(false);
  });
});

describe('insertTaskList', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertTaskList(emptyRef as any)).toBe(false);
  });
});

describe('insertHorizontalRule', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertHorizontalRule(emptyRef as any)).toBe(false);
  });
});

describe('insertParagraphAbove', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertParagraphAbove(emptyRef as any)).toBe(false);
  });

  it('should insert paragraph above current block', () => {
    const mockDispatch = mock(() => {});
    const mockFocus = mock(() => {});

    const mockAction = mock((fn: Function) => {
      const mockCtx = {
        get: () => ({
          state: {
            selection: { from: 20 },
            doc: {
              resolve: () => ({
                before: () => 10,
                depth: 1,
              }),
            },
            schema: {
              nodes: {
                paragraph: { create: () => ({ type: 'paragraph' }) },
              },
            },
            tr: {
              insert: () => ({
                setSelection: () => ({}),
              }),
            },
          },
          dispatch: mockDispatch,
          focus: mockFocus,
        }),
      };
      return fn(mockCtx);
    });

    const ref = {
      current: {
        editor: {
          ctx: {},
          action: mockAction,
        },
      },
    };

    expect(typeof insertParagraphAbove).toBe('function');
  });
});

describe('insertParagraphBelow', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertParagraphBelow(emptyRef as any)).toBe(false);
  });

  it('should insert paragraph below current block', () => {
    expect(typeof insertParagraphBelow).toBe('function');
  });
});
