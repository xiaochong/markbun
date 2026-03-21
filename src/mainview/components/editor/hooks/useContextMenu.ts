import { useEffect, RefObject } from 'react';
import { Crepe } from '@milkdown/crepe';
import { editorViewCtx, serializerCtx, schemaCtx } from '@milkdown/kit/core';
import { electrobun } from '../../../lib/electrobun';

// Global variable to store selection state before context menu opens
// This is needed because the selection might be lost when the menu is clicked
declare global {
  interface Window {
    __pendingEditorSelection?: {
      text: string;
      hasBlobUrl: boolean;
    } | null;
    __pendingTableCellText?: string | null;
  }
}

export function useContextMenu(
  crepeRef: RefObject<Crepe | null>,
  containerRef: RefObject<HTMLDivElement | null>
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleContextMenu = (e: MouseEvent) => {
      const editor = crepeRef.current?.editor;
      if (!editor?.ctx) return;

      // Check if click is inside the editor
      const target = e.target as HTMLElement;
      if (!target.closest('.ProseMirror')) return;

      // Save current selection before showing menu
      // This is important because clicking the menu may cause selection to be lost
      const selection = window.getSelection();

      if (selection && !selection.isCollapsed) {
        // Try to get markdown-formatted selection from Milkdown
        let selectedMarkdown: string | null = null;

        try {
          const editor = crepeRef.current?.editor;
          if (editor?.ctx) {
            // Get ProseMirror view and check selection
            const view = editor.ctx.get(editorViewCtx);
            const { from, to, empty } = view.state.selection;

            if (!empty && from !== to) {
              // Get serializer and schema
              const serializer = editor.ctx.get(serializerCtx);
              const schema = editor.ctx.get(schemaCtx);

              // Create a temporary document with the selected content
              const slice = view.state.selection.content();
              const doc = schema.topNodeType.createAndFill(undefined, slice.content);

              if (doc) {
                // Serialize to markdown
                selectedMarkdown = serializer(doc);
              }
            }
          }
        } catch {
          // Silently ignore markdown extraction errors
        }

        // Fallback to plain text if markdown extraction failed
        const textToSave = selectedMarkdown || selection.toString();

        window.__pendingEditorSelection = {
          text: textToSave,
          hasBlobUrl: textToSave.includes('blob:http'),
        };
      } else {
        window.__pendingEditorSelection = null;
      }

      // Use the click position to check if it's inside a table, and extract cell text
      const tableClickInfo = editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);

        // Get document position at click coordinates
        const coords = { left: e.clientX, top: e.clientY };
        const posAtCoords = view.posAtCoords(coords);
        if (!posAtCoords) return { isInTable: false, cellText: null };

        const { pos } = posAtCoords;
        const $pos = view.state.doc.resolve(pos);

        let cellText: string | null = null;

        // Traverse up to find table cell and table node
        for (let d = $pos.depth; d >= 0; d--) {
          const node = $pos.node(d);
          if ((node.type.name === 'table_cell' || node.type.name === 'table_header') && cellText === null) {
            cellText = node.textContent;
          }
          if (node.type.name === 'table') {
            return { isInTable: true, cellText };
          }
        }
        return { isInTable: false, cellText: null };
      });

      if (tableClickInfo.isInTable) {
        window.__pendingTableCellText = tableClickInfo.cellText;
        e.preventDefault();
        electrobun.showTableContextMenu();
      } else {
        window.__pendingTableCellText = null;
        // Show our custom default menu instead of browser's native menu
        e.preventDefault();
        electrobun.showDefaultContextMenu();
      }
    };

    container.addEventListener('contextmenu', handleContextMenu);
    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [crepeRef, containerRef]);
}
