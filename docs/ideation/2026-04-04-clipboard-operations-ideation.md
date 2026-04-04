---
date: 2026-04-04
topic: clipboard-operations
focus: 编辑器复制/剪切/粘贴操作混乱，需要优化剪贴板管线使其清晰、可靠、可扩展
---

# Ideation: 剪贴板操作优化

## Codebase Context

### 项目架构
- Electrobun 桌面 markdown 编辑器：Bun 主进程 + WebView 渲染进程
- WYSIWYG 模式：Milkdown/Crepe (ProseMirror-based)
- 源码模式：CodeMirror
- 所有剪贴板操作通过 Bun 主进程 IPC（pbcopy/pbpaste），WebView 无原生 WebClipboard API

### 关键发现：ProseMirror 原生剪贴板被架空

当前架构中存在一个关键问题：`App.tsx` 的全局 `capture:true` 键盘处理器在 ProseMirror 之前拦截了 Cmd+C/V/X，调用 `e.preventDefault()` 后走自定义 IPC 路径。这导致：

- `clipboardBlobConverter.ts` 插件（已安装在 `useCrepeEditor.ts:245`）的 `clipboardTextSerializer` **从未被调用** — 是死代码
- Milkdown 的 `plugin-clipboard`（已安装在 `useCrepeEditor.ts:243`）的 `handlePaste` **从未被触发**
- ProseMirror 的 `text/html` 剪贴板写入、`data-pm-slice` 深度保持、HTML 解析能力 **全部被绕过**
- 每次 copy/cut/paste 都有 IPC 往返延迟，且 undo 事务不连贯

### 剪贴板相关文件
- `src/mainview/hooks/useClipboard.ts` — 主剪贴板 hook（copy/cut/paste）
- `src/mainview/components/editor/plugins/clipboardBlobConverter.ts` — ProseMirror 插件（当前死代码）
- `src/mainview/lib/image/clipboard.ts` — 图片路径/blob URL 转换
- `src/mainview/components/editor/hooks/useCrepeEditor.ts` — 编辑器 hook，注册剪贴板插件和 getSelectedMarkdown
- `src/bun/index.ts:635-712` — 主进程剪贴板 RPC（writeToClipboard/readFromClipboard）
- `src/mainview/App.tsx:1406-1456` — 全局键盘拦截器

### 历史经验
1. **WebView 剪贴板快捷键 bug**（2026-04-01）：Electrobun WebView 不支持 `execCommand('copy')`，必须走 IPC
2. **编辑器内容丢失**（2026-04-04）：`serializerCtx` 是唯一可靠的 markdown 序列化路径
3. **Frontmatter 显示 workaround**（2026-04-04）：所有内容出入口必须应用 frontmatter 转换

## Ranked Ideas

### 1. ProseMirror 原生剪贴板 + 多格式写入（架构基础）
**Description:** 移除 App.tsx 中对 Cmd+C/V/X 的 `e.preventDefault()` 拦截，让 ProseMirror 的原生剪贴板管线接管。ProseMirror 自动写入 `text/html`（DOMSerializer 序列化的 HTML）和 `text/plain`（clipboardTextSerializer 生成的 markdown），外部应用自动选择最丰富的格式。Milkdown 的 `plugin-clipboard` 已实现 markdown 序列化和智能粘贴解析，只需激活即可。

**Rationale:** 这是最高杠杆的改动。当前架构完全扼杀了 ProseMirror 的 HTML 剪贴板能力、Slice 深度保持、事务一致性、以及 Milkdown plugin-clipboard 的智能粘贴功能。`clipboardBlobConverter.ts` 已经写好了 blob URL 转换逻辑，只是从未被调用。修复后表格复制、格式化文本跨应用粘贴、拖拽一致性全部自动解决。

**Downsides:**
- 需要验证 Electrobun WebView 是否允许 ProseMirror 的 DataTransfer API 正常工作（可能需要保留 IPC 作为 fallback）
- 需要重构 App.tsx 键盘处理逻辑，INPUT/TEXTAREA 的 IPC 路径仍需保留
- `clipboardBlobConverter` 需要适配为 ProseMirror 原生事件触发时的回调

**Confidence:** 85%
**Complexity:** High
**Status:** Unexplored

### 2. 智能粘贴：HTML 检测 + turndown 转换
**Description:** 粘贴时检测系统剪贴板中的 HTML 内容（来自浏览器/Word/Google Docs），用 `turndown` 库将 HTML 转为 markdown 后插入编辑器。扩展 `readFromClipboard` RPC 支持 `pbpaste -Prefer html` 或通过 osascript 读取 `public.html`。

