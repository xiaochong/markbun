# Windows Frontend Menu Implementation

## Overview

MarkBun uses a custom frontend-implemented menu bar (AppMenuBar) on Windows instead of Electrobun's native system menu. This document explains why this decision was made and how to switch back to the system menu in the future.

## Why Use a Frontend Menu

### Root Cause: Electrobun's Windows Menu Bugs

The Electrobun framework has the following issues on Windows:

1. **Menu Rendering Issues**: Native menus don't render correctly on Windows, causing menus to not display or display abnormally
2. **Menu Event Loss**: After clicking a menu item, events fail to properly propagate to the renderer process
3. **Shortcut Conflicts**: System menu shortcut handling conflicts with frontend editor shortcuts
4. **Style Inconsistency**: Windows native menu styles cannot be unified with the app's dark/light theme

### Solution: Frontend Custom Menu

To provide a reliable user experience, we implemented a React-based custom menu bar (`AppMenuBar`):

- **Location**: `src/mainview/components/menu/AppMenuBar.tsx`
- **Features**:
  - Fully consistent with app theme (auto-switching dark/light mode)
  - Support for complete menu hierarchy (multi-level submenus)
  - Real-time menu item state synchronization (checked states)
  - Shortcut display and mapping (CmdOrCtrl → Ctrl, etc.)
  - Responsive interactions (hover, click, escape to close)

## Architecture Design

### Menu Configuration Flow

```
src/bun/menu.ts  →  via getMenuConfig() RPC  →  src/mainview/App.tsx  →  AppMenuBar
     ↑                                                   ↓
  Define menu structure                          Listen to UI state changes
  (ApplicationMenuItemConfig)                    Update menu item checked states
```

### Menu Action Handling Flow

```
User clicks menu item  →  AppMenuBar  →  handleMenuAction  →  RPC sendMenuAction
                                                              ↓
                                                        src/bun/index.ts
                                                              ↓
                                                        rpc.send.menuAction
                                                              ↓
                                                        renderer listener handles
```

### Key Code Locations

| Function | File Path |
|----------|-----------|
| Menu Definition | `src/bun/menu.ts` |
| Menu Config RPC | `src/bun/index.ts` (`getMenuConfig`) |
| Menu Action RPC | `src/bun/index.ts` (`sendMenuAction`) |
| Frontend Menu Component | `src/mainview/components/menu/AppMenuBar.tsx` |
| Menu Type Definitions | `src/shared/types.ts` (`MenuConfig`, `MenuItemConfig`) |
| Platform Detection | `src/mainview/App.tsx` (`const isWindows = ...`) |

## How to Switch Back to System Menu

When Electrobun fixes the Windows menu issues, follow these steps to switch back to the native system menu:

### Step 1: Modify `src/bun/menu.ts`

Remove the Windows platform condition and restore the native menu:

```typescript
// Current code (using frontend menu)
export function setupMenu(state: ViewMenuState, tFn: (key: string) => string): void {
  const menu: ApplicationMenuItemConfig[] = [...];

  currentMenuConfig = menu;

  // Windows uses frontend menu, skip native menu setup
  if (!isWindows) {
    ApplicationMenu.setApplicationMenu(menu);
  }
}

// Change to (using native menu)
export function setupMenu(state: ViewMenuState, tFn: (key: string) => string): void {
  const menu: ApplicationMenuItemConfig[] = [...];

  currentMenuConfig = menu;

  // All platforms use native menu
  ApplicationMenu.setApplicationMenu(menu);
}
```

### Step 2: Remove Frontend Menu Component

Remove frontend menu related code from `src/mainview/App.tsx`:

1. Remove imports:
   ```typescript
   // Delete these lines
   import { AppMenuBar } from './components/menu';
   import type { MenuConfig, AppMenuState } from './components/menu';
   ```

2. Remove menu state:
   ```typescript
   // Delete these states and hooks
   const [menuConfig, setMenuConfig] = useState<MenuConfig[]>([]);
   const appMenuState = useMemo<AppMenuState>(...);
   ```

3. Remove menu loading logic:
   ```typescript
   // Delete menu config loading in useEffect
   useEffect(() => {
     if (!isWindows) return;
     // Load menu config...
   }, [isWindows]);
   ```

4. Remove menu rendering:
   ```tsx
   // Delete AppMenuBar from JSX
   {isWindows && menuConfig.length > 0 && (
     <AppMenuBar ... />
   )}
   ```

### Step 3: Remove or Deprecate Related RPCs

If the frontend menu is no longer needed, you can remove these RPCs:

- `getMenuConfig` - Get menu configuration
- `sendMenuAction` - Send menu action

**Note**: It's recommended to keep these RPCs for a while for backward compatibility or as a fallback option.

### Step 4: Clean Up Type Definitions

If completely removing the frontend menu, clean up type definitions:

- Remove `MenuConfig` and `MenuItemConfig` from `src/shared/types.ts` (if no longer used)
- Remove the `src/mainview/components/menu/` directory

### Step 5: Test and Verify

After switching back to the system menu, test the following:

1. **Menu Display**: All menu items display correctly
2. **Menu Clicks**: Clicking menu items triggers correct actions
3. **Shortcuts**: Shortcuts work properly
4. **Menu States**: Checked states update correctly
5. **Theme Consistency**: Menu style matches app theme (if Electrobun supports it)

## References

- Electrobun Menu Documentation: [TBD]
- Electrobun Windows Support Issue: [TBD]
- MarkBun Menu Implementation PR: #[TBD]

## Changelog

| Date | Version | Description |
|------|---------|-------------|
| 2025-03-29 | v0.x | Initial frontend menu implementation |
