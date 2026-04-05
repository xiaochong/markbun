import { $prose } from '@milkdown/utils';
import { schemaCtx, serializerCtx } from '@milkdown/kit/core';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import { Slice } from '@milkdown/prose/model';
import { prepareForClipboard } from '@/lib/image/clipboard';
import { convertCodeBlockToFrontmatter } from '@/lib/frontmatter';

export const clipboardBlobConverter = $prose((ctx) => {
  const key = new PluginKey('CLIPBOARD_BLOB_CONVERTER');

  return new Plugin({
    key,
    props: {
      clipboardTextSerializer: (slice: Slice) => {
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
