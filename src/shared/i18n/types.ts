// Resource type definitions for reference
import type commonEn from '../../mainview/i18n/locales/en/common.json';
import type dialogEn from '../../mainview/i18n/locales/en/dialog.json';
import type settingsEn from '../../mainview/i18n/locales/en/settings.json';
import type editorEn from '../../mainview/i18n/locales/en/editor.json';
import type fileEn from '../../mainview/i18n/locales/en/file.json';

export interface I18nResources {
  common: typeof commonEn;
  dialog: typeof dialogEn;
  settings: typeof settingsEn;
  editor: typeof editorEn;
  file: typeof fileEn;
}
