/**
 * Table Commands 单元测试
 * 测试表格操作相关命令
 */
import './prosemirror-tables-mock';
import { describe, it, expect, mock, beforeEach } from 'bun:test';
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

// ===== Helpers for comprehensive table state mocking =====

const TABLE_POS = 20;
const ROW_SIZE = 30;
const CELL_SIZE = 8;

/**
 * Creates a mock state that works with the real findCurrentCell/findTableNode
 * Position layout:
 *   Table starts at TABLE_POS (20)
 *   Row i starts at: TABLE_POS + 1 + i * ROW_SIZE
 *   Cell (r,c) starts at: rowStart[r] + 1 + c * CELL_SIZE
 */
function createTableMock(options: {
  rowCount?: number;
  colCount?: number;
  currentRow?: number;
  currentCol?: number;
} = {}) {
  const rowCount = options.rowCount ?? 3;
  const colCount = options.colCount ?? 3;
  const currentRow = options.currentRow ?? 1;
  const currentCol = options.currentCol ?? 1;

  // Build cell nodes
  const cellNodes: any[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const row: any[] = [];
    for (let c = 0; c < colCount; c++) {
      row.push({
        type: { name: r === 0 ? 'table_header' : 'table_cell' },
        nodeSize: CELL_SIZE,
      });
    }
    cellNodes.push(row);
  }

  // Build row nodes
  const rowNodes: any[] = [];
  for (let r = 0; r < rowCount; r++) {
    const capturedR = r;
    rowNodes.push({
      type: {
        name: 'table_row',
        create: (attrs: any, children: any) => ({ type: 'table_row', attrs, children }),
      },
      childCount: colCount,
      nodeSize: ROW_SIZE,
      attrs: {},
      child: (c: number) => cellNodes[capturedR][c],
    });
  }

  // Build table node
  const tableNode = {
    type: {
      name: 'table',
      create: (attrs: any, children: any) => ({ type: 'table', attrs, children }),
    },
    childCount: rowCount,
    nodeSize: rowCount * ROW_SIZE + 2,
    attrs: {},
    child: (i: number) => rowNodes[i],
  };

  // Calculate row start positions
  const rowStartPositions: number[] = [];
  let pos = TABLE_POS + 1;
  for (let r = 0; r < rowCount; r++) {
    rowStartPositions.push(pos);
    pos += ROW_SIZE;
  }

  // Calculate cell start positions
  const cellStartPositions: number[][] = [];
  for (let r = 0; r < rowCount; r++) {
    const rowCells: number[] = [];
    let cpos = rowStartPositions[r] + 1;
    for (let c = 0; c < colCount; c++) {
      rowCells.push(cpos);
      cpos += CELL_SIZE;
    }
    cellStartPositions.push(rowCells);
  }

  const rowStart = rowStartPositions[currentRow];
  const cellStart = cellStartPositions[currentRow][currentCol];

  // $pos mock — depth 4: doc(0) → table(1) → row(2) → cell(3)
  const $pos = {
    depth: 4,
    before: (d: number) => {
      if (d === 1) return TABLE_POS;
      if (d === 2) return rowStart;
      if (d === 3) return cellStart;
      return 0;
    },
    start: (d: number) => {
      if (d === 3) return cellStart + 1;
      if (d === 2) return rowStart + 1;
      if (d === 1) return TABLE_POS + 1;
      return 0;
    },
    node: (d: number) => {
      if (d === 1) return tableNode;
      if (d === 2) return rowNodes[currentRow];
      if (d === 3) return cellNodes[currentRow][currentCol];
      return { type: { name: 'doc' } };
    },
    after: (d: number) => {
      if (d === 1) return TABLE_POS + tableNode.nodeSize;
      if (d === 2) return rowStart + ROW_SIZE;
      if (d === 3) return cellStart + CELL_SIZE;
      return 0;
    },
  };

  // Transaction chain mock
  const trChain: any = {};
  trChain.insert = mock(() => trChain);
  trChain.replaceWith = mock(() => trChain);
  trChain.delete = mock(() => trChain);
  trChain.setSelection = mock(() => trChain);
  trChain.doc = { content: { size: 200 } };
  trChain.mapping = { map: (p: number) => p };

  const mockDispatch = mock(() => {});
  const mockFocus = mock(() => {});

  const state = {
    selection: {
      from: cellStart + 2,
      to: cellStart + 2,
      $from: $pos,
      $to: $pos,
      $head: $pos,
      $anchor: $pos,
    },
    doc: {
      resolve: () => $pos,
      nodeAt: () => null,
    },
    schema: {
      nodes: {
        table_row: {
          type: { name: 'table_row' },
          create: (attrs: any, children: any) => ({ type: 'table_row', attrs, children }),
        },
        table_cell: {
          type: { name: 'table_cell' },
          create: (attrs: any, content: any) => ({ type: 'table_cell', attrs, content }),
        },
        table_header: {
          type: { name: 'table_header' },
          create: (attrs: any, content: any) => ({ type: 'table_header', attrs, content }),
        },
        paragraph: {
          type: { name: 'paragraph' },
          create: () => ({ type: 'paragraph' }),
        },
      },
    },
    tr: trChain,
  };

  const view = { state, dispatch: mockDispatch, focus: mockFocus };

  const createRef = () => ({
    current: {
      editor: {
        ctx: {},
        action: mock((fn: Function) => fn({ get: () => view })),
      },
    },
  });

  return {
    state, tableNode, rowNodes, cellNodes, $pos, trChain,
    mockDispatch, mockFocus, view, createRef,
    rowStartPositions, cellStartPositions,
  };
}

