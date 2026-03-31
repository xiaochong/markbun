---
title: "feat: Add Find & Replace for WYSIWYG Mode"
type: feat
status: active
date: 2026-03-31
origin: docs/brainstorms/2026-03-31-find-replace-requirements.md
---

# feat: Add Find & Replace for WYSIWYG Mode

## Overview

为 MarkBun 的 WYSIWYG (Milkdown/ProseMirror) 编辑器添加文档内查找替换功能。包括实时搜索高亮、正则/大小写支持、替换单个/全部，以及菜单和快捷键集成。源码模式不受影响（已有 CodeMirror 内置搜索）。

## Problem Frame

MarkBun 的 WYSIWYG 模式没有任何文档内搜索能力，而源码模式已有 CodeMirror 搜索。查找替换是文本编辑器最基本的操作之一，缺失它严重影响用户信任和效率。（see origin: docs/brainstorms/2026-03-31-find-replace-requirements.md）

## Requirements Trace

- R1. 搜索栏显示在编辑区顶部，Cmd+F 打开，Esc 关闭 → Unit 2, 3
- R2. 默认折叠替换面板，Cmd+Option+F 直接展开 → Unit 2, 3
- R3. 搜索栏包含所有按钮和输入框 → Unit 2
- R4. 匹配计数显示（当前/总数）→ Unit 1, 2
- R5. 实时高亮所有匹配项，搜索范围仅限可见文本内容 → Unit 1
- R6. 当前/其他匹配项不同颜色高亮 → Unit 1, 5
- R7. Enter/Shift+Enter 跳转匹配 → Unit 1, 2
- R8. 纯文本/大小写/正则搜索 → Unit 1, 2
- R9. Cmd+G / Shift+Cmd+G 跳转 → Unit 3
- R10. 替换当前匹配并跳转下一个 → Unit 1, 2
- R11. 全部替换（原子 Transaction）→ Unit 1
- R12. 替换文本为纯文本字面量 → Unit 1
- R13. Edit 菜单添加 Find / Find and Replace，更新 8 locale → Unit 4
- R14. 仅 WYSIWYG 模式激活 → Unit 3
- R15. 无效正则显示错误指示 → Unit 2
- R16. 空输入时隐藏计数/不高亮 → Unit 2
- R17. 模式切换时关闭搜索栏 → Unit 3
- R18. 切换文件时关闭搜索栏 → Unit 3
- R19. "当前匹配项"为最近跳转到的匹配 → Unit 1

## Scope Boundaries

- 不修改源码模式 (CodeMirror) 的搜索体验
- 不支持跨文件搜索
- 不支持多光标搜索替换
- 不支持搜索历史记录
- 不使用 `prosemirror-search` 官方插件（自定义实现以获得更好的 React 集成控制）

## Context & Research

### Relevant Code and Patterns

- **插件注册**: `useCrepeEditor.ts` 中通过 `crepe.editor.use()` 注册 Milkdown 插件；`$prose` 工具将 ProseMirror 插件包装为 Milkdown 插件
- **编辑器命令模式**: `src/mainview/components/editor/commands/` 下每个命令接受 `crepeRef`，通过 `editorViewCtx` 访问 ProseMirror view，返回 boolean
- **文本替换**: `text.ts` 使用 `view.state.tr.replaceWith(from, to, schema.text(text))` 模式
- **EditorView 访问**: `editor.ctx.get(editorViewCtx)` 是代码库中一致的访问模式
- **布局结构**: App.tsx `<main>` 元素包含 Toolbar + 编辑器，搜索栏应插入 Toolbar 和编辑器之间
- **菜单模式**: `menu.ts` 定义原生菜单，action 字符串通过 RPC 转发到渲染进程
- **快捷键**: App.tsx `handleKeyDown` 在 `capture: true` 阶段拦截 Cmd 组合键

### External References

