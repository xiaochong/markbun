import { ApplicationMenu } from 'electrobun/bun';
import type { ApplicationMenuItemConfig } from 'electrobun/bun';
import { t as defaultT } from './i18n';
import { COMMANDS, CATEGORY_MENU_MAP } from '../shared/commandRegistry';
import type { CommandEntry } from '../shared/commandRegistry';

// Visibility state for UI components
export interface ViewMenuState {
  showTitleBar: boolean;
  showToolBar: boolean;
  showStatusBar: boolean;
  showSidebar: boolean;
  sourceMode: boolean;
}

// Context for when-condition evaluation on Bun side
export interface MenuContext extends ViewMenuState {
  hasOpenFile?: boolean;
  editorReady?: boolean;
}

// Default state: all UI chrome hidden for distraction-free writing experience
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

// Map category to top-level menu label i18n key
const MENU_LABEL_KEYS: Record<string, string> = {
  file: 'file.title',
  edit: 'edit.title',
  format: 'format.title',
  paragraph: 'paragraph.title',
  view: 'view.title',
  help: 'help.title',
};

/**
 * Check if a command's when condition is met given the current context.
 */
function evaluateWhen(entry: CommandEntry, context: MenuContext): boolean {
  if (!entry.when) return true;
  const keys = Array.isArray(entry.when) ? entry.when : [entry.when];
  for (const key of keys) {
    if (!(key in context) || !context[key as keyof MenuContext]) return false;
  }
  return true;
}

/**
 * Resolve the effective accelerator for a command, accounting for platform overrides.
 */
function resolveAccelerator(entry: CommandEntry): string | undefined {
  if (entry.platformOverrides) {
    if (isMac && entry.platformOverrides.macOS?.accelerator) {
      return entry.platformOverrides.macOS.accelerator;
    }
    if (isWindows && entry.platformOverrides.windows?.accelerator) {
      return entry.platformOverrides.windows.accelerator;
    }
  }
  return entry.accelerator;
}

/**
 * Check if a command is hidden on the current platform.
 */
function isHiddenOnPlatform(entry: CommandEntry): boolean {
  if (entry.hidden) return true;
  if (entry.platformOverrides) {
    if (isMac && entry.platformOverrides.macOS?.hidden) return true;
    if (isWindows && entry.platformOverrides.windows?.hidden) return true;
  }
  return false;
}

/**
 * Get the effective top-level menu key for a command.
 */
function getMenuKey(entry: CommandEntry): string {
  return entry.menuParent || CATEGORY_MENU_MAP[entry.category];
}

/**
 * Build a menu item from a command entry.
 */
function buildMenuItem(entry: CommandEntry, tFn: (key: string) => string, context: MenuContext): ApplicationMenuItemConfig {
  const item: ApplicationMenuItemConfig = {
    label: tFn(entry.i18nKey),
    action: entry.action,
  };

  const accel = resolveAccelerator(entry);
  if (accel) item.accelerator = accel;

  // Toggle state from context
  if (entry.toggled && entry.toggled in context) {
    item.checked = !!context[entry.toggled as keyof MenuContext];
  }

  // Enable/disable based on when condition
  if (!evaluateWhen(entry, context)) {
    item.enabled = false;
  }

  return item;
}

export function setupMenu(state: ViewMenuState = defaultState, tFn: (key: string) => string = defaultT): void {
  const t = tFn;
  const context: MenuContext = { ...state };

  // Group commands by effective top-level menu
  const menuGroups = new Map<string, CommandEntry[]>();
  for (const entry of COMMANDS) {
    if (isHiddenOnPlatform(entry)) continue;
    const menuKey = getMenuKey(entry);
    if (!menuGroups.has(menuKey)) menuGroups.set(menuKey, []);
    menuGroups.get(menuKey)!.push(entry);
  }

  // Build each top-level menu
  const menus: ApplicationMenuItemConfig[] = [];

  // macOS App menu (first)
  if (isMac) {
    menus.push({
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
    });
  }

  // Generate menus from manifest in defined order
  const menuOrder = ['file', 'edit', 'format', 'paragraph', 'view', 'help'];

  for (const menuKey of menuOrder) {
    const entries = menuGroups.get(menuKey);
    if (!entries || entries.length === 0) continue;

    const submenu: ApplicationMenuItemConfig[] = [];

    // Separate entries into direct items and submenu items
    const directItems: CommandEntry[] = [];
    const submenuItems = new Map<string, CommandEntry[]>();

    for (const entry of entries) {
      if (entry.menuSubmenu) {
        if (!submenuItems.has(entry.menuSubmenu)) submenuItems.set(entry.menuSubmenu, []);
        submenuItems.get(entry.menuSubmenu)!.push(entry);
      } else {
        directItems.push(entry);
      }
    }

    // Build direct items with separators between groups
    let lastGroup: number | undefined;
    for (const entry of directItems) {
      if (lastGroup !== undefined && entry.menuGroup !== lastGroup) {
        submenu.push({ type: 'separator' });
      }
      submenu.push(buildMenuItem(entry, t, context));
      lastGroup = entry.menuGroup;
    }

    // Build submenus (Export, Table, etc.)
    Array.from(submenuItems.entries()).forEach(([submenuKey, submenuEntries]) => {
      const submenuItemsList: ApplicationMenuItemConfig[] = [];
      for (const entry of submenuEntries) {
        submenuItemsList.push(buildMenuItem(entry, t, context));
      }
      submenu.push({
        label: t(submenuKey),
        submenu: submenuItemsList,
      });
    });

    // Special handling for File menu on non-macOS
    if (menuKey === 'file' && !isMac) {
      submenu.push({ type: 'separator' });
      submenu.push({ label: t('app.quit'), role: 'quit', accelerator: 'Alt+F4' });
    }

    menus.push({
      label: t(MENU_LABEL_KEYS[menuKey] || menuKey),
      submenu,
    });
  }

  currentMenuConfig = menus;

  // Windows uses frontend menu, skip native menu setup
  if (!isWindows) {
    ApplicationMenu.setApplicationMenu(menus);
  }
}
