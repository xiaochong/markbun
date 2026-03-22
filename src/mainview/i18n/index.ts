import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import '../../shared/i18n/types'; // 注册类型扩展

// 静态导入翻译资源（Vite 友好，避免动态导入的路径问题）
import commonEn from './locales/en/common.json';
import dialogEn from './locales/en/dialog.json';
import settingsEn from './locales/en/settings.json';
import editorEn from './locales/en/editor.json';
import fileEn from './locales/en/file.json';

import commonZhCN from './locales/zh-CN/common.json';
import dialogZhCN from './locales/zh-CN/dialog.json';
import settingsZhCN from './locales/zh-CN/settings.json';
import editorZhCN from './locales/zh-CN/editor.json';
import fileZhCN from './locales/zh-CN/file.json';

i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'dialog', 'settings', 'editor', 'file'],
  interpolation: {
    escapeValue: false, // React 已处理 XSS
  },
  resources: {
    en: {
      common: commonEn,
      dialog: dialogEn,
      settings: settingsEn,
      editor: editorEn,
      file: fileEn,
    },
    'zh-CN': {
      common: commonZhCN,
      dialog: dialogZhCN,
      settings: settingsZhCN,
      editor: editorZhCN,
      file: fileZhCN,
    },
  },
});

export default i18next;
