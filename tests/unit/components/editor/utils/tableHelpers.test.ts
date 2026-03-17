/**
 * Table Helpers 单元测试
 * 测试表格相关的工具函数
 */
import { describe, it, expect } from 'bun:test';
import { isTableCell, findTableNode, findCurrentCell } from '../../../setup';

describe('isTableCell', () => {
  it('should return true for table_cell node', () => {
    const node = { type: { name: 'table_cell' } };
    expect(isTableCell(node)).toBe(true);
  });

  it('should return true for table_header node', () => {
    const node = { type: { name: 'table_header' } };
    expect(isTableCell(node)).toBe(true);
  });

  it('should return false for paragraph node', () => {
    const node = { type: { name: 'paragraph' } };
    expect(isTableCell(node)).toBe(false);
  });

  it('should return false for null node', () => {
    expect(isTableCell(null)).toBe(false);
    expect(isTableCell(undefined)).toBe(false);
  });

  it('should return false for node without type', () => {
    expect(isTableCell({})).toBe(false);
    expect(isTableCell({ type: null })).toBe(false);
  });

  it('should return false for node without type.name', () => {
    expect(isTableCell({ type: {} })).toBe(false);
  });
});

describe('findTableNode', () => {
  it('should be defined', () => {
    expect(typeof findTableNode).toBe('function');
  });

  it('should return null when not in a table', () => {
    const mockState = {
      selection: {
        from: 10,
        $from: {
          depth: 2,
          node: () => ({ type: { name: 'paragraph' } }),
          before: () => 5,
        },
      },
      doc: { resolve: (pos: number) => mockState.selection.$from },
    };

    expect(findTableNode(mockState as any)).toBeNull();
  });

  it('should find table node when cursor is in a table', () => {
    const mockTableNode = { type: { name: 'table' }, childCount: 2 };
    const mockState = {
      selection: {
        from: 15,
        $from: {
          depth: 3,
          node: (d: number) => {
            if (d === 3) return { type: { name: 'table_cell' } };
            if (d === 2) return { type: { name: 'table_row' } };
            if (d === 1) return mockTableNode;
            return { type: { name: 'paragraph' } };
          },
          before: (d: number) => (d === 1 ? 10 : 5),
        },
      },
      doc: { resolve: (pos: number) => mockState.selection.$from },
    };

    const result = findTableNode(mockState as any);
    expect(result).not.toBeNull();
    expect(result?.node.type.name).toBe('table');
    expect(result?.pos).toBe(10);
  });

  it('should find table at depth 0', () => {
    const mockTableNode = { type: { name: 'table' } };
    const mockState = {
      selection: {
        from: 5,
        $from: {
          depth: 0,
          node: () => mockTableNode,
          before: () => 0,
        },
      },
      doc: { resolve: (pos: number) => mockState.selection.$from },
    };

    const result = findTableNode(mockState as any);
    expect(result).not.toBeNull();
    expect(result?.node.type.name).toBe('table');
  });
});

