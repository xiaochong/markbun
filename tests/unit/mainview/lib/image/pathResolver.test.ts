/**
 * Path Resolver 单元测试
 * 测试路径解析相关函数
 */
import { describe, it, expect } from 'bun:test';
import {
  isRemoteUrl,
  isDataUrl,
  isBlobUrl,
  isAbsolutePath,
  isLocalFilePath,
  normalizeSeparators,
  resolveRelativePath,
  resolveImagePath,
  getDirectoryPath,
  getFileName,
  toRelativePath,
} from '../../../../../src/mainview/lib/image/pathResolver';

describe('isRemoteUrl', () => {
  it('should identify HTTP URLs', () => {
    expect(isRemoteUrl('http://example.com/image.png')).toBe(true);
    expect(isRemoteUrl('https://example.com/image.png')).toBe(true);
  });

  it('should return false for local paths', () => {
    expect(isRemoteUrl('/home/user/image.png')).toBe(false);
    expect(isRemoteUrl('./image.png')).toBe(false);
    expect(isRemoteUrl('image.png')).toBe(false);
  });

  it('should handle edge cases', () => {
    expect(isRemoteUrl('')).toBe(false);
    expect(isRemoteUrl('http')).toBe(false);
    expect(isRemoteUrl('https')).toBe(false);
  });
});

describe('isDataUrl', () => {
  it('should identify data URLs', () => {
    expect(isDataUrl('data:image/png;base64,abc123')).toBe(true);
    expect(isDataUrl('data:text/plain,hello')).toBe(true);
  });

  it('should return false for non-data URLs', () => {
    expect(isDataUrl('https://example.com/image.png')).toBe(false);
    expect(isDataUrl('/path/to/image.png')).toBe(false);
  });
});

describe('isBlobUrl', () => {
  it('should identify blob URLs', () => {
    expect(isBlobUrl('blob:http://example.com/abc-123')).toBe(true);
  });

  it('should return false for non-blob URLs', () => {
    expect(isBlobUrl('https://example.com/image.png')).toBe(false);
    expect(isBlobUrl('data:image/png;base64,abc')).toBe(false);
  });
});

describe('isAbsolutePath', () => {
  it('should identify Unix absolute paths', () => {
    expect(isAbsolutePath('/home/user/image.png')).toBe(true);
    expect(isAbsolutePath('/')).toBe(true);
  });

  it('should identify Windows absolute paths', () => {
    expect(isAbsolutePath('C:\\Users\\image.png')).toBe(true);
    expect(isAbsolutePath('D:/folder/image.png')).toBe(true);
    expect(isAbsolutePath('E:\\file.txt')).toBe(true);
  });

  it('should return false for relative paths', () => {
    expect(isAbsolutePath('./image.png')).toBe(false);
    expect(isAbsolutePath('../image.png')).toBe(false);
    expect(isAbsolutePath('folder/image.png')).toBe(false);
  });
});

describe('isLocalFilePath', () => {
  it('should identify local file paths', () => {
    expect(isLocalFilePath('/home/user/image.png')).toBe(true);
    expect(isLocalFilePath('./image.png')).toBe(true);
    expect(isLocalFilePath('../assets/image.png')).toBe(true);
  });

  it('should return false for remote/data/blob URLs', () => {
    expect(isLocalFilePath('http://example.com/image.png')).toBe(false);
    expect(isLocalFilePath('https://example.com/image.png')).toBe(false);
    expect(isLocalFilePath('data:image/png;base64,abc')).toBe(false);
    expect(isLocalFilePath('blob:http://example.com/abc')).toBe(false);
  });
});

describe('normalizeSeparators', () => {
  it('should convert backslashes to forward slashes', () => {
    expect(normalizeSeparators('C:\\Users\\file.txt')).toBe('C:/Users/file.txt');
    expect(normalizeSeparators('folder\\subfolder\\file.png')).toBe('folder/subfolder/file.png');
  });

  it('should keep forward slashes unchanged', () => {
    expect(normalizeSeparators('/home/user/file.txt')).toBe('/home/user/file.txt');
  });

  it('should handle mixed separators', () => {
    expect(normalizeSeparators('C:/Users\\file.txt')).toBe('C:/Users/file.txt');
  });
});

