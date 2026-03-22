import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { electrobun } from '@/lib/electrobun';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../../../shared/i18n/config';
import type { AppSettings, BackupSettings } from '@/shared/types';

const DEFAULT_BACKUP: BackupSettings = {
  enabled: true,
  maxVersions: 20,
  retentionDays: 30,
  recoveryInterval: 30000,
};

interface SettingsDialogProps {
  isOpen: boolean;
  settings: AppSettings | null;
  onClose: () => void;
  onSave: (settings: AppSettings) => void;
}

type SettingsTab = 'general' | 'editor' | 'appearance' | 'backup' | 'language';

export function SettingsDialog({ isOpen, settings, onClose, onSave }: SettingsDialogProps) {
  const { t: ts, i18n } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [formState, setFormState] = useState<AppSettings>({
    theme: 'system',
    fontSize: 15,
    lineHeight: 1.65,
    autoSave: true,
    autoSaveInterval: 2000,
    backup: DEFAULT_BACKUP,
    language: 'en',
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

  // Language change: apply immediately for live preview
  const handleLanguageChange = useCallback(async (lang: 'en' | 'zh-CN') => {
    handleChange('language', lang);
    await i18n.changeLanguage(lang);
  }, [handleChange, i18n]);

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
    { id: 'general', label: ts('tabs.general'), icon: '⚙️' },
    { id: 'editor', label: ts('tabs.editor'), icon: '📝' },
    { id: 'appearance', label: ts('tabs.appearance'), icon: '🎨' },
    { id: 'backup', label: ts('tabs.backup'), icon: '📦' },
    { id: 'language', label: ts('tabs.language'), icon: '🌐' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="flex w-[600px] h-[520px] bg-background rounded-lg shadow-xl overflow-hidden border">
        {/* Sidebar */}
        <div className="w-44 bg-muted/50 border-r flex flex-col">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-sm">{ts('title')}</h2>
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
                <h3 className="text-lg font-medium">{ts('tabs.general')}</h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">{ts('general.autoSave')}</label>
                      <p className="text-xs text-muted-foreground">
                        {ts('general.autoSaveDesc')}
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
                      <label className="text-sm font-medium">{ts('general.autoSaveInterval')}</label>
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
                          {formState.autoSaveInterval}{tc('unit.ms')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ts('general.autoSaveIntervalDesc')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'editor' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">{ts('tabs.editor')}</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{ts('editor.fontSize')}</label>
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
                        {formState.fontSize}{tc('unit.px')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">{ts('editor.lineHeight')}</label>
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
                <h3 className="text-lg font-medium">{ts('tabs.appearance')}</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{ts('appearance.theme')}</label>
                    <div className="flex gap-2">
                      {(['light', 'dark', 'system'] as const).map((theme) => (
                        <button
                          key={theme}
                          onClick={() => handleChange('theme', theme)}
                          className={cn(
                            'px-4 py-2 text-sm rounded-md border transition-colors',
                            formState.theme === theme
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted border-border'
                          )}
                        >
                          {ts(`appearance.theme${theme.charAt(0).toUpperCase()}${theme.slice(1)}` as any)}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ts('appearance.themeDesc')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">{ts('tabs.backup')}</h3>

                <div className="space-y-4">
                  {/* Version History toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">{ts('backup.versionHistory')}</label>
                      <p className="text-xs text-muted-foreground">
                        {ts('backup.versionHistoryDesc')}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formState.backup?.enabled ?? true}
                      onChange={(e) => handleChange('backup', { ...(formState.backup ?? DEFAULT_BACKUP), enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </div>

                  {(formState.backup?.enabled ?? true) && (
                    <div className="space-y-4 pl-4 border-l-2 border-muted">
                      {/* Max Versions */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium">{ts('backup.maxVersions')}</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="5"
                            max="100"
                            step="5"
                            value={formState.backup?.maxVersions ?? 20}
                            onChange={(e) => handleChange('backup', { ...(formState.backup ?? DEFAULT_BACKUP), maxVersions: Number(e.target.value) })}
                            className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                          />
                          <span className="text-sm text-muted-foreground w-10 text-right">
                            {formState.backup?.maxVersions ?? 20}
                          </span>
                        </div>
                      </div>

                      {/* Retention Days */}
                      <div className="space-y-1">
                        <label className="text-sm font-medium">{ts('backup.retentionDays')}</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="1"
                            max="365"
                            step="1"
                            value={formState.backup?.retentionDays ?? 30}
                            onChange={(e) => handleChange('backup', { ...(formState.backup ?? DEFAULT_BACKUP), retentionDays: Number(e.target.value) })}
                            className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                          />
                          <span className="text-sm text-muted-foreground w-10 text-right">
                            {formState.backup?.retentionDays ?? 30}{tc('unit.days')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Crash recovery interval */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">{ts('backup.recoveryInterval')}</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="5000"
                        max="120000"
                        step="5000"
                        value={formState.backup?.recoveryInterval ?? 30000}
                        onChange={(e) => handleChange('backup', { ...(formState.backup ?? DEFAULT_BACKUP), recoveryInterval: Number(e.target.value) })}
                        className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {((formState.backup?.recoveryInterval ?? 30000) / 1000).toFixed(0)}{tc('unit.s')}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ts('backup.recoveryIntervalDesc')}
                    </p>
                  </div>

                  {/* Storage location info */}
                  <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground leading-relaxed">
                    <p className="font-medium mb-1">{ts('backup.storageLocation')}</p>
                    <p>{ts('backup.recoveryPath')}</p>
                    <p>{ts('backup.historyPath')}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'language' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium">{ts('tabs.language')}</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{ts('language.label')}</label>
                    <div className="flex flex-col gap-2">
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <button
                          key={lang}
                          onClick={() => void handleLanguageChange(lang)}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 text-sm rounded-md border transition-colors text-left',
                            formState.language === lang
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted border-border'
                          )}
                        >
                          <span className="font-medium">{LANGUAGE_LABELS[lang]}</span>
                          <span className={cn(
                            'text-xs',
                            formState.language === lang ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          )}>
                            {lang}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ts('language.desc')}
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
              {tc('button.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              {tc('button.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
