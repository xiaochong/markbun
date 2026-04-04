/**
 * Turndown HTML-to-Markdown conversion service
 *
 * Provides a pre-configured TurndownService instance for converting
 * pasted HTML content to markdown.
 */

import TurndownService from 'turndown';

export const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

// Strip Google Docs internal wrapper
turndownService.addRule('googleDocs', {
  filter: (node) => {
    return node.nodeName === 'B' && !!node.getAttribute('id')?.startsWith('docs-internal-guid-');
  },
  replacement: (content) => content,
});

// Handle <br> in table cells
turndownService.addRule('tableBr', {
  filter: 'br',
  replacement: (content, node) => {
    // Check if we're inside a table cell
    let parent = node.parentNode;
    while (parent) {
      if (parent.nodeName === 'TD' || parent.nodeName === 'TH') {
        return '\n';
      }
      parent = parent.parentNode;
    }
    return '';
  },
});
