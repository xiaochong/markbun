import { useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { SidebarTab } from '@/shared/types';

interface SidebarProps {
  isOpen: boolean;
  activeTab: SidebarTab;
  width: number;
  isResizing: boolean;
  onTabChange: (tab: SidebarTab) => void;
  onClose: () => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
  onWidthChange: (width: number) => void;
  children: React.ReactNode;
}

export const Sidebar = memo(function Sidebar({
  isOpen,
  activeTab,
  width,
  isResizing,
  onTabChange,
  onClose,
  onResizeStart,
  onResizeEnd,
  onWidthChange,
  children,
}: SidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(width);

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = width;
    onResizeStart();
  }, [width, onResizeStart]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - resizeStartX.current;
      const newWidth = resizeStartWidth.current + delta;
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      onResizeEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange, onResizeEnd]);

  return (
    <div
      className={cn(
        'flex h-full flex-shrink-0 transition-all duration-200 ease-in-out',
        isOpen ? 'translate-x-0' : '-translate-x-full w-0'
      )}
      style={{ width: isOpen ? width : 0 }}
    >
      {/* Sidebar Content */}
      <div
        ref={sidebarRef}
        className="flex flex-col h-full bg-muted/30 border-r border-border"
        style={{ width: isOpen ? width - 4 : 0 }}
      >
        {/* Tab Header */}
        <TabHeader activeTab={activeTab} onTabChange={onTabChange} />

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-md hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
          title="Close sidebar (Cmd/Ctrl+B)"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Resize Handle */}
      {isOpen && (
        <div
          className={cn(
            'w-[2px] h-full cursor-col-resize relative',
            'hover:bg-border/80 active:bg-border transition-colors',
            isResizing && 'bg-border'
          )}
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  );
});

// Tab Header Component - extracted to prevent unnecessary re-renders
interface TabHeaderProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
}

const TabHeader = memo(function TabHeader({ activeTab, onTabChange }: TabHeaderProps) {
  const handleFilesClick = useCallback(() => onTabChange('files'), [onTabChange]);
  const handleOutlineClick = useCallback(() => onTabChange('outline'), [onTabChange]);

  return (
    <div className="flex items-center border-b border-border">
      <TabButton
        active={activeTab === 'files'}
        onClick={handleFilesClick}
        icon={<FilesIcon />}
        label="Files"
        className="flex-1 justify-center"
      />
      <TabButton
        active={activeTab === 'outline'}
        onClick={handleOutlineClick}
        icon={<OutlineIcon />}
        label="Outline"
        className="flex-1 justify-center"
      />
    </div>
  );
});

// Tab Button Component
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  className?: string;
}

const TabButton = memo(function TabButton({ active, onClick, icon, label, className }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 py-[6px] text-[12.5px] font-medium transition-colors border-b-2',
        active
          ? 'border-primary text-foreground bg-muted/50'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30',
        className
      )}
      title={label}
    >
      {icon}
      <span className="sm:inline">{label}</span>
    </button>
  );
});

// Icons
const FilesIcon = memo(function FilesIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
});

const OutlineIcon = memo(function OutlineIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  );
});

const CloseIcon = memo(function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
});
