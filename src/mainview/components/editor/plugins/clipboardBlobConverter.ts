import { $prose } from '@milkdown/utils';
import { schemaCtx, serializerCtx } from '@milkdown/kit/core';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import { Slice } from '@milkdown/prose/model';
import { prepareForClipboard } from '@/lib/image/clipboard';
import { convertCodeBlockToFrontmatter } from '@/lib/frontmatter';

export function isPureText(content: unknown): boolean {
  if (!content) return false;
  if (Array.isArray(content)) {
    if (content.length > 1) return false;
    return isPureText(content[0]);
  }
  if (typeof content === 'object' && content !== null && 'content' in content) {
    return isPureText((content as any).content);
  }
  if (typeof content === 'object' && content !== null && 'type' in content) {
    return (content as any).type === 'text';
  }
  return false;
}

export const clipboardBlobConverter = $prose((ctx) => {
  const key = new PluginKey('CLIPBOARD_BLOB_CONVERTER');

  return new Plugin({
    key,
    props: {
      clipboardTextSerializer: (slice: Slice) => {
        // Mirror Milkdown's built-in clipboard behavior: if the slice is pure text
        // (e.g. a partial selection inside a code block), copy it as plain text
        // without wrapping it in markdown fences.
        if (isPureText(slice.content.toJSON())) {
          return (slice.content as any).textBetween(0, slice.content.size, '\n\n');
        }

        const serializer = ctx.get(serializerCtx);
        const schema = ctx.get(schemaCtx);

        const doc = schema.topNodeType.createAndFill(undefined, slice.content);
        if (!doc) return '';

        let markdown = serializer(doc);
        markdown = prepareForClipboard(markdown);
        markdown = convertCodeBlockToFrontmatter(markdown);
        return markdown;
      },
    },
  });
});
