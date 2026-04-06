import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import '../../shared/i18n/types'; // 注册类型扩展

// 静态导入翻译资源（Vite 友好，避免动态导入的路径问题）
import commonEn from '../../shared/i18n/locales/en/common.json';
import dialogEn from '../../shared/i18n/locales/en/dialog.json';
import settingsEn from '../../shared/i18n/locales/en/settings.json';
import editorEn from '../../shared/i18n/locales/en/editor.json';
import fileEn from '../../shared/i18n/locales/en/file.json';
import aiEn from '../../shared/i18n/locales/en/ai.json';
import menuEn from '../../shared/i18n/locales/en/menu.json';

import commonZhCN from '../../shared/i18n/locales/zh-CN/common.json';
import dialogZhCN from '../../shared/i18n/locales/zh-CN/dialog.json';
import settingsZhCN from '../../shared/i18n/locales/zh-CN/settings.json';
import editorZhCN from '../../shared/i18n/locales/zh-CN/editor.json';
import fileZhCN from '../../shared/i18n/locales/zh-CN/file.json';
import aiZhCN from '../../shared/i18n/locales/zh-CN/ai.json';
import menuZhCN from '../../shared/i18n/locales/zh-CN/menu.json';

import commonDe from '../../shared/i18n/locales/de/common.json';
import dialogDe from '../../shared/i18n/locales/de/dialog.json';
import settingsDe from '../../shared/i18n/locales/de/settings.json';
import editorDe from '../../shared/i18n/locales/de/editor.json';
import fileDe from '../../shared/i18n/locales/de/file.json';
import aiDe from '../../shared/i18n/locales/de/ai.json';
import menuDe from '../../shared/i18n/locales/de/menu.json';

import commonFr from '../../shared/i18n/locales/fr/common.json';
import dialogFr from '../../shared/i18n/locales/fr/dialog.json';
import settingsFr from '../../shared/i18n/locales/fr/settings.json';
import editorFr from '../../shared/i18n/locales/fr/editor.json';
import fileFr from '../../shared/i18n/locales/fr/file.json';
import aiFr from '../../shared/i18n/locales/fr/ai.json';
import menuFr from '../../shared/i18n/locales/fr/menu.json';

import commonJa from '../../shared/i18n/locales/ja/common.json';
import dialogJa from '../../shared/i18n/locales/ja/dialog.json';
import settingsJa from '../../shared/i18n/locales/ja/settings.json';
import editorJa from '../../shared/i18n/locales/ja/editor.json';
import fileJa from '../../shared/i18n/locales/ja/file.json';
import aiJa from '../../shared/i18n/locales/ja/ai.json';
import menuJa from '../../shared/i18n/locales/ja/menu.json';

import commonKo from '../../shared/i18n/locales/ko/common.json';
import dialogKo from '../../shared/i18n/locales/ko/dialog.json';
import settingsKo from '../../shared/i18n/locales/ko/settings.json';
import editorKo from '../../shared/i18n/locales/ko/editor.json';
import fileKo from '../../shared/i18n/locales/ko/file.json';
import aiKo from '../../shared/i18n/locales/ko/ai.json';
import menuKo from '../../shared/i18n/locales/ko/menu.json';

import commonPt from '../../shared/i18n/locales/pt/common.json';
import dialogPt from '../../shared/i18n/locales/pt/dialog.json';
import settingsPt from '../../shared/i18n/locales/pt/settings.json';
import editorPt from '../../shared/i18n/locales/pt/editor.json';
import filePt from '../../shared/i18n/locales/pt/file.json';
import aiPt from '../../shared/i18n/locales/pt/ai.json';
import menuPt from '../../shared/i18n/locales/pt/menu.json';

import commonEs from '../../shared/i18n/locales/es/common.json';
import dialogEs from '../../shared/i18n/locales/es/dialog.json';
import settingsEs from '../../shared/i18n/locales/es/settings.json';
import editorEs from '../../shared/i18n/locales/es/editor.json';
import fileEs from '../../shared/i18n/locales/es/file.json';
import aiEs from '../../shared/i18n/locales/es/ai.json';
import menuEs from '../../shared/i18n/locales/es/menu.json';

i18next.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common', 'dialog', 'settings', 'editor', 'file', 'ai', 'menu'],
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
      ai: aiEn,
      menu: menuEn,
    },
    'zh-CN': {
      common: commonZhCN,
      dialog: dialogZhCN,
      settings: settingsZhCN,
      editor: editorZhCN,
      file: fileZhCN,
      ai: aiZhCN,
      menu: menuZhCN,
    },
    de: {
      common: commonDe,
      dialog: dialogDe,
      settings: settingsDe,
      editor: editorDe,
      file: fileDe,
      ai: aiDe,
      menu: menuDe,
    },
    fr: {
      common: commonFr,
      dialog: dialogFr,
      settings: settingsFr,
      editor: editorFr,
      file: fileFr,
      ai: aiFr,
      menu: menuFr,
    },
    ja: {
      common: commonJa,
      dialog: dialogJa,
      settings: settingsJa,
      editor: editorJa,
      file: fileJa,
      ai: aiJa,
      menu: menuJa,
    },
    ko: {
      common: commonKo,
      dialog: dialogKo,
      settings: settingsKo,
      editor: editorKo,
      file: fileKo,
      ai: aiKo,
      menu: menuKo,
    },
    pt: {
      common: commonPt,
      dialog: dialogPt,
      settings: settingsPt,
      editor: editorPt,
      file: filePt,
      ai: aiPt,
      menu: menuPt,
    },
    es: {
      common: commonEs,
      dialog: dialogEs,
      settings: settingsEs,
      editor: editorEs,
      file: fileEs,
      ai: aiEs,
      menu: menuEs,
    },
  },
});

export default i18next;
