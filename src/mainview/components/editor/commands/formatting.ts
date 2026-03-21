/**
 * 格式化命令
 * 包括: bold, italic, heading, quote, code, link, list
 */
import { Crepe } from '@milkdown/crepe';
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  linkSchema,
  insertImageCommand,
  wrapInHeadingCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  codeBlockSchema,
} from '@milkdown/preset-commonmark';
import { linkTooltipAPI } from '@milkdown/kit/component/link-tooltip';
import { toggleStrikethroughCommand } from '@milkdown/preset-gfm';
import {
  toggleHighlightCommand,
  toggleSuperscriptCommand,
  toggleSubscriptCommand,
} from '../plugins/inlineMarksPlugin';
import { editorViewCtx } from '@milkdown/kit/core';
import { setBlockType } from '@milkdown/prose/commands';
import { TextSelection, NodeSelection } from '@milkdown/kit/prose/state';
import { execCommand, insertParsedMarkdown } from '../utils/editorActions';

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

// ===== Inline Code - 使用 Milkdown 内置命令 =====

export function toggleCode(crepeRef: React.RefObject<Crepe | null>): boolean {
  return execCommand(crepeRef, toggleInlineCodeCommand);
}

// ===== 代码块命令（自定义实现） =====

export function toggleCodeBlock(crepeRef: React.RefObject<Crepe | null>): boolean {
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

// ===== 扩展格式化命令 =====

export function toggleStrikethrough(crepeRef: React.RefObject<Crepe | null>): boolean {
  return execCommand(crepeRef, toggleStrikethroughCommand);
}

// ===== 链接命令 - 使用 linkTooltipAPI =====

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

// ===== 暂不支持的功能 =====

export function toggleUnderline(_crepeRef: React.RefObject<Crepe | null>): boolean {
  // Underline is not a standard Markdown feature
  // Would require custom mark plugin
  console.warn('Underline is not supported in standard Markdown');
  return false;
}

export function toggleHighlight(crepeRef: React.RefObject<Crepe | null>): boolean {
  return execCommand(crepeRef, toggleHighlightCommand);
}

export function toggleSuperscript(crepeRef: React.RefObject<Crepe | null>): boolean {
  return execCommand(crepeRef, toggleSuperscriptCommand);
}

export function toggleSubscript(crepeRef: React.RefObject<Crepe | null>): boolean {
  return execCommand(crepeRef, toggleSubscriptCommand);
}

export function insertInlineMath(crepeRef: React.RefObject<Crepe | null>): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  try {
    return editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const { state } = view;
      const mathInlineType = state.schema.nodes['math_inline'];
      if (!mathInlineType) return false;

      const { from, to } = state.selection;
      const selectedText = from === to ? 'E=mc^2' : state.doc.textBetween(from, to);
      const node = mathInlineType.create({ value: selectedText });
      const tr = state.tr.replaceSelectionWith(node);
      tr.setSelection(NodeSelection.create(tr.doc, from));
      view.dispatch(tr);
      view.focus();
      return true;
    });
  } catch (e) {
    console.error('insertInlineMath failed:', e);
    return false;
  }
}

export function insertComment(_crepeRef: React.RefObject<Crepe | null>): boolean {
  // HTML comments are not supported in Milkdown's default schema
  console.warn('HTML comments are not supported');
  return false;
}

// ===== 暂不支持的功能 =====

export function insertLocalImage(_crepeRef: React.RefObject<Crepe | null>): boolean {
  // TODO: Implement local image insertion dialog
  console.warn('Local image insertion not implemented yet');
  return false;
}

// ===== 插入图片 =====

export function insertImage(
  crepeRef: React.RefObject<Crepe | null>,
  src: string,
  alt: string = '',
  title: string = ''
): boolean {
  return execCommand(crepeRef, insertImageCommand, { src, alt, title });
}
