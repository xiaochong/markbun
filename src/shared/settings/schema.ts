import { z } from 'zod';

export const settingsSchema = z.object({
  __version: z.literal(1).default(1),
  general: z.object({
    autoSave: z.boolean().default(true),
    autoSaveInterval: z.number().min(500).max(30000).default(2000),
  }),
  editor: z.object({
    fontSize: z.number().min(10).max(32).default(15),
    lineHeight: z.number().min(1).max(3).default(1.65),
  }),
  appearance: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    sidebarWidth: z.number().min(150).max(500).default(280),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingsSection = keyof Omit<Settings, '__version'>;

export const defaultSettings: Settings = {
  __version: 1,
  general: {
    autoSave: true,
    autoSaveInterval: 2000,
  },
  editor: {
    fontSize: 15,
    lineHeight: 1.65,
  },
  appearance: {
    theme: 'system',
    sidebarWidth: 280,
  },
};
