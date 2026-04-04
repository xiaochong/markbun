***

title: "feat: AI 工具调用卡片化展示"
type: feat
status: completed
date: 2026-04-04
origin: docs/brainstorms/2026-04-04-ai-tools-display-requirements.md
--------------------------------------------------------------------

# AI 工具调用卡片化展示

## Overview

将 AI Chat Panel 中的工具调用结果从原始 JSON 字符串升级为结构化可折叠卡片。每种工具（read/edit/write）有专属图标、主题色和展示格式，支持三层渐进式信息披露、执行状态动画和计时。

## Problem Frame

当前工具调用结果以 `{"content":"古诗词大会\n"}` 形式直接渲染为 `font-mono` 文本块，用户无法快速识别工具类型、执行状态或修改内容。需求文档（见 origin）定义了从原始 JSON 到结构化卡片展示的完整升级方案。

## Requirements Trace

* R1. 卡片容器结构（可折叠，头部始终可见）

* R2. 三层渐进式信息披露（头部 → 详情 → 原始 JSON）

* R3. 展开/折叠交互

* R4. 工具类型专属标识（图标 + 主题色）

* R5. 视觉标识应用位置

* R6. 状态类型与视觉表现（执行中/成功/失败/超时）

* R7. 时间显示

* R8. 错误信息展示

* R9. read 工具展示（统计 + 内容预览）

* R10. edit 工具展示（diff 视图）

* R11. write 工具展示（统计 + 内容预览）

* R12. i18n 支持（8 种语言）

## Scope Boundaries

* **不含** 编辑器内实时高亮（inline decorations）— Phase 2

* **不含** 工具链时间线可视化 — Phase 2

* **不含** 工具重试机制（UI 按钮）— 需 backend 支持

* **不含** 工具执行取消 — 当前架构不支持

* **不含** 工具参数编辑 — 超出范围

## Context & Research

### Relevant Code and Patterns

* `src/mainview/hooks/useAIChat.ts` — `AIMessage` 类型定义 + 流式事件处理。当前忽略 `toolcall_start`/`toolcall_delta` 事件（switch 中无对应 case）

* `src/mainview/components/ai-chat/ChatMessageList.tsx` — 当前 tool 消息渲染：`bg-muted border font-mono` + `JSON.stringify(toolResult)`

* `src/bun/services/ai-stream.ts` — `toolcall_start` 仅含 `contentIndex`（无工具名）；`toolcall_delta` 含 `delta`（部分 JSON，含工具名）；`toolcall_end` 含 `{ toolCall: { id, name, arguments }, toolResult, isError }`

* `src/mainview/lib/ai-tools.ts` — edit 工具返回 `{ success, replacements }`，不返回 diff 数据

* `src/mainview/i18n/locales/en/ai.json` — 当前无工具相关 i18n 键

* `src/mainview/lib/utils.ts` — `cn()` 工具函数（`clsx` + `tailwind-merge`）

* 无现有 diff 库或卡片/折叠组件

### Institutional Learnings

* 消息建模为不可变快照，非累加器。工具调用间不累积文本（see `ai-tool-call-cascading-failures` solution）

* ProseMirror 编程式 `setMarkdown` 不触发 `markdownUpdated`；规范化可能产生双重 dispatch（see `editor-content-lost-on-file-switch` solution）

### External References

* 无外部依赖研究。代码库模式充足，diff 展示使用自建轻量方案。

## Key Technical Decisions

* **Diff 数据来源**：`toolcall_end` 事件的 `toolCall.arguments` 包含 `old_text`/`new_text`，无需调整 backend。在 `AIMessage` 中新增 `toolArgs` 字段保存 arguments。(see origin: Dependencies/Assumptions)

* **Token 估算**：使用简单字符估算（`Math.ceil(content.length / 4)`），不引入 tokenizer 库。(see origin: Outstanding Questions)

* **执行中状态**：需在 `useAIChat` 中新增 `toolcall_start`/`toolcall_delta` 事件处理。从 `toolcall_delta` 的 `delta` 字段解析工具名（JSON 片段中 `"name":` 后的值）。

* **Diff 渲染**：不引入第三方 diff 库。edit 工具的 diff 展示本质是"将 N 处 old\_text 替换为 new\_text"，直接用字符串操作构建行内 diff 视图（红色删除线 + 绿色高亮）。

* **组件结构**：新增 `ToolCallCard` 组件（含子组件），在 `ChatMessage` 中根据 `role === 'tool'` 替换当前渲染。