- ProseMirror `Decoration.inline(from, to, attrs)` 用于搜索高亮
- `DecorationSet.create(doc, decorations)` + `.map(tr.mapping, tr.doc)` 用于增量更新
- 文本搜索需拼接 textblock 内跨 mark 边界的子节点文本内容
- `doc.resolve(from).marksAcross(doc.resolve(to))` 保留替换文本的 mark 样式
- Replace All 从后往前应用避免位置偏移

## Key Technical Decisions

- **自定义搜索插件而非 `prosemirror-search`**: 需要更紧密的 React 状态管理（搜索词、匹配计数、当前索引），`prosemirror-search` 的命令式导航模型与 React 状态驱动 UI 不匹配
- **ProseMirror Plugin 通过 `$prose` 注册**: 遵循代码库现有插件模式（`clipboardBlobConverter`），确保插件在编辑器创建时初始化
- **插件状态持有 DecorationSet**: 通过 `tr.setMeta()` 驱动更新，保持事务性；React 组件通过 `view.dispatch(tr.setMeta(pluginKey, data))` 与插件通信
- **搜索栏作为 React 组件**: 不使用 ProseMirror Widget，而是独立的 React 组件，通过 `MilkdownEditorRef` 暴露的方法与 ProseMirror 交互
- **搜索栏插入在 `<main>` 的 Toolbar 和编辑器之间**: 不遮挡内容，仅在 WYSIWYG 模式渲染
- **使用 `@milkdown/kit/prose/view` 的 Decoration**: 已在项目依赖中，无需新增包

## Open Questions

### Resolved During Planning

- **ProseMirror 插件如何注册到 Milkdown?** 使用 `$prose` 工具包装，在 `useCrepeEditor.ts` 中通过 `crepe.editor.use()` 注册
- **Edit 菜单位置?** 已存在于 `menu.ts` 第 87-98 行，在 `selectAll` 后插入，加分隔线
- **是否使用 `prosemirror-search`?** 不使用，自定义实现以获得 React 集成控制

### Deferred to Implementation

- 搜索高亮在超大文档（>100K 字符）中的性能表现 — 需在实际使用中验证，必要时添加防抖或匹配数量上限
- 精确的 CSS 颜色值（当前/其他匹配高亮）— 在实现阶段与现有主题协调
- 是否需要从 `@milkdown/utils` 额外安装 `$prose`（当前依赖中已有 `@milkdown/kit`）
- 搜索栏打开时用户编辑文档的行为 — 匹配结果应随文档变化实时更新，但需考虑性能影响（每次输入都重新搜索）；建议实现阶段添加输入防抖（~200ms）
- 键盘事件路由 — 当搜索栏输入框获得焦点时，Cmd+G 等全局快捷键需确保仍能被 App.tsx 的 `capture: true` handler 拦截；搜索栏内 Esc 只关闭搜索栏不触发其他行为
- 导航匹配时的滚动行为 — 跳转到匹配项时需确保 ProseMirror 视口滚动到匹配位置（可通过 `view.dispatch()` 后 ProseMirror 自动处理）

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

### 数据流

```
React SearchBar Component          ProseMirror Search Plugin
┌─────────────────────┐           ┌─────────────────────────┐
│ 用户输入搜索词        │           │ Plugin State:            │
│ 切换选项(大小写/正则) │──meta──► │   query, caseSensitive,  │
│ 点击替换/全部替换     │  tr.set  │   regex, DecorationSet,  │
│                     │  Meta()  │   matches[], activeIndex  │
│ ◄── 读 plugin 状态 ──│─────────│                          │
│   匹配计数、当前索引  │  getState│ decorations(state) 渲染   │
└─────────────────────┘           └─────────────────────────┘
```

