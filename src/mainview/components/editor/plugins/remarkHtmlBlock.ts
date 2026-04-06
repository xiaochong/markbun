import { visit } from 'unist-util-visit';
import type { Node } from 'unist';
import type { Root } from 'mdast';
import type { Plugin } from 'unified';

const BLOCK_CONTAINER_TYPES = new Set(['root', 'blockquote', 'listItem']);

/**
 * Remark plugin to transform block-level raw HTML nodes into HTML code blocks.
 * This MUST run before Milkdown's built-in remarkHtmlTransformer,
 * which wraps block-level html nodes in paragraphs.
 *
 * Only transforms html nodes whose parent is a block container (root, blockquote, listItem).
 * Inline html nodes inside paragraphs/headings are left untouched.
 */
const remarkHtmlBlock: Plugin<[], Root> = function () {
  return (tree) => {
    visit(tree, 'html', (node: Node & { value: string }, index: number | null, parent: Node & { children: Node[]; type: string } | null) => {
      if (index === null || !parent) return;
      if (!BLOCK_CONTAINER_TYPES.has(parent.type)) return;

      const newNode = {
        type: 'code',
        lang: 'html',
        value: node.value,
      };

      parent.children.splice(index, 1, newNode as Node);
    });
  };
};

export default remarkHtmlBlock;
