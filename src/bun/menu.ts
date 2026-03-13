import { ApplicationMenu } from 'electrobun/bun';
import type { ApplicationMenuItemConfig } from 'electrobun/bun';

// Visibility state for UI components
export interface ViewMenuState {
  showTitleBar: boolean;
  showToolBar: boolean;
  showStatusBar: boolean;
}

// Default state: TitleBar hidden, ToolBar hidden, StatusBar shown
const defaultState: ViewMenuState = {
  showTitleBar: false,
  showToolBar: false,
  showStatusBar: true,
};

export function setupMenu(state: ViewMenuState = defaultState): void {
  const menu: ApplicationMenuItemConfig[] = [
    // macOS requires the app menu as the first menu
    {
      label: 'PingWrite',
      submenu: [
        { label: 'About PingWrite', action: 'app-about' },
        { type: 'separator' },
        { label: 'Hide PingWrite', role: 'hide', accelerator: 'Cmd+H' },
        { label: 'Hide Others', role: 'hideOthers', accelerator: 'Cmd+Option+H' },
        { label: 'Show All', role: 'showAll' },
        { type: 'separator' },
        { label: 'Quit PingWrite', role: 'quit', accelerator: 'Cmd+Q' },
      ],
    },
    {
      label: 'File',
      submenu: [
        { label: 'New', action: 'file-new', accelerator: 'CmdOrCtrl+N' },
        { label: 'Open...', action: 'file-open', accelerator: 'CmdOrCtrl+O' },
        { type: 'separator' },
        { label: 'Save', action: 'file-save', accelerator: 'CmdOrCtrl+S' },
        { label: 'Save As...', action: 'file-save-as', accelerator: 'CmdOrCtrl+Shift+S' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', role: 'undo', accelerator: 'CmdOrCtrl+Z' },
        { label: 'Redo', role: 'redo', accelerator: 'CmdOrCtrl+Shift+Z' },
        { type: 'separator' },
        { label: 'Cut', role: 'cut', accelerator: 'CmdOrCtrl+X' },
        { label: 'Copy', role: 'copy', accelerator: 'CmdOrCtrl+C' },
        { label: 'Paste', role: 'paste', accelerator: 'CmdOrCtrl+V' },
        { type: 'separator' },
        { label: 'Select All', role: 'selectAll', accelerator: 'CmdOrCtrl+A' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Dark Mode', action: 'view-toggle-theme', accelerator: 'CmdOrCtrl+Shift+T' },
        { type: 'separator' },
        { label: 'Show Title Bar', action: 'view-toggle-titlebar', type: 'checkbox', checked: state.showTitleBar },
        { label: 'Show Tool Bar', action: 'view-toggle-toolbar', type: 'checkbox', checked: state.showToolBar },
        { label: 'Show Status Bar', action: 'view-toggle-statusbar', type: 'checkbox', checked: state.showStatusBar },
        { type: 'separator' },
        { label: 'Toggle Developer Tools', action: 'view-toggle-devtools', accelerator: 'CmdOrCtrl+Option+I' },
      ],
    },
  ];

  ApplicationMenu.setApplicationMenu(menu);
}