- React 组件通过 `view.dispatch(tr.setMeta(searchPluginKey, { type, payload }))` 驱动搜索/替换
- 插件 `state.apply()` 读取 meta，执行搜索，构建 DecorationSet
- React 通过 Plugin View 的 `update()` 回调读取匹配结果和当前索引来更新 UI（而非直接 `getState` 轮询）
- 文本搜索遍历文档 textblock 节点，拼接子节点文本，执行 indexOf/RegExp 匹配
- Replace All 从后往前应用 `tr = tr.replaceWith()` 保持位置稳定（Transaction 不可变，需重新赋值）
- 导航匹配时调用 `view.dispatch()` 滚动到匹配位置（`view.dispatch(tr.setMeta(...))` 触发 ProseMirror 自动滚动到视口）

## Implementation Units

- [ ] **Unit 1: ProseMirror Search Plugin Core**

**Goal:** 创建 ProseMirror 搜索插件，包含搜索查询状态管理、DecorationSet 高亮、文本搜索、匹配导航和替换逻辑。

**Requirements:** R5, R6, R8, R10, R11, R12, R19

**Dependencies:** None

**Files:**
- Create: `src/mainview/components/editor/plugins/searchPlugin.ts`
- Test: `tests/unit/components/editor/plugins/searchPlugin.test.ts`

**Approach:**
- 使用 `$prose` from `@milkdown/utils` 创建 Milkdown 兼容的 ProseMirror 插件
- PluginKey 命名为 `searchPluginKey`
- Plugin state 持有: `query`, `caseSensitive`, `regex`, `matches[]`, `activeIndex`, `DecorationSet`
- `state.apply(tr, oldState)` 逻辑: 检查 `tr.getMeta(searchPluginKey)` 以确定操作类型（setQuery, setCaseSensitive, setRegex, nextMatch, prevMatch, replaceCurrent, replaceAll, clear）；否则映射现有 DecorationSet
- `props.decorations(state)` 返回当前 DecorationSet
- 文本搜索函数: 遍历 `doc` 的 textblock 节点（`node.inlineContent === true`），拼接子节点文本内容（`child.isText ? child.text : '\ufffc'`），执行搜索，将匹配偏移映射回文档位置
- Decoration 构建: 所有匹配用 `Decoration.inline(from, to, { class: 'search-match' })`，当前匹配用 `Decoration.inline(from, to, { class: 'search-match-active' })`
- 单个替换: `marksAcross()` 保留 mark，`tr.replaceWith(from, to, schema.text(replacement, marks))`
- 全部替换: 从后往前排序 matches，在单个 Transaction 中逐一 `tr = tr.replaceWith(...)`（Transaction 不可变，必须重新赋值），确保原子性
- 导出辅助函数: `getSearchState(view)` 读取插件状态，`dispatchSearchAction(view, action)` 发送 meta

**Patterns to follow:**
- `src/mainview/components/editor/plugins/clipboardBlobConverter.ts` — `$prose` 插件注册模式（返回单个 MilkdownPlugin，不需要 `.flat()`）
- `src/mainview/components/editor/commands/text.ts` — ProseMirror Transaction 操作模式（注意 Transaction 不可变，需重新赋值 `tr = tr.replaceWith(...)`）
- ProseMirror 官方 `prosemirror-search` 的文本搜索和高亮实现思路

**Test scenarios:**
- Happy path: setQuery 返回正确的 matches 数组和 DecorationSet
- Happy path: nextMatch/prevMatch 正确循环 activeIndex
- Happy path: replaceCurrent 替换当前匹配并保留 marks
- Happy path: replaceAll 在单个 Transaction 中替换所有匹配
- Edge case: 空查询返回空 DecorationSet
- Edge case: 无效正则表达式不抛异常，返回空结果
- Edge case: 匹配跨越 mark 边界的文本（如 `**hello** world` 中搜索 `hello world`）
- Edge case: 单个匹配时 nextMatch 保持同一匹配
- Edge case: replaceAll 后 matches 清空
- Error path: query 为特殊正则字符（`[`, `(`）在纯文本模式下正常搜索

