---
date: 2026-04-12
topic: e2e-testing-system
---

# 统一端到端测试体系：需求与技术设计

## Problem Frame

MarkBun 系统复杂度持续增长，即将进入重构期。单元测试无法覆盖 Electrobun 主进程与 WebView 渲染进程之间的跨边界行为（菜单分发、文件保存、设置持久化、AI 流式调用、会话恢复），而现有的 `.claude/skills/self-test/` 仅支持 AI 手动验证，不能作为自动化回归测试运行。

目标是构建一个**统一的、可自动化运行的端到端测试体系**，包含基础设施、测试 API、隔离环境、分层测试策略、失败取证和项目级 Skill，为重构提供安全网。

## Requirements

### Runner 与生命周期管理
- **R1.** 提供单一命令入口 `bun test:e2e`，负责自动启动应用（`bun run dev:hmr`）、轮询等待 CDP `9222` 就绪、执行测试套件、安全 teardown（包括清理 zombie CEF/WebView 进程）。
- **R2.** Runner 必须支持按文件或按标签过滤测试（类似 `bun test --filter=save`）。
- **R3.** 每次测试运行必须使用独立的 Electrobun 应用实例；禁止多测试复用同一实例，以避免状态串味。

### 高层 CDP API 与 Page Object 库
- **R4.** 将现有 `.claude/skills/self-test/scripts/cdp.ts` 的能力封装为类型化 `Page` 类，提供 `page.click(selector)`、`page.type(selector, text)`、`page.waitForSelector(selector, { timeout })`、`page.screenshot(path)`、`page.evaluate(fn)` 等方法。
- **R5.** 构建 MarkBun 专用 Page Objects，沉淀已验证的选择器：`EditorPage`（`.milkdown`、`.ProseMirror`）、`DialogPage`（`[role="dialog"]`）、`SettingsPage`、`QuickOpenPage`。
- **R6.** Page Object 必须隐藏 Tailwind 类名的细节；当 UI 重构导致选择器变化时，只需修改 Page Object 一处，所有测试无需改动。

### 测试专用 RPC（内部控制面）
- **R7.** 在开发/测试模式下暴露 `_test` RPC 命名空间（通过独立的 `src/bun/index.test.ts` 测试入口激活），提供：
  - `_test.menuAction(action)` —— 直接触发菜单逻辑
  - `_test.getEditorMarkdown()` / `_test.setEditorMarkdown(text)` —— 读写文档模型
  - `_test.injectSettings(partial)` / `_test.resetSettings()` —— 快速设置测试环境
  - `_test.clearRecovery()` / `_test.simulateCrash()` —— 控制备份/恢复状态
- **R8.** 生产构建（`build:canary` / `build:stable`）使用 `src/bun/index.ts`，不得包含任何 `_test` RPC 代码。
- **R9.** 渲染进程对应地在 dev 模式下暴露 `window.__markbunTestAPI`，让 CDP `evaluate` 可以直接调用，减少不必要的 RPC 往返。

### Zero-Config 隔离工作区 Fixture
- **R10.** 每次测试自动创建隔离临时目录（`tmp/markbun-e2e-<pid>-<timestamp>`），并通过环境变量/进程注入重定向 `homedir()`，使 `~/.config/markbun/`、备份、恢复文件、最近打开文件列表全部写入该隔离目录。
- **R11.** Fixture 支持预置 seed 文件（Markdown、图片、配置文件），测试结束后无条件清理。
- **R12.** 测试代码中通过 `withTempWorkspace(async ({ filesDir, configDir, cleanup }) => { ... })` 使用隔离环境。

### 分层测试架构
- **R13.** 构建两层测试体系，分别存放在不同目录：
  - `tests/e2e/`：CDP 驱动真实 WebView，覆盖用户核心旅程（新建 → 编辑 → 保存 → 导出 → AI → 设置）。
  - `tests/integration/`：Bun 主进程 + mock WebView RPC peer，覆盖 RPC 边界契约、菜单分发、文件系统副作用、设置原子写入、session 恢复。
