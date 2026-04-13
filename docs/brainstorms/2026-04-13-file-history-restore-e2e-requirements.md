---
date: 2026-04-13
topic: file-history-restore-e2e
---

# File History Version Restore E2E Test

## Problem Frame

MarkBun 的版本历史（Version History）是三层文件保护的核心能力之一，但当前 E2E 测试仅验证了 `File History` 对话框能打开和关闭（`menu-dispatch.test.ts`）。实际的 restore 流程——从备份服务读取历史版本、在对话框中预览、点击 Restore 后将内容写回编辑器——完全没有端到端覆盖。这意味着备份服务与渲染进程之间的内容替换链路存在回归风险，而历史上并未为此建立自动防护网。

## Requirements

### R1. 隔离工作区与预置文件
- 测试必须使用 `withTempWorkspace` 创建隔离临时目录，避免污染真实 `~/.config/markbun/`。
- 在隔离工作区中预置一个 Markdown 文件（例如 `test-doc.md`），并为其生成至少两个版本备份（当前版本 + 一个早期版本）。
- 早期版本的内容必须与当前版本明显不同，以便恢复后断言。

### R2. 打开 File History 对话框
- 通过真实 UI 路径打开对话框：使用 `_testMenuAction('file-history')` 或 Quick Open 触发。
- 断言对话框已渲染，且左侧版本列表中至少出现两个条目。

### R3. 选择并恢复早期版本
- 在版本列表中点击较早的版本条目（非最顶部）。
- 断言右侧预览区域显示了该版本的原始 Markdown 内容。
- 点击 `Restore` 按钮。
- 断言对话框关闭。

### R4. 恢复后状态断言
- **内容一致性**：编辑器中的 Markdown 内容必须与所选早期版本完全一致。
- **路径不变性**：当前打开的文件路径（窗口标题或 `fileState.path`）保持为原文件，未发生变更或新建文件。
- **Dirty 状态**：恢复后文件应标记为 dirty（因为编辑器内容已与磁盘上的当前版本不同）。

### R5. 失败取证
- 测试必须包裹在 `withTrace` 中，任何失败自动收集 CDP 截图、DOM 快照和临时工作区文件树到 `tests/e2e/__traces__/`。

## Success Criteria

- `bun test:e2e` 能稳定运行新增的 File History restore 测试。
- 若备份服务、对话框渲染或编辑器内容替换任一环节被破坏，测试能在 30 秒内明确失败。
- 开发者能在 5 分钟内通过 `__traces__` 目录定位 restore 失败的根因。

## Scope Boundaries

- **非目标**：测试删除历史版本按钮（属于边界操作，非核心用户旅程）。
- **非目标**：测试空历史列表状态（已在 dialog-open 测试中隐式覆盖）。
- **非目标**：测试 `maxVersions` / `retentionDays` 触发的自动清理（属于 backup service 的单元/集成测试范围）。
- **非目标**：同时覆盖 Source Mode 和 WYSIWYG 两种编辑器模式（需求为至少覆盖 WYSIWYG 模式；Source Mode 路径可作为后续扩展）。

## Key Decisions

### D1. 生成版本备份的方式
采用**主动多次保存**而非直接操作备份目录：
1. 使用 `__markbunTestAPI.setEditorMarkdown()` 写入早期版本内容；
2. 调用 `EditorPage.saveFile(filePath)` 保存；
3. 再次修改内容并保存，生成第二个版本。
这样确保备份文件是通过真实的 `saveFile` → `createVersionBackup` 链路生成的，避免测试与内部备份路径格式耦合。

### D2. 选择版本条目的定位策略
左侧版本列表按时间倒序排列。选择“较早版本”时，通过 CDP 评估定位列表中的第二个 `<button>`（即 `li:nth-child(2) button`），避免依赖具体日期文本格式化。

### D3. 断言 dirty 状态的方式
通过 `__markbunTestAPI.getFileState ? window.__markbunTestAPI.getFileState().isDirty : false` 读取渲染进程中的 `fileState.isDirty`，确认恢复后状态为 `true`。若当前 `__markbunTestAPI` 尚未暴露 `getFileState`，则在实现阶段扩展该测试 API。
