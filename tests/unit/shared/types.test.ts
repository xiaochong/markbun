/**
 * Shared Types 单元测试
 * 验证共享类型定义
 */
import { describe, it, expect } from 'bun:test';
import type {
  FileContent,
  FileInfo,
  AppSettings,
  EditorStats,
  FileNode,
  FolderNode,
  RecentFile,
  OutlineNode,
  QuickOpenItem,
  UIState,
} from '../../../src/shared/types';

describe('FileContent', () => {
  it('should have correct structure', () => {
    const content: FileContent = {
      path: '/home/user/file.md',
      content: '# Hello World',
      lastModified: Date.now(),
    };
    expect(content.path).toBe('/home/user/file.md');
    expect(content.content).toBe('# Hello World');
    expect(typeof content.lastModified).toBe('number');
  });
});

describe('FileInfo', () => {
  it('should have correct structure', () => {
    const info: FileInfo = {
      path: '/home/user/file.md',
      name: 'file.md',
      isDirty: false,
      lastModified: Date.now(),
    };
    expect(info.name).toBe('file.md');
    expect(info.isDirty).toBe(false);
  });
});

describe('AppSettings', () => {
  it('should accept valid theme values', () => {
    const lightSettings: AppSettings = {
      theme: 'light',
      fontSize: 15,
      lineHeight: 1.6,
      autoSave: true,
      autoSaveInterval: 2000,
      backup: { enabled: true, maxVersions: 20, retentionDays: 30, recoveryInterval: 30000 },
    };
    expect(lightSettings.theme).toBe('light');

    const darkSettings: AppSettings = {
      ...lightSettings,
      theme: 'dark',
    };
    expect(darkSettings.theme).toBe('dark');

    const systemSettings: AppSettings = {
      ...lightSettings,
      theme: 'system',
    };
    expect(systemSettings.theme).toBe('system');
  });
});

describe('EditorStats', () => {
  it('should track word and character counts', () => {
    const stats: EditorStats = {
      words: 100,
      characters: 500,
      lines: 10,
    };
    expect(stats.words).toBe(100);
    expect(stats.characters).toBe(500);
    expect(stats.lines).toBe(10);
  });
});

describe('FileNode', () => {
  it('should represent a file in the tree', () => {
    const file: FileNode = {
      type: 'file',
      name: 'document.md',
      path: '/home/user/document.md',
      extension: 'md',
    };
    expect(file.type).toBe('file');
    expect(file.extension).toBe('md');
  });
});

describe('FolderNode', () => {
  it('should represent a folder in the tree', () => {
    const folder: FolderNode = {
      type: 'folder',
      name: 'documents',
      path: '/home/user/documents',
      children: [],
      isExpanded: true,
    };
    expect(folder.type).toBe('folder');
    expect(folder.isExpanded).toBe(true);
    expect(Array.isArray(folder.children)).toBe(true);
  });
});

describe('RecentFile', () => {
  it('should track when file was opened', () => {
    const recent: RecentFile = {
      path: '/home/user/file.md',
      name: 'file.md',
      openedAt: Date.now(),
    };
    expect(recent.name).toBe('file.md');
    expect(typeof recent.openedAt).toBe('number');
  });
});

describe('OutlineNode', () => {
  it('should represent a heading in the outline', () => {
    const node: OutlineNode = {
      id: 'heading-1',
      level: 1,
      text: 'Introduction',
      line: 10,
      children: [],
    };
    expect(node.level).toBe(1);
    expect(node.text).toBe('Introduction');
    expect(node.line).toBe(10);
  });

  it('should support nested children', () => {
    const parent: OutlineNode = {
      id: 'heading-1',
      level: 1,
      text: 'Parent',
      line: 1,
      children: [
        {
          id: 'heading-2',
          level: 2,
          text: 'Child',
          line: 5,
          children: [],
        },
      ],
    };
    expect(parent.children).toHaveLength(1);
    expect(parent.children[0].level).toBe(2);
  });
});

describe('QuickOpenItem', () => {
  it('should have optional fuzzy search score', () => {
    const item: QuickOpenItem = {
      path: '/home/user/file.md',
      name: 'file.md',
      isRecent: true,
    };
    expect(item.isRecent).toBe(true);
    expect(item.score).toBeUndefined();

    const withScore: QuickOpenItem = {
      ...item,
      score: 0.95,
    };
    expect(withScore.score).toBe(0.95);
  });
});

describe('UIState', () => {
  it('should have all UI visibility flags', () => {
    const state: UIState = {
      showTitleBar: true,
      showToolBar: true,
      showStatusBar: true,
      showSidebar: true,
      sourceMode: false,
      sidebarWidth: 280,
      sidebarActiveTab: 'files',
      windowX: 100,
      windowY: 100,
      windowWidth: 1200,
      windowHeight: 800,
    };
    expect(state.showTitleBar).toBe(true);
    expect(state.sidebarWidth).toBe(280);
    expect(state.sidebarActiveTab).toBe('files');
  });

  it('should support optional display info', () => {
    const state: UIState = {
      showTitleBar: false,
      showToolBar: false,
      showStatusBar: false,
      showSidebar: false,
      sourceMode: false,
      sidebarWidth: 280,
      sidebarActiveTab: 'files',
      windowX: 0,
      windowY: 0,
      windowWidth: 800,
      windowHeight: 600,
      displayId: 1,
      displayWidth: 1920,
      displayHeight: 1080,
    };
    expect(state.displayId).toBe(1);
    expect(state.displayWidth).toBe(1920);
  });
});
