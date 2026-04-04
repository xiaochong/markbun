// AIChatPanel — main AI chat panel container (resizable, right sidebar)
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { useAIChat } from '../../hooks/useAIChat';
import { ChatMessageList } from './ChatMessageList';
import { ChatInput } from './ChatInput';
import { SessionHeader } from './SessionHeader';
import { AISetupGuide } from './AISetupGuide';
import type { AISettings } from '@/shared/types';

const MIN_WIDTH = 280;
const MAX_WIDTH = 600;

interface AIChatPanelProps {
  isOpen: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  aiSettings: AISettings | null;
  onOpenSettings: () => void;
}

export const AIChatPanel = memo(function AIChatPanel({
  isOpen,
  width,
  onWidthChange,
  onClose,
  aiSettings,
  onOpenSettings,
}: AIChatPanelProps) {
  const chat = useAIChat();
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(width);
  const [isResizing, setIsResizing] = useState(false);

  // Clamp width (guard against NaN from corrupted state)
  const safeWidth = Number.isFinite(width) ? width : MIN_WIDTH;
  const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, safeWidth));

  // Handle resize (drag left edge of panel)
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = clampedWidth;
    setIsResizing(true);
  }, [clampedWidth]);

  // Global mouse move/up for resizing
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Dragging left edge: moving mouse LEFT increases panel width
      const delta = resizeStartX.current - e.clientX;
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStartWidth.current + delta));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  const isAIEnabled = aiSettings?.enabled;
  const isAIConfigured = aiSettings ? (aiSettings.provider || aiSettings.localOnly) : false;

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'flex h-full flex-shrink-0 overflow-hidden',
        isResizing && 'select-none'
      )}
      style={{ width: clampedWidth }}
    >
      {/* Resize Handle (left edge) */}
      <div
        className={cn(
          'w-[2px] h-full cursor-col-resize relative flex-shrink-0',
          'hover:bg-border/80 active:bg-border transition-colors',
          isResizing && 'bg-border'
        )}
        onMouseDown={handleResizeMouseDown}
      />

      {/* Panel Content */}
      <div className="flex flex-col h-full min-w-0 bg-background border-l border-border" style={{ width: clampedWidth - 2 }}>
        <SessionHeader onReset={chat.resetSession} onClose={onClose} />

        {isAIEnabled && isAIConfigured ? (
          <>
            <ChatMessageList messages={chat.messages} isStreaming={chat.isStreaming} />
            <ChatInput
              onSend={chat.send}
              onStop={chat.abort}
              isStreaming={chat.isStreaming}
            />
          </>
        ) : (
          <AISetupGuide
            isDisabled={isAIEnabled === false}
            onOpenSettings={onOpenSettings}
          />
        )}
      </div>
    </div>
  );
});
