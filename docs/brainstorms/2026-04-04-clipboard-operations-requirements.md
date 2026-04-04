---
date: 2026-04-04
topic: clipboard-operations
---

# 剪贴板操作重构

## Problem Frame

MarkBun 编辑器的复制/剪切/粘贴操作存在多个问题：

1. **复制丢失格式**：当前所有剪贴板操作走 IPC（pbcopy/pbpaste），只写入 text/plain。复制内容粘贴到 Word/Slack/Google Docs 时，markdown 源码直接出现，格式丢失。
2. **粘贴丢失格式**：从浏览器/Office 粘贴富文本时，HTML 结构完全丢失，只得到纯文本。
3. **截图无法粘贴**：系统剪贴板中的图片数据（如截图）无法粘贴，`readFromClipboard` 只返回文本。
4. **Frontmatter 静默损坏**：编辑器内部将 `---` frontmatter 转为 `` ```yaml `` 代码块显示，但复制时未做逆转换，导致剪贴板内容是 yaml 代码块而非 frontmatter。
5. **架构混乱**：App.tsx 全局拦截 Cmd+C/V/X（capture:true + preventDefault），完全绕过了 ProseMirror 的原生剪贴板管线。已安装的 Milkdown plugin-clipboard 和 clipboardBlobConverter 插件从未被键盘操作触发。

**经验证的关键事实：**
- Electrobun WebView 中，`copy`/`cut` 事件正常触发,`paste` 事件不触发（WebView 原生插入 text/plain，不经过 JS)
- Electrobun 原生菜单注册了 CmdOrCtrl+C/X/V 作为 `menu.ts` 中的快捷键，会在 ProseMirror 夋到事件之前拦截
- DataTransfer、ClipboardEvent、clipboardData.setData/getData 全部可用
- 因此采用**混合方案**：复制/剪切走 ProseMirror 原生，粘贴走 IPC + turndown 转换

## Requirements

**复制与剪切（ProseMirror 原生）**

- R1. WYSIWYG 模式下 Cmd+C 走 ProseMirror 原生 copy 事件，不再通过 App.tsx 拦截和 IPC。ProseMirror 自动写入 `text/html`（DOMSerializer 输出）和 `text/plain`（clipboardTextSerializer 输出的 markdown）。
- R2. WYSIWYG 模式下 Cmd+X 走 ProseMirror 原生 cut 事件，行为同 R1 加删除选中内容。
- R3. clipboardTextSerializer 输出的 markdown 中，blob URL 已转换为原始文件路径（复用现有 `clipboardBlobConverter` 插件逻辑）。
- R4. clipboardTextSerializer 输出的 markdown 中，yaml 代码块已转换为 frontmatter `---` 格式（修复静默损坏 bug）。

**粘贴（IPC + 智能转换）**

- R5. WYSIWYG 模式下 Cmd+V 仍由 App.tsx 拦截（因 paste 事件不触发），通过 IPC 读取系统剪贴板内容。
- R6. readFromClipboard RPC 扩展为同时返回 `text`（text/plain）和 `html`（text/html，如有）。
- R7. 粘贴时优先使用 HTML 内容，通过 turndown 转为 markdown，再通过 Milkdown parser 插入编辑器。若无 HTML，则将纯文本作为 markdown 解析插入。
- R8. 粘贴的 markdown 中，本地图片路径转换为 blob URL（复用现有 `processFromClipboard` 逻辑）。
- R9. Cmd+Shift+V 粘贴为纯文本，不经过 markdown/turndown 解析，直接作为字面文本插入。

**图片粘贴**

- R10. 检测系统剪贴板中的图片数据（PNG/TIFF），保存到工作目录并插入 `![image](relative/path)` markdown 引用。复用已有拖拽图片保存管线（saveDroppedImage RPC）。

**源码模式**

- R11. 源码模式（CodeMirror）的复制/剪切/粘贴不做修改，依赖 WebView 原生处理。

**INPUT/TEXTAREA 元素**

- R12. `<input>` 和 `<textarea>` 中的剪贴板操作保持现有 IPC 路径不变。

## User Flow

```
复制 (Cmd+C)
  WYSIWYG → ProseMirror copy 事件 → clipboardData.setData('text/html', html)
                                       clipboardData.setData('text/plain', markdown)
  Source   → 原生处理
  Input    → IPC writeToClipboard

