---
date: 2026-03-31
topic: find-replace
---

# Find & Replace

## Problem Frame

MarkBun 的 WYSIWYG 模式没有任何文档内搜索能力。源码模式已通过 CodeMirror 的 `@codemirror/search` 内置了搜索功能，但 WYSIWYG 模式（Milkdown/ProseMirror）完全空白。查找替换是文本编辑器最基本的操作之一——缺失它严重影响日常使用者的信任和效率。

**目标用户**: 所有使用 WYSIWYG 模式的写作者和开发者。

## Requirements

**搜索栏 UI**
- R1. 搜索栏显示在编辑区顶部（不遮挡内容），按 Cmd+F 打开，按 Esc 关闭
- R2. 默认只显示查找输入框；点击展开按钮显示替换输入框和替换操作按钮；按 Cmd+Option+F 直接打开查找+替换栏
- R3. 搜索栏包含：查找输入框、替换输入框（展开时）、展开/折叠按钮、大小写敏感切换按钮、正则表达式切换按钮、关闭按钮
- R4. 输入框右侧显示匹配计数，格式为 `当前/总数`（如 `3/15`）；无匹配时显示 `无结果`

**搜索行为**
- R5. 输入时实时高亮所有匹配项（不需要按 Enter），使用 ProseMirror Decoration 实现。搜索范围仅限编辑器中可见的文本内容（ProseMirror 文本节点，包括代码块内的文本），不搜索图片 alt 文本、链接 href 等属性值
- R6. 当前匹配项用醒目颜色高亮（如橙色背景），其他匹配项用浅色高亮（如浅黄色背景）
- R7. 按 Enter 跳转到下一个匹配项，Shift+Enter 跳转到上一个匹配项；自动滚动到匹配位置
- R8. 支持纯文本搜索（默认）、大小写敏感搜索和正则表达式搜索，通过按钮切换
- R9. Cmd+G / Shift+Cmd+G 快捷键跳转下一个/上一个匹配项

**替换行为**
- R10. "替换"按钮替换当前匹配项（最近跳转到的、橙色高亮的匹配）并自动跳转到下一个
- R11. "全部替换"按钮替换文档中所有匹配项，作为单个原子 ProseMirror Transaction 执行（一次 Cmd+Z 撤销全部替换）
- R12. 替换操作通过 ProseMirror Transaction 执行，确保可撤销（Cmd+Z）。替换框中的文本作为纯文本字面量插入，不解析 Markdown 语法

**菜单集成**
- R13. Edit 菜单添加 Find (Cmd+F) 和 Find and Replace (Cmd+Option+F) 菜单项，并更新所有 8 个 locale 的 menu.json 翻译文件（de, en, es, fr, ja, ko, pt, zh-CN）

**错误与边界状态**
- R15. 正则表达式模式下，输入无效正则表达式时显示错误指示（如输入框红色边框），暂停高亮直到模式变为有效
- R16. 搜索输入框为空时隐藏匹配计数，不执行搜索或高亮

**模式边界**
- R14. 搜索功能仅在 WYSIWYG 模式下激活；源码模式继续使用 CodeMirror 内置搜索
- R17. 从 WYSIWYG 切换到源码模式时关闭搜索栏；切换回 WYSIWYG 模式时不自动恢复搜索词
- R18. 切换文件时关闭搜索栏并清除搜索状态（搜索词、匹配结果、高亮全部重置）
- R19. "当前匹配项"定义为最近通过 Cmd+G / Shift+Cmd+G / Enter 跳转到的匹配（橙色高亮）；用户点击编辑器内容区不影响当前匹配项选择

## Success Criteria

- 用户可以在 WYSIWYG 模式下通过 Cmd+F 快速查找文档中的任意文本
- 匹配项实时高亮且可跳转，当前项与其他项视觉区分明显
- 替换操作正确执行且可通过 Cmd+Z 撤销
- 大小写敏感和正则搜索模式工作正常

## Scope Boundaries

- 不修改源码模式 (CodeMirror) 的搜索体验
- 不支持跨文件搜索（那是工作区搜索功能的范围）
- 不支持多光标搜索替换
- 不支持搜索历史记录

## Key Decisions

- **仅 WYSIWYG 模式**: 源码模式已有 CodeMirror 内置搜索，无需重复建设
- **搜索栏位于编辑区顶部**: 与 VS Code/Typora 一致，不遮挡内容
- **替换面板默认折叠**: 减少视觉噪音，Cmd+Option+F 可直接展开
- **全功能第一版**: 包含查找、替换、大小写、正则，不做阉割版
- **搜索范围**: 仅搜索 ProseMirror 可见文本内容（含代码块文本），不搜索图片 alt、链接 href 等属性值
- **替换语义**: 替换框中的文本作为纯文本字面量插入，不解析 Markdown
- **Replace All 原子性**: 全部替换作为单个 ProseMirror Transaction 执行，一次 Cmd+Z 撤销
- **Cmd+Option+F**: 不使用 Cmd+H（macOS 系统保留用于隐藏应用），也不使用 Cmd+Shift+H（已绑定高亮格式）

## Dependencies / Assumptions

- ProseMirror Decoration API 足以实现高亮性能要求（假设文档 < 100K 字符时流畅）
- Milkdown 的编辑器实例暴露了足够的 ProseMirror 底层 API 来执行搜索和替换事务

## Outstanding Questions

### Resolve before planning

(none)

### Deferred to planning

- [Affects R5-R6][Technical] 具体使用 ProseMirror 的哪些 Decoration 类型来实现高效搜索高亮
- [Affects R8][Needs research] ProseMirror 生态中是否有现成的搜索插件可复用或参考（如 prosemirror-search）
- [Affects R13][Technical] Edit 菜单已存在于 menu.ts 第 87-98 行（含 undo, redo, cut, copy, paste, selectAll），需在 selectAll 后插入 Find 和 Find and Replace 菜单项（含分隔线）

## Next Steps

→ `/ce:plan` for structured implementation planning
