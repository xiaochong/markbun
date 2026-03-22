interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-80 bg-background rounded-xl shadow-xl border overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* App icon + name */}
        <div className="flex flex-col items-center px-8 pt-8 pb-6 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl select-none">
            🐇
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold tracking-tight">MarkBun</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Version 0.3.0</p>
          </div>
          <p className="text-sm text-center text-muted-foreground leading-relaxed">
            A lightweight Markdown writing app
            <br />
            designed for focused writing.
          </p>
          <p className="text-xs text-muted-foreground">
            Built with Electrobun · Bun · React
          </p>
        </div>

        {/* Footer */}
        <div className="border-t px-8 py-4 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
