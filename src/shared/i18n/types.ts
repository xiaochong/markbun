// Resource type definitions for reference
import type commonEn from '../../mainview/i18n/locales/en/common.json';
import type dialogEn from '../../mainview/i18n/locales/en/dialog.json';
import type settingsEn from '../../mainview/i18n/locales/en/settings.json';
import type editorEn from '../../mainview/i18n/locales/en/editor.json';
import type fileEn from '../../mainview/i18n/locales/en/file.json';
import type aiEn from '../../mainview/i18n/locales/en/ai.json';
import type menuEn from '../../bun/i18n/locales/en/menu.json';

export interface I18nResources {
  common: typeof commonEn;
  dialog: typeof dialogEn;
  settings: typeof settingsEn;
  editor: typeof editorEn;
  file: typeof fileEn;
  ai: typeof aiEn;
  menu: typeof menuEn;
}
