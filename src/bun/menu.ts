import { ApplicationMenu } from 'electrobun/bun';
import type { ApplicationMenuItemConfig } from 'electrobun/bun';

export function setupMenu(): void {
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
        { label: 'Toggle Developer Tools', action: 'view-toggle-devtools', accelerator: 'CmdOrCtrl+Option+I' },
      ],
    },
  ];

  ApplicationMenu.setApplicationMenu(menu);
}
