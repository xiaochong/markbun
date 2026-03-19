# macOS 文件关联实现原理

## 功能概述

用户可以在 macOS Finder 中双击 `.md`、`.markdown`、`.mdx` 文件，自动用 MarkBun 打开并加载文件内容。

## 架构设计

由于 Electrobun 框架**不支持** `application:openFile:` Apple Events，我们采用**双应用 + 文件系统 IPC** 的方案：

```
┌─────────────────────┐      文件路径       ┌─────────────────────┐
│   MarkBun Opener    │ ──────────────────► │    MarkBun 主应用    │
│  (AppleScript App)  │   pending-open.txt  │                     │
└─────────────────────┘                     └─────────────────────┘
        │                                            ▲
        │ 启动主应用                                   │
        └────────────────────────────────────────────┘
```

## 组件说明

### 1. MarkBun Opener（AppleScript Droplet）

**位置**：`build/MarkBun Opener.app`

**作用**：
- 注册为 `.md`/`.markdown`/`.mdx` 文件的处理器
- 接收 macOS 的文件打开事件
- 将文件路径写入 IPC 文件
- 启动主应用

**源码**：`scripts/create-opener.sh`

```applescript
on open theFiles
    repeat with aFile in theFiles
        set filePath to POSIX path of aFile
        -- 写入 IPC 文件
        do shell script "mkdir -p ~/Library/... && echo " & filePath & " > pending-open.txt"
        -- 启动主应用
        do shell script "open -a 'MarkBun-canary'"
    end repeat
end open
```

### 2. IPC 文件

**路径**：`~/Library/Application Support/dev.markbun.app/pending-open.txt`

**作用**：
- MarkBun Opener 写入待打开的文件路径
- 主应用读取后立即删除（防止重复打开）

### 3. 主应用处理逻辑

**文件**：`src/bun/index.ts`

**启动时检查**：
```typescript
async function main() {
  // 第一时间检查 IPC 文件
  const pendingFilePath = join(homedir(), 'Library', 'Application Support', 'dev.markbun.app', 'pending-open.txt');
  if (existsSync(pendingFilePath)) {
    const filePath = (await readFile(pendingFilePath, 'utf-8')).trim();
    await unlink(pendingFilePath); // 立即删除
    pendingOpenFilePath = filePath;
  }
  // ... 其他初始化
}
```

**渲染进程获取**：
```typescript
// RPC: getPendingFile
// 渲染进程启动时调用，获取并清空待打开的文件
getPendingFile: async () => {
  if (!pendingOpenFilePath) return null;
  const filePath = pendingOpenFilePath;
  pendingOpenFilePath = null;
  // 读取文件内容，返回给渲染进程
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
    // 直接打开文件
  }
});
```

## 为什么不用 Apple Events？

Electrobun 框架的 launcher 是预编译的二进制，没有实现 `application:openFile:` 委托。macOS 双击文件时发送的 Apple Events 无法被应用接收。

## 为什么不用 URL Scheme 作为主方案？

当应用**未运行**时，URL scheme 事件可能在应用完全初始化之前触发，导致事件丢失。文件系统 IPC 方案更可靠。

## 构建流程

`package.json` 中的 `build:canary` 脚本：

```bash
vite build && electrobun build --env=canary && bash scripts/patch-plist.sh && bash scripts/create-opener.sh
```

1. `vite build` - 构建前端
2. `electrobun build` - 构建主应用
3. `patch-plist.sh` - 注入 `CFBundleDocumentTypes`（主应用的文件关联声明，用于 Finder 右键菜单）
4. `create-opener.sh` - 创建 MarkBun Opener

## 安装使用

1. 将 `MarkBun-canary.app` 和 `MarkBun Opener.app` 复制到 `/Applications/`
2. 右键任意 `.md` 文件 → "打开方式" → "MarkBun Opener"
3. 勾选 "始终使用此应用打开"

## 相关文件

| 文件 | 作用 |
|------|------|
| `electrobun.config.ts` | 配置 `urlSchemes: ["markbun"]` |
| `src/bun/index.ts` | 主进程文件，处理 IPC 和 URL scheme |
| `src/mainview/App.tsx` | 渲染进程，启动时调用 `getPendingFile` |
| `src/mainview/lib/electrobun.ts` | RPC 接口定义 |
| `src/shared/types.ts` | TypeScript 类型定义 |
| `scripts/patch-plist.sh` | 构建后注入 plist |
| `scripts/create-opener.sh` | 创建 AppleScript droplet |
