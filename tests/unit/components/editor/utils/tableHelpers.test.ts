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
});

describe('findCurrentCell', () => {
  it('should be defined', () => {
    expect(typeof findCurrentCell).toBe('function');
  });
});
