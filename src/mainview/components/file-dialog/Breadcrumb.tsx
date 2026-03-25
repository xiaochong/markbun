import React from 'react';

interface BreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
  homePath: string;
}

// Simple SVG icons
const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m9 18 6-6-6-6"/>
  </svg>
);

const FolderIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
  </svg>
);

const HardDriveIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="22" x2="2" y1="12" y2="12"/>
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    <line x1="6" x2="6.01" y1="16" y2="16"/>
    <line x1="10" x2="10.01" y1="16" y2="16"/>
  </svg>
);

export function Breadcrumb({ path, onNavigate, homePath }: BreadcrumbProps) {
  // Parse path into segments
  const getSegments = () => {
    if (!path || path === homePath) {
      return [{ name: getFolderName(homePath) || 'Home', path: homePath }];
    }

    // Detect if this is an absolute path (starts with /)
    const isAbsolute = path.startsWith('/');
    const parts = path.split('/').filter(Boolean);
    const segments: { name: string; path: string }[] = [];
    let currentPath = '';

    for (const part of parts) {
      // For absolute paths, always start with /
      if (currentPath === '' && isAbsolute) {
        currentPath = `/${part}`;
      } else {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
      }
      segments.push({ name: part, path: currentPath });
    }

    return segments;
  };

  const getFolderName = (p: string) => {
    const parts = p.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  };

  const segments = getSegments();

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border bg-muted/20 min-h-10">
      <button
        onClick={() => onNavigate(homePath)}
        className="p-1 rounded hover:bg-accent transition-colors"
        title="Home"
      >
        <HardDriveIcon className="w-4 h-4 text-muted-foreground" />
      </button>

      {segments.length > 0 && (
        <>
          {segments.map((segment, index) => (
            <React.Fragment key={segment.path}>
              <ChevronRightIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <button
                onClick={() => onNavigate(segment.path)}
                className={`
                  px-1.5 py-0.5 rounded text-sm transition-colors flex items-center gap-1
                  ${index === segments.length - 1
                    ? 'font-medium text-foreground bg-accent/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                  }
                `}
              >
                {index === segments.length - 1 && (
                  <FolderIcon className="w-3.5 h-3.5" />
                )}
                <span className="max-w-32 truncate">{segment.name}</span>
              </button>
            </React.Fragment>
          ))}
        </>
      )}
    </div>
  );
}
