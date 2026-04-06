import { describe, it, expect, beforeEach } from 'bun:test';
import { CommandDispatcher } from '../../../src/shared/commandDispatch';

describe('CommandDispatcher', () => {
  let dispatcher: CommandDispatcher;

  beforeEach(() => {
    dispatcher = new CommandDispatcher();
  });

  describe('registerHandler + execute', () => {
    it('executes a registered handler', () => {
      let called = false;
      dispatcher.registerHandler('test-action', () => { called = true; });
      const result = dispatcher.execute('test-action');
      expect(result).toBe(true);
      expect(called).toBe(true);
    });

    it('last registration wins when same action registered twice', () => {
      let first = false;
      let second = false;
      dispatcher.registerHandler('test-action', () => { first = true; });
      dispatcher.registerHandler('test-action', () => { second = true; });
      dispatcher.execute('test-action');
      expect(first).toBe(false);
      expect(second).toBe(true);
    });

    it('returns false for unknown action with no handler (no crash)', () => {
      const result = dispatcher.execute('nonexistent-action');
      expect(result).toBe(false);
    });
  });

  describe('when conditions', () => {
    it('blocks execution when when condition is not met (single key)', () => {
      // file-save has when: 'hasOpenFile' in the manifest
      let called = false;
      dispatcher.registerHandler('file-save', () => { called = true; });

      // hasOpenFile not set → should block
      const result = dispatcher.execute('file-save');
      expect(result).toBe(false);
      expect(called).toBe(false);
    });

    it('allows execution when when condition is met', () => {
      let called = false;
      dispatcher.registerHandler('file-save', () => { called = true; });
      dispatcher.setContext('hasOpenFile', true);

      const result = dispatcher.execute('file-save');
      expect(result).toBe(true);
      expect(called).toBe(true);
    });

    it('allows execution for actions without when condition', () => {
      let called = false;
      dispatcher.registerHandler('format-strong', () => { called = true; });

      const result = dispatcher.execute('format-strong');
      expect(result).toBe(true);
      expect(called).toBe(true);
    });
  });

  describe('canExecute', () => {
    it('returns false for actions with no handler', () => {
      expect(dispatcher.canExecute('nonexistent')).toBe(false);
    });

    it('returns true for registered actions without when', () => {
      dispatcher.registerHandler('format-strong', () => {});
      expect(dispatcher.canExecute('format-strong')).toBe(true);
    });

    it('returns false when when condition is not met', () => {
      dispatcher.registerHandler('file-save', () => {});
      expect(dispatcher.canExecute('file-save')).toBe(false);
    });

    it('returns true when when condition is met', () => {
      dispatcher.registerHandler('file-save', () => {});
      dispatcher.setContext('hasOpenFile', true);
      expect(dispatcher.canExecute('file-save')).toBe(true);
    });
  });

  describe('context', () => {
    it('sets and gets context values', () => {
      dispatcher.setContext('hasOpenFile', true);
      expect(dispatcher.getContext('hasOpenFile')).toBe(true);

      dispatcher.setContext('hasOpenFile', false);
      expect(dispatcher.getContext('hasOpenFile')).toBe(false);
    });

    it('returns undefined for unset keys', () => {
      expect(dispatcher.getContext('nonexistent')).toBeUndefined();
    });

    it('does not trigger rebuild when value unchanged', () => {
      let rebuildCount = 0;
      dispatcher.onRebuildNeeded(() => { rebuildCount++; });

      dispatcher.setContext('hasOpenFile', true);
      expect(rebuildCount).toBe(1);

      dispatcher.setContext('hasOpenFile', true); // same value
      expect(rebuildCount).toBe(1); // no additional rebuild
    });
  });

  describe('menu rebuild triggers', () => {
    it('triggers rebuild for low-frequency keys (hasOpenFile)', () => {
      let rebuildCount = 0;
      dispatcher.onRebuildNeeded(() => { rebuildCount++; });

      dispatcher.setContext('hasOpenFile', true);
      expect(rebuildCount).toBe(1);
    });

    it('triggers rebuild for low-frequency keys (editorReady)', () => {
      let rebuildCount = 0;
      dispatcher.onRebuildNeeded(() => { rebuildCount++; });

      dispatcher.setContext('editorReady', true);
      expect(rebuildCount).toBe(1);
    });

    it('triggers rebuild for low-frequency keys (isSourceMode)', () => {
      let rebuildCount = 0;
      dispatcher.onRebuildNeeded(() => { rebuildCount++; });

      dispatcher.setContext('isSourceMode', true);
      expect(rebuildCount).toBe(1);
    });

    it('does NOT trigger rebuild for high-frequency keys (hasSelection)', () => {
      let rebuildCount = 0;
      dispatcher.onRebuildNeeded(() => { rebuildCount++; });

      dispatcher.setContext('hasSelection', true);
      expect(rebuildCount).toBe(0);
    });

    it('does NOT trigger rebuild for high-frequency keys (isDirty)', () => {
      let rebuildCount = 0;
      dispatcher.onRebuildNeeded(() => { rebuildCount++; });

      dispatcher.setContext('isDirty', true);
      expect(rebuildCount).toBe(0);
    });
  });

  describe('toggled state', () => {
    it('returns false for unset toggle key', () => {
      expect(dispatcher.isToggled('showSidebar')).toBe(false);
    });

    it('returns true when toggle key is truthy', () => {
      dispatcher.setContext('showSidebar', true);
      expect(dispatcher.isToggled('showSidebar')).toBe(true);
    });

    it('returns false when toggle key is explicitly false', () => {
      dispatcher.setContext('showSidebar', true);
      dispatcher.setContext('showSidebar', false);
      expect(dispatcher.isToggled('showSidebar')).toBe(false);
    });
  });
});
