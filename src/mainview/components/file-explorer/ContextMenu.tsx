import { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { FileSystemNode } from '@/shared/types';

export type ContextMenuAction =
  | 'new-file'
  | 'new-folder'
  | 'rename'
  | 'delete'
  | 'move'
  | 'refresh';

interface ContextMenuItem {
  id: ContextMenuAction;
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  node: FileSystemNode | null;
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: ContextMenuAction, node: FileSystemNode | null) => void;
}

export function ContextMenu({
  node,
  x,
  y,
  isOpen,
  onClose,
  onAction,
}: ContextMenuProps) {
  const { t } = useTranslation('file');
  const menuRef = useRef<HTMLDivElement>(null);

  // Build menu items inside the component so labels are translated
  const fileItems: ContextMenuItem[] = [
    { id: 'new-file', label: t('contextMenu.newFile'), icon: <FilePlusIcon /> },
    { id: 'new-folder', label: t('contextMenu.newFolder'), icon: <FolderPlusIcon /> },
    { separator: true } as ContextMenuItem,
    { id: 'rename', label: t('contextMenu.rename'), icon: <EditIcon /> },
    { id: 'move', label: t('contextMenu.moveTo'), icon: <MoveIcon /> },
    { separator: true } as ContextMenuItem,
    { id: 'delete', label: t('contextMenu.delete'), icon: <TrashIcon />, danger: true },
  ];

  const folderItems: ContextMenuItem[] = [
    { id: 'new-file', label: t('contextMenu.newFile'), icon: <FilePlusIcon /> },
    { id: 'new-folder', label: t('contextMenu.newFolder'), icon: <FolderPlusIcon /> },
    { separator: true } as ContextMenuItem,
    { id: 'rename', label: t('contextMenu.rename'), icon: <EditIcon /> },
    { id: 'delete', label: t('contextMenu.delete'), icon: <TrashIcon />, danger: true },
  ];

  const rootItems: ContextMenuItem[] = [
    { id: 'new-file', label: t('contextMenu.newFile'), icon: <FilePlusIcon /> },
    { id: 'new-folder', label: t('contextMenu.newFolder'), icon: <FolderPlusIcon /> },
    { separator: true } as ContextMenuItem,
    { id: 'refresh', label: t('contextMenu.refresh'), icon: <RefreshIcon /> },
  ];

  // Get menu items based on node type
  const getMenuItems = useCallback((): ContextMenuItem[] => {
    if (!node) return rootItems;
    if (node.type === 'file') return fileItems;
    return folderItems;
  }, [node, fileItems, folderItems, rootItems]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Calculate position to avoid overflow
  const getPosition = useCallback(() => {
    if (!menuRef.current) return { left: x, top: y };

    const menuRect = menuRef.current.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let left = x;
    let top = y;

    // Adjust if menu goes off right edge
    if (left + menuRect.width > windowWidth) {
      left = windowWidth - menuRect.width - 8;
    }

    // Adjust if menu goes off bottom edge
    if (top + menuRect.height > windowHeight) {
      top = windowHeight - menuRect.height - 8;
    }

    return { left, top };
  }, [x, y]);

  if (!isOpen) return null;

  const items = getMenuItems();
  const position = getPosition();

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] py-1 bg-popover border border-border rounded-md shadow-lg animate-in fade-in zoom-in-95 duration-100"
      style={{ left: position.left, top: position.top }}
    >
      {items.map((item, index) => {
        if (item.separator) {
          return (
            <div
              key={`sep-${index}`}
              className="my-1 h-px bg-border"
            />
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => {
              onAction(item.id, node);
              onClose();
            }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-left transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              item.danger && 'text-destructive hover:bg-destructive hover:text-destructive-foreground'
            )}
          >
            {item.icon && (
              <span className="w-4 h-4 flex-shrink-0 opacity-70">
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Icons
function FilePlusIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 3v5h5M12 18v-6M9 15h6" />
    </svg>
  );
}

function FolderPlusIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      <path d="M12 13v6M9 16h6" />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}
