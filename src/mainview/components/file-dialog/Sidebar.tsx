import React from 'react';
import { useTranslation } from 'react-i18next';

export interface SidebarItem {
  id: string;
  name: string;
  path: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  items: SidebarItem[];
  currentPath: string;
  onSelect: (path: string) => void;
}

// Simple SVG icons
const FolderIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
  </svg>
);

const HomeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

const DesktopIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="14" x="2" y="3" rx="2"/>
    <line x1="8" x2="16" y1="21" y2="21"/>
    <line x1="12" x2="12" y1="17" y2="21"/>
  </svg>
);

const DownloadIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" x2="12" y1="15" y2="3"/>
  </svg>
);

const FileTextIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
    <path d="M10 9H8"/>
    <path d="M16 13H8"/>
    <path d="M16 17H8"/>
  </svg>
);

const ImageIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
    <circle cx="9" cy="9" r="2"/>
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
  </svg>
);

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  desktop: DesktopIcon,
  downloads: DownloadIcon,
  documents: FileTextIcon,
  pictures: ImageIcon,
  home: HomeIcon,
};

export const defaultSidebarItems: Omit<SidebarItem, 'path'>[] = [
  { id: 'desktop', name: 'desktop', icon: <DesktopIcon className="w-4 h-4" /> },
  { id: 'downloads', name: 'downloads', icon: <DownloadIcon className="w-4 h-4" /> },
  { id: 'documents', name: 'documents', icon: <FileTextIcon className="w-4 h-4" /> },
  { id: 'pictures', name: 'pictures', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'home', name: 'home', icon: <HomeIcon className="w-4 h-4" /> },
];

export function Sidebar({ items, currentPath, onSelect }: SidebarProps) {
  const { t } = useTranslation('dialog');

  return (
    <div className="w-44 flex-shrink-0 border-r border-border bg-muted/30 flex flex-col">
      <div className="p-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
          {t('fileDialog.sidebar.favorites')}
        </h3>
        <nav className="space-y-0.5">
          {items.map((item) => {
            const isActive = currentPath === item.path;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.path)}
                className={`
                  w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm
                  transition-colors text-left
                  ${isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-foreground hover:bg-accent/50'
                  }
                `}
              >
                <span className="text-muted-foreground">{item.icon}</span>
                <span className="truncate">
                  {t(`fileDialog.sidebar.${item.name}`, { defaultValue: item.name })}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
