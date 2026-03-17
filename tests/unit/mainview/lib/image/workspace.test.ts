/**
 * Workspace Manager 单元测试
 * 测试工作空间管理器
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { workspaceManager } from '../../../../../src/mainview/lib/image/workspace';

describe('WorkspaceManager', () => {
  beforeEach(() => {
    workspaceManager.clear();
  });

  describe('setCurrentFile', () => {
    it('should set current file and update workspace root', () => {
      workspaceManager.setCurrentFile('/home/user/docs/file.md');
      expect(workspaceManager.getCurrentFile()).toBe('/home/user/docs/file.md');
      expect(workspaceManager.getWorkspaceRoot()).toBe('/home/user/docs');
    });

    it('should handle null file path', () => {
      workspaceManager.setWorkspaceRoot('/home/user');
      workspaceManager.setCurrentFile(null);
      expect(workspaceManager.getCurrentFile()).toBeNull();
      expect(workspaceManager.getWorkspaceRoot()).toBe('/home/user');
    });
  });

  describe('setWorkspaceRoot', () => {
    it('should set workspace root explicitly', () => {
      workspaceManager.setWorkspaceRoot('/home/user/project');
      expect(workspaceManager.getWorkspaceRoot()).toBe('/home/user/project');
    });
  });

  describe('getCurrentFile', () => {
    it('should return null initially', () => {
      expect(workspaceManager.getCurrentFile()).toBeNull();
    });

    it('should return set file path', () => {
      workspaceManager.setCurrentFile('/home/user/file.md');
      expect(workspaceManager.getCurrentFile()).toBe('/home/user/file.md');
    });
  });

  describe('getWorkspaceRoot', () => {
    it('should return null initially', () => {
      expect(workspaceManager.getWorkspaceRoot()).toBeNull();
    });

    it('should return set root path', () => {
      workspaceManager.setWorkspaceRoot('/home/user');
      expect(workspaceManager.getWorkspaceRoot()).toBe('/home/user');
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace state', () => {
      workspaceManager.setCurrentFile('/home/user/docs/file.md');
      const workspace = workspaceManager.getWorkspace();
      expect(workspace.currentFilePath).toBe('/home/user/docs/file.md');
      expect(workspace.rootPath).toBe('/home/user/docs');
    });

    it('should handle uninitialized state', () => {
      const workspace = workspaceManager.getWorkspace();
      expect(workspace.currentFilePath).toBeNull();
      expect(workspace.rootPath).toBe('');
    });
  });

  describe('isInitialized', () => {
    it('should return false initially', () => {
      expect(workspaceManager.isInitialized()).toBe(false);
    });

    it('should return true after setting workspace root', () => {
      workspaceManager.setWorkspaceRoot('/home/user');
      expect(workspaceManager.isInitialized()).toBe(true);
    });

    it('should return true after setting current file', () => {
      workspaceManager.setCurrentFile('/home/user/file.md');
      expect(workspaceManager.isInitialized()).toBe(true);
    });
  });

  describe('resolvePath', () => {
    it('should resolve relative path against current file', () => {
      workspaceManager.setCurrentFile('/home/user/docs/file.md');
      const resolved = workspaceManager.resolvePath('./image.png');
      expect(resolved).toBe('/home/user/docs/image.png');
    });

    it('should resolve against workspace root when no current file', () => {
      workspaceManager.setWorkspaceRoot('/home/user/project');
      const resolved = workspaceManager.resolvePath('./assets/image.png');
      expect(resolved).toBe('/home/user/project/assets/image.png');
    });

    it('should return absolute path unchanged', () => {
      const resolved = workspaceManager.resolvePath('/absolute/path/image.png');
      expect(resolved).toBe('/absolute/path/image.png');
    });
  });

  describe('clear', () => {
    it('should clear all state', () => {
      workspaceManager.setCurrentFile('/home/user/file.md');
      workspaceManager.clear();
      expect(workspaceManager.getCurrentFile()).toBeNull();
      expect(workspaceManager.getWorkspaceRoot()).toBeNull();
      expect(workspaceManager.isInitialized()).toBe(false);
    });
  });
});
