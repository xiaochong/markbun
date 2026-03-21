/**
 * MilkdownEditor 类型定义
 * 集中管理所有接口和类型
 */

export interface MilkdownEditorProps {
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  className?: string;
  darkMode?: boolean;
}

export interface MilkdownEditorRef {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  focus: () => void;
  isReady: boolean;
  getSelectedMarkdown: () => string | null;
  // Formatting commands
  toggleBold: () => boolean;
  toggleItalic: () => boolean;
  toggleHeading: (level: number) => boolean;
  toggleQuote: () => boolean;
  toggleCode: () => boolean;
  toggleLink: (href?: string, title?: string) => boolean;
  toggleList: () => boolean;
  toggleOrderedList: () => boolean;
  // Extended formatting commands (GFM)
  toggleStrikethrough: () => boolean;
  toggleHighlight: () => boolean;
  toggleSuperscript: () => boolean;
  toggleSubscript: () => boolean;
  // Paragraph menu commands
  setParagraph: () => boolean;
  increaseHeadingLevel: () => boolean;
  decreaseHeadingLevel: () => boolean;
  insertTable: () => boolean;
  insertMathBlock: () => boolean;
  insertCodeBlock: () => boolean;
  insertMermaidBlock: () => boolean;
  insertTaskList: () => boolean;
  insertHorizontalRule: () => boolean;
  insertParagraphAbove: () => boolean;
  insertParagraphBelow: () => boolean;
  // Table operations
  insertTableRowAbove: () => boolean;
  insertTableRowBelow: () => boolean;
  insertTableColumnLeft: () => boolean;
  insertTableColumnRight: () => boolean;
  moveTableRowUp: () => boolean;
  moveTableRowDown: () => boolean;
  moveTableColumnLeft: () => boolean;
  moveTableColumnRight: () => boolean;
  deleteTableRow: () => boolean;
  deleteTableColumn: () => boolean;
  deleteTable: () => boolean;
  // Selection
  hasSelection: () => boolean;
  // Insert image
  insertImage: (src: string, alt?: string, title?: string) => boolean;
  // Insert text at current cursor position
  insertText: (text: string) => boolean;
}

// 编辑器实例引用类型
export type CrepeRef = {
  current: {
    editor?: {
      ctx?: any;
    };
    getMarkdown: () => string;
  } | null;
};

// 表格单元格信息
export interface TableCellInfo {
  row: number;
  col: number;
  cellPos: number;
  isHeader: boolean;
}

// 表格节点信息
export interface TableNodeInfo {
  node: any;
  pos: number;
}
