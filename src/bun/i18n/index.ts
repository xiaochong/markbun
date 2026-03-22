import i18next, { type TFunction } from 'i18next';
import { resolveLanguage, DEFAULT_LANGUAGE, type SupportedLanguage } from '../../shared/i18n/config';

import menuEn from './locales/en/menu.json';
import menuZhCN from './locales/zh-CN/menu.json';

let initialized = false;

export async function initI18n(language: SupportedLanguage = DEFAULT_LANGUAGE): Promise<void> {
  if (initialized) {
    await i18next.changeLanguage(language);
    return;
  }

  await i18next.init({
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    ns: ['menu'],
    defaultNS: 'menu',
    interpolation: { escapeValue: false },
    resources: {
      en: { menu: menuEn },
      'zh-CN': { menu: menuZhCN },
    },
  });

  initialized = true;
}

export async function changeLanguage(language: SupportedLanguage): Promise<void> {
  await i18next.changeLanguage(language);
}

export function t(key: string): string {
  return i18next.t(key);
}

export { resolveLanguage };
export type { SupportedLanguage };