粘贴 (Cmd+V)
  WYSIWYG → App.tsx 拦截 → IPC readFromClipboard({ html })
           → 有 HTML? → turndown(html) → markdown → Milkdown parser → 插入
           → 无 HTML? → text 作为 markdown → Milkdown parser → 插入
           → 有图片? → saveClipboardImage → ![](path) → 插入
  Source   → 原生处理
  Input    → IPC readFromClipboard → insertText

粘贴 (Cmd+Shift+V)
  WYSIWYG → App.tsx 拦截 → IPC readFromClipboard
           → text 直接作为字面文本插入，不经过 markdown 解析
```

## Success Criteria

- 在 WYSIWYG 编辑器内复制内容再粘贴回来，格式无损失（无丢失样式、无多余空白、无结构变化）
- 从 MarkBun 复制带格式的文本（标题、列表、粗体、表格），粘贴到浏览器/Slack/Word 时保留可见格式
- 从浏览器复制带格式的 HTML（包含粗体、链接、列表、表格），粘贴到 MarkBun 时正确转为 markdown 格式
- 截图后 Cmd+V 自动保存图片并插入 markdown 图片引用
- Cmd+Shift+V 粘贴纯文本，不解析 markdown 语法
- 复制包含 frontmatter 的文档内容，剪贴板输出 `---` 格式而非 `` ```yaml ``
- 源码模式、INPUT/TEXTAREA 的剪贴板行为无回归

## Scope Boundaries

- **不含**：剪贴板历史（clipboard history ring）
- **不含**：AI 驱动的粘贴转换
- **不含**：用户可配置的默认粘贴模式（设置面板）
- **不含**：LaTeX 数学公式的专门剪贴板处理（作为后续可插拔管线的一部分）
- **HTML 转换为 best-effort**：turndown 处理常见 HTML 结构，复杂布局（嵌套表格、复杂 CSS）可能不完全转换

## Key Decisions

- **混合方案**：复制/剪切走 ProseMirror 原生（copy/cut 事件可用），粘贴走 IPC（paste 事件不触发）。经验证确认。
- **turndown 用于 HTML→markdown**：新增 turndown 依赖，用于将外部 HTML 转为 markdown。不修改 Milkdown plugin-clipboard 的 handlePaste（因为 paste 事件不触发，该处理器永远不会运行）。
- **图片粘贴复用拖拽管线**：已有的 `saveDroppedImage` RPC + `loadLocalImage` 逻辑可直接复用，只需在主进程新增剪贴板图片数据读取能力。
- **Frontmatter 修复在 clipboardTextSerializer 中**：在 `clipboardBlobConverter.ts` 的序列化输出上叠加 `convertCodeBlockToFrontmatter` 调用。

## Dependencies / Assumptions

- **turndown**：需要新增 npm 依赖（当前未安装）
- **主进程 HTML 读取**：macOS 使用 `osascript` 读取剪贴板 HTML（`the clipboard as «class HTML»`）；Linux 使用 `xclip -t text/html -o`；Windows 使用 PowerShell。注意：`pbpaste` 不支持 HTML flavor（`-Prefer` 只接受 txt/rtf/ps）
- **主进程图片读取**：macOS 使用 `osascript` 读取 `public.tiff`/`public.png`；跨平台方案待规划阶段确定
- **clipboardBlobConverter 插件**：已有代码逻辑正确，只需确认在 ProseMirror 原生 copy 事件下正常触发
- **convertCodeBlockToFrontmatter 提取**：当前为 useCrepeEditor.ts 中的私有函数，需提取为共享模块后才能在 clipboardBlobConverter.ts 中使用

## Outstanding Questions

### Deferred to Planning

- [Affects R6][Technical] macOS osascript 读取 HTML 巷贴板的具体实现方式（`the clipboard as «class HTML»` 编码为 UTF-8 的十六进制 hex string）需验证；备选方案：通过 NSPasteboard 的 Swift helper 辅助
- [Affects R10][Needs research] macOS 读取剪贴板图片数据的最佳方式（osascript vs NSPasteboard via Swift helper vs 其他）
- [Affects R7][Technical] turndown 的自定义规则需要覆盖哪些 HTML 结构（表格、Google Docs 包裹、Word XML 等）
- [Affects R3/R4][Technical] clipboardBlobConverter.ts 是否需要重构为独立的 ProseMirror 插件，还是继续在现有插件中扩展

## Next Steps

→ `/ce:plan` for structured implementation planning
