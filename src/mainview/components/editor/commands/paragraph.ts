/**
 * 段落相关命令
 * 包括: setParagraph, headingLevel, insertTable, insertCodeBlock 等
 */
import { Crepe } from '@milkdown/crepe';
import { paragraphSchema } from '@milkdown/preset-commonmark';
import { wrapInHeadingCommand } from '@milkdown/preset-commonmark';
import { editorViewCtx } from '@milkdown/kit/core';
import { setBlockType } from '@milkdown/prose/commands';
import { TextSelection } from '@milkdown/prose/state';
import { insertParsedMarkdown } from '../utils/editorActions';

// ===== 段落设置命令 =====

export function setParagraph(crepeRef: React.RefObject<Crepe | null>): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const paragraphType = paragraphSchema.type(ctx);
    if (!paragraphType) return false;
    return setBlockType(paragraphType)(state, view.dispatch.bind(view));
  });
}

// ===== 标题级别命令 =====

export function increaseHeadingLevel(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const { from, to } = state.selection;

    // Find current heading level
    let currentLevel = 0;
    state.doc.nodesBetween(from, to, (node) => {
      if (node.type.name.startsWith('heading')) {
        currentLevel = node.attrs.level || 0;
        return false;
      }
    });

    const newLevel = currentLevel > 0 ? Math.min(currentLevel + 1, 6) : 1;
    const { callCommand } = require('@milkdown/utils');
    return callCommand(wrapInHeadingCommand.key, newLevel)(ctx);
  });
}

export function decreaseHeadingLevel(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const { from, to } = state.selection;

    // Find current heading level
    let currentLevel = 0;
    state.doc.nodesBetween(from, to, (node) => {
      if (node.type.name.startsWith('heading')) {
        currentLevel = node.attrs.level || 0;
        return false;
      }
    });

    if (currentLevel <= 1) {
      // Convert to paragraph
      const paragraphType = paragraphSchema.type(ctx);
      if (!paragraphType) return false;
      return setBlockType(paragraphType)(state, view.dispatch.bind(view));
    }

    const newLevel = currentLevel - 1;
    const { callCommand } = require('@milkdown/utils');
    return callCommand(wrapInHeadingCommand.key, newLevel)(ctx);
  });
}

// ===== 插入命令 =====

export function insertTable(crepeRef: React.RefObject<Crepe | null>): boolean {
  return insertParsedMarkdown(
    crepeRef,
    '\n| Column 1 | Column 2 | Column 3 |\n|----------|----------|----------|\n|          |          |          |\n',
    false
  );
}

export function insertMathBlock(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  return insertParsedMarkdown(crepeRef, '\n$$\nE=mc^2\n$$\n', true);
}

export function insertCodeBlock(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  return insertParsedMarkdown(crepeRef, '\n```\n\n```\n', true);
}

export function insertMermaidBlock(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  return insertParsedMarkdown(crepeRef, '\n```mermaid\ngraph TD\n    A[Start] --> B[End]\n```\n', true);
}

export function insertTaskList(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  return insertParsedMarkdown(crepeRef, '- [ ] Task item\n', false);
}

export function insertHorizontalRule(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  return insertParsedMarkdown(crepeRef, '\n---\n', false);
}

// ===== 段落插入命令 =====

export function insertParagraphAbove(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const { from } = state.selection;

    const $pos = state.doc.resolve(from);
    const blockStart = $pos.before($pos.depth);

    // Insert paragraph and move cursor to it
    const tr = state.tr.insert(blockStart, state.schema.nodes.paragraph.create());
    const newPos = blockStart + 1;
    tr.setSelection(TextSelection.create(tr.doc, newPos));
    view.dispatch(tr);
    view.focus();
    return true;
  });
}

export function insertParagraphBelow(
  crepeRef: React.RefObject<Crepe | null>
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const { from } = state.selection;

    const $pos = state.doc.resolve(from);
    const blockEnd = $pos.after($pos.depth);

    // Insert paragraph and move cursor to it
    const tr = state.tr.insert(blockEnd, state.schema.nodes.paragraph.create());
    const newPos = blockEnd + 1;
    tr.setSelection(TextSelection.create(tr.doc, newPos));
    view.dispatch(tr);
    view.focus();
    return true;
  });
}
