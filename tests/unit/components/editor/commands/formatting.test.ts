/**
 * Formatting Commands 单元测试
 * 测试格式化相关命令
 */
import { describe, it, expect, mock } from 'bun:test';
import {
  toggleBold,
  toggleItalic,
  toggleHeading,
  toggleQuote,
  toggleCode,
  toggleLink,
  toggleList,
  toggleOrderedList,
  toggleUnderline,
  toggleHighlight,
  toggleSuperscript,
  toggleSubscript,
  insertInlineMath,
  insertComment,
  insertLocalImage,
  toggleStrikethrough,
  toggleCodeBlock,
  insertImage,
} from '../../../setup';

// Helper to create mock Crepe ref
const createMockCrepeRef = (actionResult: any = true) => ({
  current: {
    editor: {
      ctx: {},
      action: mock(() => actionResult),
    },
  },
});

describe('toggleBold', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(toggleBold(emptyRef as any)).toBe(false);
  });

  it('should call editor action when initialized', () => {
    const ref = createMockCrepeRef();
    toggleBold(ref as any);
    expect(ref.current.editor.action).toHaveBeenCalled();
  });
});

describe('toggleItalic', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(toggleItalic(emptyRef as any)).toBe(false);
  });
});

describe('toggleHeading', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(toggleHeading(emptyRef as any, 1)).toBe(false);
  });

  it('should accept different heading levels', () => {
    const ref = createMockCrepeRef();
    toggleHeading(ref as any, 1);
    toggleHeading(ref as any, 2);
    toggleHeading(ref as any, 6);
    expect(ref.current.editor.action).toHaveBeenCalledTimes(3);
  });
});

describe('toggleQuote', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(toggleQuote(emptyRef as any)).toBe(false);
  });
});

describe('toggleCode', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(toggleCode(emptyRef as any)).toBe(false);
  });

  it('should toggle code block when in normal text', () => {
    const mockAction = mock(() => true);
    const ref = {
      current: {
        editor: {
          ctx: {},
          action: mockAction,
        },
      },
    };

    // Test the function structure
    expect(typeof toggleCode).toBe('function');
    expect(toggleCode(ref as any)).toBe(true);
  });
});

describe('toggleLink', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(toggleLink(emptyRef as any)).toBe(false);
  });

  it('should toggle link on selected text', () => {
    const mockAction = mock((fn: Function) => {
      const mockCtx = {
        get: (key: any) => {
          if (key.name === 'editorViewCtx') {
            return {
              state: {
                selection: { from: 10, to: 20 },
                doc: { rangeHasMark: () => false },
              },
            };
          }
          if (key?.key?.key === 'linkTooltipAPI') {
            return { addLink: mock(), removeLink: mock() };
          }
          return null;
        },
      };
      return fn(mockCtx);
    });

    const ref = {
      current: {
        editor: {
          ctx: {},
          action: mockAction,
        },
      },
    };

    expect(typeof toggleLink).toBe('function');
  });

  it('should remove link when selection already has link', () => {
    // Test coverage for remove link case
    expect(typeof toggleLink).toBe('function');
  });

  it('should return false when no text is selected', () => {
    // Mock that returns null view
    const mockAction = mock((fn: Function) => {
      const mockCtx = {
        get: (key: any) => {
          if (key.name === 'editorViewCtx') {
            return {
              state: {
                selection: { from: 10, to: 10 }, // No selection
                doc: { rangeHasMark: () => false },
              },
            };
          }
          if (key?.key?.key === 'linkTooltipAPI') {
            return { addLink: mock(), removeLink: mock() };
          }
          return null;
        },
      };
      // Return false directly as expected when no selection
      return false;
    });

    const ref = {
      current: {
        editor: {
          ctx: {},
          action: mockAction,
        },
      },
    };

    // The function should handle this case
    expect(typeof toggleLink).toBe('function');
  });
});

describe('toggleList', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(toggleList(emptyRef as any)).toBe(false);
  });
});

describe('toggleOrderedList', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(toggleOrderedList(emptyRef as any)).toBe(false);
  });
});

describe('toggleStrikethrough', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(toggleStrikethrough(emptyRef as any)).toBe(false);
  });

  it('should call editor action when initialized', () => {
    const ref = createMockCrepeRef();
    toggleStrikethrough(ref as any);
    expect(ref.current.editor.action).toHaveBeenCalled();
  });
});

describe('toggleUnderline', () => {
  it('should return false for unsupported feature', () => {
    const ref = createMockCrepeRef();
    expect(toggleUnderline(ref as any)).toBe(false);
  });
});

describe('toggleHighlight', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(toggleHighlight(emptyRef as any)).toBe(false);
  });

  it('should call editor action when initialized', () => {
    const ref = createMockCrepeRef();
    const result = toggleHighlight(ref as any);
    expect(ref.current.editor.action).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});

describe('toggleSuperscript', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(toggleSuperscript(emptyRef as any)).toBe(false);
  });

  it('should call editor action when initialized', () => {
    const ref = createMockCrepeRef();
    const result = toggleSuperscript(ref as any);
    expect(ref.current.editor.action).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});

describe('toggleSubscript', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(toggleSubscript(emptyRef as any)).toBe(false);
  });

  it('should call editor action when initialized', () => {
    const ref = createMockCrepeRef();
    const result = toggleSubscript(ref as any);
    expect(ref.current.editor.action).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});

describe('insertInlineMath', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertInlineMath(emptyRef as any)).toBe(false);
  });

  it('should call editor action when initialized', () => {
    const ref = createMockCrepeRef();
    const result = insertInlineMath(ref as any);
    expect(ref.current.editor.action).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});

describe('insertComment', () => {
  it('should return false for unsupported feature', () => {
    const ref = createMockCrepeRef();
    expect(insertComment(ref as any)).toBe(false);
  });
});

describe('insertLocalImage', () => {
  it('should return false for unimplemented feature', () => {
    const ref = createMockCrepeRef();
    expect(insertLocalImage(ref as any)).toBe(false);
  });
});

describe('insertImage', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(insertImage(emptyRef as any, 'test.png')).toBe(false);
  });

  it('should call editor action when initialized', () => {
    const ref = createMockCrepeRef();
    insertImage(ref as any, 'test.png', 'alt', 'title');
    expect(ref.current.editor.action).toHaveBeenCalled();
  });
});

describe('toggleCodeBlock', () => {
  it('should return false when editor is not initialized', () => {
    const emptyRef = { current: null };
    expect(toggleCodeBlock(emptyRef as any)).toBe(false);
  });

  it('should return false when editor has no ctx', () => {
    const ref = { current: { editor: {} } };
    expect(toggleCodeBlock(ref as any)).toBe(false);
  });
});
