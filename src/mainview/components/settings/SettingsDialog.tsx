import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { electrobun } from '@/lib/electrobun';
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type SupportedLanguage } from '../../../shared/i18n/config';
import type { AppSettings, BackupSettings } from '@/shared/types';

// ── AI Provider / Model definitions ──────────────────────────────────────────

interface ProviderDef {
  id: string;
  group: 'international' | 'domestic' | 'other';
  defaultBaseUrl?: string;
  models: string[];
  needsApiKey: boolean;
}

const AI_PROVIDERS: ProviderDef[] = [
  // International
  { id: 'ollama', group: 'international', defaultBaseUrl: 'http://localhost:11434', models: ['llama3.1', 'llama3.2', 'mistral', 'codellama', 'gemma2', 'qwen2.5', 'deepseek-r1'], needsApiKey: false },
  { id: 'anthropic', group: 'international', defaultBaseUrl: 'https://api.anthropic.com', models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'], needsApiKey: true },
  { id: 'openai', group: 'international', defaultBaseUrl: 'https://api.openai.com/v1', models: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'o3-mini'], needsApiKey: true },
  { id: 'google', group: 'international', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta', models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'], needsApiKey: true },
  { id: 'openrouter', group: 'international', defaultBaseUrl: 'https://openrouter.ai/api/v1', models: ['anthropic/claude-sonnet-4', 'openai/gpt-4.1', 'google/gemini-2.5-pro', 'deepseek/deepseek-r1', 'meta-llama/llama-3.1-405b-instruct'], needsApiKey: true },
  // Domestic (China)
  { id: 'deepseek', group: 'domestic', defaultBaseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'], needsApiKey: true },
  { id: 'kimi', group: 'domestic', defaultBaseUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'], needsApiKey: true },
  { id: 'glm', group: 'domestic', defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-plus', 'glm-4-flash', 'glm-4-air', 'glm-4-long'], needsApiKey: true },
  { id: 'qwen', group: 'domestic', defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long'], needsApiKey: true },
  { id: 'minimax', group: 'domestic', defaultBaseUrl: 'https://api.minimax.chat/v1', models: ['MiniMax-Text-01', 'abab6.5s-chat'], needsApiKey: true },
  { id: 'doubao', group: 'domestic', defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', models: ['doubao-1.5-pro-32k', 'doubao-1.5-lite-32k', 'doubao-pro-32k', 'doubao-lite-32k'], needsApiKey: true },
  // Other
  { id: 'custom', group: 'other', models: [], needsApiKey: true },
];

// ── AI Tab sub-component ─────────────────────────────────────────────────────

interface AITabContentProps {
  formState: AppSettings;
  handleChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  ts: (key: string, options?: Record<string, unknown>) => string;
  tc: (key: string, options?: Record<string, unknown>) => string;
}

function AITabContent({ formState, handleChange, ts, tc }: AITabContentProps) {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [maskedKey, setMaskedKey] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const apiKeyRef = useRef<HTMLInputElement>(null);

  const ai = formState.ai;
  const localOnly = ai?.localOnly ?? false;
  const selectedProvider = AI_PROVIDERS.find(p => p.id === ai?.provider);
  const currentModels = selectedProvider?.models ?? [];

  // Providers visible based on localOnly mode
  const visibleProviders = localOnly
    ? AI_PROVIDERS.filter(p => p.id === 'ollama')
    : AI_PROVIDERS;

  // Load masked key when provider changes
  useEffect(() => {
    if (!ai?.provider || ai.provider === 'ollama' || localOnly) {
      setMaskedKey('');
      setHasSavedKey(false);
      return;
    }
    electrobun.getAIKeyMasked(ai.provider).then(res => {
      if (res.success && res.maskedKey) {
        setMaskedKey(res.maskedKey);
        setHasSavedKey(true);
      } else {
        setMaskedKey('');
        setHasSavedKey(false);
      }
    }).catch(() => {
      setMaskedKey('');
      setHasSavedKey(false);
    });
  }, [ai?.provider, localOnly]);

  const updateAI = useCallback(<K extends keyof import('@/shared/types').AISettings>(key: K, value: import('@/shared/types').AISettings[K]) => {
    handleChange('ai', { ...ai, [key]: value } as AppSettings['ai']);
  }, [ai, handleChange]);

  const handleProviderChange = useCallback((providerId: string) => {
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    const newAi = {
      ...ai,
      provider: providerId,
      model: '',
      baseUrl: provider?.defaultBaseUrl ?? '',
    };
    handleChange('ai', newAi as AppSettings['ai']);
    setTestStatus('idle');
    setTestMessage('');
  }, [ai, handleChange]);

  const handleTestConnection = useCallback(async () => {
    if (!ai?.provider || !ai?.model) return;
    setTestStatus('testing');
    setTestMessage('');
    try {
      const result = await electrobun.testAIConnection(ai.provider, ai.model, ai.baseUrl || undefined);
      if (result.success) {
        setTestStatus('success');
        setTestMessage(ts('ai.testSuccess', { latency: result.latency ?? '?' }));
      } else {
        setTestStatus('error');
        setTestMessage(ts('ai.testFailed', { error: result.error ?? 'Unknown error' }));
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(ts('ai.testFailed', { error: err.message ?? 'Unknown error' }));
    }
  }, [ai?.provider, ai?.model, ai?.baseUrl, ts]);

  const handleSaveKey = useCallback(async () => {
    if (!ai?.provider || !apiKeyInput.trim()) return;
    const result = await electrobun.saveAIKey(ai.provider, apiKeyInput.trim());
    if (result.success) {
      setApiKeyInput('');
      setHasSavedKey(true);
      // Refresh masked key
      const masked = await electrobun.getAIKeyMasked(ai.provider);
      if (masked.success && masked.maskedKey) {
        setMaskedKey(masked.maskedKey);
      }
    }
  }, [ai?.provider, apiKeyInput]);

  const handleDeleteKey = useCallback(async () => {
    if (!ai?.provider) return;
    const result = await electrobun.deleteAIKey(ai.provider);
    if (result.success) {
      setMaskedKey('');
      setHasSavedKey(false);
      setApiKeyInput('');
    }
  }, [ai?.provider]);

  const providersByGroup = {
    international: visibleProviders.filter(p => p.group === 'international'),
    domestic: visibleProviders.filter(p => p.group === 'domestic'),
    other: visibleProviders.filter(p => p.group === 'other'),
  };

  const showApiKey = !localOnly && selectedProvider?.needsApiKey !== false;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">{ts('ai.title')}</h3>

      <div className="space-y-4">
        {/* Enable AI toggle */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium">{ts('ai.enabled')}</label>
            <p className="text-xs text-muted-foreground">{ts('ai.enabledDesc')}</p>
          </div>
          <input
            type="checkbox"
            checked={ai?.enabled ?? false}
            onChange={(e) => updateAI('enabled', e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
        </div>

        {(ai?.enabled) && (
          <div className="space-y-4 pl-4 border-l-2 border-muted">
            {/* Local Only toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">{ts('ai.localOnly')}</label>
                <p className="text-xs text-muted-foreground">{ts('ai.localOnlyDesc')}</p>
              </div>
              <input
                type="checkbox"
                checked={localOnly}
                onChange={(e) => {
                  const newVal = e.target.checked;
                  if (newVal) {
                    // Switch to Ollama when enabling local-only
                    handleChange('ai', {
                      ...ai,
                      localOnly: true,
                      provider: 'ollama',
                      model: '',
                      baseUrl: 'http://localhost:11434',
                    } as AppSettings['ai']);
                  } else {
                    updateAI('localOnly', false);
                  }
                }}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
            </div>

            {/* Provider selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{ts('ai.provider')}</label>
              <select
                value={ai?.provider ?? ''}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">{ts('ai.providerDesc')}</option>
                {!localOnly && providersByGroup.international.length > 0 && (
                  <optgroup label={ts('ai.providerGroupInternational')}>
                    {providersByGroup.international.map(p => (
                      <option key={p.id} value={p.id}>{ts(`ai.providers.${p.id}`)}</option>
                    ))}
                  </optgroup>
                )}
                {!localOnly && providersByGroup.domestic.length > 0 && (
                  <optgroup label={ts('ai.providerGroupDomestic')}>
                    {providersByGroup.domestic.map(p => (
                      <option key={p.id} value={p.id}>{ts(`ai.providers.${p.id}`)}</option>
                    ))}
                  </optgroup>
                )}
                {!localOnly && providersByGroup.other.length > 0 && (
                  <optgroup label={ts('ai.providerGroupOther')}>
                    {providersByGroup.other.map(p => (
                      <option key={p.id} value={p.id}>{ts(`ai.providers.${p.id}`)}</option>
                    ))}
                  </optgroup>
                )}
                {localOnly && providersByGroup.international.map(p => (
                  <option key={p.id} value={p.id}>{ts(`ai.providers.${p.id}`)}</option>
                ))}
              </select>
            </div>

            {/* Model selection */}
            {ai?.provider && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{ts('ai.model')}</label>
                {currentModels.length > 0 ? (
                  <select
                    value={ai?.model ?? ''}
                    onChange={(e) => updateAI('model', e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">{ts('ai.modelDesc')}</option>
                    {currentModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={ai?.model ?? ''}
                    onChange={(e) => updateAI('model', e.target.value)}
                    placeholder={ts('ai.modelDesc')}
                    className="w-full px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>
            )}

            {/* Base URL */}
            {ai?.provider && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{ts('ai.baseUrl')}</label>
                <input
                  type="text"
                  value={ai?.baseUrl ?? ''}
                  onChange={(e) => updateAI('baseUrl', e.target.value || undefined)}
                  placeholder={ts('ai.baseUrlPlaceholder')}
                  className="w-full px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">{ts('ai.baseUrlDesc')}</p>
              </div>
            )}

            {/* API Key section */}
            {showApiKey && ai?.provider && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{ts('ai.apiKey')}</label>
                <p className="text-xs text-muted-foreground">{ts('ai.apiKeyDesc')}</p>

                {/* Show saved key status */}
                {hasSavedKey && !apiKeyInput && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md text-sm">
                    <span className="text-muted-foreground">{ts('ai.apiKeySaved')}:</span>
                    <code className="text-xs font-mono">{maskedKey}</code>
                    <button
                      onClick={handleDeleteKey}
                      className="ml-auto text-xs text-red-500 hover:text-red-600 transition-colors"
                    >
                      {ts('ai.deleteKey')}
                    </button>
                  </div>
                )}

                {/* API key input */}
                <div className="flex gap-2">
                  <input
                    ref={apiKeyRef}
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={ts('ai.apiKeyPlaceholder')}
                    className="flex-1 px-3 py-2 text-sm bg-background border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => void handleSaveKey()}
                    disabled={!apiKeyInput.trim()}
                    className={cn(
                      'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      apiKeyInput.trim()
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    )}
                  >
                    {ts('ai.saveKey')}
                  </button>
                </div>
              </div>
            )}

            {/* Test Connection */}
            {ai?.provider && ai?.model && (
              <div className="space-y-2">
                <button
                  onClick={() => void handleTestConnection()}
                  disabled={testStatus === 'testing'}
                  className={cn(
                    'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                    testStatus === 'testing'
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  {testStatus === 'testing' ? ts('ai.testing') : ts('ai.testConnection')}
                </button>
                {testStatus !== 'idle' && testStatus !== 'testing' && (
                  <p className={cn(
                    'text-xs',
                    testStatus === 'success' ? 'text-green-600' : 'text-red-500'
                  )}>
                    {testMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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

type SettingsTab = 'general' | 'editor' | 'appearance' | 'backup' | 'language' | 'ai';

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
    ai: {
      enabled: false,
      provider: '',
      model: '',
      baseUrl: undefined,
      localOnly: false,
    },
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
  const handleLanguageChange = useCallback(async (lang: SupportedLanguage) => {
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
    { id: 'ai', label: ts('tabs.ai'), icon: '🤖' },
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
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">{ts('tabs.editor')}</h3>
                  <button
                    onClick={() => {
                      handleChange('fontSize', 15);
                      handleChange('lineHeight', 1.65);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {ts('editor.resetDefault')}
                  </button>
                </div>

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

            {activeTab === 'ai' && (
              <AITabContent
                formState={formState}
                handleChange={handleChange}
                ts={ts}
                tc={tc}
              />
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
