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
 * Insert text or markdown at the current cursor position
 * If text contains markdown syntax, it will be parsed and rendered
 *
 * Logic:
 * - Single-paragraph parsed content: insert inline at cursor (no new block)
 * - Multi-paragraph / block-level content: insert as blocks
 */
export function insertText(crepeRef: CrepeRef, text: string): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  try {
    const view = editor.ctx.get(editorViewCtx);
    const { from, to } = view.state.selection;
    const { $from } = view.state.selection;

    // Inside a code block, always insert as plain text to avoid breaking the block.
    if ($from.parent.type.name === 'code_block' || $from.parent.type.name === 'fence') {
      const tr = view.state.tr.replaceWith(from, to, view.state.schema.text(text));
      view.dispatch(tr);
      return true;
    }

    // Check if text contains markdown
    if (containsMarkdown(text)) {
      // Parse markdown and insert as nodes
      const parser = editor.ctx.get(parserCtx);
      const doc = parser(text);

      if (doc && doc.content.size > 0) {
        // If parsed content is a single paragraph, insert its inline content
        // at the cursor to avoid creating a new block (new line).
        if (doc.childCount === 1 && doc.firstChild?.type.name === 'paragraph') {
          const tr = view.state.tr.replaceWith(from, to, doc.firstChild.content);
          view.dispatch(tr);
        } else {
          // Block-level content (headings, lists, multi-paragraph)
          const tr = view.state.tr.replaceWith(from, to, doc.content);
          view.dispatch(tr);
        }
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