const createMockCrepeRef = (actionResult: any = true) => ({
  current: {
    editor: {
      ctx: {},
      action: mock(() => actionResult),
    },
  },
});

// ===== Null/undefined guard tests =====

describe('insertTableRowAbove', () => {
  it('should return false when editor is not initialized', () => {
    expect(insertTableRowAbove({ current: null } as any)).toBe(false);
  });

  it('should return false when editor has no ctx', () => {
    expect(insertTableRowAbove({ current: { editor: {} } } as any)).toBe(false);
  });

  it('should return false when findCurrentCell returns null (not in table)', () => {
    const ref = {
      current: {
        editor: {
          ctx: {},
          action: mock((fn: Function) => {
            // Return state with no table structure → findCurrentCell returns null
            const state = {
              selection: { from: 5, to: 5, $from: { depth: 0, node: () => ({ type: { name: 'doc' } }) } },
              doc: { resolve: () => ({ depth: 0, node: () => ({ type: { name: 'doc' } }) }) },
              schema: { nodes: {} },
              tr: { insert: mock(() => ({})) },
            };
            return fn({ get: () => ({ state, dispatch: mock(() => {}), focus: mock(() => {}) }) });
          }),
        },
      },
    };
    expect(insertTableRowAbove(ref as any)).toBe(false);
  });

  it('should insert row above row 1 with table_cell type', () => {
    const m = createTableMock({ currentRow: 1, currentCol: 1 });
    const ref = m.createRef();
    const result = insertTableRowAbove(ref as any);
    expect(result).toBe(true);
    expect(m.mockDispatch).toHaveBeenCalled();
    expect(m.mockFocus).toHaveBeenCalled();
  });

  it('should insert row above row 0 with table_header type', () => {
    const m = createTableMock({ currentRow: 0, currentCol: 0 });
    const ref = m.createRef();
    const result = insertTableRowAbove(ref as any);
    expect(result).toBe(true);
    expect(m.mockDispatch).toHaveBeenCalled();
  });
});

describe('insertTableRowBelow', () => {
  it('should return false when editor is not initialized', () => {
    expect(insertTableRowBelow({ current: null } as any)).toBe(false);
  });

  it('should return false when editor has no ctx', () => {
    expect(insertTableRowBelow({ current: { editor: {} } } as any)).toBe(false);
  });

  it('should insert row below current row', () => {
    const m = createTableMock({ currentRow: 1, currentCol: 1 });
    const ref = m.createRef();
    const result = insertTableRowBelow(ref as any);
    expect(result).toBe(true);
    expect(m.mockDispatch).toHaveBeenCalled();
  });

  it('should insert row below last row', () => {
    const m = createTableMock({ rowCount: 3, currentRow: 2, currentCol: 0 });
    const ref = m.createRef();
    expect(insertTableRowBelow(ref as any)).toBe(true);
  });
});