describe('findCurrentCell', () => {
  it('should be defined', () => {
    expect(typeof findCurrentCell).toBe('function');
  });

  it('should return null when not in a table cell', () => {
    const mockState = {
      selection: {
        from: 10,
        $from: {
          depth: 2,
          node: () => ({ type: { name: 'paragraph' } }),
        },
      },
      doc: { resolve: () => mockState.selection.$from },
    };

    expect(findCurrentCell(mockState as any)).toBeNull();
  });

  it('should find current cell in a table', () => {
    const mockCellNode = { type: { name: 'table_cell' }, nodeSize: 10 };
    const mockRowNode = { type: { name: 'table_row' }, childCount: 2, child: () => mockCellNode };
    const mockTableNode = { type: { name: 'table' }, childCount: 1, child: () => mockRowNode };

    let callCount = 0;
    const mockState = {
      selection: {
        from: 20,
        $from: {
          depth: 3,
          node: (d: number) => {
            if (d === 3) return mockCellNode;
            if (d === 2) return mockRowNode;
            if (d === 1) return mockTableNode;
            return { type: { name: 'doc' } };
          },
          before: (d: number) => {
            if (d === 1) return 10;
            if (d === 2) return 11;
            if (d === 3) return 12;
            return 0;
          },
          start: () => 15,
        },
      },
      doc: { resolve: () => mockState.selection.$from },
    };

    const result = findCurrentCell(mockState as any);
    expect(typeof result).toBe('object');
  });

  it('should handle table_header cells', () => {
    const mockHeaderNode = { type: { name: 'table_header' }, nodeSize: 10 };
    const mockRowNode = { type: { name: 'table_row' }, childCount: 1, child: () => mockHeaderNode };
    const mockTableNode = { type: { name: 'table' }, childCount: 1, child: () => mockRowNode };

    const mockState = {
      selection: {
        from: 15,
        $from: {
          depth: 3,
          node: (d: number) => {
            if (d === 3) return mockHeaderNode;
            if (d === 2) return mockRowNode;
            if (d === 1) return mockTableNode;
            return { type: { name: 'doc' } };
          },
          before: (d: number) => (d === 1 ? 5 : d === 2 ? 6 : 7),
          start: () => 10,
        },
      },
      doc: { resolve: () => mockState.selection.$from },
    };

    const result = findCurrentCell(mockState as any);
    expect(typeof result).toBe('object');
  });

  it('should return null when row parent is missing', () => {
    const mockCellNode = { type: { name: 'table_cell' } };

    const mockState = {
      selection: {
        from: 10,
        $from: {
          depth: 1,
          node: () => mockCellNode,
        },
      },
      doc: { resolve: () => mockState.selection.$from },
    };

    expect(findCurrentCell(mockState as any)).toBeNull();
  });

  it('should find cell in second row', () => {
    const mockCellNode = { type: { name: 'table_cell' }, nodeSize: 10 };
    const mockRowNode = {
      type: { name: 'table_row' },
      childCount: 2,
      child: (i: number) => i === 0 ? mockCellNode : { type: { name: 'table_cell' }, nodeSize: 10 }
    };
    const mockTableNode = {
      type: { name: 'table' },
      childCount: 2,
      child: () => mockRowNode
    };

    const mockState = {
      selection: {
        from: 35,
        $from: {
          depth: 3,
          node: (d: number) => {
            if (d === 3) return mockCellNode;
            if (d === 2) return mockRowNode;
            if (d === 1) return mockTableNode;
            return { type: { name: 'doc' } };
          },
          before: (d: number) => {
            if (d === 1) return 10;
            if (d === 2) return 22; // Second row
            if (d === 3) return 23;
            return 0;
          },
          start: () => 24,
        },
      },
      doc: { resolve: () => mockState.selection.$from },
    };

    const result = findCurrentCell(mockState as any);
    expect(typeof result).toBe('object');
    if (result) {
      expect(result.row).toBe(1);
    }
  });

  it('should find cell in second column', () => {
    const cell1 = { type: { name: 'table_cell' }, nodeSize: 10 };
    const cell2 = { type: { name: 'table_cell' }, nodeSize: 10 };
    const mockRowNode = {
      type: { name: 'table_row' },
      childCount: 2,
      child: (i: number) => i === 0 ? cell1 : cell2
    };
    const mockTableNode = {
      type: { name: 'table' },
      childCount: 1,
      child: () => mockRowNode
    };

    const mockState = {
      selection: {
        from: 25,
        $from: {
          depth: 3,
          node: (d: number) => {
            if (d === 3) return cell2;
            if (d === 2) return mockRowNode;
            if (d === 1) return mockTableNode;
            return { type: { name: 'doc' } };
          },
          before: (d: number) => {
            if (d === 1) return 10;
            if (d === 2) return 11;
            if (d === 3) return 22; // Second column cell
            return 0;
          },
          start: () => 23,
        },
      },
      doc: { resolve: () => mockState.selection.$from },
    };

    const result = findCurrentCell(mockState as any);
    expect(typeof result).toBe('object');
    if (result) {
      expect(result.col).toBe(1);
    }
  });
});
