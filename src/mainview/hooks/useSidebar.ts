// Sidebar state management hook
import { useState, useCallback } from 'react';
import type { SidebarTab } from '@/shared/types';

const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 500;

export interface UseSidebarReturn {
  isOpen: boolean;
  activeTab: SidebarTab;
  width: number;
  toggle: () => void;
  open: () => void;
  close: () => void;
  setTab: (tab: SidebarTab) => void;
  setWidth: (width: number) => void;
  startResize: () => void;
  stopResize: () => void;
  isResizing: boolean;
}

export function useSidebar(): UseSidebarReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('files');
  const [width, setWidthState] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setTab = useCallback((tab: SidebarTab) => {
    setActiveTab(tab);
    // Auto-open sidebar when switching tabs if closed
    setIsOpen(true);
  }, []);

  const setWidth = useCallback((newWidth: number) => {
    setWidthState(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth)));
  }, []);

  const startResize = useCallback(() => {
    setIsResizing(true);
  }, []);

  const stopResize = useCallback(() => {
    setIsResizing(false);
  }, []);

  return {
    isOpen,
    activeTab,
    width,
    toggle,
    open,
    close,
    setTab,
    setWidth,
    startResize,
    stopResize,
    isResizing,
  };
}
