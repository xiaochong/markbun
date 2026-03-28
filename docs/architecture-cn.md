# MarkBun 架构

## 概述

MarkBun 是一款类似 Typora 的 Markdown 桌面编辑器，采用现代高性能技术栈构建。本文档描述其架构、设计决策和技术实现细节。

## 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MarkBun 应用                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────┐         IPC (JSON-RPC)         ┌─────────────────┐   │
│   │     主进程       │◄───────────────────────────────►│   渲染进程      │   │
│   │  (Electrobun)   │                                │   (WebView)     │   │
│   │                 │                                │                 │   │
│   │  • Bun 运行时   │                                │  • React        │   │
│   │  • 文件 I/O     │                                │  • Milkdown     │   │
│   │  • 系统 API     │                                │  • CodeMirror   │   │
│   │  • 菜单         │                                │  • shadcn/ui    │   │
│   └─────────────────┘                                └─────────────────┘   │
│            │                                                  │              │
│            ▼                                                  ▼              │
│   ┌─────────────────┐                                ┌─────────────────┐   │
│   │    文件系统      │                                │   用户界面      │   │
│   │  • 读取文件     │                                │  • 编辑器       │   │
│   │  • 写入文件     │                                │  • 侧边栏       │   │
│   │  • 监听目录     │                                │  • 工具栏       │   │
│   │  • 备份恢复     │                                │  • 状态栏       │   │
│   └─────────────────┘                                └─────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 技术栈

| 层级             | 技术            | 用途                                          |
| ----------------- | --------------- | -------------------------------------------- |
| 运行时           | Bun             | JavaScript 运行时、打包器、包管理器            |
| 桌面框架         | Electrobun      | 跨平台原生桌面应用                            |
| 编辑器核心       | Milkdown (Crepe)| 所见即所得 Markdown 编辑器框架                 |
| 源码编辑器       | CodeMirror 6   | 源码模式 Markdown 编辑                        |
| UI 框架          | React           | 组件化 UI                                     |
| UI 组件          | shadcn/ui       | 无障碍、可定制的组件                          |
| 样式             | Tailwind CSS    | 原子化 CSS                                    |
| 文档模型         | ProseMirror     | 富文本编辑基础                                |
| Markdown 解析器  | Remark          | Markdown AST 处理                             |
| 国际化           | i18next         | 多语言支持（8 种语言）                        |
| 验证             | Zod             | 设置 Schema 验证                              |

## 进程架构

### 主进程（Bun + Electrobun）

主进程运行在 Bun 运行时中，拥有系统 API 的完整访问权限。

**职责：**

* 窗口管理（创建、调整大小、关闭）
* 原生菜单（应用菜单、上下文菜单）
* 文件系统操作（读取、写入、监听）
* 三层备份与恢复系统
* 自动更新
* 国际化（菜单翻译）

**核心 API：**

```typescript
import Electrobun, {
  BrowserWindow,
  BrowserView,
  Updater,
  Utils,
  ApplicationMenu,
  ContextMenu,
  Screen
} from "electrobun/bun";
```

### 渲染进程（WebView）

渲染进程运行在原生 WebView 中，使用 React 渲染 UI。

**职责：**

* 渲染编辑器 UI
* 处理用户输入
* 显示 Markdown 内容
* 管理本地 UI 状态

**核心 API：**

```typescript
import { Electroview } from "electrobun/view";
```

### IPC 通信

主进程与渲染进程通过 Electrobun 的 IPC 系统使用 JSON-RPC 进行通信。

```
渲染进程 ──► BrowserView.defineRPC（类型化请求处理器）──► 主进程
主进程 ────► webview.rpc.send.messageName(params) ──────► 渲染进程
```

**请求 RPC（渲染进程 → 主进程）：**

* **文件操作**：`openFile`, `openFolder`, `saveFile`, `saveFileAs`, `readFile`, `readFolder`, `getCurrentFile`, `getPendingFile`
* **文件管理**：`createFile`, `createFolder`, `deleteFile`, `moveFile`, `renameFile`, `openInFinder`, `fileExists`, `getFileStats`
* **最近文件**：`getRecentFiles`, `addRecentFile`, `removeRecentFile`, `clearRecentFiles`, `quickOpen`
* **设置与 UI 状态**：`getSettings`, `saveSettings`, `getUIState`, `saveUIState`, `updateWindowBounds`
* **备份与恢复**：`checkRecovery`, `clearRecovery`, `recoverFile`, `writeRecovery`, `getVersionBackups`, `restoreVersionBackup`, `deleteVersionBackup`
* **图片处理**：`readImageAsBase64`, `selectImageFile`, `saveDroppedImage`
* **导出**：`saveExportedFile`
* **剪贴板**：`writeToClipboard`, `readFromClipboard`
* **国际化**：`setLanguage`, `getSystemLanguage`
* **对话框**：`showConfirmationDialog`, `showUnsavedChangesDialog`, `showPromptDialog`, `listFolder`, `getParentFolder`, `saveFileWithPath`

