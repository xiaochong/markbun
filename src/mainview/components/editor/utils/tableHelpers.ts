/**
 * 表格操作工具函数
 */
import type { EditorState } from '@milkdown/prose/state';
import type { TableCellInfo, TableNodeInfo } from '../types';

/**
 * 检查节点是否是表格单元格（包括表头）
 */
export function isTableCell(node: any): boolean {
  return node && (node.type.name === 'table_cell' || node.type.name === 'table_header');
}

/**
 * 查找表格节点及其位置
 */
export function findTableNode(state: EditorState): TableNodeInfo | null {
  const { from } = state.selection;

  // Look for table node by traversing up from current position
  const $pos = state.doc.resolve(from);
  for (let d = $pos.depth; d >= 0; d--) {
    const node = $pos.node(d);
    if (node.type.name === 'table') {
      return { node, pos: $pos.before(d) };
    }
  }

  return null;
}

/**
 * 查找当前单元格在表格中的位置
 */
export function findCurrentCell(state: EditorState): TableCellInfo | null {
  const { from } = state.selection;
  const $pos = state.doc.resolve(from);

  // Traverse up to find table structure
  for (let d = $pos.depth; d >= 0; d--) {
    const node = $pos.node(d);

    if (isTableCell(node)) {
      const isHeader = node.type.name === 'table_header';

      // Find row and table parents
      const rowNode = $pos.node(d - 1);
      const tableNode = $pos.node(d - 2);

      if (rowNode?.type.name === 'table_row' && tableNode?.type.name === 'table') {
        // Find row index by iterating through table rows
        let rowIndex = -1;
        const rowStartPos = $pos.before(d - 1);
        for (let i = 0; i < tableNode.childCount; i++) {
          let calcPos = $pos.before(d - 2);
          for (let j = 0; j < i; j++) {
            calcPos += tableNode.child(j).nodeSize;
          }
          calcPos += 1;
          if (calcPos === rowStartPos) {
            rowIndex = i;
            break;
          }
        }

        // Find column index
        let colIndex = -1;
        const cellStartPos = $pos.before(d);
        for (let i = 0; i < rowNode.childCount; i++) {
          let calcPos = $pos.before(d - 1) + 1;
          for (let j = 0; j < i; j++) {
            calcPos += rowNode.child(j).nodeSize;
          }
          if (calcPos === cellStartPos) {
            colIndex = i;
            break;
          }
        }

        if (rowIndex >= 0 && colIndex >= 0) {
          return { row: rowIndex, col: colIndex, cellPos: $pos.start(d), isHeader };
        }
      }
      break;
    }
  }

  return null;
}
