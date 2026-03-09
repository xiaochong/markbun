import { cn } from '@/lib/utils';

interface TitleBarProps {
  className?: string;
  title?: string;
  isDirty?: boolean;
}

export function TitleBar({ className, title = 'Untitled', isDirty }: TitleBarProps) {
  return (
    <div className={cn(
      'flex items-center justify-center h-8 px-4 bg-background border-b text-sm',
      'select-none', // Prevent text selection when dragging window
      className
    )}>
      <span className="font-medium truncate">
        {isDirty && '● '}
        {title} - PingWrite
      </span>
    </div>
  );
}
