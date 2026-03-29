/**
 * Text insertion commands for Milkdown editor
 */

import type { CrepeRef } from '../types';

import { editorViewCtx, parserCtx } from '@milkdown/kit/core';

// Markdown pattern detection regex
const MARKDOWN_PATTERNS = [
  /^#{1,6}\s/m,           // Headers
  /\*\*.*?\*\*/m,         // Bold
  /\*.*?\*/m,             // Italic
  /`{1,3}[^`]+`{1,3}/m,   // Inline code / code block
  /\[.*?\]\(.*?\)/m,      // Links
  /!\[.*?\]\(.*?\)/m,     // Images
  /^\s*[-*+]\s/m,         // Lists
  /^\s*\d+\.\s/m,         // Ordered lists
  /^\s*>\s/m,             // Blockquotes
  /^\s*```/m,             // Code blocks
  /~~.*?~~/m,             // Strikethrough
  /^\s*---\s*$/m,         // Horizontal rule
  /^\|.*\|$/m,            // Tables
];

/**
 * Check if text contains markdown syntax
 */
function containsMarkdown(text: string): boolean {
  return MARKDOWN_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if current position is in an empty paragraph
 */
function isInEmptyParagraph(view: any): boolean {
  const { $from } = view.state.selection;
  // Get the paragraph node at current depth
  const depth = $from.depth;
  const paraNode = $from.node(depth);

  // Check if it's a paragraph and has no content (or only whitespace)
  if (paraNode?.type?.name === 'paragraph') {
    const textContent = paraNode.textContent || '';
    return textContent.trim() === '';
  }
  return false;
}

/**
 * Insert text or markdown at the current cursor position
 * If text contains markdown syntax, it will be parsed and rendered
 *
 * Logic:
 * - If current cursor is in an empty paragraph: insert at current position
 * - If current paragraph has content: create new paragraph and insert there
 */
export function insertText(crepeRef: CrepeRef, text: string): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  try {
    const view = editor.ctx.get(editorViewCtx);
    const { from, to } = view.state.selection;

    // Check if text contains markdown
    if (containsMarkdown(text)) {
      // Parse markdown and insert as nodes
      const parser = editor.ctx.get(parserCtx);
      const doc = parser(text);

      if (doc && doc.content.size > 0) {
        // Check if we need to create a new paragraph
        const inEmptyParagraph = isInEmptyParagraph(view);

        let insertPos = from;
        let tr = view.state.tr;

        if (!inEmptyParagraph) {
          // Current paragraph has content, insert at end of current paragraph
          const { $to } = view.state.selection;
          insertPos = $to.end();
        } else {
          // In empty paragraph, replace the entire empty paragraph node
          const { $from } = view.state.selection;
          // Get paragraph node boundaries (before/after give the positions including the node itself)
          const paraStart = $from.before();
          const paraEnd = $from.after();
          // Delete the empty paragraph
          tr = tr.delete(paraStart, paraEnd);
          // Insert at the position where the paragraph was
          insertPos = paraStart;
        }

        // Insert parsed content
        tr = tr.replaceWith(insertPos, insertPos, doc.content);
        view.dispatch(tr);
        return true;
      }
    }

    // Plain text insertion
    const tr = view.state.tr.replaceWith(from, to, view.state.schema.text(text));
    view.dispatch(tr);

    return true;
  } catch {
    return false;
  }
}