- **R14.** Mock WebView peer 必须能够接收和发送 `MarkBunRPC` 消息，并记录调用历史供断言使用。
- **R15.** 分层架构允许集成测试在无 GUI 环境下运行（CI 友好），而 E2E 测试依赖真实窗口（本地验证为主）。

### 失败自动取证
- **R16.** 任何 E2E 测试失败后，runner 必须自动收集并写入 `tests/e2e/__traces__/<test-name>-<timestamp>/`：
  - 失败前后 CDP 截图
  - DOM 快照
  - Bun 主进程 stdout/stderr（截取失败前后 50 行）
  - CDP 命令与响应轨迹
  - 临时工作区文件树快照
- **R17.** 取证信息必须在测试失败报告中输出路径，方便开发者直接查看。

### 项目级 Skill「创建端到端测试」
- **R18.** 在 `.claude/skills/e2e-test/` 建立项目级 skill，包含：
  - 基础设施知识（runner、API、fixture、RPC 辅助）
  - 测试代码模板（针对常见场景：文件操作、菜单触发、设置切换、AI 对话）
  - 生成符合项目最佳实践的测试文件的能力
- **R19.** 用户可以通过自然语言输入（如「给文件保存功能加一个 E2E 测试」）触发 skill，skill 自动选择合适的 Page Object、fixture 和断言组合，输出可直接提交的代码。

## Success Criteria

- `bun test:e2e` 能在无人工干预的情况下完整运行一组核心场景测试（新建-编辑-保存-关闭-恢复）。
- 新增一个 E2E 测试的平均时间从数小时降至 15 分钟以内。
- 任何破坏菜单分发双路径的改动都能被集成测试或 E2E 测试捕获。
- 测试失败时，开发者能在 5 分钟内通过 `__traces__` 目录定位问题根因。
- `.claude/skills/e2e-test/` 能根据功能描述生成可编译、可运行的测试草稿。

## Scope Boundaries

- **非目标**：覆盖所有历史 bug 的回归测试（这是内容填充工作，不在基础设施设计范围内）。
- **非目标**：视觉回归/像素级 diff（baseline 管理成本高，待基础设施稳定后再评估）。
- **非目标**：Windows CI 上的完整 E2E 运行（优先保证 macOS 本地和可能的 macOS CI；Windows 先保证集成测试层可跑）。
- **非目标**：修改 Electrobun 框架本身（所有实现必须基于现有 v1.16.0 API）。

## Key Decisions

### D1. 统一目录结构

```
tests/
├── unit/                        # 现有单元测试
├── integration/                 # Mock WebView 集成测试
│   ├── fixtures/
│   ├── helpers/
│   │   ├── mockWebView.ts       # Mock WebView RPC peer
│   │   └── spawnMainProcess.ts  # 启动 Bun 主进程（无 WebView）
│   ├── menu-dispatch.test.ts
│   ├── file-save.test.ts
│   ├── settings-persist.test.ts
│   └── session-restore.test.ts
├── e2e/                         # CDP 驱动真实 WebView
│   ├── __traces__/              # 失败自动取证（gitignored）
│   ├── fixtures/                # 预置工作区 seed
│   ├── lib/
│   │   ├── runner.ts            # 应用生命周期管理
│   │   ├── page.ts              # Playwright-like CDP API
│   │   ├── page-objects/
│   │   │   ├── EditorPage.ts
│   │   │   ├── DialogPage.ts
│   │   │   ├── SettingsPage.ts
│   │   │   └── QuickOpenPage.ts
│   │   └── withTempWorkspace.ts # 隔离 fixture
│   ├── file-lifecycle.test.ts
│   ├── export-image.test.ts
│   ├── ai-chat.test.ts
│   └── settings-ui.test.ts
└── e2e-setup.ts                 # 全局 beforeAll / afterAll
```