describe('insertTableColumnLeft', () => {
  it('should return false when editor is not initialized', () => {
    expect(insertTableColumnLeft({ current: null } as any)).toBe(false);
  });

  it('should insert column to the left of current cell', () => {
    const m = createTableMock({ currentRow: 1, currentCol: 1 });
    const ref = m.createRef();
    expect(insertTableColumnLeft(ref as any)).toBe(true);
    expect(m.mockDispatch).toHaveBeenCalled();
  });

  it('should insert header column when in row 0', () => {
    const m = createTableMock({ currentRow: 0, currentCol: 1 });
    const ref = m.createRef();
    expect(insertTableColumnLeft(ref as any)).toBe(true);
  });
});

describe('insertTableColumnRight', () => {
  it('should return false when editor is not initialized', () => {
    expect(insertTableColumnRight({ current: null } as any)).toBe(false);
  });

  it('should insert column to the right of current cell', () => {
    const m = createTableMock({ currentRow: 1, currentCol: 1 });
    const ref = m.createRef();
    expect(insertTableColumnRight(ref as any)).toBe(true);
    expect(m.mockDispatch).toHaveBeenCalled();
  });

  it('should insert column right of last column', () => {
    const m = createTableMock({ colCount: 3, currentCol: 2 });
    const ref = m.createRef();
    expect(insertTableColumnRight(ref as any)).toBe(true);
  });
});

describe('moveTableRowUp', () => {
  it('should return false when editor is not initialized', () => {
    expect(moveTableRowUp({ current: null } as any)).toBe(false);
  });

  it('should return false when at first row (row 0)', () => {
    const m = createTableMock({ currentRow: 0, currentCol: 0 });
    const ref = m.createRef();
    expect(moveTableRowUp(ref as any)).toBe(false);
  });

  it('should swap row with previous row', () => {
    const m = createTableMock({ currentRow: 1, currentCol: 1 });
    const ref = m.createRef();
    expect(moveTableRowUp(ref as any)).toBe(true);
    expect(m.mockDispatch).toHaveBeenCalled();
    expect(m.trChain.replaceWith).toHaveBeenCalled();
  });
});

describe('moveTableRowDown', () => {
  it('should return false when editor is not initialized', () => {
    expect(moveTableRowDown({ current: null } as any)).toBe(false);
  });

  it('should return false when at last row', () => {
    const m = createTableMock({ rowCount: 3, currentRow: 2, currentCol: 0 });
    const ref = m.createRef();
    expect(moveTableRowDown(ref as any)).toBe(false);
  });

  it('should swap row with next row', () => {
    const m = createTableMock({ currentRow: 0, currentCol: 0 });
    const ref = m.createRef();
    expect(moveTableRowDown(ref as any)).toBe(true);
    expect(m.mockDispatch).toHaveBeenCalled();
  });
});

describe('moveTableColumnLeft', () => {
  it('should return false when editor is not initialized', () => {
    expect(moveTableColumnLeft({ current: null } as any)).toBe(false);
  });

  it('should return false when at first column (col 0)', () => {
    const m = createTableMock({ currentRow: 1, currentCol: 0 });
    const ref = m.createRef();
    expect(moveTableColumnLeft(ref as any)).toBe(false);
  });

  it('should swap column with left neighbor', () => {
    const m = createTableMock({ currentRow: 1, currentCol: 1 });
    const ref = m.createRef();
    expect(moveTableColumnLeft(ref as any)).toBe(true);
    expect(m.trChain.replaceWith).toHaveBeenCalled();
  });
});

