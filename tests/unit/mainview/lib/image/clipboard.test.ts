/**
 * Image Clipboard 单元测试
 * 测试图片剪贴板功能
 */
import { describe, it, expect } from 'bun:test';
import {
  containsBlobUrls,
  extractImagePaths,
} from '../../../../../src/mainview/lib/image/clipboard';

describe('containsBlobUrls', () => {
  it('should detect blob URLs in markdown', () => {
    const markdown = '![image](blob:http://localhost/abc-123)';
    expect(containsBlobUrls(markdown)).toBe(true);
  });

  it('should return false for regular markdown', () => {
    const markdown = '![image](/path/to/image.png)';
    expect(containsBlobUrls(markdown)).toBe(false);
  });

  it('should handle empty string', () => {
    expect(containsBlobUrls('')).toBe(false);
  });

  it('should detect blob URLs anywhere in text', () => {
    const markdown = 'Some text blob:http://example.com/id more text';
    expect(containsBlobUrls(markdown)).toBe(true);
  });
});

describe('extractImagePaths', () => {
  it('should extract image paths from markdown', () => {
    const markdown = '![alt1](/path1.png) ![alt2](/path2.png)';
    const paths = extractImagePaths(markdown);
    expect(paths).toEqual(['/path1.png', '/path2.png']);
  });

  it('should extract remote URLs', () => {
    const markdown = '![remote](https://example.com/image.png)';
    const paths = extractImagePaths(markdown);
    expect(paths).toEqual(['https://example.com/image.png']);
  });

  it('should return empty array for no images', () => {
    const markdown = 'Just plain text without images';
    const paths = extractImagePaths(markdown);
    expect(paths).toEqual([]);
  });

  it('should handle empty alt text', () => {
    const markdown = '![](/path/to/image.png)';
    const paths = extractImagePaths(markdown);
    expect(paths).toEqual(['/path/to/image.png']);
  });

  it('should handle paths with spaces (encoded)', () => {
    const markdown = '![image](/path/my%20image.png)';
    const paths = extractImagePaths(markdown);
    expect(paths).toEqual(['/path/my%20image.png']);
  });
});