### D2. 独立测试入口文件
采用独立的 `src/bun/index.test.ts` 作为 E2E 测试的 Bun 入口：

- `src/bun/index.test.ts` 复用现有主逻辑（需在规划阶段解决好 `src/bun/index.ts` 模块级 `main()` 调用与测试入口的兼容方式），然后注入 `_test` RPC。
- `package.json` 增加 `"test:e2e": "bun tests/e2e/lib/runner.ts"` 作为测试命令入口。
- Runner 在启动应用时设置 `MARKBUN_TEST=1` 环境变量，并显式使用 `src/bun/index.test.ts` 作为 Bun 入口文件；`MARKBUN_TEST=1` 同时用于主进程内部快速拒绝 `_test` 请求的非测试环境调用。
- 生产构建（`build:canary` / `build:stable`）仍使用 `src/bun/index.ts`，完全不会接触 `index.test.ts`。

### D3. 组件交互关系

```
+------------------------------------------------------------------+
|                          bun test:e2e                            |
|                         (Test Runner)                            |
+----------------------------+-------------------------------------+
                             |
          +------------------+------------------+
          |                                     |
          v                                     v
+----------------------------+      +--------------------------+
|   tests/e2e/               |      |   tests/integration/      |
|   (CDP 真实 WebView)       |      |   (Mock WebView Peer)     |
+--------+--------+----------+      +-------------+------------+
         |        |                               |
         |   +----v----+                          |
         |   |  Page   |                          |
         |   |  Object |                          |
         |   +----+----+                          |
         |        |                               |
    +----v--------v---+               +-----------v------------+
    |  CDP via 9222   |               |   Mock RPC Peer        |
    |  (cdp.ts 封装)  |               |   (MarkBunRPC  fake)   |
    +--------+--------+               +-----------+------------+
             |                                    |
             v                                    v
    +----------------+                 +--------------------+
    | Electrobun App |                 | Bun Main Process   |
    | (index.test.ts)|                 | (index.test.ts)    |
    | + _test RPC    |                 | + _test RPC        |
    +--------+-------+                 +--------+-----------+
             |                                  |
             +----------------> <---------------+
                              |
                         +----v-----------------+
                         | withTempWorkspace()  |
                         | 隔离临时目录 + 清理   |
                         +----------------------+
```

### D4. 各组件边界、输入输出与集成点

| 组件 | 边界 | 输入 | 输出 | 与现有代码集成点 |
|------|------|------|------|------------------|
| **Runner** (`tests/e2e/lib/runner.ts`) | 负责单测不可见的进程生命周期 | `testFilePattern`, `timeout` | 应用进程 PID、`exitCode` | `package.json` 新增 `test:e2e` 脚本 |
| **Page / CDP API** (`tests/e2e/lib/page.ts`) | 不直接依赖 MarkBun 业务逻辑 | `pageUrl`, `selector`, `text` | CDP 命令结果、`Buffer` (截图) | 复用 `.claude/skills/self-test/scripts/cdp.ts` 的 WebSocket/CDP 逻辑，提取为 TS 类库 |
| **Page Objects** (`tests/e2e/lib/page-objects/`) | 仅封装 DOM 与 UI 交互 | `Page` 实例 | 业务语义方法（`typeMarkdown`, `openSettings`） | 依赖渲染进程的 DOM 结构；当 UI 重构时需同步更新 |
| **`_test` RPC** (`src/bun/index.test.ts`) | 仅存在于 dev/test 入口 | `action`, `text`, `partialSettings` | 菜单触发结果、文档内容、设置状态 | 通过 `MarkBunRPC` 的 `bun.requests` 扩展；渲染进程对应 `window.__markbunTestAPI` |
| **Fixture** (`tests/e2e/lib/withTempWorkspace.ts`) | 纯辅助函数，无业务逻辑 | `seedFiles` (可选) | `{ filesDir, configDir, cleanup }` | runner 启动前通过 `process.env.MARKBUN_E2E_HOME` 注入，主进程需在启动早期读取该变量以覆盖 `homedir()` |
| **集成测试层** (`tests/integration/`) | 不启动 WebView，只验证主进程 | `mockPeer`, `action` | `assertion` on 调用历史 / 文件状态 | 需 mock `electrobun/bun` 的 `BrowserView.defineRPC` |
| **失败取证** (`tests/e2e/lib/trace.ts`) | 仅在测试失败路径触发 | `testName`, `pageInstance`, `runnerLogs` | `__traces__/<name>-<ts>/` 目录 | Bun test 的 `afterEach` 钩子集成 |

