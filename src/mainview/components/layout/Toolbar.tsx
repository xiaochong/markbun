import { useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  className?: string;
  onBold?: () => void;
  onItalic?: () => void;
  onHeading?: (level: number) => void;
  onQuote?: () => void;
  onCode?: () => void;
  onLink?: () => void;
  onList?: () => void;
  onOrderedList?: () => void;
}

interface ToolbarButtonProps {
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  disabled?: boolean;
  active?: boolean;
}

function ToolbarButton({ onClick, children, title, disabled, active }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        active && 'bg-accent text-accent-foreground'
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="w-px h-6 bg-border mx-1" />;
}

export function Toolbar({
  className,
  onBold,
  onItalic,
  onHeading,
  onQuote,
  onCode,
  onLink,
  onList,
  onOrderedList,
}: ToolbarProps) {
  return (
    <div className={cn(
      'flex items-center gap-0.5 px-2 py-1 border-b bg-background',
      className
    )}>
      {/* Headings */}
      <ToolbarButton onClick={() => onHeading?.(1)} title="Heading 1 (Ctrl+1)">
        H1
      </ToolbarButton>
      <ToolbarButton onClick={() => onHeading?.(2)} title="Heading 2 (Ctrl+2)">
        H2
      </ToolbarButton>
      <ToolbarButton onClick={() => onHeading?.(3)} title="Heading 3 (Ctrl+3)">
        H3
      </ToolbarButton>
      
      <ToolbarSeparator />
      
      {/* Text formatting */}
      <ToolbarButton onClick={onBold} title="Bold (Ctrl+B)">
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton onClick={onItalic} title="Italic (Ctrl+I)">
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton onClick={onCode} title="Code (Ctrl+`)">
        {'<>'}
      </ToolbarButton>
      
      <ToolbarSeparator />
      
      {/* Blocks */}
      <ToolbarButton onClick={onQuote} title="Quote">
        "
      </ToolbarButton>
      <ToolbarButton onClick={onLink} title="Link (Ctrl+K)">
        🔗
      </ToolbarButton>
      
      <ToolbarSeparator />
      
      {/* Lists */}
      <ToolbarButton onClick={onList} title="Bullet List">
        •
      </ToolbarButton>
      <ToolbarButton onClick={onOrderedList} title="Numbered List">
        1.
      </ToolbarButton>
    </div>
  );
}
