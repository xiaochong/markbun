/**
 * 表格操作命令
 * 包括: insert/delete/move rows/columns, delete table
 */
import { Crepe } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import { findTableNode, findCurrentCell } from '../utils/tableHelpers';

// ===== 行操作 =====

export function insertTableRowAbove(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;

    const cellInfo = findCurrentCell(state);
    if (!cellInfo) return false;

    const tableInfo = findTableNode(state);
    if (!tableInfo) return false;

    const { node: tableNode, pos: tablePos } = tableInfo;
    const { row } = cellInfo;

    const firstRow = tableNode.child(0);
    const colCount = firstRow.childCount;

    const newCells: any[] = [];
    for (let i = 0; i < colCount; i++) {
      const cellType = row === 0 ? state.schema.nodes.table_header : state.schema.nodes.table_cell;
      newCells.push(cellType.create(null, state.schema.nodes.paragraph.create()));
    }
    const newRow = state.schema.nodes.table_row.create(null, newCells);

    let insertPos = tablePos + 1;
    for (let i = 0; i < row; i++) {
      insertPos += tableNode.child(i).nodeSize;
    }

    const tr = state.tr.insert(insertPos, newRow);
    view.dispatch(tr);
    view.focus();
    return true;
  });
}

export function insertTableRowBelow(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;

    const cellInfo = findCurrentCell(state);
    if (!cellInfo) return false;

    const tableInfo = findTableNode(state);
    if (!tableInfo) return false;

    const { node: tableNode, pos: tablePos } = tableInfo;
    const { row } = cellInfo;

    const firstRow = tableNode.child(0);
    const colCount = firstRow.childCount;

    const newCells: any[] = [];
    for (let i = 0; i < colCount; i++) {
      newCells.push(state.schema.nodes.table_cell.create(null, state.schema.nodes.paragraph.create()));
    }
    const newRow = state.schema.nodes.table_row.create(null, newCells);

    let insertPos = tablePos + 1;
    for (let i = 0; i <= row; i++) {
      insertPos += tableNode.child(i).nodeSize;
    }

    const tr = state.tr.insert(insertPos, newRow);
    view.dispatch(tr);
    view.focus();
    return true;
  });
}

export function moveTableRowUp(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;

    const cellInfo = findCurrentCell(state);
    if (!cellInfo || cellInfo.row === 0) return false;

    const tableInfo = findTableNode(state);
    if (!tableInfo) return false;

    const { node: tableNode, pos: tablePos } = tableInfo;
    const { row } = cellInfo;

    const currentRow = tableNode.child(row);
    const prevRow = tableNode.child(row - 1);

    const rows: any[] = [];
    for (let i = 0; i < tableNode.childCount; i++) {
      if (i === row - 1) {
        rows.push(currentRow);
      } else if (i === row) {
        rows.push(prevRow);
      } else {
        rows.push(tableNode.child(i));
      }
    }

    const newTable = tableNode.type.create(tableNode.attrs, rows);
    const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

    view.dispatch(tr);
    view.focus();
    return true;
  });
}

export function moveTableRowDown(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;

    const cellInfo = findCurrentCell(state);
    if (!cellInfo) return false;

    const tableInfo = findTableNode(state);
    if (!tableInfo) return false;

    const { node: tableNode, pos: tablePos } = tableInfo;
    const { row } = cellInfo;

    if (row >= tableNode.childCount - 1) return false;

    const currentRow = tableNode.child(row);
    const nextRow = tableNode.child(row + 1);

    const rows: any[] = [];
    for (let i = 0; i < tableNode.childCount; i++) {
      if (i === row) {
        rows.push(nextRow);
      } else if (i === row + 1) {
        rows.push(currentRow);
      } else {
        rows.push(tableNode.child(i));
      }
    }

    const newTable = tableNode.type.create(tableNode.attrs, rows);
    const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

    view.dispatch(tr);
    view.focus();
    return true;
  });
}

