# macOS 文件关联实现原理

## 功能概述

用户可以在 macOS Finder 中双击 `.md`、`.markdown`、`.mdx` 文件，自动用 MarkBun 打开并加载文件内容。

## 架构设计

由于 Electrobun 框架**不支持** `application:openFile:` Apple Events，我们采用 **Wrapper App + 文件 IPC** 的方案：

```
┌─────────────────────────────────┐
│         MarkBun.app (Wrapper)    │
│  ┌───────────────────────────┐  │
│  │  AppleScript droplet      │  │  收到 macOS 文件打开事件
│  │  CFBundleDocumentTypes    │  │  → 写 /tmp/markbun/pending.txt
│  └───────────────────────────┘  │  → 启动内部主应用
│  ┌───────────────────────────┐  │
│  │  Contents/MacOS/          │  │
│  │    MarkBun-canary.app/    │  │  Electrobun 主应用
│  │      → 检查 pending 文件  │  │  → 渲染进程打开文件
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

## 组件说明

### 1. MarkBun Wrapper（AppleScript Droplet）

**位置**：`build/MarkBun.app`

**作用**：

- 注册为 `.md`/`.markdown`/`.mdx` 文件的处理器（通过 `CFBundleDocumentTypes`）
- 接收 macOS 的文件打开事件
- 将文件路径写入 `/tmp/markbun/pending.txt`
- 启动或激活内部的 Electrobun 主应用

**源码**：`scripts/create-wrapper.sh`

```applescript
on open theFiles
    set filePath to POSIX path of (item 1 of theFiles)
    do shell script "echo " & quoted form of filePath & " > /tmp/markbun/pending.txt"
    set appPath to POSIX path of (path to me) & "Contents/MacOS/MarkBun-canary.app"
    do shell script "open " & quoted form of appPath
end open
```

### 2. IPC 文件

**路径**：`/tmp/markbun/pending.txt`

**作用**：

- Wrapper 写入待打开的文件路径
- 主应用读取后立即删除（防止重复打开）
- 系统重启自动清除，不会有残留

### 3. 主应用处理逻辑

**文件**：`src/bun/index.ts`

**启动时消费**（应用未运行时）：
```typescript
const filePath = await consumePendingFile();
if (filePath) pendingOpenFilePath = filePath;
```

**运行时监听**（应用已运行时，使用 `fs.watch` 事件驱动）：
```typescript
watch('/tmp/markbun', (eventType, filename) => {
  if (filename !== 'pending.txt') return;
  const filePath = await consumePendingFile();
  if (filePath) openFileInFocusedWindow(filePath);
});
```

**渲染进程获取**：
```typescript
// RPC: getPendingFile
getPendingFile: async () => {
  if (!pendingOpenFilePath) return null;
  const filePath = pendingOpenFilePath;
  pendingOpenFilePath = null;
  return { path: filePath, content: ... };
}
```

### 4. URL Scheme（辅助方案）

**用途**：当主应用**已运行**时，可通过 URL scheme 直接打开文件

**格式**：`markbun://open?path=/path/to/file.md`

**监听**：
```typescript
Electrobun.events.on('open-url', (event) => {
  const url = new URL(event.data.url);
  if (url.hostname === 'open') {
    const filePath = decodeURIComponent(url.searchParams.get('path') ?? '');
    if (filePath) openFileInFocusedWindow(filePath);
  }
});
```

## 为什么不用 Apple Events？

Electrobun 框架的 launcher 是预编译的 Zig 二进制，没有实现 `application:openFile:` 委托。macOS 双击文件时发送的 Apple Events 无法被应用接收。

## 为什么需要 Wrapper？

Electrobun 的启动链路是 `Zig 二进制 → Bun main.js → Worker(应用代码)`，命令行参数不会传递到 Worker 层，因此无法直接处理 Finder 传来的文件路径。

## 构建流程

`scripts/post-build.ts` 在 macOS 构建后自动执行：

1. `create-wrapper.sh` - 创建 Wrapper App（内嵌主应用 + 文件关联声明）
2. `create-dmg.sh` - 打包 DMG

## 安装使用

1. 将 `MarkBun.app` 从 DMG 拖到 `/Applications/`
2. 右键任意 `.md` 文件 → "打开方式" → "MarkBun"
3. 勾选 "始终使用此应用打开"

## 相关文件

| 文件 | 作用 |
|------|------|
| `electrobun.config.ts` | 配置 `urlSchemes: ["markbun"]` |
| `src/bun/index.ts` | 主进程文件，处理 IPC 和 URL scheme |
| `src/mainview/App.tsx` | 渲染进程，启动时调用 `getPendingFile` |
| `src/mainview/lib/electrobun.ts` | RPC 接口定义 |
| `scripts/create-wrapper.sh` | 创建 Wrapper App |
| `scripts/create-dmg.sh` | 打包 DMG |