**Verification:**
- 插件可通过 `crepe.editor.use()` 注册，不报错
- 设置搜索词后 `getState()` 返回非空 matches
- DecorationSet 包含正确的 inline decoration 数量和位置

- [ ] **Unit 2: Search Bar React Component**

**Goal:** 创建搜索栏 React 组件，包含查找输入框、替换面板、选项切换按钮和操作按钮。

**Requirements:** R1-R4, R7, R15, R16

**Dependencies:** Unit 1

**Files:**
- Create: `src/mainview/components/search-bar/SearchBar.tsx`
- Create: `src/mainview/components/search-bar/useSearch.ts`
- Test: `tests/unit/components/search-bar/useSearch.test.ts`

**Approach:**
- `SearchBar` 组件: 接收 `editorView`（或 `getEditorView` 方法）、`isVisible`、`onClose`、`showReplace` props
- `useSearch` hook: 封装所有搜索逻辑，接收 `EditorView`（通过 `MilkdownEditorRef` 获取），返回 `{ query, setQuery, caseSensitive, setCaseSensitive, regex, setRegex, matchCount, activeIndex, replaceCurrent, replaceAll, nextMatch, prevMatch, error }`
- hook 内部通过 Plugin View 回调机制接收 ProseMirror 搜索状态更新，避免轮询 `getState`
- 搜索词变化时 `view.dispatch(tr.setMeta(searchPluginKey, { type: 'setQuery', query, caseSensitive, regex }))`
- 通过 Plugin View 的 `update()` 回调读取 matches 和 activeIndex 更新 React 状态
- 输入框为空时不 dispatch 搜索（R16）
- 无效正则时设置 error 状态（R15）
- 布局: 查找行（输入框 + 计数 + 选项按钮 + 关闭），替换行（输入框 + 替换/全部替换按钮）
- 使用原生 Tailwind CSS（项目无 shadcn/ui 组件），样式参考现有 QuickOpen 组件的输入框风格
- 支持 Enter/Shift+Enter 键盘操作
- 输入框自动聚焦

**Patterns to follow:**
- `src/mainview/components/quick-open/QuickOpen.tsx` — 浮层 UI 组件模式
- `src/mainview/hooks/useQuickOpen.ts` — hook 封装模式
- 现有 Tailwind CSS 样式约定（`cn()` 工具、语义化颜色类名）

**Test scenarios:**
- Happy path: 输入搜索词触发 dispatchSearchAction
- Happy path: 匹配计数正确显示（3/15 格式）
- Happy path: 空输入不触发搜索
- Happy path: 切换大小写敏感重新搜索
- Happy path: 切换正则模式重新搜索
- Edge case: 无效正则显示错误状态
- Edge case: 无匹配时显示 "无结果"
- Edge path: Enter 键触发 nextMatch
- Edge path: Shift+Enter 触发 prevMatch

**Verification:**
- 组件渲染正确，输入框可交互
- 搜索词变化后匹配计数正确更新

- [ ] **Unit 3: App Integration — Layout, Shortcuts, State Management**

**Goal:** 将搜索栏集成到 App.tsx 布局中，添加键盘快捷键，处理模式切换和文件切换时的搜索状态。

