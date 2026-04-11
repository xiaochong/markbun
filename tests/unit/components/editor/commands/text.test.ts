/**
 * Text Commands 单元测试
 * 测试文本插入相关命令
 */
import { describe, it, expect, mock } from 'bun:test';
import { insertText } from '../../../setup';

// Test the containsMarkdown function through insertText behavior
// The containsMarkdown function is internal but we can test markdown detection

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
                selection: {
                  from: 10,
                  to: 10,
                  $from: {
                    parent: { type: { name: 'paragraph' } },
                  },
                },
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

  it('should handle markdown text with bold pattern **text**', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: {
                        end: () => 10,
                      },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '**bold text**');
    expect(result).toBe(true);
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
                selection: {
                  from: 10,
                  to: 10,
                  $from: {
                    parent: { type: { name: 'paragraph' } },
                  },
                },
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

  it('should handle text with headers markdown (# Header)', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '# Header');
    expect(result).toBe(true);
  });

  it('should handle text with code block markdown', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '```code block```');
    expect(result).toBe(true);
  });

  it('should handle text with link markdown [text](url)', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '[link](http://example.com)');
    expect(result).toBe(true);
  });

  it('should handle text with list markdown (- item)', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '- list item');
    expect(result).toBe(true);
  });

  it('should handle text with italic markdown *text*', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '*italic text*');
    expect(result).toBe(true);
  });

  it('should handle text with inline code `code`', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '`inline code`');
    expect(result).toBe(true);
  });

  it('should handle text with image markdown ![alt](src)', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '![alt text](image.png)');
    expect(result).toBe(true);
  });

  it('should handle text with ordered list markdown', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '1. ordered item');
    expect(result).toBe(true);
  });

  it('should handle text with blockquote markdown', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '> blockquote');
    expect(result).toBe(true);
  });

  it('should handle text with strikethrough markdown ~~text~~', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '~~strikethrough~~');
    expect(result).toBe(true);
  });

  it('should handle text with horizontal rule markdown', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '---');
    expect(result).toBe(true);
  });

  it('should handle text with table markdown |col|', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '| cell | cell |');
    expect(result).toBe(true);
  });

  it('should handle text with triple backtick code block', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '```\ncode block\n```');
    expect(result).toBe(true);
  });

  it('should handle text with h2-h6 headers', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    expect(insertText(ref as any, '## H2')).toBe(true);
    expect(insertText(ref as any, '### H3')).toBe(true);
    expect(insertText(ref as any, '#### H4')).toBe(true);
    expect(insertText(ref as any, '##### H5')).toBe(true);
    expect(insertText(ref as any, '###### H6')).toBe(true);
  });

  it('should handle text with star list (* item)', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '* star list item');
    expect(result).toBe(true);
  });

  it('should handle text with plus list (+ item)', () => {
    const mockDispatch = mock(() => {});
    const mockReplaceWith = mock(() => ({ dispatch: mockDispatch }));

    const ref = {
      current: {
        editor: {
          ctx: {
            get: (ctx: any) => {
              if (ctx.name === 'editorView') {
                return {
                  state: {
                    selection: {
                      from: 10,
                      to: 10,
                      $from: {
                        parent: { type: { name: 'paragraph' } },
                        depth: 1,
                        node: () => ({
                          type: { name: 'paragraph' },
                          textContent: '',
                        }),
                        before: () => 0,
                        after: () => 2,
                      },
                      $to: { end: () => 10 },
                    },
                    tr: {
                      replaceWith: mockReplaceWith,
                      delete: () => ({ replaceWith: mockReplaceWith }),
                    },
                    schema: { text: () => ({}) },
                  },
                  dispatch: mockDispatch,
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

    const result = insertText(ref as any, '+ plus list item');
    expect(result).toBe(true);
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
