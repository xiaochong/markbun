// Command registry — single source of truth for all command metadata.
// Drives: menu generation (macOS native + Windows frontend), command palette,
// unified dispatch routing, and contextual enablement.

export type CommandCategory = 'file' | 'edit' | 'format' | 'paragraph' | 'table' | 'view' | 'help';
export type ExecutionContext = 'main' | 'renderer' | 'cross-process';

export interface CommandEntry {
  action: string;
  i18nKey: string;
  accelerator?: string;
  category: CommandCategory;

  // Menu placement
  menuParent?: string;   // Override top-level menu (defaults from CATEGORY_MENU_MAP)
  menuSubmenu?: string;  // i18n key for submenu label (e.g., 'file.export', 'paragraph.table')
  menuGroup?: number;    // Separator groups — different numbers get a separator between them
  hidden?: boolean;      // Exclude from menu bar (e.g., context-menu-only actions)

  // Execution
  executionContext: ExecutionContext;

  // Conditional state
  when?: string | string[]; // Context key(s) that must be truthy to execute
  toggled?: string;         // Context key whose boolean value drives native menu checked state

  // Platform overrides
  platformOverrides?: {
    macOS?: Partial<Pick<CommandEntry, 'accelerator' | 'hidden'>>;
    windows?: Partial<Pick<CommandEntry, 'accelerator' | 'hidden'>>;
  };
}

// Maps category to top-level menu i18n key prefix (e.g., category 'table' → 'paragraph' menu)
export const CATEGORY_MENU_MAP: Record<CommandCategory, string> = {
  file: 'file',
  edit: 'edit',
  format: 'format',
  paragraph: 'paragraph',
  table: 'paragraph', // table items go under the Paragraph menu's Table submenu
  view: 'view',
  help: 'help',
};

