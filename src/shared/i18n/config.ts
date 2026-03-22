export const SUPPORTED_LANGUAGES = ['en', 'zh-CN'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  'zh-CN': '简体中文',
};

// 系统语言 → 支持语言的映射
const LANGUAGE_MAPPING: Record<string, SupportedLanguage> = {
  en: 'en',
  'en-US': 'en',
  'en-GB': 'en',
  'en-AU': 'en',
  zh: 'zh-CN',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-CN',
  'zh-HK': 'zh-CN',
};

export function resolveLanguage(
  userSetting: string | undefined,
  systemLocale: string
): SupportedLanguage {
  // 1. 用户明确设置
  if (userSetting && SUPPORTED_LANGUAGES.includes(userSetting as SupportedLanguage)) {
    return userSetting as SupportedLanguage;
  }

  // 2. 精确匹配系统语言
  const exact = LANGUAGE_MAPPING[systemLocale];
  if (exact) return exact;

  // 3. 前缀匹配 (e.g. "en-NZ" → "en")
  const prefix = systemLocale.split('-')[0];
  const prefixMapped = LANGUAGE_MAPPING[prefix];
  if (prefixMapped) return prefixMapped;

  // 4. 默认英文
  return DEFAULT_LANGUAGE;
}
