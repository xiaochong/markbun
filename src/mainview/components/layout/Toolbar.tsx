import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  className?: string;
  onBold?: () => void;
  onItalic?: () => void;
  onStrikethrough?: () => void;
  onHighlight?: () => void;
  onHeading?: (level: number) => void;
  onQuote?: () => void;
  onCode?: () => void;
  onLink?: () => void;
  onImage?: () => void;
  onTable?: () => void;
  onList?: () => void;
  onOrderedList?: () => void;
  onTaskList?: () => void;
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
        'w-7 h-7 flex items-center justify-center rounded text-muted-foreground',
        'hover:bg-accent hover:text-accent-foreground transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        active && 'bg-accent text-accent-foreground'
      )}
    >
      {children}
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="w-px h-4 bg-border mx-0.5" />;
}

export function Toolbar({
  className,
  onBold,
  onItalic,
  onStrikethrough,
  onHighlight,
  onHeading,
  onQuote,
  onCode,
  onLink,
  onImage,
  onTable,
  onList,
  onOrderedList,
  onTaskList,
}: ToolbarProps) {
  const { t } = useTranslation('editor');

  return (
    <div className={cn(
      'flex items-center gap-0.5 px-3 py-1.5 border-b bg-background select-none',
      className
    )}>
      {/* Headings */}
      <ToolbarButton onClick={() => onHeading?.(1)} title={t('toolbar.heading1')}>
        <span className="text-[11px] font-bold tracking-tight">H1</span>
      </ToolbarButton>
      <ToolbarButton onClick={() => onHeading?.(2)} title={t('toolbar.heading2')}>
        <span className="text-[11px] font-bold tracking-tight">H2</span>
      </ToolbarButton>
      <ToolbarButton onClick={() => onHeading?.(3)} title={t('toolbar.heading3')}>
        <span className="text-[11px] font-bold tracking-tight">H3</span>
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Text formatting */}
      <ToolbarButton onClick={onBold} title={t('toolbar.bold')}>
        <strong className="font-bold text-[13px] font-serif">B</strong>
      </ToolbarButton>
      <ToolbarButton onClick={onItalic} title={t('toolbar.italic')}>
        <em className="italic font-serif text-[14px]">I</em>
      </ToolbarButton>
      <ToolbarButton onClick={onStrikethrough} title={t('toolbar.strikethrough')}>
        <span className="line-through text-[13px] font-medium">S</span>
      </ToolbarButton>
      <ToolbarButton onClick={onHighlight} title={t('toolbar.highlight')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 013.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          <path d="M3 21h6" strokeWidth="2" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={onCode} title={t('toolbar.code')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Blocks */}
      <ToolbarButton onClick={onQuote} title={t('toolbar.quote')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <rect x="3" y="5" width="2" height="14" rx="1" fill="currentColor" stroke="none" />
          <line x1="7" y1="8" x2="21" y2="8" />
          <line x1="7" y1="12" x2="17" y2="12" />
          <line x1="7" y1="16" x2="21" y2="16" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={onLink} title={t('toolbar.link')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={onImage} title={t('toolbar.image')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={onTable} title={t('toolbar.table')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </ToolbarButton>

      <ToolbarSeparator />

      {/* Lists */}
      <ToolbarButton onClick={onList} title={t('toolbar.bulletList')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
          <line x1="9" y1="6" x2="20" y2="6" />
          <line x1="9" y1="12" x2="20" y2="12" />
          <line x1="9" y1="18" x2="20" y2="18" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={onOrderedList} title={t('toolbar.numberedList')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <text x="2.5" y="8.5" fontSize="7" fill="currentColor" stroke="none" fontFamily="serif" fontWeight="bold">1</text>
          <text x="2.5" y="13.5" fontSize="7" fill="currentColor" stroke="none" fontFamily="serif" fontWeight="bold">2</text>
          <text x="2.5" y="18.5" fontSize="7" fill="currentColor" stroke="none" fontFamily="serif" fontWeight="bold">3</text>
          <line x1="9" y1="6" x2="20" y2="6" />
          <line x1="9" y1="12" x2="20" y2="12" />
          <line x1="9" y1="18" x2="20" y2="18" />
        </svg>
      </ToolbarButton>
      <ToolbarButton onClick={onTaskList} title={t('toolbar.taskList')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <rect x="3" y="5" width="4" height="4" rx="0.5" />
          <rect x="3" y="11" width="4" height="4" rx="0.5" />
          <polyline points="4,13 5,14.5 7,12" strokeWidth="1.2" />
          <line x1="10" y1="7" x2="21" y2="7" />
          <line x1="10" y1="13" x2="21" y2="13" />
          <line x1="10" y1="19" x2="21" y2="19" />
          <rect x="3" y="17" width="4" height="4" rx="0.5" />
        </svg>
      </ToolbarButton>
    </div>
  );
}