### D5. MVP 实现顺序

**Phase 1：基础设施底座（Week 1）**
1. `tests/e2e/lib/runner.ts` — 自动启停 `dev:hmr` + CDP 轮询 + teardown
2. `tests/e2e/lib/page.ts` — 提取 `cdp.ts` 为 TS 类库
3. `tests/e2e/lib/withTempWorkspace.ts` — 隔离 fixture
4. `src/bun/index.test.ts` — 创建测试入口并注入 `_test.menuAction` 与 `_test.getEditorMarkdown`
5. `src/mainview/lib/electrobun.ts`（或 `window` 挂载点）—— 对应增加 `__markbunTestAPI`

**Phase 2：第一个黄金路径测试（Week 1-2）**
6. 用以上基础设施实现第一个完整 E2E 测试：`file-lifecycle.test.ts`（新建 → 输入 → 保存 → 重新打开 → 断言内容一致）
7. 同步实现 `tests/e2e/lib/trace.ts` 失败取证，确保第一条测试失败时有上下文

**Phase 3：Page Object 与测试扩展（Week 2）**
8. `EditorPage`, `DialogPage`, `SettingsPage`
9. 添加 3-5 条核心场景测试：导出 PNG、切换设置、AI 对话

**Phase 4：集成测试层（待验证 / 可选延后）**
10. `tests/integration/helpers/mockWebView.ts` + `spawnMainProcess.ts`
11. 实现菜单分发契约测试和设置持久化集成测试
> **注**：Mock WebView peer 的可行性尚未验证，且此层不是 E2E 核心目标。如 Phase 1-2 进展良好，可在 Phase 3 之后以 spike 形式验证；若发现 Mock peer 实现成本过高，整层可延后或放弃，由 E2E 层覆盖关键边界。

**Phase 5：Skill 封装（Week 3-4）**
12. `.claude/skills/e2e-test/SKILL.md` + 代码模板
13. 验证 skill 能根据自然语言描述生成可编译的测试草稿

### D6. 潜在风险与规避策略

| 风险 | 规避策略 |
|------|----------|
| ** zombie CEF/WebView 进程** | Runner teardown 使用 `process.kill(-pid, 'SIGTERM')` 杀进程组；teardown 失败时 fallback 到 `pkill -f "electrobun.*markbun"` |
| **CDP 连接不稳定 / flaky** | Page API 内置指数退避重试；所有 `waitFor` 方法轮询而非固定 sleep；关键断言前检查 `document.readyState === 'complete'` |
| **Milkdown 编辑器就绪时序不可控** | `EditorPage` 提供 `waitForReady()`，内部轮询 `window.__markbunTestAPI.isEditorReady()` 或检测 `.ProseMirror[contenteditable="true"]` |
| **`_test` RPC 意外进入生产** | 构建脚本仅使用 `src/bun/index.ts`；CI 增加 lint 规则，禁止 `index.test.ts` 中的字符串出现在生产 bundle |
| **临时目录清理失败** | Fixture 使用 `process.pid` + `Date.now()` 保证唯一性；teardown 中用 `rm -rf` 强制删除；本地开发设置 24h cron 清理残留 |
| **Mock WebView peer 与真实 RPC 漂移** | 集成测试层共享 `src/shared/types.ts` 的 `MarkBunRPC` 类型；当 `types.ts` 变更时，TypeScript 编译器会强制同步 mock peer |
| **E2E 测试运行太慢被弃用** | 严格控制 E2E 数量在 15 条核心场景以内；集成测试层承担大部分边界验证工作；本地开发支持 `--filter` 单条快速运行 |
| **`index.ts` 模块级 `main()` 调用阻塞测试入口** | 规划阶段必须解决：将 `main()` 与 handler 注册解耦（提取 `createApp()`），或改用不导入 `index.ts` 的测试入口策略 |
| **`homedir()` 在子进程中无法被 env 拦截** | 若 Bun/Electrobun 在模块加载时缓存 `os.homedir()`，需在规划阶段设计 `markbun-homedir` 包装模块或 `NODE_OPTIONS` preload 方案 |
| **Tailwind 类名变化导致选择器失效** | Page Object 集中管理选择器；当类名变更时只改一处；避免在测试中直接使用 Tailwind 原子类 |

