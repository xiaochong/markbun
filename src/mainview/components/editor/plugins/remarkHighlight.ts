import { visit } from 'unist-util-visit';
import type { Root, Text, Parent } from 'mdast';
import type { Plugin } from 'unified';

/**
 * Remark plugin to parse ==text== as highlight nodes.
 * Transforms text nodes containing ==...== into {type: 'highlight'} AST nodes.
 */
const remarkHighlight: Plugin<[], Root> = function () {
  return (tree) => {
    visit(tree, 'text', (node: Text, index: number | null, parent: Parent | null) => {
      if (index === null || !parent) return;

      const value = node.value;
      const re = /==([^=\n]+)==/g;
      const parts: any[] = [];
      let lastIndex = 0;
      let match;

      while ((match = re.exec(value)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }
        parts.push({
          type: 'highlight',
          children: [{ type: 'text', value: match[1] }],
        });
        lastIndex = match.index + match[0].length;
      }

      if (parts.length === 0) return;

      if (lastIndex < value.length) {
        parts.push({ type: 'text', value: value.slice(lastIndex) });
      }

      parent.children.splice(index, 1, ...(parts as any));
      return index + parts.length;
    });
  };
};

export default remarkHighlight;