* **计时实现**：`toolcall_start` 时记录 `startTime` 到 tool message，`toolcall_end` 时计算差值。执行中用 `setInterval` 每 200ms 更新已耗时显示（100ms 过于频繁，200ms 在视觉上无差异且性能更优）。

## Open Questions

### Resolved During Planning

* **Diff 视图数据来源**（origin Q1）：`toolcall_end` 的 `toolCall.arguments` 已包含 `old_text`/`new_text`，无需 backend 调整。

* **Token 估算算法**（origin Q2）：使用 `Math.ceil(length / 4)` 简单估算，足够用于摘要展示。

### Deferred to Implementation

* 内容截断长度是否需要根据面板宽度动态调整（当前用固定值 500/300 字符）

* Diff 截断策略的精确 N 值（需求文档建议前 3 处 + 省略）

* 脉冲动画是否需要 `will-change` 优化（实现时视性能决定）

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### 数据流变更

```
当前: toolcall_end → { role: 'tool', content: JSON.stringify(result), toolName, toolResult }
目标: toolcall_start → { role: 'tool', status: 'executing', startTime }
      toolcall_delta → 更新 toolName（从 delta 解析）
      toolcall_end   → { role: 'tool', status: 'success'|'failed', toolName, toolResult, toolArgs, duration }
```

### 组件树变更

```
当前: ChatMessage(role='tool') → <div font-mono>{content}</div>
目标: ChatMessage(role='tool') → <ToolCallCard>
                               ├── CardHeader (icon + name + status + duration)
                               ├── CardBody (按工具类型分化)
                               │   ├── ReadBody (stats + preview)
                               │   ├── EditBody (inline diff)
                               │   └── WriteBody (stats + preview)
                               └── RawDataSection (<details> 折叠)
```

## Implementation Units

* [ ] **Unit 1: 扩展 AIMessage 类型和 useAIChat 事件处理**

**Goal:** 为工具调用卡片提供完整的数据模型：执行中状态、工具参数、计时。

**Requirements:** R6, R7

**Dependencies:** None

**Files:**

* Modify: `src/mainview/hooks/useAIChat.ts`

* Test: `tests/unit/mainview/hooks/useAIChat.test.ts`（新建）

**Approach:**

* 扩展 `AIMessage` 接口：新增 `status?: 'executing' | 'success' | 'failed' | 'timeout'`、`startTime?: number`、`duration?: number`、`toolArgs?: Record<string, unknown>`

* 在 `useAIChat` 事件处理中新增 `toolcall_start` case：创建 `role: 'tool'` 消息，`status: 'executing'`，`startTime: Date.now()`

* 新增 `toolcall_delta` case：解析 delta JSON 片段中的 `"name"` 字段更新 `toolName`

* 修改现有 `toolcall_end` case：从 `toolCall.arguments` 提取 `toolArgs`，计算 `duration`，设 `status: isError ? 'failed' : 'success'`

**Patterns to follow:**

* 现有 `useAIChat` 事件处理 switch-case 模式

* 不可变消息更新（`setMessages(prev => prev.map(...))`）

**Test scenarios:**

* Happy path: `toolcall_start` 创建 executing 状态 tool 消息，`toolcall_end` 更新为 success + duration + toolArgs

* Edge case: 收到 `toolcall_start` 但没有后续 `toolcall_end`（session abort）

* Edge case: `toolcall_delta` 中 name 解析失败的降级处理

* Integration: 完整流式周期 — text\_delta → toolcall\_start → toolcall\_delta → toolcall\_end → text\_delta → done

**Verification:**

* tool 消息在 executing 状态包含 `startTime`、`status: 'executing'`

* tool 消息在 success 状态包含 `duration`、`toolArgs`、`toolResult`

* [ ] **Unit 2: ToolCallCard 基础组件**

**Goal:** 实现可折叠卡片容器，含头部（图标 + 名称 + 状态 + 计时）和展开/折叠交互。

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R8

**Dependencies:** Unit 1

**Files:**

* Create: `src/mainview/components/ai-chat/ToolCallCard.tsx`

* Test: `tests/unit/mainview/components/ai-chat/ToolCallCard.test.tsx`（新建）

**Approach:**

* `ToolCallCard` 接收 `AIMessage`（`role === 'tool'`）作为 props

* 工具配置映射：`{ read: { icon: 'Eye', color: 'blue-500' }, edit: { icon: 'Pencil', color: 'amber-500' }, write: { icon: 'FileText', color: 'green-500' } }`

* 使用 Lucide React 图标（已存在于项目依赖中）

* 卡片头部：`border-l-4` 左边框使用主题色，图标 + 工具名 + 状态指示器 + 耗时

