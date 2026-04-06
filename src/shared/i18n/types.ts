// Resource type definitions for reference
import type commonEn from './locales/en/common.json';
import type dialogEn from './locales/en/dialog.json';
import type settingsEn from './locales/en/settings.json';
import type editorEn from './locales/en/editor.json';
import type fileEn from './locales/en/file.json';
import type aiEn from './locales/en/ai.json';
import type menuEn from './locales/en/menu.json';

export interface I18nResources {
  common: typeof commonEn;
  dialog: typeof dialogEn;
  settings: typeof settingsEn;
  editor: typeof editorEn;
  file: typeof fileEn;
  ai: typeof aiEn;
  menu: typeof menuEn;
}
