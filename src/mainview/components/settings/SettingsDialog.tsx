import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { AppSettings } from '@/shared/types';

interface SettingsDialogProps {
  isOpen: boolean;
  settings: AppSettings | null;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}

type SettingsTab = 'general' | 'editor' | 'appearance';

export function SettingsDialog({ isOpen, settings, onClose, onSave }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [formState, setFormState] = useState<AppSettings>({
    theme: 'system',
    fontSize: 15,
    lineHeight: 1.65,
    autoSave: true,
    autoSaveInterval: 2000,
  });

  // Sync form state with props when dialog opens
  useEffect(() => {
    if (isOpen && settings) {
      setFormState({ ...settings });
    }
  }, [isOpen, settings]);

  const handleChange = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(formState);
    onClose();
  }, [formState, onSave, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'editor', label: 'Editor', icon: '📝' },
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="flex w-[600px] h-[450px] bg-background rounded-lg shadow-xl overflow-hidden border">
        {/* Sidebar */}
        <div className="w-44 bg-muted/50 border-r flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-sm">Settings</h2>
          </div>
          <nav className="flex-1 p-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">General</h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Auto Save</label>
                      <p className="text-xs text-muted-foreground">
                        Automatically save changes while editing
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formState.autoSave}
                      onChange={(e) => handleChange('autoSave', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </div>

                  {formState.autoSave && (
                    <div className="space-y-2 pl-4 border-l-2 border-muted">
                      <label className="text-sm font-medium">Auto Save Interval</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="500"
                          max="10000"
                          step="500"
                          value={formState.autoSaveInterval}
                          onChange={(e) => handleChange('autoSaveInterval', Number(e.target.value))}
                          className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-sm text-muted-foreground w-16 text-right">
                          {formState.autoSaveInterval}ms
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        How often to save changes while typing
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'editor' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Editor</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Font Size</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="10"
                        max="32"
                        step="1"
                        value={formState.fontSize}
                        onChange={(e) => handleChange('fontSize', Number(e.target.value))}
                        className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {formState.fontSize}px
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Line Height</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.1"
                        value={formState.lineHeight}
                        onChange={(e) => handleChange('lineHeight', Number(e.target.value))}
                        className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {formState.lineHeight}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">Appearance</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Theme</label>
                    <div className="flex gap-2">
                      {(['light', 'dark', 'system'] as const).map((theme) => (
                        <button
                          key={theme}
                          onClick={() => handleChange('theme', theme)}
                          className={cn(
                            'px-4 py-2 text-sm rounded-md border transition-colors capitalize',
                            formState.theme === theme
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted border-border'
                          )}
                        >
                          {theme}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Choose your preferred color theme
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex justify-end gap-2 bg-muted/30">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