export function deleteTableRow(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const { $from } = state.selection;

    let tableNode: any = null;
    let tablePos = -1;
    let rowNode: any = null;
    let rowPos = -1;
    let rowIndex = -1;

    for (let d = $from.depth; d >= 0; d--) {
      const node = $from.node(d);
      if (node.type.name === 'table') {
        tableNode = node;
        tablePos = $from.before(d);
        break;
      }
    }

    if (!tableNode) return false;

    for (let d = $from.depth; d >= 0; d--) {
      const node = $from.node(d);
      if (node.type.name === 'table_row') {
        rowNode = node;
        rowPos = $from.before(d);
        break;
      }
    }

    if (!rowNode) return false;

    for (let i = 0; i < tableNode.childCount; i++) {
      let calcPos = tablePos + 1;
      for (let j = 0; j < i; j++) {
        calcPos += tableNode.child(j).nodeSize;
      }
      if (calcPos === rowPos) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) return false;

    if (tableNode.childCount <= 1) {
      const tr = state.tr.delete(tablePos, tablePos + tableNode.nodeSize);
      view.dispatch(tr);
      view.focus();
      return true;
    }

    const tr = state.tr.delete(rowPos, rowPos + rowNode.nodeSize);
    view.dispatch(tr);
    view.focus();
    return true;
  });
}

// ===== 列操作 =====

export function insertTableColumnLeft(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;

    const cellInfo = findCurrentCell(state);
    if (!cellInfo) return false;

    const tableInfo = findTableNode(state);
    if (!tableInfo) return false;

    const { node: tableNode, pos: tablePos } = tableInfo;
    const { col } = cellInfo;

    const newRows: any[] = [];
    for (let rowIdx = 0; rowIdx < tableNode.childCount; rowIdx++) {
      const rowNode = tableNode.child(rowIdx);
      const newCells: any[] = [];

      for (let cellIdx = 0; cellIdx < rowNode.childCount; cellIdx++) {
        if (cellIdx === col) {
          const cellType = rowIdx === 0 ? state.schema.nodes.table_header : state.schema.nodes.table_cell;
          newCells.push(cellType.create(null, state.schema.nodes.paragraph.create()));
        }
        newCells.push(rowNode.child(cellIdx));
      }

      newRows.push(state.schema.nodes.table_row.create(null, newCells));
    }

    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

    view.dispatch(tr);
    view.focus();
    return true;
  });
}

export function insertTableColumnRight(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;

    const cellInfo = findCurrentCell(state);
    if (!cellInfo) return false;

    const tableInfo = findTableNode(state);
    if (!tableInfo) return false;

    const { node: tableNode, pos: tablePos } = tableInfo;
    const { col } = cellInfo;

    const newRows: any[] = [];
    for (let rowIdx = 0; rowIdx < tableNode.childCount; rowIdx++) {
      const rowNode = tableNode.child(rowIdx);
      const newCells: any[] = [];

      for (let cellIdx = 0; cellIdx < rowNode.childCount; cellIdx++) {
        newCells.push(rowNode.child(cellIdx));
        if (cellIdx === col) {
          const cellType = rowIdx === 0 ? state.schema.nodes.table_header : state.schema.nodes.table_cell;
          newCells.push(cellType.create(null, state.schema.nodes.paragraph.create()));
        }
      }

      newRows.push(state.schema.nodes.table_row.create(null, newCells));
    }

    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

    view.dispatch(tr);
    view.focus();
    return true;
  });
}

export function moveTableColumnLeft(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;

    const cellInfo = findCurrentCell(state);
    if (!cellInfo || cellInfo.col === 0) return false;

    const tableInfo = findTableNode(state);
    if (!tableInfo) return false;

    const { node: tableNode, pos: tablePos } = tableInfo;
    const { col } = cellInfo;

    const newRows: any[] = [];
    for (let rowIdx = 0; rowIdx < tableNode.childCount; rowIdx++) {
      const rowNode = tableNode.child(rowIdx);
      const newCells: any[] = [];

      for (let cellIdx = 0; cellIdx < rowNode.childCount; cellIdx++) {
        if (cellIdx === col - 1) {
          newCells.push(rowNode.child(col));
        } else if (cellIdx === col) {
          newCells.push(rowNode.child(col - 1));
        } else {
          newCells.push(rowNode.child(cellIdx));
        }
      }

      newRows.push(state.schema.nodes.table_row.create(null, newCells));
    }

    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

    view.dispatch(tr);
    view.focus();
    return true;
  });
}

