import { ApplicationMenu } from 'electrobun/bun';
import type { ApplicationMenuItemConfig } from 'electrobun/bun';

// Visibility state for UI components
export interface ViewMenuState {
  showTitleBar: boolean;
  showToolBar: boolean;
  showStatusBar: boolean;
  showSidebar: boolean;
}

// Default state: all UI chrome hidden for distraction-free writing experience
// Users can enable specific UI elements via View menu based on their workflow needs
const defaultState: ViewMenuState = {
  showTitleBar: false,
  showToolBar: false,
  showStatusBar: false,
  showSidebar: false,
};

export function setupMenu(state: ViewMenuState = defaultState): void {
  const menu: ApplicationMenuItemConfig[] = [
    // macOS requires the app menu as the first menu
    {
      label: 'MarkBun',
      submenu: [
        { label: 'About MarkBun', action: 'app-about' },
        { type: 'separator' },
        { label: 'Hide MarkBun', role: 'hide', accelerator: 'Cmd+H' },
        { label: 'Hide Others', role: 'hideOthers', accelerator: 'Cmd+Option+H' },
        { label: 'Show All', role: 'showAll' },
        { type: 'separator' },
        { label: 'Quit MarkBun', role: 'quit', accelerator: 'Cmd+Q' },
      ],
    },
    {
      label: 'File',
      submenu: [
        { label: 'New', action: 'file-new', accelerator: 'CmdOrCtrl+N' },
        { label: 'Open...', action: 'file-open', accelerator: 'CmdOrCtrl+O' },
        { label: 'Quick Open...', action: 'view-quick-open', accelerator: 'CmdOrCtrl+P' },
        { type: 'separator' },
        { label: 'Save', action: 'file-save', accelerator: 'CmdOrCtrl+S' },
        { label: 'Save As...', action: 'file-save-as', accelerator: 'CmdOrCtrl+Shift+S' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', action: 'editor-undo', accelerator: 'CmdOrCtrl+Z' },
        { label: 'Redo', action: 'editor-redo', accelerator: 'CmdOrCtrl+Shift+Z' },
        { type: 'separator' },
        { label: 'Cut', action: 'editor-cut', accelerator: 'CmdOrCtrl+X' },
        { label: 'Copy', action: 'editor-copy', accelerator: 'CmdOrCtrl+C' },
        { label: 'Paste', action: 'editor-paste', accelerator: 'CmdOrCtrl+V' },
        { type: 'separator' },
        { label: 'Select All', action: 'editor-select-all', accelerator: 'CmdOrCtrl+A' },
      ],
    },
    {
      label: 'Format',
      submenu: [
        // Text styles - Milkdown native support
        { label: 'Strong', action: 'format-strong', accelerator: 'CmdOrCtrl+B' },
        { label: 'Emphasis', action: 'format-emphasis', accelerator: 'CmdOrCtrl+I' },
        { label: 'Strikethrough', action: 'format-strikethrough', accelerator: 'CmdOrCtrl+Shift+~' },
        { type: 'separator' },
        { label: 'Code', action: 'format-code', accelerator: 'CmdOrCtrl+Shift+C' },
        { label: 'Hyperlink', action: 'format-link', accelerator: 'CmdOrCtrl+K' },
        { type: 'separator' },
        { label: 'Image', action: 'format-image', accelerator: 'CmdOrCtrl+Shift+I' },
      ],
    },
    {
      label: 'Paragraph',
      submenu: [
        // Headings
        { label: 'Heading 1', action: 'para-heading-1', accelerator: 'CmdOrCtrl+1' },
        { label: 'Heading 2', action: 'para-heading-2', accelerator: 'CmdOrCtrl+2' },
        { label: 'Heading 3', action: 'para-heading-3', accelerator: 'CmdOrCtrl+3' },
        { label: 'Heading 4', action: 'para-heading-4', accelerator: 'CmdOrCtrl+4' },
        { label: 'Heading 5', action: 'para-heading-5', accelerator: 'CmdOrCtrl+5' },
        { label: 'Heading 6', action: 'para-heading-6', accelerator: 'CmdOrCtrl+6' },
        { type: 'separator' },
        { label: 'Paragraph', action: 'para-paragraph', accelerator: 'CmdOrCtrl+0' },
        { type: 'separator' },
        { label: 'Increase Heading Level', action: 'para-increase-heading', accelerator: 'CmdOrCtrl+Plus' },
        { label: 'Decrease Heading Level', action: 'para-decrease-heading', accelerator: 'CmdOrCtrl+Minus' },
        { type: 'separator' },
        // Block elements
        {
          label: 'Table',
          submenu: [
            { label: 'Insert Table', action: 'table-insert', accelerator: 'Alt+CmdOrCtrl+T' },
            { type: 'separator' },
            { label: 'Insert Row Above', action: 'table-insert-row-above' },
            { label: 'Insert Row Below', action: 'table-insert-row-below' },
            { type: 'separator' },
            { label: 'Insert Column Left', action: 'table-insert-col-left' },
            { label: 'Insert Column Right', action: 'table-insert-col-right' },
            { type: 'separator' },
            { label: 'Move Row Up', action: 'table-move-row-up' },
            { label: 'Move Row Down', action: 'table-move-row-down' },
            { type: 'separator' },
            { label: 'Move Column Left', action: 'table-move-col-left' },
            { label: 'Move Column Right', action: 'table-move-col-right' },
            { type: 'separator' },
            { label: 'Delete Row', action: 'table-delete-row' },
            { label: 'Delete Column', action: 'table-delete-col' },
            { type: 'separator' },
            { label: 'Delete Table', action: 'table-delete' },
          ],
        },
        { label: 'Math Block', action: 'para-math-block', accelerator: 'Alt+CmdOrCtrl+B' },
        { label: 'Code Block', action: 'para-code-block', accelerator: 'Alt+CmdOrCtrl+C' },
        { type: 'separator' },
        // Lists and quotes
        { label: 'Quote', action: 'para-quote', accelerator: 'Alt+CmdOrCtrl+Q' },
        { label: 'Ordered List', action: 'para-ordered-list', accelerator: 'Alt+CmdOrCtrl+O' },
        { label: 'Unordered List', action: 'para-unordered-list', accelerator: 'Alt+CmdOrCtrl+U' },
        { label: 'Task List', action: 'para-task-list', accelerator: 'Alt+CmdOrCtrl+X' },
        { type: 'separator' },
        // Paragraph operations
        { label: 'Insert Paragraph Above', action: 'para-insert-above' },
        { label: 'Insert Paragraph Below', action: 'para-insert-below' },
        { type: 'separator' },
        // Divider
        { label: 'Horizontal Rule', action: 'para-horizontal-rule', accelerator: 'Alt+CmdOrCtrl+Minus' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Dark Mode', action: 'view-toggle-theme', accelerator: 'CmdOrCtrl+Shift+T' },
        { type: 'separator' },
        { label: 'Show Sidebar', action: 'view-toggle-sidebar', accelerator: 'CmdOrCtrl+B', checked: state.showSidebar },
        { type: 'separator' },
        { label: 'Show Title Bar', action: 'view-toggle-titlebar', checked: state.showTitleBar },
        { label: 'Show Tool Bar', action: 'view-toggle-toolbar', checked: state.showToolBar },
        { label: 'Show Status Bar', action: 'view-toggle-statusbar', checked: state.showStatusBar },
        { type: 'separator' },
        { label: 'Toggle Developer Tools', action: 'view-toggle-devtools', accelerator: 'CmdOrCtrl+Option+I' },
      ],
    },
  ];

  ApplicationMenu.setApplicationMenu(menu);
}