**消息（主进程 → 渲染进程）：**

`fileOpened`, `folderOpened`, `fileNew`, `fileSaveRequest`, `fileSaveAsRequest`, `fileOpenRequest`, `toggleTheme`, `showAbout`, `toggleTitlebar`, `toggleToolbar`, `toggleStatusbar`, `toggleSidebar`, `openQuickOpen`, `openSettings`, `toggleSourceMode`, `openFileHistory`, `menuAction`, `languageChanged`

## 组件架构

### 编辑器组件层级

```
App
├── TitleBar（条件渲染）
├── Main Content Area (flex row)
│   ├── Sidebar（条件渲染，选项卡式）
│   │   ├── FileExplorer（文件选项卡）
│   │   └── Outline（大纲选项卡）
│   │
│   └── Editor Area (flex col, flex-1)
│       ├── Toolbar（条件渲染）
│       ├── Editor（三种模式之一）：
│       │   ├── MilkdownEditor（所见即所得模式）
│       │   ├── SourceEditor（源码模式，CodeMirror 6）
│       │   └── ImageViewer（图片预览）
│       └── StatusBar（条件渲染）
│
└── Dialogs（均为条件渲染）
    ├── QuickOpen (Cmd+P 文件查找)
    ├── ImageInsertDialog
    ├── SettingsDialog
    ├── FileDialog（打开/保存）
    ├── RecoveryDialog
    ├── FileHistoryDialog
    ├── SaveDialog
    └── AboutDialog
```

注意：TitleBar、Toolbar、StatusBar、Sidebar 的可见性通过"视图"菜单切换，并持久化到 UI 状态中。

### Milkdown 集成

Milkdown 通过 **Crepe**（Milkdown 的高级封装）作为封装 ProseMirror 编辑器的 React 组件进行集成。

```
MilkdownEditor (React 组件, forwardRef + memo)
├── useCrepeEditor (自定义 Hook)
│   ├── Crepe (来自 @milkdown/crepe)
│   │   ├── 功能配置：
│   │   │   ├── BlockEdit: 禁用
│   │   │   ├── LinkTooltip: 启用
│   │   │   ├── Toolbar: 禁用（使用自定义 Toolbar）
│   │   │   ├── ImageBlock: 启用（自定义 onUpload, proxyDomURL）
│   │   │   └── CodeMirror: 启用（含 Mermaid 图表渲染）
│   │   │
│   │   └── 插件：
│   │       ├── clipboard (@milkdown/plugin-clipboard)
│   │       ├── history (@milkdown/plugin-history)
│   │       ├── gfm (@milkdown/preset-gfm)
│   │       ├── clipboardBlobConverter（自定义 — blob URL 处理）
│   │       ├── inlineMarksPlugin（自定义 — 高亮、上标、下标）
│   │       ├── breaksPlugin（自定义 — 软换行）
│   │       └── inlineMarksParsersPlugin（自定义 — remarkHighlight, remarkSuperSub）
│   │
│   └── 内容加载：
│       ├── 直接解析（< 500 行）
│       └── 分块加载（>= 500 行，按代码块感知分割）
│
├── useThemeLoader (自定义 Hook)
│   ├── @milkdown/crepe/theme/frame.css（浅色模式）
│   └── @milkdown/crepe/theme/frame-dark.css（深色模式）
│
├── useContextMenu (自定义 Hook)
│
└── 样式导入：
    ├── @milkdown/crepe/theme/common/style.css
    └── @milkdown/crepe/theme/common/link-tooltip.css
```

### 源码编辑器（CodeMirror 6）

在源码模式下作为所见即所得编辑器的替代方案：

```
SourceEditor (React 组件)
├── EditorView + EditorState
├── @codemirror/lang-markdown
├── @codemirror/theme-one-dark（深色模式）
├── 扩展：lineNumbers, history, search, bracketMatching
└── 自定义浅色/深色主题语法高亮
```

## 数据流

### 文件打开流程

