---
date: 2026-04-01
topic: command-palette
---

# Command Palette

## Problem Frame

MarkBun 有大量菜单动作（文件操作、编辑、插入块、视图切换、设置等），但许多动作没有键盘快捷键。用户每次都要通过菜单栏查找操作，打断编辑流程。现有的 Cmd+P Quick-Open 仅搜索最近打开的文件（受 MAX_RECENT_FILES 存储上限限制），无法触达任何命令动作。

命令面板将 Quick-Open 扩展为统一的搜索入口，让所有操作可搜索、可发现、可执行。

## Requirements

**交互模式**
- R1. Cmd+P 打开统一面板，同时搜索文件和命令（无需新增快捷键）
- R2. 结果分两组显示：文件组 + 命令组。两组在同一个可滚动列表中，各有标题分隔（"文件"/"命令"），标题行不可选中。每组最多显示 7 条结果，总计不超过 14 条
- R3. 未输入查询时，显示最近使用的命令 + 最近打开的文件

**命令覆盖范围**
- R4. 包含所有菜单动作（文件、编辑、视图、格式等菜单项）
- R5. 包含编辑器插入块操作（标题、表格、代码块、引用、分割线等）— 包括表格子菜单中的单步操作（insert-row-above 等）
- R6. 包含视图切换操作（侧边栏、大纲、源码模式）
- R7. 包含设置/偏好操作（打开设置、切换语言）

**命令显示**
- R8. 每个命令显示：名称（使用现有 i18n 键）+ 对应快捷键（如有）；无快捷键的命令仅显示名称
- R9. 文件结果与现有 QuickOpen 行为一致（显示文件名、路径、最近标记）

**命令执行**
- R10. 选中命令后按 Enter，面板立即关闭，通过 sendMenuAction RPC 经主进程路由执行动作（与菜单栏点击走相同的 application-menu-clicked / sendMenuAction 路径）。动作行为与从菜单栏触发完全一致

**使用历史**
- R11. 记录最近使用的命令，影响排序：空查询时最近使用的命令排在前面；有查询时匹配结果中最近使用的获得分数加成
- R12. 使用历史持久化存储（与 recent-files 同级目录）

**键盘导航**
- R13. 保留现有键盘行为：↑↓ 选择、Enter 确认、Escape 关闭
- R14. 面板打开时默认聚焦文件组；Tab / Shift+Tab 在文件组和命令组之间切换焦点（当两组都有结果时）。切换时 selectedIndex 重置为 0；↑↓ 仅在当前焦点组内导航；输入新查询时取消组焦点，搜索两组

**搜索匹配**
- R15. 命令搜索使用与文件搜索相同的模糊匹配算法，匹配目标为当前 locale 的 i18n 显示名称

**空组处理**
- R16. 当某一组无匹配结果时，隐藏该组，Tab 切换仅在两组都有结果时可用

**状态管理**
- R17. toggle 类命令（显示/隐藏侧边栏、深色/浅色主题）始终显示统一的 toggle 标签（如"切换侧边栏"），不反映当前开/关状态

**新 UI 元素的 i18n**
- R18. 新增 i18n 键：分组标题（文件/命令）、更新键盘提示文本（含 Tab），添加到现有 8 个 locale 文件中

## Success Criteria
- 用户可通过 Cmd+P 搜索并执行任意菜单动作，无需鼠标
- 搜索响应时间 < 50ms（命令列表为本地静态数据，过滤/评分无 IO 开销；首次打开可能包含一次性历史记录读取）
- 新增菜单动作只需在菜单定义（menu.ts）中添加即可出现在命令面板中，无需额外的命令面板注册步骤

## Scope Boundaries
- 不包含多步命令工作流（如 "Insert > Table > 选择 3x4 尺寸"）— 但子菜单中的单步动作（table-insert-row-above 等）作为独立命令包含
- 不包含自定义命令或用户定义快捷键
- 不包含命令执行结果的撤销（依赖各动作自身的撤销机制）
- 不包含命令的上下文感知（如在源码模式下隐藏 WYSIWYG-only 命令）— 所有命令始终显示，不可用时静默无操作

## Key Decisions
- **统一入口而非分离模式 (Cmd+P vs Cmd+Shift+P):** 减少快捷键记忆负担，复用现有 Cmd+P 肌肉记忆。已评估短查询歧义风险（如"save"匹配命令+文件），认为分组显示足够消歧；若实际体验不佳可后续增加 > 前缀过滤
- **分组显示而非混合排序:** 文件和命令是不同的操作意图，分组让用户快速定位目标类型
- **最近使用优先而非频率加权:** 实现简单，存储开销小，满足大多数场景
- **利用现有 i18n 键作为命令名称:** 不新增翻译负担（命令名称部分），新增菜单动作自动出现
- **命令列表从菜单定义提取，非运行时反射:** 需要构建一个统一的命令注册表（command registry），将分散在 menu.ts / index.ts / App.tsx 中的动作信息聚合。这是实现前置条件

## Dependencies / Assumptions
- 需要设计并实现一个命令注册表（command registry），作为命令列表的单一数据源。当前动作分散在 4 个位置：menu.ts（菜单树定义）、index.ts actionToEvent 映射（RPC 路由）、index.ts switch/case（原生动作处理）、App.tsx（formatActions/paragraphActions + switch/case 执行）。上下文菜单还重复定义了部分动作字符串（如 table-insert-row-above），注册表需去重
- 菜单 i18n 键（menu namespace）仅在主进程可用，renderer 需要引入 menu namespace 或通过 RPC 获取标签。具体方案由规划阶段决定
- 编辑器插入块操作已通过菜单系统暴露为可调用的动作字符串
- `file-export-pdf` 是一个不完整的特性：menu.ts 导出子菜单无此项、8 个 locale 的 menu.json 无 `exportPDF` 键、App.tsx 的 menuAction handler 无对应 case。命令面板应排除此动作，直到三项全部补全
- 现有 QuickOpenItem 类型和 onSelect 回调仅为文件设计，命令需要扩展或引入新类型

## Outstanding Questions

### Deferred to Planning
- [Affects R4-R7][Technical] 命令列表的完整 inventory — 需要在规划阶段扫描所有 menu action 字符串和编辑器命令，确定完整列表
- [Affects R11][Technical] 使用历史的存储格式和位置 — 建议 `~/.config/markbun/command-history.json`，但具体结构由规划阶段决定
- [Affects R10][Technical] 命令注册表的设计 — 放在 shared/types.ts？如何聚合 3 个分散的动作来源？构建时生成还是运行时构建？
- [Affects R8][Technical] renderer 如何获取菜单 i18n 标签 — 添加 menu namespace 到 renderer i18n，还是通过 RPC 从主进程获取？

## Next Steps
→ `/ce:plan` for structured implementation planning
