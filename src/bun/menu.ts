import { ApplicationMenu } from 'electrobun/bun';
import type { ApplicationMenuItemConfig } from 'electrobun/bun';
import { t as defaultT } from './i18n';

// Visibility state for UI components
export interface ViewMenuState {
  showTitleBar: boolean;
  showToolBar: boolean;
  showStatusBar: boolean;
  showSidebar: boolean;
  sourceMode: boolean;
}

// Default state: all UI chrome hidden for distraction-free writing experience
// Users can enable specific UI elements via View menu based on their workflow needs
const defaultState: ViewMenuState = {
  showTitleBar: false,
  showToolBar: false,
  showStatusBar: false,
  showSidebar: false,
  sourceMode: false,
};

// Platform detection
const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

// Store menu config for frontend access
let currentMenuConfig: ApplicationMenuItemConfig[] | null = null;

export function getMenuConfig(): ApplicationMenuItemConfig[] | null {
  return currentMenuConfig;
}

export function setupMenu(state: ViewMenuState = defaultState, tFn: (key: string) => string = defaultT): void {
  const t = tFn;

  const menu: ApplicationMenuItemConfig[] = [
    // macOS requires the app menu as the first menu
    ...(isMac ? [{
      label: 'MarkBun',
      submenu: [
        { label: t('app.about'), action: 'app-about' },
        { type: 'separator' },
        { label: t('app.preferences'), action: 'app-preferences', accelerator: 'Cmd+,' },
        { type: 'separator' },
        { label: t('app.hide'), role: 'hide', accelerator: 'Cmd+H' },
        { label: t('app.hideOthers'), role: 'hideOthers', accelerator: 'Cmd+Option+H' },
        { label: t('app.showAll'), role: 'showAll' },
        { type: 'separator' },
        { label: t('app.quit'), role: 'quit', accelerator: 'Cmd+Q' },
      ],
    }] as ApplicationMenuItemConfig[] : []),
    {
      label: t('file.title'),
      submenu: [
        ...(!isMac ? [
          { label: t('app.preferences'), action: 'app-preferences', accelerator: 'Ctrl+,' },
          { type: 'separator' },
        ] as ApplicationMenuItemConfig[] : []),
        { label: t('file.new'), action: 'file-new', accelerator: 'CmdOrCtrl+N' },
        { label: t('file.newWindow'), action: 'window-new', accelerator: 'CmdOrCtrl+Shift+N' },
        { type: 'separator' },
        { label: t('file.open'), action: 'file-open', accelerator: 'CmdOrCtrl+O' },
        { label: t('file.openFolder'), action: 'file-open-folder', accelerator: 'CmdOrCtrl+Shift+O' },
        { label: t('file.quickOpen'), action: 'view-quick-open', accelerator: 'CmdOrCtrl+P' },
        { type: 'separator' },
        { label: t('file.save'), action: 'file-save', accelerator: 'CmdOrCtrl+S' },
        { label: t('file.saveAs'), action: 'file-save-as', accelerator: 'CmdOrCtrl+Shift+S' },
        { type: 'separator' },
        { label: t('file.history'), action: 'file-history', accelerator: 'CmdOrCtrl+Alt+H' },
        { type: 'separator' },
        {
          label: t('file.export'),
          submenu: [
            { label: t('file.exportImage'), action: 'file-export-image' },
            { label: t('file.exportHTML'), action: 'file-export-html' },
          ],
        },
        ...(!isMac ? [
          { type: 'separator' },
          { label: t('app.quit'), role: 'quit', accelerator: 'Alt+F4' },
        ] as ApplicationMenuItemConfig[] : []),
      ],
    },
    {
      label: t('edit.title'),
      submenu: [
        { label: t('edit.undo'), action: 'editor-undo', accelerator: 'CmdOrCtrl+Z' },
        { label: t('edit.redo'), action: 'editor-redo', accelerator: 'CmdOrCtrl+Shift+Z' },
        { type: 'separator' },
        { label: t('edit.cut'), action: 'editor-cut', accelerator: 'CmdOrCtrl+X' },
        { label: t('edit.copy'), action: 'editor-copy', accelerator: 'CmdOrCtrl+C' },
        { label: t('edit.paste'), action: 'editor-paste', accelerator: 'CmdOrCtrl+V' },
        { type: 'separator' },
        { label: t('edit.selectAll'), action: 'editor-select-all', accelerator: 'CmdOrCtrl+A' },
        { type: 'separator' },
        { label: t('edit.find'), action: 'edit-find', accelerator: 'CmdOrCtrl+F' },
        { label: t('edit.findAndReplace'), action: 'edit-find-and-replace', accelerator: 'CmdOrCtrl+Option+F' },
      ],
    },
    {
      label: t('format.title'),
      submenu: [
        { label: t('format.strong'), action: 'format-strong', accelerator: 'CmdOrCtrl+B' },
        { label: t('format.emphasis'), action: 'format-emphasis', accelerator: 'CmdOrCtrl+I' },
        { label: t('format.code'), action: 'format-code', accelerator: 'CmdOrCtrl+Shift+C' },
        { type: 'separator' },
        { label: t('format.inlineFormula'), action: 'format-inline-math', accelerator: 'Ctrl+M' },
        { label: t('format.strikethrough'), action: 'format-strikethrough', accelerator: 'CmdOrCtrl+Shift+~' },
        { label: t('format.highlight'), action: 'format-highlight', accelerator: 'CmdOrCtrl+Shift+H' },
        { label: t('format.superscript'), action: 'format-superscript' },
        { label: t('format.subscript'), action: 'format-subscript' },
        { type: 'separator' },
        { label: t('format.hyperlink'), action: 'format-link', accelerator: 'CmdOrCtrl+K' },
        { type: 'separator' },
        { label: t('format.image'), action: 'format-image', accelerator: 'CmdOrCtrl+Shift+I' },
      ],
    },
    {
      label: t('paragraph.title'),
      submenu: [
        // Headings
        { label: t('paragraph.heading1'), action: 'para-heading-1', accelerator: 'CmdOrCtrl+1' },
        { label: t('paragraph.heading2'), action: 'para-heading-2', accelerator: 'CmdOrCtrl+2' },
        { label: t('paragraph.heading3'), action: 'para-heading-3', accelerator: 'CmdOrCtrl+3' },
        { label: t('paragraph.heading4'), action: 'para-heading-4', accelerator: 'CmdOrCtrl+4' },
        { label: t('paragraph.heading5'), action: 'para-heading-5', accelerator: 'CmdOrCtrl+5' },
        { label: t('paragraph.heading6'), action: 'para-heading-6', accelerator: 'CmdOrCtrl+6' },
        { type: 'separator' },
        { label: t('paragraph.paragraph'), action: 'para-paragraph', accelerator: 'CmdOrCtrl+0' },
        { type: 'separator' },
        { label: t('paragraph.increaseHeading'), action: 'para-increase-heading', accelerator: 'CmdOrCtrl+=' },
        { label: t('paragraph.decreaseHeading'), action: 'para-decrease-heading', accelerator: 'CmdOrCtrl+Minus' },
        { type: 'separator' },
        // Block elements
        {
          label: t('paragraph.table'),
          submenu: [
            { label: t('paragraph.insertTable'), action: 'table-insert', accelerator: 'Alt+CmdOrCtrl+T' },
            { type: 'separator' },
            { label: t('paragraph.insertRowAbove'), action: 'table-insert-row-above' },
            { label: t('paragraph.insertRowBelow'), action: 'table-insert-row-below' },
            { type: 'separator' },
            { label: t('paragraph.insertColLeft'), action: 'table-insert-col-left' },
            { label: t('paragraph.insertColRight'), action: 'table-insert-col-right' },
            { type: 'separator' },
            { label: t('paragraph.moveRowUp'), action: 'table-move-row-up' },
            { label: t('paragraph.moveRowDown'), action: 'table-move-row-down' },
            { type: 'separator' },
            { label: t('paragraph.moveColLeft'), action: 'table-move-col-left' },
            { label: t('paragraph.moveColRight'), action: 'table-move-col-right' },
            { type: 'separator' },
            { label: t('paragraph.deleteRow'), action: 'table-delete-row' },
            { label: t('paragraph.deleteCol'), action: 'table-delete-col' },
            { type: 'separator' },
            { label: t('paragraph.deleteTable'), action: 'table-delete' },
          ],
        },
        { label: t('paragraph.mathBlock'), action: 'para-math-block', accelerator: 'Alt+CmdOrCtrl+B' },
        { label: t('paragraph.codeBlock'), action: 'para-code-block', accelerator: 'Alt+CmdOrCtrl+C' },
        { type: 'separator' },
        // Lists and quotes
        { label: t('paragraph.quote'), action: 'para-quote', accelerator: 'Alt+CmdOrCtrl+Q' },
        { label: t('paragraph.orderedList'), action: 'para-ordered-list', accelerator: 'Alt+CmdOrCtrl+O' },
        { label: t('paragraph.unorderedList'), action: 'para-unordered-list', accelerator: 'Alt+CmdOrCtrl+U' },
        { label: t('paragraph.taskList'), action: 'para-task-list', accelerator: 'Alt+CmdOrCtrl+X' },
        { type: 'separator' },
        // Paragraph operations
        { label: t('paragraph.insertAbove'), action: 'para-insert-above' },
        { label: t('paragraph.insertBelow'), action: 'para-insert-below' },
        { type: 'separator' },
        // Divider
        { label: t('paragraph.horizontalRule'), action: 'para-horizontal-rule', accelerator: 'Alt+CmdOrCtrl+Minus' },
      ],
    },
    {
      label: t('view.title'),
      submenu: [
        { label: t('view.toggleDarkMode'), action: 'view-toggle-theme', accelerator: 'CmdOrCtrl+Shift+D' },
        { type: 'separator' },
        { label: t('view.showSidebar'), action: 'view-toggle-sidebar', accelerator: 'CmdOrCtrl+Shift+B', checked: state.showSidebar },
        { type: 'separator' },
        { label: t('view.toggleAIPanel'), action: 'toggle-ai-panel', accelerator: 'CmdOrCtrl+Shift+A' },
        { type: 'separator' },
        { label: t('view.showTitleBar'), action: 'view-toggle-titlebar', checked: state.showTitleBar },
        { label: t('view.showToolBar'), action: 'view-toggle-toolbar', checked: state.showToolBar },
        { label: t('view.showStatusBar'), action: 'view-toggle-statusbar', checked: state.showStatusBar },
        { type: 'separator' },
        { label: t('view.sourceMode'), action: 'view-toggle-source-mode', accelerator: 'CmdOrCtrl+/', checked: state.sourceMode },
        { type: 'separator' },
        { label: t('view.toggleDevTools'), action: 'view-toggle-devtools', accelerator: isMac ? 'CmdOrCtrl+Option+I' : 'CmdOrCtrl+Alt+I' },
      ],
    },
    {
      label: t('help.title'),
      submenu: [
        { label: t('help.help'), action: 'help-open' },
        { type: 'separator' },
        { label: t('help.about'), action: 'app-about' },
      ],
    },
  ];

  currentMenuConfig = menu;

  // Windows uses frontend menu, skip native menu setup
  if (!isWindows) {
    ApplicationMenu.setApplicationMenu(menu);
  }
}