```
1. 用户点击"打开"菜单或 Cmd+O
   ↓
2. 主进程：ApplicationMenu 触发 "file-open" 动作
   ↓
3. 主进程：显示原生文件选择对话框
   ↓
4. 用户选择文件
   ↓
5. 主进程：通过 readFile RPC 读取文件内容
   ↓
6. 主进程：通过 IPC 发送到渲染进程
   ↓
7. 渲染进程：更新编辑器内容
   ↓
8. 渲染进程：更新标题栏
```

### 自动保存流程

```
1. 编辑器内容变更（ProseMirror transaction）
   ↓
2. 渲染进程：防抖（可配置间隔，默认 2000ms）
   ↓
3. 渲染进程：序列化为 Markdown
   ↓
4. 渲染进程：调用 saveFile RPC
   ↓
5. 主进程：写入恢复文件（崩溃保护）
   ↓
6. 主进程：创建版本备份（如已启用）
   ↓
7. 主进程：原子写入（.tmp + rename）
   ↓
8. 主进程：清除恢复文件
   ↓
9. 渲染进程：更新保存状态指示器
```

### 主题切换流程

```
1. 用户切换深色/浅色模式
   ↓
2. 渲染进程：更新 React 状态
   ↓
3. 渲染进程：将 CSS 类应用到根元素
   ↓
4. 渲染进程：动态加载 Crepe 主题 CSS
   ↓
5. 渲染进程：通过 IPC 通知主进程
   ↓
6. 主进程：将偏好持久化到设置文件
```

## 状态管理

### 本地组件状态（React useState）

用于不需要持久化的 UI 状态：

* 侧边栏展开/收起
* 侧边栏中的活动面板
* 工具栏按钮悬停状态
* 对话框可见性

### 编辑器状态（ProseMirror）

由 Milkdown/ProseMirror 内部管理：

* 文档内容（JSON 树）
* 选区状态
* 撤销/重做历史
* 插件状态

通过以下方式访问：

```typescript
editor.action(ctx => {
  const view = ctx.get(editorViewCtx);
  const state = view.state;
  // ...
});
```

### 全局设置

使用 Zod 验证的嵌套 Schema 持久化到磁盘。启动时加载。

```typescript
interface Settings {
  __version: 1;
  general: {
    autoSave: boolean;         // 默认: true
    autoSaveInterval: number;  // 500-30000ms, 默认: 2000
    language: 'en' | 'zh-CN' | 'de' | 'fr' | 'ja' | 'ko' | 'pt' | 'es';
  };
  editor: {
    fontSize: number;   // 10-32, 默认: 15
    lineHeight: number; // 1-3, 默认: 1.65
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';  // 默认: 'system'
    sidebarWidth: number;                  // 150-500, 默认: 280
  };
  backup: {
    enabled: boolean;           // 默认: true
    maxVersions: number;        // 5-100, 默认: 20
    retentionDays: number;      // 1-365, 默认: 30
    recoveryInterval: number;   // 5000-120000ms, 默认: 30000
  };
}
```

### UI 状态

独立于设置 — 存储临时的窗口/布局状态：

```typescript
interface UIState {
  showTitleBar: boolean;
  showToolBar: boolean;
  showStatusBar: boolean;
  showSidebar: boolean;
  sourceMode: boolean;
  sidebarWidth: number;
  sidebarActiveTab: 'files' | 'outline' | 'search';
  windowX: number;
  windowY: number;
  windowWidth: number;
  windowHeight: number;
  displayId?: number;
}
```

### 存储路径

所有平台使用统一路径：

* 设置：`~/.config/markbun/settings.json`
* UI 状态：`~/.config/markbun/ui-state.json`
* 恢复文件：`~/.config/markbun/recovery/`
* 版本备份：`~/.config/markbun/backups/`

## 备份与恢复系统

`src/bun/services/backup.ts` 中的三层文件保护系统：

1. **原子写入** — 先写入 `.tmp` 再重命名，防止写入中断导致文件损坏
2. **崩溃恢复** — 保存前写入恢复文件，成功后清除。以 JSON 格式存储 `{originalPath, timestamp, content}`
3. **版本历史** — 每次保存前创建快照，通过 `retentionDays` 和 `maxVersions` 自动清理

## 国际化

使用 i18next 的多语言支持：

* **主进程**：`src/bun/i18n/` — 8 种语言的菜单翻译（en, zh-CN, de, es, fr, ja, ko, pt）
* **渲染进程**：`src/mainview/i18n/` — UI 翻译
* **共享**：`src/shared/i18n/config.ts` — 语言解析逻辑
* 语言偏好保存在设置中；菜单在语言变更时重建