export const COMMANDS: CommandEntry[] = [
  // ── File ──────────────────────────────────────────────────────────────────
  { action: 'app-preferences', i18nKey: 'app.preferences', accelerator: 'CmdOrCtrl+,', category: 'file', menuGroup: 1, executionContext: 'cross-process', platformOverrides: { macOS: { hidden: true } } },
  { action: 'file-new', i18nKey: 'file.new', accelerator: 'CmdOrCtrl+N', category: 'file', menuGroup: 2, executionContext: 'cross-process' },
  { action: 'window-new', i18nKey: 'file.newWindow', accelerator: 'CmdOrCtrl+Shift+N', category: 'file', menuGroup: 2, executionContext: 'main' },
  { action: 'file-open', i18nKey: 'file.open', accelerator: 'CmdOrCtrl+O', category: 'file', menuGroup: 3, executionContext: 'cross-process' },
  { action: 'file-open-folder', i18nKey: 'file.openFolder', accelerator: 'CmdOrCtrl+Shift+O', category: 'file', menuGroup: 3, executionContext: 'cross-process' },
  { action: 'view-quick-open', i18nKey: 'file.quickOpen', accelerator: 'CmdOrCtrl+P', category: 'file', menuGroup: 3, executionContext: 'cross-process' },
  { action: 'file-save', i18nKey: 'file.save', accelerator: 'CmdOrCtrl+S', category: 'file', menuGroup: 4, executionContext: 'cross-process', when: 'hasOpenFile' },
  { action: 'file-save-as', i18nKey: 'file.saveAs', accelerator: 'CmdOrCtrl+Shift+S', category: 'file', menuGroup: 4, executionContext: 'cross-process', when: 'hasOpenFile' },
  { action: 'file-history', i18nKey: 'file.history', accelerator: 'CmdOrCtrl+Alt+H', category: 'file', menuGroup: 5, executionContext: 'cross-process' },
  { action: 'file-export-image', i18nKey: 'file.exportImage', category: 'file', menuSubmenu: 'file.export', menuGroup: 6, executionContext: 'renderer' },
  { action: 'file-export-html', i18nKey: 'file.exportHTML', category: 'file', menuSubmenu: 'file.export', menuGroup: 6, executionContext: 'renderer' },

  // ── Edit ──────────────────────────────────────────────────────────────────
  { action: 'editor-undo', i18nKey: 'edit.undo', accelerator: 'CmdOrCtrl+Z', category: 'edit', menuGroup: 1, executionContext: 'renderer' },
  { action: 'editor-redo', i18nKey: 'edit.redo', accelerator: 'CmdOrCtrl+Shift+Z', category: 'edit', menuGroup: 1, executionContext: 'renderer' },
  { action: 'editor-cut', i18nKey: 'edit.cut', accelerator: 'CmdOrCtrl+X', category: 'edit', menuGroup: 2, executionContext: 'renderer' },
  { action: 'editor-copy', i18nKey: 'edit.copy', accelerator: 'CmdOrCtrl+C', category: 'edit', menuGroup: 2, executionContext: 'renderer' },
  { action: 'editor-paste', i18nKey: 'edit.paste', accelerator: 'CmdOrCtrl+V', category: 'edit', menuGroup: 2, executionContext: 'renderer' },
  { action: 'editor-select-all', i18nKey: 'edit.selectAll', accelerator: 'CmdOrCtrl+A', category: 'edit', menuGroup: 3, executionContext: 'renderer' },
  { action: 'edit-find', i18nKey: 'edit.find', accelerator: 'CmdOrCtrl+F', category: 'edit', menuGroup: 4, executionContext: 'renderer' },
  { action: 'edit-find-and-replace', i18nKey: 'edit.findAndReplace', accelerator: 'CmdOrCtrl+Option+F', category: 'edit', menuGroup: 4, executionContext: 'renderer' },

  // ── Format ────────────────────────────────────────────────────────────────
  { action: 'format-strong', i18nKey: 'format.strong', accelerator: 'CmdOrCtrl+B', category: 'format', menuGroup: 1, executionContext: 'renderer' },
  { action: 'format-emphasis', i18nKey: 'format.emphasis', accelerator: 'CmdOrCtrl+I', category: 'format', menuGroup: 1, executionContext: 'renderer' },
  { action: 'format-code', i18nKey: 'format.code', accelerator: 'CmdOrCtrl+Shift+C', category: 'format', menuGroup: 1, executionContext: 'renderer' },
  { action: 'format-inline-math', i18nKey: 'format.inlineFormula', accelerator: 'Ctrl+M', category: 'format', menuGroup: 2, executionContext: 'renderer' },
  { action: 'format-strikethrough', i18nKey: 'format.strikethrough', accelerator: 'CmdOrCtrl+Shift+~', category: 'format', menuGroup: 2, executionContext: 'renderer' },
  { action: 'format-highlight', i18nKey: 'format.highlight', accelerator: 'CmdOrCtrl+Shift+H', category: 'format', menuGroup: 2, executionContext: 'renderer' },
  { action: 'format-superscript', i18nKey: 'format.superscript', category: 'format', menuGroup: 2, executionContext: 'renderer' },
  { action: 'format-subscript', i18nKey: 'format.subscript', category: 'format', menuGroup: 2, executionContext: 'renderer' },
  { action: 'format-link', i18nKey: 'format.hyperlink', accelerator: 'CmdOrCtrl+K', category: 'format', menuGroup: 3, executionContext: 'renderer' },
  { action: 'format-image', i18nKey: 'format.image', accelerator: 'CmdOrCtrl+Shift+I', category: 'format', menuGroup: 4, executionContext: 'renderer' },

  // ── Paragraph ─────────────────────────────────────────────────────────────
  { action: 'para-heading-1', i18nKey: 'paragraph.heading1', accelerator: 'CmdOrCtrl+1', category: 'paragraph', menuGroup: 1, executionContext: 'renderer' },
  { action: 'para-heading-2', i18nKey: 'paragraph.heading2', accelerator: 'CmdOrCtrl+2', category: 'paragraph', menuGroup: 1, executionContext: 'renderer' },
  { action: 'para-heading-3', i18nKey: 'paragraph.heading3', accelerator: 'CmdOrCtrl+3', category: 'paragraph', menuGroup: 1, executionContext: 'renderer' },
  { action: 'para-heading-4', i18nKey: 'paragraph.heading4', accelerator: 'CmdOrCtrl+4', category: 'paragraph', menuGroup: 1, executionContext: 'renderer' },
  { action: 'para-heading-5', i18nKey: 'paragraph.heading5', accelerator: 'CmdOrCtrl+5', category: 'paragraph', menuGroup: 1, executionContext: 'renderer' },
  { action: 'para-heading-6', i18nKey: 'paragraph.heading6', accelerator: 'CmdOrCtrl+6', category: 'paragraph', menuGroup: 1, executionContext: 'renderer' },
  { action: 'para-paragraph', i18nKey: 'paragraph.paragraph', accelerator: 'CmdOrCtrl+0', category: 'paragraph', menuGroup: 2, executionContext: 'renderer' },
  { action: 'para-increase-heading', i18nKey: 'paragraph.increaseHeading', accelerator: 'CmdOrCtrl+=', category: 'paragraph', menuGroup: 3, executionContext: 'renderer' },
  { action: 'para-decrease-heading', i18nKey: 'paragraph.decreaseHeading', accelerator: 'CmdOrCtrl+Minus', category: 'paragraph', menuGroup: 3, executionContext: 'renderer' },
  // Table submenu under Paragraph
  { action: 'table-insert', i18nKey: 'paragraph.insertTable', accelerator: 'Alt+CmdOrCtrl+T', category: 'table', menuSubmenu: 'paragraph.table', menuGroup: 4, executionContext: 'renderer' },
  { action: 'table-insert-row-above', i18nKey: 'paragraph.insertRowAbove', category: 'table', menuSubmenu: 'paragraph.table', menuGroup: 4, executionContext: 'renderer' },
  { action: 'table-insert-row-below', i18nKey: 'paragraph.insertRowBelow', category: 'table', menuSubmenu: 'paragraph.table', menuGroup: 4, executionContext: 'renderer' },
  { action: 'table-insert-col-left', i18nKey: 'paragraph.insertColLeft', category: 'table', menuSubmenu: 'paragraph.table', menuGroup: 4, executionContext: 'renderer' },
  { action: 'table-insert-col-right', i18nKey: 'paragraph.insertColRight', category: 'table', menuSubmenu: 'paragraph.table', menuGroup: 4, executionContext: 'renderer' },
  { action: 'table-move-row-up', i18nKey: 'paragraph.moveRowUp', category: 'table', menuSubmenu: 'paragraph.table', menuGroup: 4, executionContext: 'renderer' },
  { action: 'table-move-row-down', i18nKey: 'paragraph.moveRowDown', category: 'table', menuSubmenu: 'paragraph.table', menuGroup: 4, executionContext: 'renderer' },
  { action: 'table-move-col-left', i18nKey: 'paragraph.moveColLeft', category: 'table', menuSubmenu: 'paragraph.table', menuGroup: 4, executionContext: 'renderer' },
  { action: 'table-move-col-right', i18nKey: 'paragraph.moveColRight', category: 'table', menuSubmenu: 'paragraph.table', menuGroup: 4, executionContext: 'renderer' },
  { action: 'table-delete-row', i18nKey: 'paragraph.deleteRow', category: 'table', menuSubmenu: 'paragraph.table', menuGroup: 4, executionContext: 'renderer' },
  { action: 'table-delete-col', i18nKey: 'paragraph.deleteCol', category: 'table', menuSubmenu: 'paragraph.table', menuGroup: 4, executionContext: 'renderer' },
  { action: 'table-delete', i18nKey: 'paragraph.deleteTable', category: 'table', menuSubmenu: 'paragraph.table', menuGroup: 4, executionContext: 'renderer' },
  // Context-menu-only table action
  { action: 'table-copy-cell', i18nKey: 'paragraph.copyCell', category: 'table', executionContext: 'renderer', hidden: true },
  { action: 'para-math-block', i18nKey: 'paragraph.mathBlock', accelerator: 'Alt+CmdOrCtrl+B', category: 'paragraph', menuGroup: 5, executionContext: 'renderer' },
  { action: 'para-code-block', i18nKey: 'paragraph.codeBlock', accelerator: 'Alt+CmdOrCtrl+C', category: 'paragraph', menuGroup: 5, executionContext: 'renderer' },
  { action: 'para-quote', i18nKey: 'paragraph.quote', accelerator: 'Alt+CmdOrCtrl+Q', category: 'paragraph', menuGroup: 6, executionContext: 'renderer' },
  { action: 'para-ordered-list', i18nKey: 'paragraph.orderedList', accelerator: 'Alt+CmdOrCtrl+O', category: 'paragraph', menuGroup: 6, executionContext: 'renderer' },
  { action: 'para-unordered-list', i18nKey: 'paragraph.unorderedList', accelerator: 'Alt+CmdOrCtrl+U', category: 'paragraph', menuGroup: 6, executionContext: 'renderer' },
  { action: 'para-task-list', i18nKey: 'paragraph.taskList', accelerator: 'Alt+CmdOrCtrl+X', category: 'paragraph', menuGroup: 6, executionContext: 'renderer' },
  { action: 'para-insert-above', i18nKey: 'paragraph.insertAbove', category: 'paragraph', menuGroup: 7, executionContext: 'renderer' },
  { action: 'para-insert-below', i18nKey: 'paragraph.insertBelow', category: 'paragraph', menuGroup: 7, executionContext: 'renderer' },
  { action: 'para-horizontal-rule', i18nKey: 'paragraph.horizontalRule', accelerator: 'Alt+CmdOrCtrl+Minus', category: 'paragraph', menuGroup: 8, executionContext: 'renderer' },

  // ── View ──────────────────────────────────────────────────────────────────
  { action: 'view-toggle-theme', i18nKey: 'view.toggleDarkMode', accelerator: 'CmdOrCtrl+Shift+D', category: 'view', menuGroup: 1, executionContext: 'cross-process' },
  { action: 'view-toggle-sidebar', i18nKey: 'view.showSidebar', accelerator: 'CmdOrCtrl+Shift+B', category: 'view', menuGroup: 2, executionContext: 'cross-process', toggled: 'showSidebar' },
  { action: 'toggle-ai-panel', i18nKey: 'view.toggleAIPanel', accelerator: 'CmdOrCtrl+Shift+A', category: 'view', menuGroup: 3, executionContext: 'renderer' },
  { action: 'view-toggle-titlebar', i18nKey: 'view.showTitleBar', category: 'view', menuGroup: 4, executionContext: 'cross-process', toggled: 'showTitleBar' },
  { action: 'view-toggle-toolbar', i18nKey: 'view.showToolBar', category: 'view', menuGroup: 4, executionContext: 'cross-process', toggled: 'showToolBar' },
  { action: 'view-toggle-statusbar', i18nKey: 'view.showStatusBar', category: 'view', menuGroup: 4, executionContext: 'cross-process', toggled: 'showStatusBar' },
  { action: 'view-toggle-source-mode', i18nKey: 'view.sourceMode', accelerator: 'CmdOrCtrl+/', category: 'view', menuGroup: 5, executionContext: 'cross-process', toggled: 'sourceMode' },
  { action: 'view-toggle-devtools', i18nKey: 'view.toggleDevTools', category: 'view', menuGroup: 6, executionContext: 'main', platformOverrides: { macOS: { accelerator: 'CmdOrCtrl+Option+I' }, windows: { accelerator: 'CmdOrCtrl+Alt+I' } } },

  // ── Help ──────────────────────────────────────────────────────────────────
  { action: 'help-open', i18nKey: 'help.help', category: 'help', menuGroup: 1, executionContext: 'main' },
  { action: 'app-about', i18nKey: 'help.about', category: 'help', menuGroup: 2, executionContext: 'cross-process' },
];

// Lookup helper: find command entry by action ID
export function getCommand(action: string): CommandEntry | undefined {
  return COMMANDS.find(cmd => cmd.action === action);
}

// Lookup helper: get commands visible in the menu bar (excludes hidden items)
export function getMenuCommands(): CommandEntry[] {
  return COMMANDS.filter(cmd => !cmd.hidden);
}

// Lookup helper: get commands for the command palette (excludes hidden items)
export function getPaletteCommands(): CommandEntry[] {
  return COMMANDS.filter(cmd => !cmd.hidden);
}
