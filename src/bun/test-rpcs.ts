import type { AppState } from './app';

export function guardTest(): { success: false; error: string } | null {
  if (process.env.MARKBUN_TEST !== '1') {
    return { success: false, error: 'Forbidden' };
  }
  return null;
}

export function createTestRequests(getAppState: () => AppState): Record<string, any> {
  return {
    _testMenuAction: async ({ action }: { action: string }) => {
      try {
        const guard = guardTest();
        if (guard) return guard;
        const { ACTION_TO_RPC_EVENT } = await import('./app');
        const { getCommand } = await import('../shared/commandRegistry');
        const fw = getAppState().focusedWindow;
        if (!fw) return { success: false, error: 'No focused window' };

        const eventName = ACTION_TO_RPC_EVENT[action];
        const entry = getCommand(action);

        if (eventName) {
          (fw.win.webview.rpc.send as any)[eventName]({});
        } else if (entry?.executionContext === 'renderer') {
          fw.win.webview.rpc.send.menuAction({ action });
        } else {
          return { success: false, error: `Unhandled test menu action: ${action}` };
        }

        return { success: true };
      } catch (err: any) {
        console.error('[_testMenuAction]', err);
        return { success: false, error: err?.message || String(err) };
      }
    },

    _testGetEditorMarkdown: async () => {
      const guard = guardTest();
      if (guard) return guard;
      const fw = getAppState().focusedWindow;
      if (!fw) return { success: false, error: 'No focused window' };
      const result = await (fw.win.webview.rpc.request as any).getEditorMarkdown?.({});
      if (result?.success) {
        return { success: true, content: result.content };
      }
      return { success: false, error: result?.error || 'Failed to get editor markdown' };
    },

    _testSetEditorMarkdown: async ({ content }: { content: string }) => {
      const guard = guardTest();
      if (guard) return guard;
      const fw = getAppState().focusedWindow;
      if (!fw) return { success: false, error: 'No focused window' };
      const result = await (fw.win.webview.rpc.request as any).setEditorMarkdown?.({ content });
      if (result?.success) {
        return { success: true };
      }
      return { success: false, error: result?.error || 'Failed to set editor markdown' };
    },

    _testInjectSettings: async ({ settings }: { settings: any }) => {
      const guard = guardTest();
      if (guard) return guard;
      const { saveSettings } = await import('./services/settings');
      return saveSettings(settings);
    },

    _testResetSettings: async () => {
      const guard = guardTest();
      if (guard) return guard;
      const { rmSync } = await import('fs');
      const { join } = await import('path');
      const { homedir } = await import('./services/homedir');
      try {
        rmSync(join(homedir(), '.config', 'markbun', 'settings.json'), { force: true });
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },

    _testClearRecovery: async () => {
      const guard = guardTest();
      if (guard) return guard;
      const { scanRecoveries, clearRecoveryFile } = await import('./services/backup');
      try {
        const recoveries = await scanRecoveries();
        for (const r of recoveries) {
          await clearRecoveryFile(r.recoveryPath);
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },

    _testSimulateCrash: async ({ content, filePath }: { content: string; filePath?: string }) => {
      const guard = guardTest();
      if (guard) return guard;
      const { writeRecoveryFile } = await import('./services/backup');
      try {
        await writeRecoveryFile(filePath || '/tmp/e2e-simulated.md', content);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },

    _testOpenFileByPath: async ({ path }: { path: string }) => {
      const guard = guardTest();
      if (guard) return guard;
      const { openFileByPath } = await import('./app');
      const { addRecentFile } = await import('./ipc/recentFiles');
      const { dirname } = await import('path');
      const fw = getAppState().focusedWindow;
      if (!fw) return { success: false, error: 'No focused window' };
      try {
        const result = await openFileByPath(path, fw.state);
        if (result.success && result.path && result.content !== undefined) {
          await addRecentFile(result.path);
          fw.state.workspaceRoot = dirname(result.path);
          // @ts-ignore
          fw.win.webview.rpc.send.fileOpened({ path: result.path, content: result.content });
        }
        return result;
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
  };
}