* 状态动画：executing 状态的脉冲圆点使用 `animate-pulse`

* 点击头部 toggle 展开/折叠（`useState`）

* executing 状态时用 `useEffect` + `setInterval(200ms)` 更新已耗时

* 第二层CardBody：工具特定内容（Unit 3 实现，此处先留 slot）

* 第三层RawData：使用 HTML `<details>` 元素包裹 `JSON.stringify`

**Technical design (directional):**

```
TOOL_CONFIG = { read: { icon: Eye, color: 'blue' }, edit: { icon: Pencil, color: 'amber' }, write: { icon: FileText, color: 'green' } }
StatusIndicator: executing → PulseDot(color), success → CheckCircle(green), failed → XCircle(red), timeout → AlertTriangle(orange)
formatDuration(ms): ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`
```

**Patterns to follow:**

* 项目中 `cn()` className 合并模式

* React `memo` 包裹组件的性能模式（参考 `ChatMessageList.tsx`）

**Test scenarios:**

* Happy path: 卡片渲染头部（图标 + 名称 + 状态），点击展开/折叠第二层

* Edge case: executing 状态的实时计时更新

* Edge case: failed 状态显示错误信息（截断至 30 字符）

* Edge case: `toolName` 为 'unknown' 时的降级显示

**Verification:**

* 卡片默认折叠，只显示头部

* 点击头部可展开/折叠

* executing 状态有脉冲动画和实时计时

* failed 状态显示红色错误图标

* [ ] **Unit 3: 工具特定展示组件**

**Goal:** 为 read/edit/write 三种工具实现差异化的第二层展示内容。

**Requirements:** R9, R10, R11

**Dependencies:** Unit 2

**Files:**

* Create: `src/mainview/components/ai-chat/ReadToolBody.tsx`

* Create: `src/mainview/components/ai-chat/EditToolBody.tsx`

* Create: `src/mainview/components/ai-chat/WriteToolBody.tsx`

* Test: `tests/unit/mainview/components/ai-chat/ReadToolBody.test.tsx`（新建）

* Test: `tests/unit/mainview/components/ai-chat/EditToolBody.test.tsx`（新建）

* Test: `tests/unit/mainview/components/ai-chat/WriteToolBody.test.tsx`（新建）

**Approach:**

**ReadToolBody：**

* 头部摘要：字数 + 行数 + token 估算 + 耗时

* 第二层：前 500 字符预览 + "查看完整内容" 按钮（展开后显示 `<pre>` 代码块）

* 统计从 `toolResult.content` 计算

**EditToolBody：**

* 头部摘要：替换 N 处 + 影响字节数 + 耗时

* 第二层：行内 diff 视图

  * 从 `toolArgs.old_text` 和 `toolArgs.new_text` 构建

  * 删除内容：`bg-red-100 text-red-800 line-through`（Tailwind 类）

  * 新增内容：`bg-green-100 text-green-800`（Tailwind 类）

  * 超过 3 处替换时：前 3 处 + "... 还有 N 处"

* 不使用第三方 diff 库；直接渲染 old\_text（红）→ new\_text（绿）的替换对

**WriteToolBody：**

* 头部摘要：字数 + 行数 + 耗时

* 第二层：前 300 字符预览 + 渐变淡出遮罩 + "查看完整内容" 按钮

**Token 估算函数**（共享工具函数）：

```
estimateTokens(content: string): number → Math.ceil(content.length / 4)
```

**Patterns to follow:**

* `cn()` className 合并

* React `memo` 包裹

**Test scenarios:**

* **ReadToolBody** — Happy path: 显示统计（字数/行数/tokens）和内容预览；Edge case: 空内容；Edge case: 超长内容截断至 500 字符

* **EditToolBody** — Happy path: 显示 diff（红色删除 + 绿色新增）；Edge case: 0 处替换（不应发生但需降级）；Edge case: 超过 3 处替换时显示省略

* **WriteToolBody** — Happy path: 显示统计和预览；Edge case: 空内容；Edge case: 超长内容截断至 300 字符

* **Integration** — EditToolBody 从 `toolArgs` 和 `toolResult` 组合构建完整 diff 信息

**Verification:**

* ReadToolBody 显示文件统计和可展开预览

* EditToolBody 显示行内 diff（红/绿高亮）

* WriteToolBody 显示统计和渐变淡出预览

* [ ] **Unit 4: 集成到 ChatMessageList**

**Goal:** 在 `ChatMessage` 中用 `ToolCallCard` 替换当前 tool 消息的原始 JSON 渲染。

**Requirements:** R1-R11（集成所有 UI 需求）

**Dependencies:** Unit 2, Unit 3

**Files:**

* Modify: `src/mainview/components/ai-chat/ChatMessageList.tsx`

**Approach:**

* 在 `ChatMessage` 组件中，当 `message.role === 'tool'` 时渲染 `<ToolCallCard message={message} />`

* 移除当前 tool 消息的 `bg-muted border font-mono` 渲染分支

* 确保不影响 user 和 assistant 消息的现有渲染逻辑

**Patterns to follow:**

* 现有 `ChatMessage` 的条件分支渲染模式

**Test scenarios:**

* Happy path: tool 消息渲染为 `ToolCallCard`，user/assistant 消息不变

* Integration: 流式场景下，executing 状态的 tool 卡片与 streaming cursor 共存

**Verification:**

* tool 消息展示为带图标和颜色的卡片

* 非 tool 消息渲染不受影响

* [ ] **Unit 5: i18n 键值扩展**

**Goal:** 为工具调用展示添加 8 种语言的翻译键。

**Requirements:** R12

**Dependencies:** None（可与 Unit 2-4 并行）

**Files:**

* Modify: `src/mainview/i18n/locales/en/ai.json`

* Modify: `src/mainview/i18n/locales/zh-CN/ai.json`

* Modify: `src/mainview/i18n/locales/de/ai.json`

* Modify: `src/mainview/i18n/locales/fr/ai.json`

* Modify: `src/mainview/i18n/locales/ja/ai.json`

* Modify: `src/mainview/i18n/locales/ko/ai.json`

* Modify: `src/mainview/i18n/locales/pt/ai.json`

* Modify: `src/mainview/i18n/locales/es/ai.json`

* Modify: `src/shared/i18n/types.ts`（如需更新类型推断）

**Approach:**

* 在 `ai.json` 的 `message` 命名空间下添加 `tool` 子对象

* 键值结构：`message.tool.read`、`message.tool.edit`、`message.tool.write`、`message.tool.executing`、`message.tool.completed`、`message.tool.failed`、`message.tool.timeout`、`message.tool.stats.*`、`message.tool.viewFullContent`、`message.tool.collapse`、`message.tool.expand`、`message.tool.rawData`

* 使用 i18next 插值语法 `{{count}}`、`{{time}}`

**Patterns to follow:**

* 现有 `ai.json` 键值嵌套模式（如 `message.user`、`panel.title`）

* 8 种语言的同步更新模式（参考 export 功能的 i18n 实现）

**Test scenarios:**

* Test expectation: none — i18n 键值是静态数据，通过构建时类型检查和运行时切换语言验证

**Verification:**

* 切换语言后工具卡片文本正确显示

* TypeScript 类型推断无报错

## System-Wide Impact

* **Interaction graph:** `useAIChat` 事件处理新增 `toolcall_start`/`toolcall_delta` 分支，不影响现有 `text_delta`/`done`/`error` 处理

* **Error propagation:** tool 执行失败时 `toolcall_end.isError` 已有标记，卡片组件读取该标记显示失败状态

* **State lifecycle risks:** executing 状态的 `setInterval` 必须在组件卸载时清除（`useEffect` cleanup）

* **Unchanged invariants:** user/assistant 消息的渲染逻辑、流式光标、auto-scroll 行为均不变

## Risks & Dependencies

| Risk                                                      | Mitigation                             |
| --------------------------------------------------------- | -------------------------------------- |
| `toolcall_delta` 中工具名解析不稳定（JSON 片段可能不完整）                  | 降级为 "执行中..." 无工具名，等 `toolcall_end` 再更新 |
| edit diff 展示在多替换场景下不够精确（仅显示 old\_text→new\_text 对，不显示上下文） | 接受此限制，Phase 2 可引入精确 diff 库             |
| executing 状态的 `setInterval` 在组件卸载时泄漏                      | `useEffect` return 中 `clearInterval`   |

## Sources & References

* **Origin document:** [docs/brainstorms/2026-04-04-ai-tools-display-requirements.md](docs/brainstorms/2026-04-04-ai-tools-display-requirements.md)

* Related code: `src/mainview/hooks/useAIChat.ts`（AIMessage + 事件处理）

* Related code: `src/mainview/components/ai-chat/ChatMessageList.tsx`（当前 tool 消息渲染）

* Related code: `src/bun/services/ai-stream.ts`（流式事件定义）

* Related code: `src/mainview/lib/ai-tools.ts`（工具实现 + 返回值结构）

* Institutional learning: `docs/solutions/integration-issues/ai-tool-call-cascading-failures-rpc-stream-lifecycle-2026-04-04.md`

