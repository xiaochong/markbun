***

date: 2026-04-04
topic: ai-tools-display
focus: 优化AI面板中read/edit/write工具的显示和交互反馈体验
-----------------------------------------

# Ideation: AI 工具显示与交互体验优化

## Codebase Context

**当前实现状态**:

* AI Chat Panel 位于右侧边栏，使用 `ChatMessageList` 组件渲染消息

* 工具消息 `role='tool'` 显示为灰色背景的小字体 monospace 块

* 直接渲染 `JSON.stringify(toolResult)`，如 `{"content":"古诗词大会\n"}`

* 工具调用事件：Bun端 `ai-stream.ts` 发送 `toolcall_start` → WebView执行 → `toolcall_end`（带结果）

* 3个原子工具：read（读文档）、edit（查找替换）、write（写文档）

**当前痛点**:

1. 工具显示为原始JSON，用户不友好
2. 没有区分不同工具类型的视觉设计
3. 工具执行过程无反馈（不知道何时开始/完成）
4. 长内容直接显示，占用大量空间
5. edit工具的修改内容无法直观理解

***

## Ranked Ideas

### 1. 分层折叠卡片 ⭐⭐⭐

**描述**: 将工具调用封装为可折叠卡片，分三层渐进展示：

* 第一层（默认）：图标 + 工具名 + 执行状态（如 "✓ 已读取文档"）

* 第二层（点击展开）：格式化详情（diff预览/内容摘要/统计数字）

* 第三层（再次点击）：原始JSON数据（调试用）

**为什么重要**:

* 渐进式信息披露减少认知负荷

* 节省垂直空间，让用户专注于AI回复内容

* 同时满足普通用户（看摘要）和开发者（看JSON）的需求

**实现要点**:

* 使用现有的 `role='tool'` 消息结构

* 添加 `isExpanded` 本地状态

* 第三层使用 `<details>` 或自定义折叠

**Downsides**: 需要额外的点击操作查看详情
**Confidence**: 95%
**Complexity**: Low
**Status**: Unexplored

***

### 2. 工具视觉标识系统 ⭐⭐⭐

**描述**: 为三种工具设计专属视觉标识：

* **read**: 眼睛图标 👁 + 蓝色主题

* **edit**: 铅笔图标 ✏️ + 黄色/橙色主题

* **write**: 文档图标 📝 + 绿色主题

图标和颜色贯穿整个工具卡片：头部图标、边框颜色、状态指示器。

**为什么重要**:

* 人类识别图标比阅读文字快60%（认知心理学研究）

* 颜色编码建立即时视觉关联

* 快速滚动时也能一眼识别工具类型

**实现要点**:

* 在 `AIMessage` 类型中保留 `toolName`

* 创建 `getToolConfig(toolName)` 辅助函数返回图标/颜色

* 使用 Tailwind 的 `border-l-4` 或背景色区分

**Downsides**: 需要维护工具配置映射
**Confidence**: 90%
**Complexity**: Low
**Status**: Unexplored

***

### 3. Diff可视化系统 ⭐⭐⭐

**描述**: 针对edit工具的修改操作，展示直观的diff视图：

* 旧文本：红色背景 + 删除线

* 新文本：绿色背景 + 高亮

* 顶部徽章："已替换 3 处"

对于write工具，显示字数统计徽章和内容的渐变预览（超出部分淡出）。

**为什么重要**:

* 用户最关心"什么被改变了"

* diff视图比阅读两段完整文本高效得多

* 程序员熟悉diff语义，非程序员也能理解红绿含义

**实现要点**:

* edit工具的 `toolResult` 包含 `replacements` 数字

* 工具参数中的 `old_text` 和 `new_text` 可以展示为inline diff

* 长diff可以截断显示前后各100字符

**参考设计**:

* GitHub Copilot的代码建议diff

* Cursor的代码编辑高亮

* Warp终端的AI修改建议

**Downsides**: 大段文本的diff可能仍占用较多空间
**Confidence**: 88%
**Complexity**: Medium
**Status**: Unexplored

***

### 4. 执行状态反馈 ⭐⭐

**描述**: 为工具执行过程提供实时状态可视化：

* **执行中**: 脉冲动画（圆点或边框）+ 实时耗时（如 "120ms"）

* **成功**: 绿色勾选图标（带短暂动画）+ 最终耗时

* **失败**: 红色错误图标 + 错误摘要 + 展开查看详情

* **超时**: 橙色警告图标

**为什么重要**:

* 当前用户对工具执行完全无感知，产生"系统是否卡住"的不确定感

* 性能可见性帮助建立系统响应预期

* 明确的完成状态让用户知道何时可以继续交互

**实现要点**:

* `toolcall_start` 事件触发状态变为"执行中"

* `toolcall_end` 事件根据 `isError` 更新状态

* 使用 CSS 动画（pulse/animate-spin）

**参考设计**:

* Claude Desktop的工具调用动画

* ChatGPT代码解释器的"Analyzing..."状态

* Raycast命令执行的耗时显示

**Downsides**: 工具执行通常很快（10-500ms），动画可能一闪而过
**Confidence**: 92%
**Complexity**: Low
**Status**: Unexplored

