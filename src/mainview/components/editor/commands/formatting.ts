/**
 * 格式化命令
 * 包括: bold, italic, heading, quote, code, link, list
 */
import { Crepe } from '@milkdown/crepe';
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  codeBlockSchema,
  linkSchema,
} from '@milkdown/preset-commonmark';
import { linkTooltipAPI } from '@milkdown/kit/component/link-tooltip';
import { editorViewCtx } from '@milkdown/kit/core';
import { setBlockType } from '@milkdown/prose/commands';
import { execCommand } from '../utils/editorActions';

// ===== 简单格式化命令 =====

export function toggleBold(crepeRef: React.RefObject<Crepe | null>): boolean {
  return execCommand(crepeRef, toggleStrongCommand);
}

export function toggleItalic(crepeRef: React.RefObject<Crepe | null>): boolean {
  return execCommand(crepeRef, toggleEmphasisCommand);
}

export function toggleHeading(
  crepeRef: React.RefObject<Crepe | null>,
  level: number
): boolean {
  return execCommand(crepeRef, wrapInHeadingCommand, level);
}

export function toggleQuote(crepeRef: React.RefObject<Crepe | null>): boolean {
  return execCommand(crepeRef, wrapInBlockquoteCommand);
}

export function toggleList(crepeRef: React.RefObject<Crepe | null>): boolean {
  return execCommand(crepeRef, wrapInBulletListCommand);
}

export function toggleOrderedList(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  return execCommand(crepeRef, wrapInOrderedListCommand);
}

// ===== 代码块命令（自定义实现） =====

export function toggleCode(crepeRef: React.RefObject<Crepe | null>): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const { from, to } = state.selection;

    // Get the code block node type
    const codeBlockType = codeBlockSchema.type(ctx);

    // Check if we're already inside a code block
    let inCodeBlock = false;
    state.doc.nodesBetween(from, to, (node) => {
      if (node.type === codeBlockType) {
        inCodeBlock = true;
        return false;
      }
    });

    if (inCodeBlock) {
      // If already in code block, convert back to paragraph
      const paragraphType = state.schema.nodes.paragraph;
      if (!paragraphType) return false;
      return setBlockType(paragraphType)(state, view.dispatch.bind(view));
    }

    // Collect all text content from selected blocks
    const lines: string[] = [];
    state.doc.nodesBetween(from, to, (node) => {
      if (node.isBlock && node.textContent) {
        lines.push(node.textContent);
      } else if (node.isBlock && node.isTextblock) {
        lines.push('');
      }
    });

    const codeContent = lines.join('\n');

    // Find the start and end positions for block-level replacement
    const $from = state.doc.resolve(from);
    const $to = state.doc.resolve(to);
    const startBlockPos = $from.before($from.depth);
    const endBlockPos = $to.after($to.depth);

    // Create the code block with the collected text
    const { TextSelection } = require('@milkdown/prose/state');
    const codeBlockNode = codeBlockType.create(
      { language: '' },
      state.schema.text(codeContent)
    );

    // Replace the selected range with the code block
    const tr = state.tr.replaceRangeWith(startBlockPos, endBlockPos, codeBlockNode);

    // Set selection inside the code block
    const newPos = tr.mapping.map(startBlockPos) + 1;
    tr.setSelection(TextSelection.create(tr.doc, newPos));

    view.dispatch(tr);
    return true;
  });
}

// ===== 链接命令 =====

export function toggleLink(
  crepeRef: React.RefObject<Crepe | null>,
  _href?: string,
  _title?: string
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const { from, to } = state.selection;

    // Check if there's a selection
    if (from === to) return false;

    // Check if selection has link
    const mark = linkSchema.type(ctx);
    const hasLink = state.doc.rangeHasMark(from, to, mark);

    const api = ctx.get(linkTooltipAPI.key);
    if (hasLink) {
      api.removeLink(from, to);
    } else {
      api.addLink(from, to);
    }
    return true;
  });
}
