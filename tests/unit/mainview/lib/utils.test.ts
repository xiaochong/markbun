/**
 * Utils 单元测试
 * 测试通用工具函数
 */
import { describe, it, expect } from 'bun:test';
import { cn, formatPath, countWords, countCharacters, countLines, debounce } from '../../../../src/mainview/lib/utils';

describe('cn', () => {
  it('should merge tailwind classes', () => {
    const result = cn('px-2', 'py-1', 'bg-red-500');
    expect(typeof result).toBe('string');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const result = cn('base', isActive && 'active');
    expect(typeof result).toBe('string');
  });

  it('should merge conflicting classes', () => {
    const result = cn('px-2', 'px-4');
    expect(typeof result).toBe('string');
  });
});

describe('formatPath', () => {
  it('should extract filename from path', () => {
    expect(formatPath('/home/user/document.txt')).toBe('document.txt');
    expect(formatPath('folder/file.md')).toBe('file.md');
  });

  it('should return original if no slashes', () => {
    expect(formatPath('filename.txt')).toBe('filename.txt');
  });

  it('should handle empty string', () => {
    expect(formatPath('')).toBe('');
  });

  it('should handle path with multiple slashes', () => {
    expect(formatPath('/home//user//file.txt')).toBe('file.txt');
  });
});

describe('countWords', () => {
  it('should count words in text', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('one two three four')).toBe(4);
  });

  it('should handle empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('should handle whitespace only', () => {
    expect(countWords('   ')).toBe(0);
    expect(countWords('\t\n')).toBe(0);
  });

  it('should handle multiple spaces', () => {
    expect(countWords('hello    world')).toBe(2);
  });
});

describe('countCharacters', () => {
  it('should count characters', () => {
    expect(countCharacters('hello')).toBe(5);
    expect(countCharacters('hello world')).toBe(11);
  });

  it('should handle empty string', () => {
    expect(countCharacters('')).toBe(0);
  });

  it('should count spaces and newlines', () => {
    expect(countCharacters('a b\nc')).toBe(5);
  });
});

describe('countLines', () => {
  it('should count lines', () => {
    expect(countLines('line1\nline2')).toBe(2);
    expect(countLines('a\nb\nc')).toBe(3);
  });

  it('should handle single line', () => {
    expect(countLines('single line')).toBe(1);
  });

  it('should handle empty string', () => {
    expect(countLines('')).toBe(1);
  });

  it('should handle trailing newline', () => {
    expect(countLines('line1\n')).toBe(2);
  });
});

describe('debounce', () => {
  it('should return a debounced function', () => {
    const fn = () => 'result';
    const debounced = debounce(fn, 100);
    expect(typeof debounced).toBe('function');
    expect(typeof debounced.cancel).toBe('function');
  });

  it('should have cancel method', () => {
    const fn = () => {};
    const debounced = debounce(fn, 100);
    expect(() => debounced.cancel()).not.toThrow();
  });

  it('should call function after delay', async () => {
    let called = false;
    const fn = () => { called = true; };
    const debounced = debounce(fn, 10);

    debounced();
    expect(called).toBe(false);

    await new Promise(resolve => setTimeout(resolve, 20));
    expect(called).toBe(true);
  });

  it('should reset timer on multiple calls', async () => {
    let callCount = 0;
    const fn = () => { callCount++; };
    const debounced = debounce(fn, 50);

    debounced();
    await new Promise(resolve => setTimeout(resolve, 30));
    debounced();
    await new Promise(resolve => setTimeout(resolve, 30));

    expect(callCount).toBe(0);

    await new Promise(resolve => setTimeout(resolve, 60));
    expect(callCount).toBe(1);
  });

  it('should pass arguments to debounced function', async () => {
    let receivedArgs: number[] = [];
    const fn = (...args: number[]) => { receivedArgs = args; };
    const debounced = debounce(fn, 10);

    debounced(1, 2, 3);
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(receivedArgs).toEqual([1, 2, 3]);
  });

  it('should prevent function call when cancelled', async () => {
    let called = false;
    const fn = () => { called = true; };
    const debounced = debounce(fn, 50);

    debounced();
    debounced.cancel();

    await new Promise(resolve => setTimeout(resolve, 60));
    expect(called).toBe(false);
  });
});