**Requirements:** R1, R2, R9, R14, R17, R18

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/mainview/App.tsx`
- Modify: `src/mainview/components/editor/hooks/useCrepeEditor.ts`

**Approach:**

**App.tsx 修改:**
- 添加 `searchVisible` 和 `showReplace` 状态
- 在 `<main>` 元素内，Toolbar 和编辑器之间插入 `<SearchBar>`（仅在 `!sourceMode` 时渲染）
- 搜索栏接收 `editorView` 或搜索相关方法（通过 `MilkdownEditorRef` 暴露），不再直接传递 `crepeRef`
- 键盘快捷键 handler (`handleKeyDown`) 中添加:
  - `case 'f'`: 如果不在源码模式，`e.preventDefault()` + 打开搜索栏
  - `case 'g'`: 如果搜索栏可见，调用 nextMatch/prevMatch
- 监听 `menuAction` 事件中的 `'edit-find'` 和 `'edit-find-and-replace'`
- 文件切换（`openFileByPath` 调用前）和模式切换时设置 `searchVisible = false`
- 注册 `crepeRef` 到 MilkdownEditor 组件（需暴露 `crepeRef` 或搜索相关方法）

**useCrepeEditor.ts 修改:**
- 在插件注册列表中添加 `searchPlugin`：`crepe.editor.use(searchPlugin)`（`$prose` 返回单个 MilkdownPlugin，直接 use 即可，不需要 `.flat()`）

**MilkdownEditor.tsx 修改:**
- 在 `MilkdownEditorRef` 接口中添加 `getEditorView: () => EditorView | null` 方法，通过 `useImperativeHandle` 暴露给父组件
- App.tsx 通过 `editorRef.current?.getEditorView()` 获取 ProseMirror EditorView，传递给 SearchBar
- 或者：直接在 `MilkdownEditorRef` 上暴露搜索相关方法（`searchFind`, `searchNext`, `searchReplace` 等），将搜索逻辑封装在编辑器组件内部

**React-ProseMirror 响应性桥接:**
- ProseMirror 插件状态变化不会触发 React 重渲染，需要显式桥接机制
- 方案 A（推荐）: 使用 ProseMirror Plugin View — 在 `searchPlugin` 中注册 `view` 回调（`new Plugin({ view: () => ({ update(view) { ... } }) })`），当搜索状态变化时调用 React 回调更新 UI
- 方案 B: 在 `useSearch` hook 中使用 ProseMirror 的 `dispatchTransaction` wrapper 拦截所有事务，检查搜索 meta 更新 React 状态
- 无论哪种方案，`useSearch` hook 都需要在 ProseMirror 状态变化时同步 React 状态

**Patterns to follow:**
- App.tsx 现有的状态管理模式（`useState` + `useEffect`）
- `handleKeyDown` 快捷键注册模式
- `menuAction` 事件处理模式
- `useCrepeEditor.ts` 插件注册列表

**Test scenarios:**
- Integration: Cmd+F 打开搜索栏，Esc 关闭
- Integration: Cmd+Option+F 打开搜索栏并展开替换面板
- Integration: Cmd+G/Shift+Cmd+G 在搜索栏打开时跳转匹配
- Integration: 源码模式下 Cmd+F 不触发自定义搜索栏
- Integration: 切换文件时搜索栏关闭
- Integration: 切换到源码模式时搜索栏关闭
- Edge case: 编辑器未就绪时 Cmd+F 无操作

**Verification:**
- Cmd+F 在 WYSIWYG 模式打开搜索栏
- 搜索栏仅在 WYSIWYG 模式渲染
- 切换文件/模式后搜索栏消失

- [ ] **Unit 4: Menu Integration and i18n**

**Goal:** 在 Edit 菜单添加 Find 和 Find and Replace 菜单项，更新所有 8 个 locale 的翻译文件，注册菜单 action 转发。

**Requirements:** R13

**Dependencies:** Unit 3

**Files:**
- Modify: `src/bun/menu.ts`
- Modify: `src/bun/i18n/locales/{en,zh-CN,de,es,fr,ja,ko,pt}/menu.json`
- Modify: `src/bun/index.ts`

**Approach:**

**menu.ts:** 在 Edit 菜单的 `selectAll` 后添加分隔线，然后添加:
- `{ label: t('edit.find'), action: 'edit-find', accelerator: 'CmdOrCtrl+F' }`
- `{ label: t('edit.findAndReplace'), action: 'edit-find-and-replace', accelerator: 'CmdOrCtrl+Option+F' }`

**menu.json (8 files):** 在 `edit` 对象中添加:
- `"find": "Find"` / `"find": "查找"` (等各语言翻译)
- `"findAndReplace": "Find and Replace"` / `"findAndReplace": "查找和替换"` (等)

**index.ts:** 在 `application-menu-clicked` handler 的 switch 和 `sendMenuAction` 的 actionToEvent map 中添加 `'edit-find'` 和 `'edit-find-and-replace'` case，转发到渲染进程。

**Patterns to follow:**
- 现有 Edit 菜单项结构（`menu.ts` 第 87-98 行）
- 现有 i18n 更新模式（参考 export 功能的 8 locale 更新）
- 现有 action 转发模式（index.ts 中的 switch/case 和 actionToEvent map）

**Test expectation:** none — 菜单配置和翻译文件的正确性通过手动验证和类型检查保证

**Verification:**
- Edit 菜单显示 Find 和 Find and Replace 菜单项
- 点击菜单项在 WYSIWYG 模式打开搜索栏
- 所有 8 个 locale 翻译正确显示

- [ ] **Unit 5: Search Highlight Styles**

**Goal:** 添加搜索高亮和搜索栏的 CSS 样式。

**Requirements:** R6

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/mainview/styles/globals.css`（或编辑器样式文件）

