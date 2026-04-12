/**
 * TaskQueue 单元测试
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { TaskQueue, createTaskQueue } from '../../../../src/mainview/lib/taskQueue';

function expectAbortError(promise: Promise<unknown>): Promise<void> {
  return expect(promise).rejects.toEqual(
    expect.objectContaining({ name: 'AbortError' })
  );
}

describe('TaskQueue', () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = createTaskQueue();
  });

  describe('enqueue', () => {
    it('should return the task resolved value', async () => {
      const result = await queue.enqueue('key1', async () => {
        return 'success';
      });
      expect(result).toBe('success');
    });

    it('should reject the first promise when a second enqueue replaces it', async () => {
      const first = queue.enqueue('key1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'first';
      });

      // Immediately replace
      const second = queue.enqueue('key1', async () => 'second');

      await expectAbortError(first);
      await expect(second).resolves.toBe('second');
    });

    it('should allow tasks with different keys to run concurrently without interference', async () => {
      const first = queue.enqueue('key1', async () => 'a');
      const second = queue.enqueue('key2', async () => 'b');

      const [r1, r2] = await Promise.all([first, second]);
      expect(r1).toBe('a');
      expect(r2).toBe('b');
    });

    it('should propagate non-abort task errors unchanged', async () => {
      const task = queue.enqueue('key1', () => Promise.reject(new Error('custom error')));

      let caught: Error | undefined;
      try {
        await task;
      } catch (err) {
        caught = err as Error;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(caught?.message).toBe('custom error');
    });

    it('should provide an AbortSignal to the task function', async () => {
      let capturedSignal: AbortSignal | undefined;
      queue.enqueue('key1', async (signal) => {
        capturedSignal = signal;
        return 'done';
      });
      expect(capturedSignal).toBeDefined();
      expect(capturedSignal!.aborted).toBe(false);
    });
  });

  describe('finally cleanup on abort', () => {
    it('should allow finally blocks to run after abort even though caller gets AbortError', async () => {
      let finallyRan = false;

      const first = queue.enqueue('key1', async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'first';
        } finally {
          finallyRan = true;
        }
      });

      queue.enqueue('key1', async () => 'second');

      await expectAbortError(first);
      // Wait for the original task to settle
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(finallyRan).toBe(true);
    });
  });

  describe('abort', () => {
    it('should cause the pending promise to reject with AbortError', async () => {
      const task = queue.enqueue('key1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'first';
      });

      queue.abort('key1');

      await expectAbortError(task);
    });

    it('should be a no-op if no task is pending for the key', () => {
      expect(() => queue.abort('nonexistent')).not.toThrow();
    });
  });

  describe('abortAll', () => {
    it('should cause all pending promises to reject with AbortError', async () => {
      const task1 = queue.enqueue('key1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'a';
      });
      const task2 = queue.enqueue('key2', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'b';
      });

      queue.abortAll();

      let err1: unknown;
      let err2: unknown;
      try { await task1; } catch (e) { err1 = e; }
      try { await task2; } catch (e) { err2 = e; }

      expect(err1).toEqual(expect.objectContaining({ name: 'AbortError' }));
      expect(err2).toEqual(expect.objectContaining({ name: 'AbortError' }));
    });
  });

  describe('size', () => {
    it('should reflect the number of pending tasks', async () => {
      expect(queue.size).toBe(0);

      queue.enqueue('key1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'a';
      });
      expect(queue.size).toBe(1);

      queue.enqueue('key2', async () => 'b');
      expect(queue.size).toBe(2);

      // Wait for key2 to settle
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(queue.size).toBe(1);

      // Wait for key1 to settle
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(queue.size).toBe(0);
    });

    it('should clean up the replaced task once its original promise settles', async () => {
      const first = queue.enqueue('key1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return 'first';
      });
      expect(queue.size).toBe(1);

      const second = queue.enqueue('key1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'second';
      });
      // Abort the first task so it does not become an unhandled rejection
      await expectAbortError(first);

      expect(queue.size).toBe(1); // only the current one is in the map

      await expect(second).resolves.toBe('second');
      expect(queue.size).toBe(0);
    });
  });
});

describe('createTaskQueue', () => {
  it('should create an independent TaskQueue instance', () => {
    const q1 = createTaskQueue();
    const q2 = createTaskQueue();
    expect(q1).not.toBe(q2);
  });
});
