/**
 * 编辑器操作工具函数
 * 提供通用的编辑器操作能力
 */
import { Crepe } from '@milkdown/crepe';
import { callCommand } from '@milkdown/utils';
import { editorViewCtx, parserCtx } from '@milkdown/kit/core';
import { TextSelection } from '@milkdown/prose/state';

export type EditorContext = {
  crepeRef: React.RefObject<Crepe | null>;
};

/**
 * 执行 Milkdown 命令的通用包装器
 */
export function execCommand<T>(
  crepeRef: React.RefObject<Crepe | null>,
  command: { key: any },
  payload?: T
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;
  return editor.action((ctx) => callCommand(command.key, payload)(ctx));
}

/**
 * 检查是否有文本选择
 */
export function hasSelection(crepeRef: React.RefObject<Crepe | null>): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;
  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { from, to } = view.state.selection;
    return from !== to;
  });
}

/**
 * 插入解析后的 Markdown 内容
 * @param crepeRef Crepe 编辑器引用
 * @param markdown Markdown 字符串
 * @param cursorInside 光标是否放在内容内部
 * @returns 是否成功
 */
export function insertParsedMarkdown(
  crepeRef: React.RefObject<Crepe | null>,
  markdown: string,
  cursorInside: boolean = false
): boolean {
  const editor = crepeRef.current?.editor;
  if (!editor?.ctx) return false;

  return editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const parser = ctx.get(parserCtx);
    const { state } = view;
    const { from } = state.selection;

    // Parse the markdown
    const doc = parser(markdown);
    if (!doc || doc.content.size === 0) {
      return false;
    }

    // Get current block info
    const $pos = state.doc.resolve(from);
    const currentBlockPos = $pos.before($pos.depth);
    const currentBlockEnd = $pos.after($pos.depth);
    const currentBlock = state.doc.nodeAt(currentBlockPos);
    const isEmptyParagraph = currentBlock?.type.name === 'paragraph' && currentBlock.textContent === '';

    // Build transaction
    let tr = state.tr;
    let cursorPos: number;

    if (isEmptyParagraph) {
      // Replace empty paragraph with new content
      tr = tr.replaceWith(currentBlockPos, currentBlockEnd, doc.content);

      if (cursorInside) {
        // Cursor inside the first block (for code, math, etc.)
        cursorPos = currentBlockPos + 1;
      } else {
        // Cursor after the inserted content (for table, hr, etc.)
        const insertedSize = doc.content.size;
        cursorPos = currentBlockPos + insertedSize + 1;
      }
    } else {
      // Insert after current block
      tr = tr.insert(currentBlockEnd, doc.content);

      if (cursorInside) {
        cursorPos = currentBlockEnd + 1;
      } else {
        const insertedSize = doc.content.size;
        cursorPos = currentBlockEnd + insertedSize + 1;
      }
    }

    // Ensure cursor position is valid
    cursorPos = Math.min(cursorPos, tr.doc.content.size);

    try {
      tr = tr.setSelection(TextSelection.create(tr.doc, cursorPos));
    } catch (e) {
      tr = tr.setSelection(TextSelection.create(tr.doc, tr.doc.content.size));
    }

    view.dispatch(tr);
    view.focus();
    return true;
  });
}