describe('resolveRelativePath', () => {
  it('should resolve simple relative paths', () => {
    expect(resolveRelativePath('./image.png', '/home/user')).toBe('/home/user/image.png');
    expect(resolveRelativePath('image.png', '/home/user')).toBe('/home/user/image.png');
  });

  it('should resolve parent directory references', () => {
    expect(resolveRelativePath('../image.png', '/home/user/docs')).toBe('/home/user/image.png');
    expect(resolveRelativePath('../../image.png', '/home/user/docs/sub')).toBe('/home/user/image.png');
  });

  it('should handle nested paths', () => {
    expect(resolveRelativePath('./assets/images/image.png', '/home/user/docs')).toBe('/home/user/docs/assets/images/image.png');
  });

  it('should resolve Windows paths without prepending /', () => {
    expect(resolveRelativePath('./image.png', 'C:/Users/user/docs')).toBe('C:/Users/user/docs/image.png');
    expect(resolveRelativePath('../image.png', 'C:/Users/user/docs')).toBe('C:/Users/user/image.png');
    expect(resolveRelativePath('assets/img.png', 'D:/projects/notes')).toBe('D:/projects/notes/assets/img.png');
  });
});

describe('resolveImagePath', () => {
  it('should return absolute paths unchanged', () => {
    expect(resolveImagePath('/home/user/image.png')).toBe('/home/user/image.png');
  });

  it('should resolve against current file path', () => {
    const result = resolveImagePath('./image.png', { currentFilePath: '/home/user/docs/file.md' });
    expect(result).toBe('/home/user/docs/image.png');
  });

  it('should resolve against workspace root', () => {
    const result = resolveImagePath('./image.png', { workspaceRoot: '/home/user/project' });
    expect(result).toBe('/home/user/project/image.png');
  });

  it('should return as-is if cannot resolve', () => {
    expect(resolveImagePath('./image.png')).toBe('./image.png');
  });

  it('should handle Windows absolute paths unchanged', () => {
    expect(resolveImagePath('C:/Users/user/image.png')).toBe('C:/Users/user/image.png');
  });

  it('should resolve relative paths against Windows current file', () => {
    const result = resolveImagePath('./image.png', { currentFilePath: 'C:/Users/user/docs/file.md' });
    expect(result).toBe('C:/Users/user/docs/image.png');
  });
});

describe('getDirectoryPath', () => {
  it('should extract directory from file path', () => {
    expect(getDirectoryPath('/home/user/file.txt')).toBe('/home/user');
    expect(getDirectoryPath('/home/user/docs/file.md')).toBe('/home/user/docs');
  });

  it('should return root for root-level files', () => {
    expect(getDirectoryPath('/file.txt')).toBe('/');
  });

  it('should handle paths without directories', () => {
    expect(getDirectoryPath('file.txt')).toBe('/');
  });
});

describe('getFileName', () => {
  it('should extract filename from path', () => {
    expect(getFileName('/home/user/file.txt')).toBe('file.txt');
    expect(getFileName('/home/user/docs/image.png')).toBe('image.png');
  });

  it('should return filename for simple paths', () => {
    expect(getFileName('file.txt')).toBe('file.txt');
  });

  it('should handle paths with Windows separators', () => {
    expect(getFileName('C:\\Users\\file.txt')).toBe('file.txt');
  });
});

describe('toRelativePath', () => {
  it('should convert to relative path', () => {
    expect(toRelativePath('/home/user/docs/file.md', '/home/user')).toBe('docs/file.md');
  });

  it('should handle parent directory traversal', () => {
    expect(toRelativePath('/home/user/file.md', '/home/user/docs/sub')).toBe('../../file.md');
  });

  it('should return absolute if no common prefix', () => {
    expect(toRelativePath('/var/log/file.log', '/home/user')).toBe('/var/log/file.log');
  });
});
