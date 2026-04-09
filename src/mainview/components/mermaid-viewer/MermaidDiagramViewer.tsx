import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface MermaidDiagramViewerProps {
  isOpen: boolean;
  onClose: () => void;
  mermaidSource: string | null;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 15.0;
const ZOOM_FACTOR = 1.10;
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
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
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
    setSvgSize({ width: 0, height: 0 });
    setError(null);
    setIsLoading(true);
    setSvgContent(null);

    const renderDiagram = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        const isDark = document.documentElement.classList.contains('dark');
        // Use Mermaid defaults (htmlLabels: true) in the viewer for maximum
        // compatibility with all diagram types.
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          suppressErrorRendering: true,
        });

        const id = `mermaid-viewer-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidSource);

        // Strip width="100%" so SVG uses its intrinsic viewBox dimensions
        const fixedSvg = svg.replace(/\swidth="100%"/, '');

        if (!cancelled) {
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

  // Read SVG natural size from viewBox after mount
  useEffect(() => {
    if (!svgContent || !svgContainerRef.current) return;
    const svg = svgContainerRef.current.querySelector('svg');
    if (!svg) return;

    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/);
      const w = parseFloat(parts[2]) || 0;
      const h = parseFloat(parts[3]) || 0;
      if (w > 0 && h > 0) {
        setSvgSize({ width: w, height: h });
      }
    }
  }, [svgContent]);

  // Apply zoom by mutating SVG width/height styles instead of CSS transform
  // to avoid WebKit compositing bugs that clip SVG content.
  useEffect(() => {
    if (!svgContainerRef.current || svgSize.width <= 0 || svgSize.height <= 0) return;
    const svg = svgContainerRef.current.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;

    svg.style.maxWidth = 'none';
    svg.style.width = `${svgSize.width * zoom}px`;
    svg.style.height = `${svgSize.height * zoom}px`;
  }, [zoom, svgSize]);

  // Update canPan based on SVG size vs container
  useEffect(() => {
    if (!containerRef.current || svgSize.width <= 0 || svgSize.height <= 0) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const renderedWidth = svgSize.width * zoom;
    const renderedHeight = svgSize.height * zoom;
    setCanPan(renderedWidth > containerRect.width || renderedHeight > containerRect.height);
  }, [svgSize, zoom]);

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
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleFitToWindow = useCallback(() => {
    if (!containerRef.current || svgSize.width <= 0 || svgSize.height <= 0) {
      handleReset();
      return;
    }
    const containerRect = containerRef.current.getBoundingClientRect();
    const scaleX = containerRect.width / svgSize.width;
    const scaleY = containerRect.height / svgSize.height;
    setZoom(Math.min(scaleX, scaleY, MAX_ZOOM));
    setPosition({ x: 0, y: 0 });
  }, [svgSize, handleReset]);

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
              onClick={handleFitToWindow}
              disabled={isLoading}
              className="p-1.5 rounded hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={t('mermaidViewer.fitToWindow')}
            >
              <FitIcon className="w-4 h-4" />
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
              className="absolute mermaid-viewer-svg"
              style={{
                left: `calc(50% + ${position.x}px)`,
                top: `calc(50% + ${position.y}px)`,
                transform: 'translate(-50%, -50%)',
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

function FitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
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
