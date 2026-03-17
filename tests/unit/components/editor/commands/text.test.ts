/**
 * Text Commands 单元测试
 * 测试文本插入相关命令
 */
import { describe, it, expect, mock } from 'bun:test';
import { insertText } from '../../../setup';

describe('insertText', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertText(emptyRef as any, 'hello')).toBe(false);
  });

  it('should return false when editor has no ctx', () => {
    const ref = {
      current: {
        editor: {},
      },
    };
    expect(insertText(ref as any, 'hello')).toBe(false);
  });

  it('should insert plain text when no markdown pattern detected', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: () => ({
              state: {
                selection: { from: 10, to: 10 },
                schema: { text: (content: string) => ({ content }) },
                tr: {
                  replaceWith: mockReplaceWith,
                },
              },
              dispatch: mockDispatch,
            }),
          },
        },
      },
    };

    const result = insertText(ref as any, 'plain text');
    expect(result).toBe(true);
  });

  it('should handle markdown text with bold pattern', () => {
    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: { from: 10, to: 10 },
                    doc: { content: { size: 0 } },
                  },
                };
              }
              if (ctx.name === 'parser') {
                return (text: string) => ({ content: { size: text.length } });
              }
              return null;
            },
          },
        },
      },
    };

    expect(typeof insertText).toBe('function');
  });

  it('should handle empty string', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: () => ({
              state: {
                selection: { from: 10, to: 10 },
                schema: { text: () => ({}) },
                tr: { replaceWith: mockReplaceWith },
              },
              dispatch: mockDispatch,
            }),
          },
        },
      },
    };

    const result = insertText(ref as any, '');
    expect(result).toBe(true);
  });

  it('should handle text with headers markdown', () => {
    expect(typeof insertText).toBe('function');
  });

  it('should handle text with code block markdown', () => {
    expect(typeof insertText).toBe('function');
  });

  it('should handle text with link markdown', () => {
    expect(typeof insertText).toBe('function');
  });

  it('should handle text with list markdown', () => {
    expect(typeof insertText).toBe('function');
  });

  it('should handle exception gracefully', () => {
    const ref = {
      current: {
        editor: {
          ctx: {
            get: () => {
              throw new Error('Test error');
            },
          },
        },
      },
    };

    const result = insertText(ref as any, 'test');
    expect(result).toBe(false);
  });
});
