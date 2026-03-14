import { useEffect, RefObject } from 'react';
import { Crepe } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import { electrobun } from '../../../lib/electrobun';

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

      // Use the click position to check if it's inside a table
      const isInTableAtClick = editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);

        // Get document position at click coordinates
        const coords = { left: e.clientX, top: e.clientY };
        const posAtCoords = view.posAtCoords(coords);
        if (!posAtCoords) return false;

        const { pos } = posAtCoords;
        const $pos = view.state.doc.resolve(pos);

        // Traverse up to find table node
        for (let d = $pos.depth; d >= 0; d--) {
          const node = $pos.node(d);
          if (node.type.name === 'table') {
            return true;
          }
        }
        return false;
      });

      if (isInTableAtClick) {
        e.preventDefault();
        electrobun.showTableContextMenu();
      }
      // Otherwise, let the default browser context menu show
    };

    container.addEventListener('contextmenu', handleContextMenu);
    return () => {
      container.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [crepeRef, containerRef]);
}