## 图片处理

编辑器中显示和保存图片的处理管线：

* **本地图片路径解析** 通过 `workspaceManager`
* **Blob URL 转换** 用于 WebView 中显示（安全要求）
* **原始路径还原** 保存时通过 `restoreOriginalImagePaths`
* **图片缓存**（`imageCache.ts`）用于 blob URL 复用
* **拖拽** 保存图片到工作区 `assets/` 目录

## 样式架构

### 分层系统

```
1. Tailwind CSS（通过 @tailwind 指令的基础工具类）
   ↓
2. CSS 变量主题（:root/.dark 中 shadcn 兼容变量）
   ↓
3. Crepe 主题样式（@milkdown/crepe/theme/common/style.css, frame.css/frame-dark.css）
   ↓
4. Crepe 链接提示样式（@milkdown/crepe/theme/common/link-tooltip.css）
   ↓
5. MarkBun 自定义样式（全部在 src/mainview/index.css）
```

### CSS 变量

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  --primary-foreground: 0 0% 98%;
  --secondary: 240 4.8% 95.9%;
  --secondary-foreground: 240 5.9% 10%;
  --muted: 240 4.8% 95.9%;
  --muted-foreground: 240 3.8% 46.1%;
  --accent: 240 4.8% 95.9%;
  --accent-foreground: 240 5.9% 10%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 5.9% 90%;
  --input: 240 5.9% 90%;
  --ring: 240 5.9% 10%;
  --radius: 0.5rem;
}

