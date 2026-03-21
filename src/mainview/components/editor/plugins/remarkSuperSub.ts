import { visit } from 'unist-util-visit';
import type { Root, Text, Parent } from 'mdast';
import type { Plugin } from 'unified';

/**
 * Remark plugin to parse ^text^ as superscript and ~text~ as subscript nodes.
 * Note: GFM strikethrough uses ~~double~~ tilde, so single ~ is safe for subscript.
 */
const remarkSuperSub: Plugin<[], Root> = function () {
  return (tree) => {
    // Process superscript: ^text^
    visit(tree, 'text', (node: Text, index: number | null, parent: Parent | null) => {
      if (index === null || !parent) return;

      const value = node.value;
      const re = /\^([^\^\n]+)\^/g;
      const parts: any[] = [];
      let lastIndex = 0;
      let match;

      while ((match = re.exec(value)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }
        parts.push({
          type: 'superscript',
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

    // Process subscript: ~text~ (single tilde, not double)
    visit(tree, 'text', (node: Text, index: number | null, parent: Parent | null) => {
      if (index === null || !parent) return;

      const value = node.value;
      // Match single ~ but not ~~ (negative lookahead/lookbehind)
      const re = /(?<!~)~([^~\n]+)~(?!~)/g;
      const parts: any[] = [];
      let lastIndex = 0;
      let match;

      while ((match = re.exec(value)) !== null) {
        if (match.index > lastIndex) {
          parts.push({ type: 'text', value: value.slice(lastIndex, match.index) });
        }
        parts.push({
          type: 'subscript',
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

export default remarkSuperSub;
