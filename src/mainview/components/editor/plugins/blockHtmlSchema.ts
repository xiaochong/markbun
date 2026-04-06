import { codeBlockSchema } from '@milkdown/kit/preset/commonmark';

/**
 * Extend codeBlockSchema so that language="html" blocks serialize back
 * to raw HTML nodes (not fenced code blocks) in markdown output.
 */
export const blockHtmlSchema = codeBlockSchema.extendSchema((prev) => {
  return (ctx) => {
    const baseSchema = prev(ctx);
    return {
      ...baseSchema,
      toMarkdown: {
        match: baseSchema.toMarkdown.match,
        runner: (state, node) => {
          const language = node.attrs.language ?? '';
          if (language.toLowerCase() === 'html') {
            state.addNode(
              'html',
              undefined,
              node.content.firstChild?.text || ''
            );
          } else {
            return baseSchema.toMarkdown.runner(state, node);
          }
        },
      },
    };
  };
});
