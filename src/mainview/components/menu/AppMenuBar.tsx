import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import type { MenuItemConfig, MenuConfig, AppMenuState } from './types';

interface AppMenuBarProps {
  menuConfig: MenuConfig[];
  menuState: AppMenuState;
  onAction: (action: string) => void;
}

export function AppMenuBar({ menuConfig, menuState, onAction }: AppMenuBarProps) {
  const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  // Close menu when clicking outside (check both menu bar and dropdown portal)
  useEffect(() => {
    if (activeMenuIndex === null) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInMenuBar = menuBarRef.current?.contains(target);
      const isInDropdown = dropdownRef.current?.contains(target);
      if (!isInMenuBar && !isInDropdown) {
        setActiveMenuIndex(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveMenuIndex(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeMenuIndex]);

  const handleMenuClick = useCallback((index: number, buttonEl: HTMLButtonElement) => {
    setActiveMenuIndex(prev => {
      if (prev === index) return null;
      const rect = buttonEl.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom, left: rect.left });
      return index;
    });
  }, []);

  const handleMenuHover = useCallback((index: number, buttonEl: HTMLButtonElement) => {
    if (activeMenuIndex !== null && activeMenuIndex !== index) {
      const rect = buttonEl.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom, left: rect.left });
      setActiveMenuIndex(index);
    }
  }, [activeMenuIndex]);

  const handleAction = useCallback((action: string) => {
    onAction(action);
    setActiveMenuIndex(null);
  }, [onAction]);

  return (
    <>
      <div
        ref={menuBarRef}
        className="h-8 flex items-center px-2 bg-background border-b border-border select-none"
      >
        {menuConfig.map((menu, index) => (
          <button
            key={menu.label}
            onClick={(e) => handleMenuClick(index, e.currentTarget)}
            onMouseEnter={(e) => handleMenuHover(index, e.currentTarget)}
            className={cn(
              'px-3 py-1 text-sm transition-colors rounded',
              activeMenuIndex === index
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent/50'
            )}
          >
            {menu.label}
          </button>
        ))}
      </div>

      {/* Render dropdown via portal to avoid overflow clipping */}
      {activeMenuIndex !== null && dropdownPos && createPortal(
        <div ref={dropdownRef}>
          <MenuDropdown
            items={menuConfig[activeMenuIndex].items}
            menuState={menuState}
            onAction={handleAction}
            onClose={() => setActiveMenuIndex(null)}
            fixedPosition={dropdownPos}
          />
        </div>,
        document.body
      )}
    </>
  );
}

interface MenuDropdownProps {
  items: MenuItemConfig[];
  menuState: AppMenuState;
  onAction: (action: string) => void;
  onClose: () => void;
  /** When provided, use fixed positioning at these coordinates (first-level dropdown via portal) */
  fixedPosition?: { top: number; left: number };
}

function MenuDropdown({ items, menuState, onAction, onClose, fixedPosition }: MenuDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [subMenuIndex, setSubMenuIndex] = useState<number | null>(null);

  // Calculate position to avoid overflow
  useEffect(() => {
    if (!dropdownRef.current) return;

    const rect = dropdownRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    if (rect.right > windowWidth) {
      dropdownRef.current.style.left = 'auto';
      dropdownRef.current.style.right = '0';
    }

    if (rect.bottom > windowHeight) {
      dropdownRef.current.style.top = 'auto';
      dropdownRef.current.style.bottom = '0';
    }
  }, []);

  const handleItemClick = (item: MenuItemConfig) => {
    if (item.type === 'separator' || !item.action) return;
    onAction(item.action);
  };

  const formatAccelerator = (accelerator?: string): string => {
    if (!accelerator) return '';
    return accelerator
      .replace('CmdOrCtrl', 'Ctrl')
      .replace('Cmd', 'Ctrl')
      .replace('Option', 'Alt')
      .replace('Minus', '-');
  };

  // Map of toggle actions to their corresponding state keys
  const actionToStateKey: Record<string, keyof AppMenuState> = {
    'view-toggle-sidebar': 'showSidebar',
    'view-toggle-titlebar': 'showTitleBar',
    'view-toggle-toolbar': 'showToolBar',
    'view-toggle-statusbar': 'showStatusBar',
    'view-toggle-source-mode': 'sourceMode',
  };

  const isChecked = (action?: string): boolean => {
    if (!action) return false;
    const key = actionToStateKey[action];
    return key ? menuState[key] : false;
  };

  // First-level dropdown uses fixed positioning via portal, submenus use absolute
  const positionStyle = fixedPosition
    ? { position: 'fixed' as const, top: fixedPosition.top, left: fixedPosition.left, zIndex: 9999 }
    : undefined;

  const positionClassName = fixedPosition
    ? '' // fixed positioning handled by style
    : 'absolute left-full top-0 ml-1'; // submenu positioning

  return (
    <div
      ref={dropdownRef}
      style={positionStyle}
      className={cn(
        'z-[9999] min-w-[200px] py-1 bg-popover border border-border rounded-md shadow-lg',
        positionClassName
      )}
    >
      {items.map((item, index) => {
        if (item.type === 'separator') {
          return <div key={`sep-${index}`} className="my-1 h-px bg-border" />;
        }

        const hasSubmenu = item.submenu && item.submenu.length > 0;
        const checked = isChecked(item.action);

        return (
          <div
            key={item.label || `item-${index}`}
            className="relative"
            onMouseEnter={() => hasSubmenu && setSubMenuIndex(index)}
            onMouseLeave={() => setSubMenuIndex(null)}
          >
            <button
              onClick={() => !hasSubmenu && handleItemClick(item)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-1.5 text-[13px] text-left transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                checked && 'bg-accent/30'
              )}
            >
              <div className="flex items-center gap-2">
                {checked && <span className="w-4 h-4 flex items-center justify-center">✓</span>}
                {!checked && <span className="w-4" />}
                <span>{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.accelerator && (
                  <span className="text-xs text-muted-foreground ml-4">
                    {formatAccelerator(item.accelerator)}
                  </span>
                )}
                {hasSubmenu && (
                  <span className="text-xs text-muted-foreground">▶</span>
                )}
              </div>
            </button>

            {hasSubmenu && subMenuIndex === index && (
              <MenuDropdown
                items={item.submenu!}
                menuState={menuState}
                onAction={onAction}
                onClose={onClose}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
