import { ApplicationMenu } from 'electrobun/bun';

export interface MenuItem {
  label?: string;
  action?: string;
  shortcut?: string;
  enabled?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
}

export function setupMenu(): void {
  const menu: MenuItem[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New', action: 'file-new', shortcut: 'CmdOrCtrl+N' },
        { label: 'Open...', action: 'file-open', shortcut: 'CmdOrCtrl+O' },
        { separator: true },
        { label: 'Save', action: 'file-save', shortcut: 'CmdOrCtrl+S' },
        { label: 'Save As...', action: 'file-save-as', shortcut: 'CmdOrCtrl+Shift+S' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', action: 'edit-undo', shortcut: 'CmdOrCtrl+Z' },
        { label: 'Redo', action: 'edit-redo', shortcut: 'CmdOrCtrl+Shift+Z' },
        { separator: true },
        { label: 'Cut', action: 'edit-cut', shortcut: 'CmdOrCtrl+X' },
        { label: 'Copy', action: 'edit-copy', shortcut: 'CmdOrCtrl+C' },
        { label: 'Paste', action: 'edit-paste', shortcut: 'CmdOrCtrl+V' },
        { separator: true },
        { label: 'Select All', action: 'edit-select-all', shortcut: 'CmdOrCtrl+A' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Dark Mode', action: 'view-toggle-theme', shortcut: 'CmdOrCtrl+Shift+T' },
      ],
    },
  ];

  // @ts-ignore - ApplicationMenu types
  ApplicationMenu.setApplicationMenu(menu);
}
