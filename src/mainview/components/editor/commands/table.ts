/**
 * 表格操作命令
 * 包括: insert/delete/move rows/columns, delete table
 */
import { Crepe } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import {
  deleteRow,
  deleteColumn,
  addRowBefore,
  addRowAfter,
  addColumnBefore,
  addColumnAfter,
} from 'prosemirror-tables';
import { findTableNode, findCurrentCell } from '../utils/tableHelpers';

// ===== 行操作 =====

export function insertTableRowAbove(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    if (addRowBefore(view.state, view.dispatch)) {
      view.focus();
      return true;
    }
    return false;
  });
}

export function insertTableRowBelow(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    if (addRowAfter(view.state, view.dispatch)) {
      view.focus();
      return true;
    }
    return false;
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

    const cellInfo = findCurrentCell(state);
    if (!cellInfo) return false;

    const tableInfo = findTableNode(state);
    if (!tableInfo) return false;

    const { node: tableNode, pos: tablePos } = tableInfo;
    const { row } = cellInfo;

    const rows: any[] = [];
    for (let i = 0; i < tableNode.childCount; i++) {
      if (i !== row) {
        rows.push(tableNode.child(i));
      }
    }

    if (rows.length === 0) {
      const tr = state.tr.delete(tablePos, tablePos + tableNode.nodeSize);
      view.dispatch(tr);
      view.focus();
      return true;
    }

    const newTable = tableNode.type.create(tableNode.attrs, rows);
    const tr = state.tr.replaceWith(tablePos, tablePos + tableNode.nodeSize, newTable);

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
    if (addColumnBefore(view.state, view.dispatch)) {
      view.focus();
      return true;
    }
    return false;
  });
}

export function insertTableColumnRight(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    if (addColumnAfter(view.state, view.dispatch)) {
      view.focus();
      return true;
    }
    return false;
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

      newRows.push(rowNode.type.create(rowNode.attrs, newCells));
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

      newRows.push(rowNode.type.create(rowNode.attrs, newCells));
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
    if (deleteColumn(view.state, view.dispatch)) {
      view.focus();
      return true;
    }
    return false;
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