**Rationale:** 目前从外部粘贴富文本结果一团糟。`readFromClipboard` 只读取 `pbpaste` 纯文本，所有 HTML 结构丢失。这是 WYSIWYG 编辑器最核心的缺失能力。Milkdown plugin-clipboard 已有 `handlePaste` 钩子可以接入，且内置了 Google Docs HTML 清理逻辑。

**Downsides:**
- 新增 `turndown` 依赖
- 需要扩展主进程 RPC 支持 HTML 格式读取
- HTML → markdown 转换不一定完美，复杂表格/嵌入对象可能需要自定义规则

**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 3. 图片粘贴：直接粘贴截图/剪贴板图片
**Description:** 检测系统剪贴板中的图片数据（PNG/TIFF），保存到工作目录并插入 `![](path)` markdown 引用。复用已有的拖拽图片保存管线（`useCrepeEditor.ts:669-740` 的 `handleDrop`）。

**Rationale:** 所有主流 markdown 编辑器（Typora、Obsidian、Mark Text）的标配功能。当前粘贴截图毫无反应 — `readFromClipboard` 返回空文本，粘贴静默失败。拖拽管线的 `saveDroppedImage` RPC 和 `loadLocalImage` 已实现完整流程，只需增加剪贴板图片数据读取。

**Downsides:**
- 主进程需要新增图片数据读取能力（macOS: `osascript` 读取 `public.tiff`/`public.png`，或 NSPasteboard API）
- 跨平台实现差异（Linux/Windows 需要不同方案）
- 需要确定图片保存路径策略（`.assets/` 目录 vs 同目录）

**Confidence:** 90%
**Complexity:** Medium
**Status:** Unexplored

### 4. Frontmatter 剪贴板边界修复
**Description:** 编辑器内部将 frontmatter `---` 转为 `` ```yaml `` 代码块显示，但复制时 `getSelectedMarkdown()` 未做逆转换，导致剪贴板内容是 yaml 代码块而非 frontmatter。在 `clipboardBlobConverter.ts` 的序列化路径中调用 `convertCodeBlockToFrontmatter`。

**Rationale:** 这是一个静默数据损坏 bug。跨文档复制粘贴会悄悄将 `---` frontmatter 变为 `` ```yaml `` 代码块，在静态站点生成器等依赖 frontmatter的场景中造成问题。修复成本极低（一处函数调用），影响明确。

**Downsides:**
- 需要确保只在文档级复制（全选复制）时转换，避免部分选择 yaml 代码块时误判

**Confidence:** 95%
**Complexity:** Low
**Status:** Unexplored

### 5. 可配置的复制/粘贴模式
**Description:** Cmd+V 智能粘贴（自动检测格式），Cmd+Shift+V 纯文本粘贴，Cmd+Option+V 打开格式选择。通过设置面板（新增 clipboard 配置节）配置默认行为。

**Rationale:** 用户完全无法控制粘贴格式的解释方式。不同的工作流需要不同格式：技术文档写入 Confluence 需要 HTML，开发者粘贴到 Slack 需要 markdown，笔记用户需要纯文本。设置系统已支持嵌套分区（backup/ai/editor/appearance），添加 clipboard 分区遵循相同模式。

**Downsides:**
- 依赖前述基础设施（智能粘贴、多格式）
- 需要更新 8 个 locale 的 i18n 文件
- 快捷键变体检测依赖 App.tsx 键盘处理重构

**Confidence:** 75%
**Complexity:** Medium
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | 剪贴板历史环 | 锦上添花功能，偏离核心剪贴板质量问题，应作为后续特性 |
| 2 | AI 驱动粘贴转换 | 有趣但过早 — 基础剪贴板能力尚未建立 |
| 3 | Undo 一致性事务 | 切换到 ProseMirror 原生剪贴板后自然解决 |
| 4 | 空选区竞态条件修复 | 真实 bug 但影响小，重构时顺带修复 |
| 5 | 源码模式/WYSIWYG 模式不对称 | 统一 ProseMirror 剪贴板后自然解决 |
| 6 | LaTeX 数学公式剪贴板 | 应作为可插拔管线中的一个插件，而非独立想法 |
| 7 | 表格格式协商（markdown/TSV/HTML） | 多格式剪贴板 + ProseMirror 原生处理自动覆盖 |
| 8 | 剪贴板操作 toast 反馈 | UX 优化，基础能力建立后再考虑 |
| 9 | 统一内容转换服务 | 正确方向但与想法 #1 高度重叠，作为实现细节而非独立想法 |
| 10 | Copy as Rendered（视觉剪贴板） | 已被想法 #1 的多格式剪贴板包含 |

## Session Log
- 2026-04-04: Initial ideation — 40 candidates generated (5 agents x ~8 ideas), 15 unique after dedupe, 5 survived filtering