**Approach:**
- `.search-match`: 浅色背景高亮（如 `background-color: rgba(255, 213, 0, 0.4)`）
- `.search-match-active`: 醒目高亮（如 `background-color: rgba(255, 150, 50, 0.6)`）
- 搜索栏组件样式: 固定高度，输入框与现有 UI 一致
- 确保深色模式下颜色可读（使用 `dark:` 变体）

**Test expectation:** none — 样式正确性通过视觉验证

**Verification:**
- 搜索匹配项在编辑器中可见高亮
- 当前匹配项与其他匹配项颜色区分明显
- 深色模式下高亮可读

## System-Wide Impact

- **Interaction graph:** 搜索功能通过 `menuAction` RPC 路径和键盘快捷键两个入口触发，均最终调用 `useSearch` hook，通过 ProseMirror plugin meta dispatch 驱动。不影响现有文件操作、自动保存或剪贴板流程。
- **Error propagation:** 无效正则表达式在 `useSearch` hook 层捕获，不传播到 ProseMirror。搜索/替换失败静默处理（返回空结果）。
- **State lifecycle risks:** 切换文件/模式时搜索栏状态必须清除（R17, R18），否则残留的 DecorationSet 会指向无效文档位置。通过在 `openFileByPath` 和 `handleToggleSourceMode` 中强制 `setSearchVisible(false)` 解决。
- **Unchanged invariants:** 源码模式的 CodeMirror 搜索行为完全不变。自动保存、备份、导出、剪贴板功能不受影响。

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| ProseMirror `DecorationSet` 在超大文档中性能问题（>100K 字符） | Deferred to implementation — 可添加匹配数量上限（如 1000）或搜索防抖 |
| `@milkdown/utils` 的 `$prose` 可能需要额外安装 | 检查 `package.json` 依赖；`@milkdown/kit` 可能已包含所需导出 |
| 搜索栏与 Toolbar 的视觉一致性 | 参考现有 UI 组件风格，保持统一 |
| `editorViewCtx` 在编辑器重建期间（如主题切换）可能返回 stale view | 搜索操作前检查 `crepeRef.current?.editor?.ctx` 有效性 |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-03-31-find-replace-requirements.md](docs/brainstorms/2026-03-31-find-replace-requirements.md)
- Related code: `src/mainview/components/editor/plugins/clipboardBlobConverter.ts` ($prose plugin pattern)
- Related code: `src/mainview/components/editor/commands/text.ts` (ProseMirror transaction pattern)
- Related code: `src/mainview/components/quick-open/QuickOpen.tsx` (overlay UI component pattern)
- External docs: ProseMirror Decoration API, prosemirror-search source code
