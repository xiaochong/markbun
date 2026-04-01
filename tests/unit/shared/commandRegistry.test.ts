import { describe, it, expect } from 'bun:test';
import { COMMANDS } from '../../../src/shared/commandRegistry';

describe('commandRegistry', () => {
  it('contains expected actions across all categories', () => {
    const actions = COMMANDS.map(c => c.action);

    // File
    expect(actions).toContain('file-new');
    expect(actions).toContain('file-open');
    expect(actions).toContain('file-save');
    expect(actions).toContain('file-save-as');
    expect(actions).toContain('file-export-image');
    expect(actions).toContain('file-export-html');

    // Format
    expect(actions).toContain('format-strong');
    expect(actions).toContain('format-emphasis');
    expect(actions).toContain('format-code');

    // Paragraph
    expect(actions).toContain('para-heading-1');
    expect(actions).toContain('para-paragraph');
    expect(actions).toContain('para-horizontal-rule');

    // Table
    expect(actions).toContain('table-insert');
    expect(actions).toContain('table-delete');

    // View
    expect(actions).toContain('view-toggle-sidebar');
    expect(actions).toContain('view-toggle-theme');
    expect(actions).toContain('view-toggle-source-mode');

    // Help
    expect(actions).toContain('help-open');
    expect(actions).toContain('app-about');
  });

  it('each entry has non-empty action and i18nKey', () => {
    for (const cmd of COMMANDS) {
      expect(cmd.action.length).toBeGreaterThan(0);
      expect(cmd.i18nKey.length).toBeGreaterThan(0);
    }
  });

  it('does not contain file-export-pdf', () => {
    const actions = COMMANDS.map(c => c.action);
    expect(actions).not.toContain('file-export-pdf');
  });

  it('does not contain role-based items', () => {
    const actions = COMMANDS.map(c => c.action);
    expect(actions).not.toContain('hide');
    expect(actions).not.toContain('hideOthers');
    expect(actions).not.toContain('quit');
    expect(actions).not.toContain('showAll');
  });

  it('has no duplicate actions', () => {
    const actions = COMMANDS.map(c => c.action);
    const unique = new Set(actions);
    expect(unique.size).toBe(actions.length);
  });
});
