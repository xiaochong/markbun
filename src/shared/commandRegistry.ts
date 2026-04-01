// Command registry for the command palette.
// Manually enumerated from src/bun/menu.ts — new menu items must update BOTH files.

export type CommandCategory = 'file' | 'edit' | 'format' | 'paragraph' | 'table' | 'view' | 'help';

export interface CommandEntry {
  action: string;
  i18nKey: string;
  accelerator?: string;
  category: CommandCategory;
}

// Excludes role-based items (hide, hideOthers, quit, showAll) and file-export-pdf (not in menu).
// Context-menu-only entries (e.g. table-copy-cell) are also excluded as they are not in the menu bar.
export const COMMANDS: CommandEntry[] = [
  // ── File ──────────────────────────────────────────────────────────────────
  { action: 'app-preferences', i18nKey: 'app.preferences', accelerator: 'CmdOrCtrl+,', category: 'file' },
  { action: 'file-new', i18nKey: 'file.new', accelerator: 'CmdOrCtrl+N', category: 'file' },
  { action: 'window-new', i18nKey: 'file.newWindow', accelerator: 'CmdOrCtrl+Shift+N', category: 'file' },
  { action: 'file-open', i18nKey: 'file.open', accelerator: 'CmdOrCtrl+O', category: 'file' },
  { action: 'file-open-folder', i18nKey: 'file.openFolder', accelerator: 'CmdOrCtrl+Shift+O', category: 'file' },
  { action: 'view-quick-open', i18nKey: 'file.quickOpen', accelerator: 'CmdOrCtrl+P', category: 'file' },
  { action: 'file-save', i18nKey: 'file.save', accelerator: 'CmdOrCtrl+S', category: 'file' },
  { action: 'file-save-as', i18nKey: 'file.saveAs', accelerator: 'CmdOrCtrl+Shift+S', category: 'file' },
  { action: 'file-history', i18nKey: 'file.history', accelerator: 'CmdOrCtrl+Alt+H', category: 'file' },
  { action: 'file-export-image', i18nKey: 'file.exportImage', category: 'file' },
  { action: 'file-export-html', i18nKey: 'file.exportHTML', category: 'file' },

  // ── Edit ──────────────────────────────────────────────────────────────────
  { action: 'editor-undo', i18nKey: 'edit.undo', accelerator: 'CmdOrCtrl+Z', category: 'edit' },
  { action: 'editor-redo', i18nKey: 'edit.redo', accelerator: 'CmdOrCtrl+Shift+Z', category: 'edit' },
  { action: 'editor-cut', i18nKey: 'edit.cut', accelerator: 'CmdOrCtrl+X', category: 'edit' },
  { action: 'editor-copy', i18nKey: 'edit.copy', accelerator: 'CmdOrCtrl+C', category: 'edit' },
  { action: 'editor-paste', i18nKey: 'edit.paste', accelerator: 'CmdOrCtrl+V', category: 'edit' },
  { action: 'editor-select-all', i18nKey: 'edit.selectAll', accelerator: 'CmdOrCtrl+A', category: 'edit' },
  { action: 'edit-find', i18nKey: 'edit.find', accelerator: 'CmdOrCtrl+F', category: 'edit' },
  { action: 'edit-find-and-replace', i18nKey: 'edit.findAndReplace', accelerator: 'CmdOrCtrl+Option+F', category: 'edit' },

  // ── Format ────────────────────────────────────────────────────────────────
  { action: 'format-strong', i18nKey: 'format.strong', accelerator: 'CmdOrCtrl+B', category: 'format' },
  { action: 'format-emphasis', i18nKey: 'format.emphasis', accelerator: 'CmdOrCtrl+I', category: 'format' },
  { action: 'format-code', i18nKey: 'format.code', accelerator: 'CmdOrCtrl+Shift+C', category: 'format' },
  { action: 'format-inline-math', i18nKey: 'format.inlineFormula', accelerator: 'Ctrl+M', category: 'format' },
  { action: 'format-strikethrough', i18nKey: 'format.strikethrough', accelerator: 'CmdOrCtrl+Shift+~', category: 'format' },
  { action: 'format-highlight', i18nKey: 'format.highlight', accelerator: 'CmdOrCtrl+Shift+H', category: 'format' },
  { action: 'format-superscript', i18nKey: 'format.superscript', category: 'format' },
  { action: 'format-subscript', i18nKey: 'format.subscript', category: 'format' },
  { action: 'format-link', i18nKey: 'format.hyperlink', accelerator: 'CmdOrCtrl+K', category: 'format' },
  { action: 'format-image', i18nKey: 'format.image', accelerator: 'CmdOrCtrl+Shift+I', category: 'format' },

  // ── Paragraph ─────────────────────────────────────────────────────────────
  { action: 'para-heading-1', i18nKey: 'paragraph.heading1', accelerator: 'CmdOrCtrl+1', category: 'paragraph' },
  { action: 'para-heading-2', i18nKey: 'paragraph.heading2', accelerator: 'CmdOrCtrl+2', category: 'paragraph' },
  { action: 'para-heading-3', i18nKey: 'paragraph.heading3', accelerator: 'CmdOrCtrl+3', category: 'paragraph' },
  { action: 'para-heading-4', i18nKey: 'paragraph.heading4', accelerator: 'CmdOrCtrl+4', category: 'paragraph' },
  { action: 'para-heading-5', i18nKey: 'paragraph.heading5', accelerator: 'CmdOrCtrl+5', category: 'paragraph' },
  { action: 'para-heading-6', i18nKey: 'paragraph.heading6', accelerator: 'CmdOrCtrl+6', category: 'paragraph' },
  { action: 'para-paragraph', i18nKey: 'paragraph.paragraph', accelerator: 'CmdOrCtrl+0', category: 'paragraph' },
  { action: 'para-increase-heading', i18nKey: 'paragraph.increaseHeading', accelerator: 'CmdOrCtrl+=', category: 'paragraph' },
  { action: 'para-decrease-heading', i18nKey: 'paragraph.decreaseHeading', accelerator: 'CmdOrCtrl+Minus', category: 'paragraph' },
  { action: 'para-math-block', i18nKey: 'paragraph.mathBlock', accelerator: 'Alt+CmdOrCtrl+B', category: 'paragraph' },
  { action: 'para-code-block', i18nKey: 'paragraph.codeBlock', accelerator: 'Alt+CmdOrCtrl+C', category: 'paragraph' },
  { action: 'para-quote', i18nKey: 'paragraph.quote', accelerator: 'Alt+CmdOrCtrl+Q', category: 'paragraph' },
  { action: 'para-ordered-list', i18nKey: 'paragraph.orderedList', accelerator: 'Alt+CmdOrCtrl+O', category: 'paragraph' },
  { action: 'para-unordered-list', i18nKey: 'paragraph.unorderedList', accelerator: 'Alt+CmdOrCtrl+U', category: 'paragraph' },
  { action: 'para-task-list', i18nKey: 'paragraph.taskList', accelerator: 'Alt+CmdOrCtrl+X', category: 'paragraph' },
  { action: 'para-insert-above', i18nKey: 'paragraph.insertAbove', category: 'paragraph' },
  { action: 'para-insert-below', i18nKey: 'paragraph.insertBelow', category: 'paragraph' },
  { action: 'para-horizontal-rule', i18nKey: 'paragraph.horizontalRule', accelerator: 'Alt+CmdOrCtrl+Minus', category: 'paragraph' },

  // ── Table ─────────────────────────────────────────────────────────────────
  { action: 'table-insert', i18nKey: 'paragraph.insertTable', accelerator: 'Alt+CmdOrCtrl+T', category: 'table' },
  { action: 'table-insert-row-above', i18nKey: 'paragraph.insertRowAbove', category: 'table' },
  { action: 'table-insert-row-below', i18nKey: 'paragraph.insertRowBelow', category: 'table' },
  { action: 'table-insert-col-left', i18nKey: 'paragraph.insertColLeft', category: 'table' },
  { action: 'table-insert-col-right', i18nKey: 'paragraph.insertColRight', category: 'table' },
  { action: 'table-move-row-up', i18nKey: 'paragraph.moveRowUp', category: 'table' },
  { action: 'table-move-row-down', i18nKey: 'paragraph.moveRowDown', category: 'table' },
  { action: 'table-move-col-left', i18nKey: 'paragraph.moveColLeft', category: 'table' },
  { action: 'table-move-col-right', i18nKey: 'paragraph.moveColRight', category: 'table' },
  { action: 'table-delete-row', i18nKey: 'paragraph.deleteRow', category: 'table' },
  { action: 'table-delete-col', i18nKey: 'paragraph.deleteCol', category: 'table' },
  { action: 'table-delete', i18nKey: 'paragraph.deleteTable', category: 'table' },

  // ── View ──────────────────────────────────────────────────────────────────
  { action: 'view-toggle-theme', i18nKey: 'view.toggleDarkMode', accelerator: 'CmdOrCtrl+Shift+D', category: 'view' },
  { action: 'view-toggle-sidebar', i18nKey: 'view.showSidebar', accelerator: 'CmdOrCtrl+Shift+B', category: 'view' },
  { action: 'view-toggle-titlebar', i18nKey: 'view.showTitleBar', category: 'view' },
  { action: 'view-toggle-toolbar', i18nKey: 'view.showToolBar', category: 'view' },
  { action: 'view-toggle-statusbar', i18nKey: 'view.showStatusBar', category: 'view' },
  { action: 'view-toggle-source-mode', i18nKey: 'view.sourceMode', accelerator: 'CmdOrCtrl+/', category: 'view' },
  { action: 'view-toggle-devtools', i18nKey: 'view.toggleDevTools', category: 'view' },

  // ── Help ──────────────────────────────────────────────────────────────────
  { action: 'help-open', i18nKey: 'help.help', category: 'help' },
  { action: 'app-about', i18nKey: 'help.about', category: 'help' },
];
