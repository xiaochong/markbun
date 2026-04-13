import { mock } from 'bun:test';

(mock as any).module('prosemirror-tables', () => ({
  addRowBefore: (state: any, dispatch?: any) => {
    if (!state.selection?.$head) return false;
    if (dispatch) dispatch(state.tr);
    return true;
  },
  addRowAfter: (state: any, dispatch?: any) => {
    if (!state.selection?.$head) return false;
    if (dispatch) dispatch(state.tr);
    return true;
  },
  addColumnBefore: (state: any, dispatch?: any) => {
    if (!state.selection?.$head) return false;
    if (dispatch) dispatch(state.tr);
    return true;
  },
  addColumnAfter: (state: any, dispatch?: any) => {
    if (!state.selection?.$head) return false;
    if (dispatch) dispatch(state.tr);
    return true;
  },
  deleteColumn: (state: any, dispatch?: any) => {
    if (!state.selection?.$head) return false;
    if (dispatch) dispatch(state.tr);
    return true;
  },
  deleteRow: (state: any, dispatch?: any) => {
    if (!state.selection?.$head) return false;
    if (dispatch) dispatch(state.tr);
    return true;
  },
}));