export function moveTableColumnRight(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;

    const cellInfo = findCurrentCell(state);
    if (!cellInfo) return false;

    const tableInfo = findTableNode(state);
    if (!tableInfo) return false;

    const { node: tableNode, pos: tablePos } = tableInfo;
    const { col } = cellInfo;

    if (col >= tableNode.child(0).childCount - 1) return false;

    const newRows: any[] = [];
    for (let rowIdx = 0; rowIdx < tableNode.childCount; rowIdx++) {
      const rowNode = tableNode.child(rowIdx);
      const newCells: any[] = [];

      for (let cellIdx = 0; cellIdx < rowNode.childCount; cellIdx++) {
        if (cellIdx === col) {
          newCells.push(rowNode.child(col + 1));
        } else if (cellIdx === col + 1) {
          newCells.push(rowNode.child(col));
        } else {
          newCells.push(rowNode.child(cellIdx));
        }
      }

      newRows.push(state.schema.nodes.table_row.create(null, newCells));
    }

    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

    view.dispatch(tr);
    view.focus();
    return true;
  });
}

export function deleteTableColumn(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const { $from } = state.selection;

    let tableNode: any = null;
    let tablePos = -1;
    let rowNode: any = null;
    let colIndex = -1;

    for (let d = $from.depth; d >= 0; d--) {
      const node = $from.node(d);
      if (node.type.name === 'table') {
        tableNode = node;
        tablePos = $from.before(d);
        break;
      }
    }

    if (!tableNode) return false;

    for (let d = $from.depth; d >= 0; d--) {
      const node = $from.node(d);
      if (node.type.name === 'table_row') {
        rowNode = node;
        break;
      }
    }

    if (!rowNode) return false;

    for (let d = $from.depth; d >= 0; d--) {
      const node = $from.node(d);
      if (node.type.name === 'table_cell' || node.type.name === 'table_header') {
        const cellPos = $from.before(d);
        for (let i = 0; i < rowNode.childCount; i++) {
          let calcPos = $from.before(d - 1) + 1;
          for (let j = 0; j < i; j++) {
            calcPos += rowNode.child(j).nodeSize;
          }
          if (calcPos === cellPos) {
            colIndex = i;
            break;
          }
        }
        break;
      }
    }

    if (colIndex === -1) return false;

    const colCount = rowNode.childCount;

    if (colCount <= 1) {
      const tr = state.tr.delete(tablePos, tablePos + tableNode.nodeSize);
      view.dispatch(tr);
      view.focus();
      return true;
    }

    const newRows: any[] = [];
    for (let rowIdx = 0; rowIdx < tableNode.childCount; rowIdx++) {
      const currentRowNode = tableNode.child(rowIdx);
      const newCells: any[] = [];

      for (let cellIdx = 0; cellIdx < currentRowNode.childCount; cellIdx++) {
        if (cellIdx !== colIndex) {
          newCells.push(currentRowNode.child(cellIdx));
        }
      }

      newRows.push(state.schema.nodes.table_row.create(null, newCells));
    }

    const newTable = tableNode.type.create(tableNode.attrs, newRows);
    const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

    view.dispatch(tr);
    view.focus();
    return true;
  });
}

// ===== 表格整体操作 =====

export function deleteTable(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;

    const tableInfo = findTableNode(state);
    if (!tableInfo) return false;

    const { node: tableNode, pos: tablePos } = tableInfo;

    const tr = state.tr.delete(tablePos, tablePos + tableNode.nodeSize);
    view.dispatch(tr);
    view.focus();
    return true;
  });
}
