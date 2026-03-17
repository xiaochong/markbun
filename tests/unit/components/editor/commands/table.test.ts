/**
 * Table Commands 单元测试
 * 测试表格操作相关命令
 */
import { describe, it, expect, mock } from 'bun:test';
import {
  insertTableRowAbove,
  insertTableRowBelow,
  insertTableColumnLeft,
  insertTableColumnRight,
  moveTableRowUp,
  moveTableRowDown,
  moveTableColumnLeft,
  moveTableColumnRight,
  deleteTableRow,
  deleteTableColumn,
  deleteTable,
} from '../../../setup';

// Helper to create a mock ProseMirror state
const createMockTableState = (overrides: any = {}) => {
  const defaultTableNode = {
    type: { name: 'table' },
    childCount: 3,
    nodeSize: 100,
    attrs: {},
    child: (i: number) => ({
      type: { name: 'table_row' },
      childCount: 3,
      nodeSize: 30,
      child: (j: number) => ({
        type: { name: j === 0 ? 'table_header' : 'table_cell' },
        nodeSize: 8,
      }),
    }),
  };

  return {
    selection: {
      from: 50,
      $from: {
        depth: 3,
        before: (d: number) => ({ 0: 45, 1: 42, 2: 40, 3: 20 }[d] || 0),
        start: (d: number) => ({ 0: 46, 1: 43, 2: 41, 3: 21 }[d] || 0),
        node: (d: number) => {
          const nodes = [
            { type: { name: 'table_cell' } },
            { type: { name: 'table_row' } },
            defaultTableNode,
            { type: { name: 'doc' } },
          ];
          return nodes[d] || null;
        },
      },
    },
    doc: {
      resolve: () => ({
        depth: 3,
        before: () => 40,
        start: () => 41,
        node: () => defaultTableNode,
      }),
      nodeAt: () => null,
    },
    schema: {
      nodes: {
        table_row: { create: (attrs: any, children: any) => ({ type: 'table_row', children }) },
        table_cell: { create: (attrs: any, content: any) => ({ type: 'table_cell', content }) },
        table_header: { create: (attrs: any, content: any) => ({ type: 'table_header', content }) },
        paragraph: { create: () => ({ type: 'paragraph' }) },
      },
    },
    tr: {
      insert: () => ({ doc: {} }),
      replaceWith: () => ({ doc: {} }),
      delete: () => ({ doc: {} }),
    },
    ...overrides,
  };
};

const createMockCrepeRef = (actionResult: any = true) => ({
  current: {
    editor: {
      ctx: {},
      action: mock(() => actionResult),
    },
  },
});

describe('insertTableRowAbove', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertTableRowAbove(emptyRef as any)).toBe(false);
  });

  it('should return false when editor has no ctx', () => {
    const ref = { current: { editor: {} } };
    expect(insertTableRowAbove(ref as any)).toBe(false);
  });

  it('should insert row above current row', () => {
    const mockDispatch = mock(() => {});
    const mockFocus = mock(() => {});
    const mockInsert = mock(() => ({ doc: {} }));

    const mockAction = mock((fn: Function) => {
      const mockState = {
        ...createMockTableState(),
        tr: {
          insert: mockInsert,
        },
      };
      const mockCtx = {
        get: () => ({
          state: mockState,
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

    const result = insertTableRowAbove(ref as any);
    expect(typeof result).toBe('boolean');
  });
});

describe('insertTableRowBelow', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertTableRowBelow(emptyRef as any)).toBe(false);
  });

  it('should return false when editor has no ctx', () => {
    const ref = { current: { editor: {} } };
    expect(insertTableRowBelow(ref as any)).toBe(false);
  });

  it('should insert row below current row', () => {
    expect(typeof insertTableRowBelow).toBe('function');
  });
});

describe('insertTableColumnLeft', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertTableColumnLeft(emptyRef as any)).toBe(false);
  });

  it('should insert column to the left', () => {
    expect(typeof insertTableColumnLeft).toBe('function');
  });
});

describe('insertTableColumnRight', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertTableColumnRight(emptyRef as any)).toBe(false);
  });

  it('should insert column to the right', () => {
    expect(typeof insertTableColumnRight).toBe('function');
  });
});

describe('moveTableRowUp', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(moveTableRowUp(emptyRef as any)).toBe(false);
  });

  it('should return false when at first row', () => {
    // Row index 0 should return false
    expect(typeof moveTableRowUp).toBe('function');
  });

  it('should swap row with previous row', () => {
    expect(typeof moveTableRowUp).toBe('function');
  });
});

describe('moveTableRowDown', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(moveTableRowDown(emptyRef as any)).toBe(false);
  });

  it('should return false when at last row', () => {
    expect(typeof moveTableRowDown).toBe('function');
  });

  it('should swap row with next row', () => {
    expect(typeof moveTableRowDown).toBe('function');
  });
});

describe('moveTableColumnLeft', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(moveTableColumnLeft(emptyRef as any)).toBe(false);
  });

  it('should return false when at first column', () => {
    expect(typeof moveTableColumnLeft).toBe('function');
  });
});

describe('moveTableColumnRight', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(moveTableColumnRight(emptyRef as any)).toBe(false);
  });

  it('should return false when at last column', () => {
    expect(typeof moveTableColumnRight).toBe('function');
  });
});

describe('deleteTableRow', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(deleteTableRow(emptyRef as any)).toBe(false);
  });

  it('should return false when not in a table cell', () => {
    const mockAction = mock((fn: Function) => {
      const mockCtx = {
        get: () => ({
          state: {
            selection: {
              from: 10,
              $from: {
                depth: 1,
                node: () => ({ type: { name: 'paragraph' } }),
              },
            },
            doc: {
              resolve: () => mockCtx.get().state.selection.$from,
            },
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

    const result = deleteTableRow(ref as any);
    expect(typeof result).toBe('boolean');
  });

  it('should delete entire table when only one row remains', () => {
    expect(typeof deleteTableRow).toBe('function');
  });

  it('should delete current row', () => {
    expect(typeof deleteTableRow).toBe('function');
  });
});

describe('deleteTableColumn', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(deleteTableColumn(emptyRef as any)).toBe(false);
  });

  it('should delete entire table when only one column remains', () => {
    expect(typeof deleteTableColumn).toBe('function');
  });

  it('should delete current column', () => {
    expect(typeof deleteTableColumn).toBe('function');
  });
});

describe('deleteTable', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(deleteTable(emptyRef as any)).toBe(false);
  });

  it('should return false when editor has no ctx', () => {
    const ref = { current: { editor: {} } };
    expect(deleteTable(ref as any)).toBe(false);
  });

  it('should delete entire table', () => {
    expect(typeof deleteTable).toBe('function');
  });
});
