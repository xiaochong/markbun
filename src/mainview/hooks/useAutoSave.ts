import { useCallback, useRef, useEffect } from 'react';

interface UseAutoSaveOptions {
  enabled: boolean;
  interval: number;
  onSave: () => Promise<void>;
  isDirty: boolean;
}

interface UseAutoSaveReturn {
  triggerSave: () => Promise<void>;
  cancelPendingSave: () => void;
}

/**
 * Hybrid auto-save hook with throttle + debounce strategy
 *
 * Strategy:
 * 1. Throttle: Save every `interval` ms during active typing
 * 2. Debounce: Save 500ms after typing stops
 * 3. Max wait: Force save after 10000ms even if typing continues
 * 4. Lifecycle: Save on blur and beforeunload
 */
export function useAutoSave({
  enabled,
  interval,
  onSave,
  isDirty,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxWaitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<number>(0);
  const isSavingRef = useRef<boolean>(false);
  const pendingSaveRef = useRef<boolean>(false);

  // Use refs to avoid stale closures — triggerSave/executeSave always read the latest value
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Clear all timers
  const clearAllTimers = useCallback(() => {
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Clear max wait timer
  const clearMaxWaitTimer = useCallback(() => {
    if (maxWaitTimerRef.current) {
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    }
  }, []);

  // Execute save
  const executeSave = useCallback(async () => {
    if (isSavingRef.current || !isDirtyRef.current) {
      return;
    }

    isSavingRef.current = true;
    pendingSaveRef.current = false;

    try {
      await onSave();
      lastSaveRef.current = Date.now();
    } catch (error) {
      console.error('[AutoSave] Save failed:', error);
    } finally {
      isSavingRef.current = false;

      // If a save was triggered while we were saving, save again
      if (pendingSaveRef.current && isDirtyRef.current) {
        void executeSave();
      }
    }
  }, [onSave]);

  // Trigger save with hybrid strategy.
  // NOTE: We intentionally do NOT check isDirtyRef here. The caller (updateContent)
  // already knows the content changed. At call time, the isDirty ref may still be stale
  // because React hasn't re-rendered yet. The actual isDirty check happens in
  // executeSave. We always schedule executeSave via setTimeout (even with 0ms delay
  // for the throttle path) so React has a chance to flush the state update and update
  // isDirtyRef before the save runs.
  const triggerSave = useCallback(async () => {
    if (!enabledRef.current) {
      return;
    }

    // If already saving, mark as pending
    if (isSavingRef.current) {
      pendingSaveRef.current = true;
      return;
    }

    clearAllTimers();

    const now = Date.now();
    const timeSinceLastSave = now - lastSaveRef.current;

    // Throttle: If enough time has passed since last save, schedule save with 0ms delay.
    // Debounce: Otherwise wait a bit after typing stops (500ms) plus remaining throttle time.
    const remainingTime = interval - timeSinceLastSave;
    const debounceTime = timeSinceLastSave >= interval ? 0 : Math.max(500, remainingTime);

    throttleTimerRef.current = setTimeout(() => {
      void executeSave();
    }, debounceTime);

    // Start max wait timer if not running
    if (!maxWaitTimerRef.current) {
      maxWaitTimerRef.current = setTimeout(() => {
        if (isDirtyRef.current) {
          clearAllTimers();
          void executeSave();
        }
        clearMaxWaitTimer();
      }, 10000); // Force save after 10 seconds
    }
  }, [interval, executeSave, clearAllTimers, clearMaxWaitTimer]);

  // Cancel pending save
  const cancelPendingSave = useCallback(() => {
    clearAllTimers();
    clearMaxWaitTimer();
  }, [clearAllTimers, clearMaxWaitTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
      clearMaxWaitTimer();
    };
  }, [clearAllTimers, clearMaxWaitTimer]);

  // Save on blur event
  useEffect(() => {
    const handleBlur = () => {
      if (enabledRef.current && isDirtyRef.current) {
        clearAllTimers();
        void executeSave();
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [executeSave, clearAllTimers]);

  // Save on beforeunload (auto-save enabled: save silently, no dialog)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (enabledRef.current && isDirtyRef.current) {
        clearAllTimers();
        void executeSave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [executeSave, clearAllTimers]);

  return {
    triggerSave,
    cancelPendingSave,
  };
}
