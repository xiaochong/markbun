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
    if (isSavingRef.current || !isDirty) {
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
      if (pendingSaveRef.current && isDirty) {
        void executeSave();
      }
    }
  }, [onSave, isDirty]);

  // Trigger save with hybrid strategy
  const triggerSave = useCallback(async () => {
    if (!enabled || !isDirty) {
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

    // Throttle: If enough time has passed since last save, save immediately
    if (timeSinceLastSave >= interval) {
      void executeSave();
    } else {
      // Otherwise, schedule save after remaining throttle time
      const remainingTime = interval - timeSinceLastSave;

      // Debounce: Wait a bit after typing stops (500ms)
      const debounceTime = Math.max(500, remainingTime);

      throttleTimerRef.current = setTimeout(() => {
        void executeSave();
      }, debounceTime);
    }

    // Start max wait timer if not running
    if (!maxWaitTimerRef.current) {
      maxWaitTimerRef.current = setTimeout(() => {
        if (isDirty) {
          clearAllTimers();
          void executeSave();
        }
        clearMaxWaitTimer();
      }, 10000); // Force save after 10 seconds
    }
  }, [enabled, isDirty, interval, executeSave, clearAllTimers, clearMaxWaitTimer]);

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
    if (!enabled) return;

    const handleBlur = () => {
      if (isDirty) {
        clearAllTimers();
        void executeSave();
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [enabled, isDirty, executeSave, clearAllTimers]);

  // Save on beforeunload
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        // Try to save synchronously
        clearAllTimers();
        void executeSave();

        // Show warning if there are unsaved changes
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, isDirty, executeSave, clearAllTimers]);

  return {
    triggerSave,
    cancelPendingSave,
  };
}
