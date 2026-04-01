import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import '../../shared/i18n/types'; // 注册类型扩展

// 静态导入翻译资源（Vite 友好，避免动态导入的路径问题）
import commonEn from './locales/en/common.json';
import dialogEn from './locales/en/dialog.json';
import settingsEn from './locales/en/settings.json';
import editorEn from './locales/en/editor.json';
import fileEn from './locales/en/file.json';
import menuEn from '../../bun/i18n/locales/en/menu.json';

import commonZhCN from './locales/zh-CN/common.json';
import dialogZhCN from './locales/zh-CN/dialog.json';
import settingsZhCN from './locales/zh-CN/settings.json';
import editorZhCN from './locales/zh-CN/editor.json';
import fileZhCN from './locales/zh-CN/file.json';
import menuZhCN from '../../bun/i18n/locales/zh-CN/menu.json';

import commonDe from './locales/de/common.json';
import dialogDe from './locales/de/dialog.json';
import settingsDe from './locales/de/settings.json';
import editorDe from './locales/de/editor.json';
import fileDe from './locales/de/file.json';
import menuDe from '../../bun/i18n/locales/de/menu.json';

import commonFr from './locales/fr/common.json';
import dialogFr from './locales/fr/dialog.json';
import settingsFr from './locales/fr/settings.json';
import editorFr from './locales/fr/editor.json';
import fileFr from './locales/fr/file.json';
import menuFr from '../../bun/i18n/locales/fr/menu.json';

import commonJa from './locales/ja/common.json';
import dialogJa from './locales/ja/dialog.json';
import settingsJa from './locales/ja/settings.json';
import editorJa from './locales/ja/editor.json';
import fileJa from './locales/ja/file.json';
import menuJa from '../../bun/i18n/locales/ja/menu.json';

import commonKo from './locales/ko/common.json';
import dialogKo from './locales/ko/dialog.json';
import settingsKo from './locales/ko/settings.json';
import editorKo from './locales/ko/editor.json';
import fileKo from './locales/ko/file.json';
import menuKo from '../../bun/i18n/locales/ko/menu.json';

import commonPt from './locales/pt/common.json';
import dialogPt from './locales/pt/dialog.json';
import settingsPt from './locales/pt/settings.json';
import editorPt from './locales/pt/editor.json';
import filePt from './locales/pt/file.json';
import menuPt from '../../bun/i18n/locales/pt/menu.json';

import commonEs from './locales/es/common.json';
import dialogEs from './locales/es/dialog.json';
import settingsEs from './locales/es/settings.json';
import editorEs from './locales/es/editor.json';
import fileEs from './locales/es/file.json';
import menuEs from '../../bun/i18n/locales/es/menu.json';

i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'dialog', 'settings', 'editor', 'file', 'menu'],
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
      menu: menuEn,
    },
    'zh-CN': {
      common: commonZhCN,
      dialog: dialogZhCN,
      settings: settingsZhCN,
      editor: editorZhCN,
      file: fileZhCN,
      menu: menuZhCN,
    },
    de: {
      common: commonDe,
      dialog: dialogDe,
      settings: settingsDe,
      editor: editorDe,
      file: fileDe,
      menu: menuDe,
    },
    fr: {
      common: commonFr,
      dialog: dialogFr,
      settings: settingsFr,
      editor: editorFr,
      file: fileFr,
      menu: menuFr,
    },
    ja: {
      common: commonJa,
      dialog: dialogJa,
      settings: settingsJa,
      editor: editorJa,
      file: fileJa,
      menu: menuJa,
    },
    ko: {
      common: commonKo,
      dialog: dialogKo,
      settings: settingsKo,
      editor: editorKo,
      file: fileKo,
      menu: menuKo,
    },
    pt: {
      common: commonPt,
      dialog: dialogPt,
      settings: settingsPt,
      editor: editorPt,
      file: filePt,
      menu: menuPt,
    },
    es: {
      common: commonEs,
      dialog: dialogEs,
      settings: settingsEs,
      editor: editorEs,
      file: fileEs,
      menu: menuEs,
    },
  },
});

export default i18next;
