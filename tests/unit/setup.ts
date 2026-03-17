/**
 * 测试辅助模块
 * 统一导出所有编辑器模块，简化测试导入
 *
 * 使用方式:
 * import { isTableCell, toggleBold } from '../setup';
 */

// Utils
export { isTableCell, findTableNode, findCurrentCell } from '../../src/mainview/components/editor/utils/tableHelpers';
export { execCommand, hasSelection, insertParsedMarkdown } from '../../src/mainview/components/editor/utils/editorActions';

// Commands
export {
  toggleBold,
  toggleItalic,
  toggleHeading,
  toggleQuote,
  toggleCode,
  toggleLink,
  toggleList,
  toggleOrderedList,
  toggleUnderline,
  toggleHighlight,
  toggleSuperscript,
  toggleSubscript,
  insertInlineMath,
  insertComment,
  insertLocalImage,
  toggleStrikethrough,
  toggleCodeBlock,
  insertImage,
} from '../../src/mainview/components/editor/commands/formatting';

export {
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
} from '../../src/mainview/components/editor/commands/paragraph';

export {
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
} from '../../src/mainview/components/editor/commands/table';

export {
  insertText,
} from '../../src/mainview/components/editor/commands/text';

// Types
export type {
  MilkdownEditorProps,
  MilkdownEditorRef,
  TableCellInfo,
  TableNodeInfo,
} from '../../src/mainview/components/editor/types';

// Note: Hooks are not exported here because they require DOM environment
// Import hooks directly in browser environment tests only