## Dependencies / Assumptions

- `bun run dev:hmr` 启动后始终暴露 `ws://127.0.0.1:9222`（已验证）。
- `src/shared/types.ts` 中的 `MarkBunRPC` 是 RPC 契约的单一可信来源。
- `tests/unit/bun/services/backup.test.ts` 中的 `mock.module('os')` 模式在集成/E2E 级别可通过环境变量重定向等价实现。
- Electrobun `BrowserWindow` 和 `BrowserView.defineRPC` 的公开 API 在 v1.16.0 中稳定，不依赖内部私有字段。

## Outstanding Questions

### Resolve Before Planning
- [Affects D2/R7][Blocking] `src/bun/index.ts` 在模块级调用 `main()`，如果 `index.test.ts` 通过 `import './index'` 复用逻辑，会在测试 runner 进程中意外启动 Electrobun 应用。必须在规划前确定：重构 `index.ts` 提取 `createApp()`，还是绕过 `import` 改用其他复用策略。

### Deferred to Planning
- [Affects R1][Technical] Runner 在 macOS 上清理 CEF 子进程的最健壮方式（需要实际测试 `SIGTERM` vs `SIGKILL` 的清理效果）。
- [Affects R10][Needs research] `homedir()` 重定向在子进程中的具体实现：环境变量是否能在 `os` 模块加载前生效，还是需要 `NODE_OPTIONS` preload 或 `markbun-homedir` 包装模块。
- [Affects R7-R9][Security] `_test` RPC 的运行时防护机制：除独立入口文件外，是否需要在每个 `_test` handler 内部增加 `process.env.MARKBUN_TEST === '1'` 的硬拒绝逻辑。
- [Affects R5][Technical] 哪些 Milkdown DOM 操作最适合放在 `__markbunTestAPI` 中而不是通过 CDP `type`/`click` 模拟（需要在实际编码时评估平衡点）。
- [Affects R13][Needs research] Mock WebView peer 的最小可行实现方案：是在 Bun 测试中 stub `electrobun/bun` 模块，还是通过子进程 IPC 模拟完整的 `BrowserView.defineRPC` 行为。

## Next Steps

- **Spike（2-3 天）**：验证以下三个阻塞性假设，再决定是否推进完整系统建设：
  1. `src/bun/index.ts` 的 `main()` 调用能否安全地解耦为可导出的 `createApp()`；
  2. `withTempWorkspace` 的 `homedir()` 重定向在子进程中是否实际生效；
  3. `runner.ts` 对 `dev:hmr` 的启停和 CEF/WebView teardown 是否稳定可靠。
- **Spike 完成后**：根据验证结果，决定是维持 1-7 的完整体系，还是按评审建议削减范围（延后/取消集成测试层、skill 生成、`__markbunTestAPI`），再进入 `/ce:plan`。
