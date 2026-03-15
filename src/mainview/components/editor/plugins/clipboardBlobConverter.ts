import { $prose } from '@milkdown/utils';
import { schemaCtx, serializerCtx } from '@milkdown/kit/core';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import { Slice } from '@milkdown/prose/model';
import { prepareForClipboard } from '@/lib/image';

/**
 * Milkdown plugin to convert blob URLs back to original paths when copying
 *
 * This plugin provides a clipboardTextSerializer that:
 * 1. Uses Milkdown's serializer to convert the slice to markdown
 * 2. Converts blob URLs back to original paths in the output
 */
export const clipboardBlobConverter = $prose((ctx) => {
  const key = new PluginKey('CLIPBOARD_BLOB_CONVERTER');

  return new Plugin({
    key,
    props: {
      clipboardTextSerializer: (slice: Slice) => {
        // Get Milkdown's serializer from context
        const serializer = ctx.get(serializerCtx);
        const schema = ctx.get(schemaCtx);

        // Create a temporary document containing the slice content
        const doc = schema.topNodeType.createAndFill(undefined, slice.content);
        if (!doc) return '';

        // Serialize to markdown
        let markdown = serializer(doc);

        // Convert blob URLs to original paths
        return prepareForClipboard(markdown);
      },
    },
  });
});
