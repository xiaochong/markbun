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
  backup: z.object({
    enabled: z.boolean().default(true),
    maxVersions: z.number().min(5).max(100).default(20),
    retentionDays: z.number().min(1).max(365).default(30),
    recoveryInterval: z.number().min(5000).max(120000).default(30000),
  }).default({
    enabled: true,
    maxVersions: 20,
    retentionDays: 30,
    recoveryInterval: 30000,
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
  backup: {
    enabled: true,
    maxVersions: 20,
    retentionDays: 30,
    recoveryInterval: 30000,
  },
};
