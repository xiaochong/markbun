import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { OutlineNode } from '@/shared/types';

interface OutlineProps {
  headings: OutlineNode[];
  activeId: string | null;
  onHeadingClick: (id: string, text: string) => void;
}

export const Outline = memo(function Outline({ headings, activeId, onHeadingClick }: OutlineProps) {
  const { t } = useTranslation('editor');

  if (headings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-sm text-muted-foreground">
        <ListIcon className="w-8 h-8 mb-2 opacity-50" />
        <p>{t('outline.empty')}</p>
        <p className="text-xs mt-1">{t('outline.emptyHint')}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto scrollbar-thin scrollbar-auto">
      <div className="py-1">
        <OutlineTree
          nodes={headings}
          activeId={activeId}
          onHeadingClick={onHeadingClick}
          level={0}
        />
      </div>
    </div>
  );
});

interface OutlineTreeProps {
  nodes: OutlineNode[];
  activeId: string | null;
  onHeadingClick: (id: string, text: string) => void;
  level: number;
}

function OutlineTree({ nodes, activeId, onHeadingClick, level }: OutlineTreeProps) {
  return (
    <div>
      {nodes.map((node) => (
        <OutlineItem
          key={node.id}
          node={node}
          activeId={activeId}
          onHeadingClick={onHeadingClick}
          level={level}
        />
      ))}
    </div>
  );
}

interface OutlineItemProps {
  node: OutlineNode;
  activeId: string | null;
  onHeadingClick: (id: string, text: string) => void;
  level: number;
}

function OutlineItem({ node, activeId, onHeadingClick, level }: OutlineItemProps) {
  const isActive = activeId === node.id;

  // 根据层级计算缩进（每级 14px）
  const paddingLeft = level * 14 + 12;

  // 根据层级设置文字大小（参考 Typora：H1 大，逐级递减）
  const fontSizeClass = getFontSizeByLevel(node.level);

  // 根据层级设置字重
  const fontWeightClass = node.level === 1 ? 'font-semibold' : 'font-normal';

  return (
    <div>
      <button
        className={cn(
          'w-full text-left py-[3px] pr-3 transition-colors leading-snug',
          'hover:bg-accent/40 hover:text-foreground',
          isActive && 'bg-accent text-accent-foreground font-medium',
          !isActive && 'text-foreground/80'
        )}
        style={{ paddingLeft }}
        onClick={() => onHeadingClick(node.id, node.text)}
      >
        <span className={cn(
          'block truncate',
          fontSizeClass,
          fontWeightClass
        )}>
          {node.text}
        </span>
      </button>

      {node.children.length > 0 && (
        <OutlineTree
          nodes={node.children}
          activeId={activeId}
          onHeadingClick={onHeadingClick}
          level={level + 1}
        />
      )}
    </div>
  );
}

// 根据标题层级返回对应的文字大小类名
function getFontSizeByLevel(level: number): string {
  switch (level) {
    case 1:
      return 'text-[13px]';
    case 2:
      return 'text-[12.5px]';
    case 3:
      return 'text-[12px]';
    case 4:
    case 5:
    case 6:
      return 'text-[11.5px]';
    default:
      return 'text-[12px]';
  }
}

// List Icon
function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
