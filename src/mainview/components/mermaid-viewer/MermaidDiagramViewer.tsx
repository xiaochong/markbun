import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface MermaidDiagramViewerProps {
  isOpen: boolean;
  onClose: () => void;
  mermaidSource: string | null;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;
const ZOOM_FACTOR = 1.25;
const PAN_STEP = 50;

export function MermaidDiagramViewer({ isOpen, onClose, mermaidSource }: MermaidDiagramViewerProps) {
  const { t } = useTranslation('editor');
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [canPan, setCanPan] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens with new source
  useEffect(() => {
    if (!isOpen || !mermaidSource) {
      setSvgContent(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setError(null);
    setIsLoading(true);
    setSvgContent(null);

    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        const isDark = document.documentElement.classList.contains('dark');
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          suppressErrorRendering: true,
          htmlLabels: false,
        });

        const id = `mermaid-viewer-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidSource);

        if (!cancelled) {
          // Remove width="100%" for consistent sizing
          const fixedSvg = svg.replace(/\swidth="100%"/, '');
          setSvgContent(fixedSvg);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          setIsLoading(false);
        }
      }
    };

    void renderDiagram();
    return () => { cancelled = true; };
  }, [isOpen, mermaidSource]);

  // Calculate fit-to-view zoom after SVG renders
  useEffect(() => {
    if (!svgContent || !containerRef.current || !svgContainerRef.current) return;

    const svgEl = svgContainerRef.current.querySelector('svg');
    if (!svgEl) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    // Use getBBox for natural dimensions, fall back to viewBox
    let naturalWidth: number;
    let naturalHeight: number;

    const viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/);
      naturalWidth = parseFloat(parts[2]) || svgEl.getBoundingClientRect().width;
      naturalHeight = parseFloat(parts[3]) || svgEl.getBoundingClientRect().height;
    } else {
      const bbox = svgEl.getBBox();
      naturalWidth = bbox.width;
      naturalHeight = bbox.height;
    }

    // Account for SVG's own width/height attributes
    const attrWidth = svgEl.getAttribute('width');
    const attrHeight = svgEl.getAttribute('height');
    if (attrWidth && attrHeight) {
      const pw = parseFloat(attrWidth);
      const ph = parseFloat(attrHeight);
      if (pw > 0 && ph > 0) {
        naturalWidth = pw;
        naturalHeight = ph;
      }
    }

    if (naturalWidth > 0 && naturalHeight > 0) {
      const scaleX = containerRect.width / naturalWidth;
      const scaleY = containerRect.height / naturalHeight;
      const fitZoom = Math.min(scaleX, scaleY, 1); // Don't zoom beyond 100% for fit
      setZoom(fitZoom);
    }
  }, [svgContent]);

  // Update canPan based on SVG size vs container
  useEffect(() => {
    if (!svgContent || !containerRef.current || !svgContainerRef.current) return;

    const svgEl = svgContainerRef.current.querySelector('svg');
    if (!svgEl) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    let naturalWidth: number;
    let naturalHeight: number;

    const viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/);
      naturalWidth = parseFloat(parts[2]) || 0;
      naturalHeight = parseFloat(parts[3]) || 0;
    } else {
      const bbox = svgEl.getBBox();
      naturalWidth = bbox.width;
      naturalHeight = bbox.height;
    }

    const renderedWidth = naturalWidth * zoom;
    const renderedHeight = naturalHeight * zoom;
    setCanPan(renderedWidth > containerRect.width || renderedHeight > containerRect.height);
  }, [svgContent, zoom]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen || isLoading) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleReset();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPosition(p => ({ ...p, x: p.x + PAN_STEP }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPosition(p => ({ ...p, x: p.x - PAN_STEP }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPosition(p => ({ ...p, y: p.y + PAN_STEP }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPosition(p => ({ ...p, y: p.y - PAN_STEP }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose, zoom, position]);

  // Auto-focus panel when opened
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * ZOOM_FACTOR, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / ZOOM_FACTOR, MIN_ZOOM));
  }, []);

  const handleReset = useCallback(() => {
    // Re-trigger fit-to-view calculation
    if (!svgContent || !containerRef.current || !svgContainerRef.current) {
      setZoom(1);
    }
    setPosition({ x: 0, y: 0 });
    // Re-calculate fit zoom by re-rendering the effect
    setZoom(prev => prev); // This is a no-op; actual reset happens in the fit-to-view effect
    // Force re-calculation
    const svgEl = svgContainerRef.current?.querySelector('svg');
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (svgEl && containerRect) {
      let naturalWidth: number;
      let naturalHeight: number;
      const viewBox = svgEl.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox.split(/[\s,]+/);
        naturalWidth = parseFloat(parts[2]) || 0;
        naturalHeight = parseFloat(parts[3]) || 0;
      } else {
        const bbox = svgEl.getBBox();
        naturalWidth = bbox.width;
        naturalHeight = bbox.height;
      }
      const attrWidth = svgEl.getAttribute('width');
      const attrHeight = svgEl.getAttribute('height');
      if (attrWidth && attrHeight) {
        const pw = parseFloat(attrWidth);
        const ph = parseFloat(attrHeight);
        if (pw > 0 && ph > 0) {
          naturalWidth = pw;
          naturalHeight = ph;
        }
      }
      if (naturalWidth > 0 && naturalHeight > 0) {
        const scaleX = containerRect.width / naturalWidth;
        const scaleY = containerRect.height / naturalHeight;
        setZoom(Math.min(scaleX, scaleY, 1));
      }
    }
  }, [svgContent]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isLoading) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  }, [handleZoomIn, handleZoomOut, isLoading]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canPan || isLoading) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  }, [canPan, position, isLoading]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        ref={panelRef}
        className="w-[90vw] h-[85vh] bg-background rounded-lg shadow-xl overflow-hidden border flex flex-col outline-none"
        tabIndex={0}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 shrink-0">
          <span className="text-sm font-medium text-foreground/90">Mermaid Diagram</span>
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              disabled={isLoading}
              className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={t('mermaidViewer.zoomOut')}
            >
              <ZoomOutIcon className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={isLoading}
              className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={t('mermaidViewer.zoomIn')}
            >
              <ZoomInIcon className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-border mx-2" />
            <button
              onClick={handleReset}
              disabled={isLoading}
              className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={t('mermaidViewer.reset')}
            >
              <ResetIcon className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-border mx-2" />
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-accent transition-colors"
              title={t('mermaidViewer.close')}
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Diagram Container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative bg-muted/20 flex items-center justify-center"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ cursor: canPan ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
        >
          {isLoading && (
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">{t('mermaidViewer.rendering')}</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center text-destructive gap-2">
              <ErrorIcon className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">{t('mermaidViewer.renderError')}</p>
              <p className="text-xs text-muted-foreground max-w-md text-center">{error}</p>
            </div>
          )}

          {svgContent && !error && (
            <div
              ref={svgContainerRef}
              className="transition-transform duration-75"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
              }}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Icons
function ZoomInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M11 8v6M8 11h6" />
    </svg>
  );
}

function ZoomOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
      <path d="M8 11h6" />
    </svg>
  );
}

function ResetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}