describe('moveTableColumnRight', () => {
  it('should return false when editor is not initialized', () => {
    expect(moveTableColumnRight({ current: null } as any)).toBe(false);
  });

  it('should return false when at last column', () => {
    const m = createTableMock({ colCount: 3, currentRow: 1, currentCol: 2 });
    const ref = m.createRef();
    expect(moveTableColumnRight(ref as any)).toBe(false);
  });

  it('should swap column with right neighbor', () => {
    const m = createTableMock({ currentRow: 1, currentCol: 0 });
    const ref = m.createRef();
    expect(moveTableColumnRight(ref as any)).toBe(true);
    expect(m.trChain.replaceWith).toHaveBeenCalled();
  });
});

describe('deleteTableRow', () => {
  it('should return false when editor is not initialized', () => {
    expect(deleteTableRow({ current: null } as any)).toBe(false);
  });

  it('should return false when not in a table', () => {
    const ref = {
      current: {
        editor: {
          ctx: {},
          action: mock((fn: Function) => {
            const state = {
              selection: {
                from: 10, to: 10,
                $from: { depth: 1, node: () => ({ type: { name: 'paragraph' } }) },
              },
              doc: { resolve: () => ({ depth: 1, node: () => ({ type: { name: 'paragraph' } }) }) },
              schema: { nodes: {} },
              tr: { delete: mock(() => ({})) },
            };
            return fn({ get: () => ({ state, dispatch: mock(() => {}), focus: mock(() => {}) }) });
          }),
        },
      },
    };
    expect(deleteTableRow(ref as any)).toBe(false);
  });

  it('should delete entire table when only one row remains', () => {
    const m = createTableMock({ rowCount: 1, colCount: 2, currentRow: 0, currentCol: 0 });
    const ref = m.createRef();
    expect(deleteTableRow(ref as any)).toBe(true);
    expect(m.trChain.delete).toHaveBeenCalled();
  });

  it('should delete current row when multiple rows exist', () => {
    const m = createTableMock({ rowCount: 3, currentRow: 1, currentCol: 1 });
    const ref = m.createRef();
    expect(deleteTableRow(ref as any)).toBe(true);
    expect(m.mockDispatch).toHaveBeenCalled();
  });
});

describe('deleteTableColumn', () => {
  it('should return false when editor is not initialized', () => {
    expect(deleteTableColumn({ current: null } as any)).toBe(false);
  });

  it('should delete entire table when only one column remains', () => {
    const m = createTableMock({ rowCount: 2, colCount: 1, currentRow: 1, currentCol: 0 });
    const ref = m.createRef();
    expect(deleteTableColumn(ref as any)).toBe(true);
    expect(m.mockDispatch).toHaveBeenCalled();
  });

  it('should delete current column when multiple columns exist', () => {
    const m = createTableMock({ rowCount: 3, colCount: 3, currentRow: 1, currentCol: 1 });
    const ref = m.createRef();
    expect(deleteTableColumn(ref as any)).toBe(true);
    expect(m.mockDispatch).toHaveBeenCalled();
  });
});

describe('deleteTable', () => {
  it('should return false when editor is not initialized', () => {
    expect(deleteTable({ current: null } as any)).toBe(false);
  });

  it('should return false when editor has no ctx', () => {
    expect(deleteTable({ current: { editor: {} } } as any)).toBe(false);
  });

  it('should return false when not in a table', () => {
    const ref = {
      current: {
        editor: {
          ctx: {},
          action: mock((fn: Function) => {
            const state = {
              selection: { from: 5, to: 5, $from: { depth: 0, node: () => ({ type: { name: 'doc' } }) } },
              doc: { resolve: () => ({ depth: 0, node: () => ({ type: { name: 'doc' } }) }) },
              schema: { nodes: {} },
              tr: { delete: mock(() => ({})) },
            };
            return fn({ get: () => ({ state, dispatch: mock(() => {}), focus: mock(() => {}) }) });
          }),
        },
      },
    };
    expect(deleteTable(ref as any)).toBe(false);
  });

  it('should delete entire table when cursor is in table', () => {
    const m = createTableMock({ currentRow: 1, currentCol: 1 });
    const ref = m.createRef();
    expect(deleteTable(ref as any)).toBe(true);
    expect(m.trChain.delete).toHaveBeenCalled();
    expect(m.mockFocus).toHaveBeenCalled();
  });
});
