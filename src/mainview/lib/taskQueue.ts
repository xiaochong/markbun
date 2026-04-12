/**
 * TaskQueue — Keyed async task queue with AbortController semantics.
 *
 * Design note:
 * Each `enqueue` call receives a `Promise.race` between the original task
 * promise and an abort promise. This guarantees that callers always get an
 * `AbortError` when the task is replaced or manually aborted, even if the
 * underlying library ignores the signal. At the same time, the queue retains
 * a reference to the original task promise and awaits it internally so that
 * its `finally` blocks (e.g. iframe cleanup) still run.
 */

export interface TaskQueueEntry {
  controller: AbortController;
  promise: Promise<unknown>;
}

export class TaskQueue {
  private tasks = new Map<string, TaskQueueEntry>();

  enqueue<T>(key: string, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    // Abort any existing task for this key before starting a new one
    this.abort(key);

    const controller = new AbortController();
    const taskPromise = task(controller.signal);

    // Store a guarded promise that runs cleanup in finally and swallows
    // unhandled rejections so the queue does not leak unhandled rejections
    // internally. The original task promise is also raced for the caller.
    const guardedPromise = taskPromise
      .finally(() => {
        const entry = this.tasks.get(key);
        if (entry && entry.controller === controller) {
          this.tasks.delete(key);
        }
      })
      .catch(() => {});

    this.tasks.set(key, {
      controller,
      promise: guardedPromise,
    });

    // Abort promise rejects when this controller fires, giving every caller
    // a uniform AbortError regardless of whether the library is signal-aware.
    const abortPromise = new Promise<T>((_, reject) => {
      const onAbort = () => {
        controller.signal.removeEventListener('abort', onAbort);
        reject(new DOMException('The task was aborted.', 'AbortError'));
      };
      controller.signal.addEventListener('abort', onAbort);
    });

    return Promise.race([taskPromise, abortPromise]);
  }

  abort(key: string): void {
    const entry = this.tasks.get(key);
    if (entry) {
      entry.controller.abort();
      // Do not delete from the map here; the original promise's finally
      // block handles cleanup once cleanup code has finished running.
    }
  }

  abortAll(): void {
    for (const key of this.tasks.keys()) {
      this.abort(key);
    }
  }

  /** Exposed for tests/debugging — returns the number of tracked entries. */
  get size(): number {
    return this.tasks.size;
  }
}

/** Singleton instance for application-wide use. */
export const taskQueue = new TaskQueue();

/** Factory function for creating custom instances (e.g. for tests). */
export function createTaskQueue(): TaskQueue {
  return new TaskQueue();
}
