/**
 * Types 单元测试
 * 验证类型定义和类型工具
 */
import { describe, it, expect } from 'bun:test';
import type {
  MilkdownEditorProps,
  MilkdownEditorRef,
  TableCellInfo,
  TableNodeInfo,
} from '../../setup';

describe('Type Definitions', () => {
  it('should have correct MilkdownEditorProps structure', () => {
    const props: MilkdownEditorProps = {
      defaultValue: '# Hello',
      onChange: (markdown: string) => console.log(markdown),
      className: 'custom-class',
      darkMode: true,
    };

    expect(props.defaultValue).toBe('# Hello');
    expect(typeof props.onChange).toBe('function');
    expect(props.className).toBe('custom-class');
    expect(props.darkMode).toBe(true);
  });

  it('should allow optional props', () => {
    const minimalProps: MilkdownEditorProps = {};
    expect(minimalProps.defaultValue).toBeUndefined();
    expect(minimalProps.onChange).toBeUndefined();
    expect(minimalProps.className).toBeUndefined();
    expect(minimalProps.darkMode).toBeUndefined();
  });

  it('should have correct TableCellInfo structure', () => {
    const cellInfo: TableCellInfo = {
      row: 1,
      col: 2,
      cellPos: 50,
      isHeader: false,
    };

    expect(cellInfo.row).toBe(1);
    expect(cellInfo.col).toBe(2);
    expect(cellInfo.cellPos).toBe(50);
    expect(cellInfo.isHeader).toBe(false);
  });

  it('should have correct TableNodeInfo structure', () => {
    const mockNode = { type: { name: 'table' } };
    const nodeInfo: TableNodeInfo = {
      node: mockNode,
      pos: 100,
    };

    expect(nodeInfo.node).toBe(mockNode);
    expect(nodeInfo.pos).toBe(100);
  });

  it('should define all required methods in MilkdownEditorRef', () => {
    // Verify the interface has the expected structure by creating a mock implementation
    const mockRef: Partial<MilkdownEditorRef> = {
      getMarkdown: () => '',
      setMarkdown: () => {},
      focus: () => {},
      isReady: true,
      toggleBold: () => true,
      toggleItalic: () => true,
      toggleHeading: () => true,
      toggleQuote: () => true,
      toggleCode: () => true,
      toggleLink: () => true,
      toggleList: () => true,
      toggleOrderedList: () => true,
      setParagraph: () => true,
      increaseHeadingLevel: () => true,
      decreaseHeadingLevel: () => true,
      insertTable: () => true,
      insertMathBlock: () => true,
      insertCodeBlock: () => true,
      insertTaskList: () => true,
      insertHorizontalRule: () => true,
      insertParagraphAbove: () => true,
      insertParagraphBelow: () => true,
      insertTableRowAbove: () => true,
      insertTableRowBelow: () => true,
      insertTableColumnLeft: () => true,
      insertTableColumnRight: () => true,
      moveTableRowUp: () => true,
      moveTableRowDown: () => true,
      moveTableColumnLeft: () => true,
      moveTableColumnRight: () => true,
      deleteTableRow: () => true,
      deleteTableColumn: () => true,
      deleteTable: () => true,
      hasSelection: () => false,
    };

    expect(typeof mockRef.getMarkdown).toBe('function');
    expect(typeof mockRef.setMarkdown).toBe('function');
    expect(typeof mockRef.focus).toBe('function');
    expect(mockRef.isReady).toBe(true);
    expect(typeof mockRef.toggleBold).toBe('function');
    expect(typeof mockRef.insertTable).toBe('function');
    expect(typeof mockRef.deleteTable).toBe('function');
  });
});