.dark {
  --background: 220 13% 24%;
  --foreground: 210 20% 96%;
  --card: 220 13% 24%;
  --card-foreground: 210 20% 96%;
  --popover: 220 13% 24%;
  --popover-foreground: 210 20% 96%;
  --primary: 210 20% 96%;
  --primary-foreground: 220 13% 24%;
  --secondary: 220 10% 32%;
  --secondary-foreground: 210 20% 96%;
  --muted: 220 10% 32%;
  --muted-foreground: 220 8% 65%;
  --accent: 220 10% 32%;
  --accent-foreground: 210 20% 96%;
  --destructive: 0 62.8% 40%;
  --destructive-foreground: 0 0% 98%;
  --border: 220 10% 32%;
  --input: 220 10% 32%;
  --ring: 210 20% 80%;
}
```

### 样式来源

所有自定义样式集中在单个文件 `src/mainview/index.css`（约 1300 行），覆盖：编辑器外观、代码块、拖放覆盖层、滚动条自动隐藏、图片块、对话框、侧边栏、工具栏、状态栏、大纲、快速打开、文件对话框、设置和恢复对话框。

Crepe 主题样式通过 `useThemeLoader` Hook 从 npm 包动态加载。

## 文件组织

```
markbun/
├── src/
│   ├── bun/                         # 主进程（Electrobun/Bun）
│   │   ├── index.ts                 # 主入口、窗口管理、RPC 处理器
│   │   ├── menu.ts                  # 应用菜单
│   │   ├── assets/
│   │   │   └── helpContent.ts       # 帮助文档内容
│   │   ├── i18n/
│   │   │   ├── index.ts             # i18next 配置
│   │   │   └── locales/             # 菜单翻译（8 种语言）
│   │   │       ├── en/menu.json
│   │   │       ├── zh-CN/menu.json
│   │   │       └── ... (de, es, fr, ja, ko, pt)
│   │   ├── ipc/
│   │   │   ├── files.ts             # 文件 I/O 操作
│   │   │   ├── folders.ts           # 文件夹树读取
│   │   │   └── recentFiles.ts       # 最近文件管理
│   │   ├── lib/                     # 主进程工具函数
│   │   └── services/
│   │       ├── settings.ts          # 设置加载/保存/迁移
│   │       ├── backup.ts            # 三层备份服务
│   │       └── uiState.ts           # UI 状态持久化
│   │
│   ├── mainview/                    # 渲染进程（WebView）
│   │   ├── main.tsx                 # React 入口
│   │   ├── App.tsx                  # 主应用组件
│   │   ├── index.html               # HTML 入口
│   │   ├── index.css                # 所有样式（约 1300 行）
│   │   ├── components/
│   │   │   ├── editor/              # 编辑器组件
│   │   │   │   ├── MilkdownEditor.tsx
│   │   │   │   ├── SourceEditor.tsx  # CodeMirror 6 源码模式
│   │   │   │   ├── commands/        # 编辑器命令函数
│   │   │   │   ├── hooks/           # useCrepeEditor, useContextMenu, useThemeLoader
│   │   │   │   ├── plugins/         # clipboardBlobConverter, inlineMarksPlugin 等
│   │   │   │   └── utils/           # editorActions, tableHelpers
│   │   │   ├── file-explorer/       # 文件树浏览器
│   │   │   │   ├── FileExplorer.tsx
│   │   │   │   ├── FileTree.tsx
│   │   │   │   ├── ContextMenu.tsx
│   │   │   │   └── MoveDialog.tsx
│   │   │   ├── file-dialog/         # 自定义打开/保存对话框
│   │   │   ├── file-history/        # 版本历史对话框
│   │   │   ├── image-insert/        # 图片插入对话框
│   │   │   ├── image-viewer/        # 图片预览
│   │   │   ├── layout/              # TitleBar, Toolbar, Sidebar, StatusBar
│   │   │   ├── outline/             # 文档大纲视图
│   │   │   ├── quick-open/          # 快速文件打开器 (Cmd+P)
│   │   │   ├── recovery-dialog/     # 崩溃恢复对话框
│   │   │   ├── save-dialog/         # 未保存更改对话框
│   │   │   ├── settings/            # 设置对话框
│   │   │   ├── about/               # 关于对话框
│   │   │   └── ui/                  # shadcn/ui 组件
│   │   ├── hooks/                   # 应用级自定义 Hooks
│   │   │   ├── useAutoSave.ts
│   │   │   ├── useClipboard.ts
│   │   │   ├── useExport.ts
│   │   │   ├── useFileExplorer.ts
│   │   │   ├── useFileOperations.ts
│   │   │   ├── useOutline.ts
│   │   │   ├── useQuickOpen.ts
│   │   │   ├── useSidebar.ts
│   │   │   └── useTheme.ts
│   │   ├── lib/                     # 渲染进程工具函数
│   │   │   ├── electrobun.ts        # IPC 封装
│   │   │   ├── image.ts             # 图片处理（工作区、blob URL）
│   │   │   ├── imageCache.ts        # 图片 blob URL 缓存
│   │   │   ├── imageProcessor.ts
│   │   │   └── utils.ts
│   │   ├── i18n/                    # 渲染进程翻译
│   │   │   ├── index.ts
│   │   │   └── locales/             # UI 翻译（8 种语言）
│   │   └── images/
│   │       └── logo.svg
│   │
│   └── shared/                      # 进程间共享
│       ├── types.ts                 # RPC Schema、共享接口
│       ├── settings/
│       │   └── schema.ts            # Zod 设置 Schema + 默认值
│       └── i18n/
│           ├── config.ts            # 语言解析逻辑
│           └── types.ts             # i18n 类型定义
│
├── docs/                            # 文档
│   ├── architecture.md
│   ├── architecture-cn.md
│   ├── file-association.md
│   └── file-association-cn.md
│
├── scripts/                         # 构建脚本
│   ├── create-dmg.sh
│   ├── create-wrapper.sh
│   ├── patch-plist.sh
│   ├── post-build.ts
│   └── typecheck.sh
│
├── tests/                           # 测试
│   └── unit/
│
├── electrobun.config.ts             # Electrobun 配置
├── vite.config.ts                   # Vite 配置
├── tailwind.config.js               # Tailwind 配置
├── postcss.config.js                # PostCSS 配置
├── tsconfig.json
├── package.json
└── README.md
```

## 构建系统

### Electrobun 配置

```typescript
// electrobun.config.ts
import type { ElectrobunConfig } from "electrobun";

// CEF 仅在开发模式下用于调试
const isBuild = process.argv.some(arg => arg === "build");

export default {
  app: {
    name: "MarkBun",
    identifier: "dev.markbun.app",
    version: "0.1.0",
    urlSchemes: ["markbun"],
  },
  build: {
    copy: {
      "dist/index.html": "views/mainview/index.html",
      "dist/assets": "views/mainview/assets",
      "src/mainview/images": "views/mainview/images",
    },
    watchIgnore: ["dist/**"],
    mac: {
      bundleCEF: !isBuild,
    },
    linux: {
      bundleCEF: true,
      icon: "icon.iconset/icon_256x256.png",
    },
    win: {
      bundleCEF: false,
      icon: "icon.iconset/icon_256x256.png",
    },
  },
} satisfies ElectrobunConfig;
```