***

### 5. 智能内容摘要 ⭐⭐

**描述**: 针对read工具返回的长文档内容，展示智能摘要而非完整内容：

* 统计行：📄 已读取 1,234 字 · 56 行 · 约 300 tokens

* 预览区：前300字符的内容预览

* 操作："查看完整内容"展开按钮

**为什么重要**:

* 避免长文档淹没对话流，保持面板整洁

* 统计数字提供足够上下文，用户知道AI"看"了多少内容

* 大多数情况不需要看到完整文档来理解AI的回复

**实现要点**:

* read返回的 `content` 可能很长，需要截断

* 计算字数、行数、预估token数（粗略估算：1 token ≈ 4 字符中文）

* 使用 `max-height` + `overflow:hidden` + 渐变遮罩实现预览效果

**参考设计**:

* Cursor的@file引用显示文件路径和行数

* Notion AI引用文档时显示"已读取 X 个页面"

**Downsides**: 用户偶尔需要点击展开才能看到关键内容
**Confidence**: 90%
**Complexity**: Low
**Status**: Unexplored

***

### 6. 编辑器联动预览 ⭐⭐

**描述**: 将AI工具操作与编辑器产生视觉联动，创造编辑器独有的体验优势：

* AI执行edit前：在编辑器中高亮标记 `old_text` 的范围（黄色背景）

* AI执行edit后：在编辑器中显示修改（旧文本红色删除线，新文本绿色高亮）

* 在行旁 gutter 显示"AI修改"标记

**为什么重要**:

* 将AI操作从"黑盒"变为"透明手术"，建立用户信任

* 这是Claude/ChatGPT无法做到的编辑器原生体验

* 用户无需在AI面板和编辑器之间来回对比

**实现要点**:

* 需要编辑器暴露Decoration API（ProseMirror decorations）

* 通过RPC从AI面板通知编辑器高亮位置

* 需要处理多个修改位置的批量高亮

**参考设计**:

* GitHub Copilot的inline diff

* Cursor的代码编辑直接高亮修改行

* Figma的协作光标（变体思路）

**Downsides**: 技术复杂度高，需要深入的ProseMirror知识
**Confidence**: 85%
**Complexity**: High
**Status**: Unexplored

***

### 7. 工具链时间线 ⭐

**描述**: 当一次对话触发多个工具调用时，以时间线形式展示执行序列：

* 垂直时间线连接各个工具卡片

* 每个节点显示：工具图标、名称、耗时、结果状态

* 折叠视图："已执行 3 个工具"，点击展开完整时间线

**为什么重要**:

* 复杂任务可能涉及 read→edit→read 的链式调用

* 时间线帮助用户理解AI的思考过程和执行顺序

* 增强对AI行为的可解释性

**实现要点**:

* 跟踪同一session中的连续工具调用

* 使用时间线组件（CSS border-left + 圆点标记）

* 可展开/折叠的容器

**参考设计**:

* Claude Desktop的复杂任务工具调用序列

* LangSmith的LLM调用链流程图

* OpenAI DeepResearch的研究步骤展示

**Downsides**: 大多数对话只触发1-2个工具，时间线价值有限
**Confidence**: 80%
**Complexity**: Medium
**Status**: Unexplored

***

## Rejection Summary

| #  | Idea        | Reason Rejected            |
| -- | ----------- | -------------------------- |
| 1  | 文件路径面包屑导航   | 当前AI工具在单文档内操作，路径信息冗余       |
| 2  | 内容预览浮层      | 与分层折叠卡片重复，增加交互复杂度          |
| 3  | AI意图猜测气泡    | 打断用户流程，v0.6阶段增加认知负担        |
| 4  | 智能选择锚点      | 技术复杂度高，需要大量ProseMirror装饰逻辑 |
| 5  | 协作光标与AI幽灵指针 | 工具执行太快（10-500ms），动画来不及感知   |
| 6  | 语义块悬浮卡片     | 偏离"AI面板工具显示"核心问题，属于新功能     |
| 7  | 错误状态分层展示    | 当前工具错误类型有限，3种状态足够          |
| 8  | 操作确认微交互     | 与执行状态反馈重复，保留更系统的方案         |
| 9  | 工具参数表格化     | 已合并到分层折叠卡片中                |
| 10 | 模型路由与成本追踪   | v0.6阶段单模型，无需此功能            |

***

## Implementation Priority

### Phase 1: 核心体验（立即实施）

1. **分层折叠卡片** - 基础架构，其他功能依赖它
2. **工具视觉标识系统** - 低成本高回报
3. **执行状态反馈** - 填补当前体验空白

### Phase 2: 增强体验（v0.6.x）

1. **Diff可视化系统** - 需要更多UI设计
2. **智能内容摘要** - 优化read工具体验

### Phase 3: 创新体验（v0.7+）

1. **编辑器联动预览** - 需要深入编辑器架构
2. **工具链时间线** - 依赖多工具调用场景

***

## Session Log

* 2026-04-04: Initial ideation — 4 agents × 7-8 ideas = 31 raw ideas, 7 survivors after dedup and adversarial filtering

* Focus: AI panel tool display optimization based on user screenshot feedback

