// Unified command dispatch — core dispatcher shared between Bun and renderer processes.
// Handles handler registration, context management, and when/toggled evaluation.

import { getCommand } from './commandRegistry';

export type CommandHandler = () => void;

export interface CommandContextValue {
  get: (key: string) => boolean | string | undefined;
  set: (key: string, value: boolean | string) => void;
}

// Keys that trigger native menu rebuilds when they change (low-frequency only).
// High-frequency keys (hasSelection, isDirty) rely on silent no-op at dispatch time.
const REBUILD_TRIGGERS = new Set([
  'hasOpenFile', 'editorReady', 'isSourceMode',
  'showSidebar', 'showTitleBar', 'showToolBar', 'showStatusBar',
]);

type RebuildCallback = () => void;

export class CommandDispatcher {
  private handlers = new Map<string, CommandHandler>();
  private contextValues = new Map<string, boolean | string>();
  private rebuildCallback: RebuildCallback | null = null;

  /** Register a handler for an action ID. Last registration wins. */
  registerHandler(actionId: string, handler: CommandHandler): void {
    this.handlers.set(actionId, handler);
  }

  /** Execute a command by action ID. Evaluates when condition before running. */
  execute(actionId: string): boolean {
    const entry = getCommand(actionId);

    // Evaluate when condition
    if (entry?.when) {
      const keys = Array.isArray(entry.when) ? entry.when : [entry.when];
      for (const key of keys) {
        if (!this.contextValues.get(key)) {
          return false; // when condition not met — silent no-op
        }
      }
    }

    const handler = this.handlers.get(actionId);
    if (!handler) {
      if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.warn(`[CommandDispatch] No handler registered for action: ${actionId}`);
      }
      return false;
    }

    handler();
    return true;
  }

  /** Check if an action has a registered handler and passes its when condition. */
  canExecute(actionId: string): boolean {
    if (!this.handlers.has(actionId)) return false;

    const entry = getCommand(actionId);
    if (entry?.when) {
      const keys = Array.isArray(entry.when) ? entry.when : [entry.when];
      for (const key of keys) {
        if (!this.contextValues.get(key)) return false;
      }
    }
    return true;
  }

  /** Get a context value. */
  getContext(key: string): boolean | string | undefined {
    return this.contextValues.get(key);
  }

  /** Set a context value. Triggers menu rebuild for low-frequency keys. */
  setContext(key: string, value: boolean | string): void {
    const oldValue = this.contextValues.get(key);
    if (oldValue === value) return; // no change

    this.contextValues.set(key, value);

    // Trigger menu rebuild for low-frequency keys
    if (REBUILD_TRIGGERS.has(key) && this.rebuildCallback) {
      this.rebuildCallback();
    }
  }

  /** Set the callback invoked when low-frequency context keys change. */
  onRebuildNeeded(callback: RebuildCallback): void {
    this.rebuildCallback = callback;
  }

  /** Check if a toggled context key is truthy. */
  isToggled(key: string): boolean {
    return !!this.contextValues.get(key);
  }
}
