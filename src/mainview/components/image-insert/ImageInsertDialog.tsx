import { useState, useCallback } from 'react';
import { electrobun } from '@/lib/electrobun';

interface ImageInsertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (src: string, alt: string) => void;
}

export function ImageInsertDialog({ isOpen, onClose, onInsert }: ImageInsertDialogProps) {
  const [activeTab, setActiveTab] = useState<'local' | 'url'>('local');
  const [imageUrl, setImageUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [selectedPath, setSelectedPath] = useState('');

  const handleSelectLocalFile = useCallback(async () => {
    const result = await electrobun.selectImageFile() as {
      success: boolean;
      path?: string;
      error?: string;
    };
    if (result.success && result.path) {
      setSelectedPath(result.path);
      // Auto-fill alt text from filename
      if (!altText) {
        const filename = result.path.split('/').pop() || '';
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
        setAltText(nameWithoutExt);
      }
    }
  }, [altText]);

  const handleInsert = useCallback(() => {
    let src: string;

    if (activeTab === 'local') {
      if (!selectedPath) return;
      src = selectedPath;
    } else {
      if (!imageUrl.trim()) return;
      src = imageUrl.trim();
    }

    const alt = altText || 'image';
    onInsert(src, alt);

    // Reset state
    setImageUrl('');
    setSelectedPath('');
    setAltText('');
    setActiveTab('local');
    onClose();
  }, [activeTab, selectedPath, imageUrl, altText, onInsert, onClose]);

  const handleClose = useCallback(() => {
    setImageUrl('');
    setSelectedPath('');
    setAltText('');
    setActiveTab('local');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-lg border border-border">
        <h2 className="text-lg font-semibold mb-4 text-foreground">Insert Image</h2>

        {/* Tabs */}
        <div className="flex border-b border-border mb-4">
          <button
            onClick={() => setActiveTab('local')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'local'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Local File
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'url'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            URL
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {activeTab === 'local' ? (
            <div>
              <button
                onClick={handleSelectLocalFile}
                className="w-full px-4 py-2 text-sm font-medium text-foreground bg-secondary hover:bg-secondary/80 rounded-md transition-colors"
              >
                Select Image File...
              </button>
              {selectedPath && (
                <p className="mt-2 text-sm text-muted-foreground truncate">
                  Selected: {selectedPath}
                </p>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Image URL
              </label>
              <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                className="w-full px-3 py-2 text-sm text-foreground bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Alt Text
            </label>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Description of the image"
              className="w-full px-3 py-2 text-sm text-foreground bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            disabled={activeTab === 'local' ? !selectedPath : !imageUrl.trim()}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}
