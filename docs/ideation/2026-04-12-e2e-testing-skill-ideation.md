---
date: 2026-04-12
topic: e2e-testing-skill
focus: 创建项目级 skill「创建端到端测试」，基于 CDP 验证功能，为重构建立安全网
---

# Ideation: 创建 MarkBun 端到端测试技能/框架

## Codebase Context

**项目**: MarkBun — Electrobun 桌面 Markdown 编辑器（Bun 主进程 + WebView 渲染进程，React + TypeScript + Tailwind CSS + Milkdown）。

**现有基础设施**:
- `bun run dev:hmr` 启动后，CDP 原生暴露 `ws://127.0.0.1:9222`。
- `.claude/skills/self-test/` 已存在：包含 `scripts/cdp.ts`（底层 CDP 操作封装）和 `SKILL.md`（引导 AI 通过 CDP 手动验证功能）。
- 测试体系仅有 `tests/unit/`（Bun test runner），无集成测试或 E2E 测试。
- 单元测试在 Bun 环境下对前端 DOM 支持有限，Milkdown 编辑器代码几乎无法单元测试。

**关键约束与历史痛点**:
- Electrobun 没有 `evaluateJavascriptWithResponse`，Bun→WebView 带返回值只能走 `webview.rpc.request`。
- macOS 与 Windows/Linux 有两套完全不同的菜单分发路径（`ApplicationMenu.on('application-menu-clicked')` vs `sendMenuAction` RPC），漏改一处会在 macOS 上静默失败。
- 文件打开/保存、设置持久化、session 恢复、AI 工具调用链等核心功能都涉及跨进程边界，单元测试完全无法覆盖。
- `docs/ideation/2026-04-05-open-ideation.md` 已提出 "Electrobun Integration Test Harness" 构想：启动 Bun 主进程 + mock WebView RPC peer，覆盖 menu actions / file open/save / settings atomic writes。
- `tests/unit/bun/services/backup.test.ts` 展示了优秀的 Bun 服务测试隔离模式：`mock.module('os')` + `process.pid` 临时目录。

**需求来源**:
- 用户明确提出：系统会越来越复杂，需要重构；代码会变，单元测试意义不大，但功能不会变。
- 端对端测试本身不会变化，通过后重构才可行。
- 需要创建项目级 skill「创建端到端测试」：通过 CDP 验证功能，编写真正的测试代码（不依赖 AI 运行测试）。
- 测试必须隔离：在临时文件创建 md，测试前清理环境。
- 顶部原生菜单无法通过 CDP 操作，需在应用内部提供便捷接口来验证菜单对应的功能。

## Ranked Ideas

### 1. 自动生命周期测试 Runner (`bun test:e2e`)
**Description:** 封装真正的自动化测试入口：负责启动 `bun run dev:hmr`、轮询等待 CDP `9222` 端口就绪、执行测试文件、最后安全 teardown（包含清理可能残留的 zombie CEF/WebView 进程）。测试代码使用常规 Bun test runner 编写，通过子进程调用 `bun $CDP ...` 或内部 API 来驱动应用。

**Rationale:** 当前最大的运行阻力是「需要手动启动应用，再手动连 CDP」。一个 `bun test:e2e` 命令让开发者像跑单元测试一样跑 E2E，大幅降低执行门槛，也是 CI 集成的必要前提。

**Downsides:** 需要正确处理 Electrobun 子进程（尤其是 macOS 开发模式下启动的 CEF）的清理逻辑，否则会产生僵尸进程。

**Confidence:** 95%
**Complexity:** Medium
**Status:** Explored

---

### 2. Playwright-like 高层 CDP API + Page Object 库
**Description:** 将现有 `cdp.ts` 的原始命令（`click-sel`、`type`、`wait-for`、`eval-json`、`screenshot`）封装成一个类型化的 `Page` 类，提供 `page.click(selector)`、`page.type(selector, text)`、`page.waitForSelector(selector, { timeout })` 等 fluent API。同时构建 MarkBun 专属的 Page Objects（如 `EditorPage`、`DialogPage`、`SettingsPage`），把 `.ProseMirror`、`[role="dialog"]` 等选择器知识沉淀为可复用代码。

**Rationale:** 手写 `bun $CDP eval-json ...` 无法扩展到真正的测试代码。类型化 API 让测试可读、可组合；Page Object 模式能隔离 Tailwind 选择器随 UI 重构变化的脆弱性，降低新增测试的边际成本。

**Downsides:** Page Objects 需要与 UI 保持同步；Milkdown 内部 DOM 较复杂，某些细粒度断言可能仍需直接写 CDP 命令。

**Confidence:** 92%
**Complexity:** Medium
**Status:** Explored

---

### 3. 测试专用 RPC / `__markbunTestAPI` 内部控制面
**Description:** 在 dev/test 模式下，利用已有的成熟 RPC 模式，增加一个仅用于测试的 `_test` 命名空间（或在渲染进程挂载 `window.__markbunTestAPI`）。暴露接口如 `_test.menuAction(action)` 直接触发菜单逻辑、`_test.getEditorMarkdown()` 读取文档模型、`_test.injectSettings(partial)` 注入特定配置状态。这些接口在 production build 中可被 tree-shake 或返回 no-op。

**Rationale:** 顶部原生菜单无法通过 CDP 操作是 E2E 的最大覆盖缺口。内部控制面让测试能稳定、精确地触达任何功能路径，而不用依赖坐标点击或平台特定的菜单实现。这套 RPC 未来也可服务于开发者调试和自动化脚本。

**Downsides:** 需要在主进程与渲染进程中增加仅 test 可用的代码路径，必须小心不误触生产逻辑。

**Confidence:** 94%
**Complexity:** Medium
**Status:** Explored

---

### 4. Zero-Config 隔离工作区 Fixture (`withTempWorkspace`)
**Description:** 每测自动创建一个临时目录（如 `tmp/markbun-e2e-<pid>-<timestamp>`），通过 `mock.module('os')` 或进程级环境变量重定向 `homedir()`，使得 `~/.config/markbun/`、崩溃恢复文件、版本备份、最近打开文件列表、AI session 等全部被写入隔离目录。测试结束后自动清理。fixture 同时支持 seed 预置的 Markdown 文件和图片资源。

**Rationale:** 用户明确要求隔离。文件保存、设置持久化、session 恢复都会写盘，不隔离会导致测试串味，甚至破坏开发者的真实数据和配置。

**Downsides:** 需要确保所有写入路径都服从 `homedir()` 重定向。项目已有 `backup.test.ts` 验证该模式可行，但需推广应用级别。

**Confidence:** 93%
**Complexity:** Low-Medium
**Status:** Explored

---

### 5. 分层测试架构：CDP E2E + Mock WebView Integration Tests
**Description:** 构建两层测试体系。上层使用 CDP 驱动真实的 Electrobun WebView，覆盖用户核心旅程（新建-编辑-保存-导出-AI-设置）。下层启动 Bun 主进程并挂载一个 mock WebView RPC peer（按照 `docs/ideation/2026-04-05-open-ideation.md` 的构想），快速验证 RPC 边界契约、菜单分发、文件系统副作用、设置原子写入、session 恢复逻辑。

**Rationale:** 历史最严重 bug（启动时 session 被覆盖、菜单分发漂移、文件切换内容丢失、AI 流生命周期竞态）都发生在跨进程边界。Mock peer 提供快速、确定性的边界测试；CDP E2E 保留真实 UI 验证。两层互补，避免把所有鸡蛋都放在脆弱又缓慢的 UI 自动化这一个篮子里。

**Downsides:** Mock peer 需要理解 Electrobun 的 RPC 内部机制（`BrowserView.defineRPC`），构建有一定探索成本。

**Confidence:** 88%
**Complexity:** High
**Status:** Explored

---

### 6. 项目级 Skill「创建端到端测试」
**Description:** 在 `.claude/skills/e2e-test/` 建立项目级 skill。它不只是一次性生成某个测试文件，而是作为一个「E2E 测试套件引导器」，包含：基础设施脚手架（runner、CDP API wrapper、fixture 辅助、`_test` RPC 注册）、测试代码模板、运行与报告命令（`bun test:e2e`）。用户只需说「给文件保存功能加一个 E2E 测试」，skill 就能输出可直接提交的、符合项目最佳实践的测试代码。

**Rationale:** 这是用户的核心交付物要求。一个封装了所有最佳实践的 skill 能大幅降低团队新增 E2E 的心理门槛和编写成本，确保测试代码风格一致、隔离正确、不写出 fragile 的裸 CDP 命令。

**Downsides:** skill 的内容需要随着基础设施演进持续更新；如果底层 runner/api 不稳定，skill 生成的代码也需要跟着变。

**Confidence:** 91%
**Complexity:** Medium（基础设施到位后，skill 本身是薄包装）
**Status:** Explored

---

### 7. E2E 失败自动取证包
**Description:** 当任何 E2E 测试失败时，runner 自动收集并打包到一个带时间戳的目录（如 `tests/e2e/__traces__/<test-name>-<timestamp>/`）：失败前后的 CDP 截图、DOM 快照（通过 CDP `DOM.getDocument`）、Bun 主进程 stdout/stderr 日志、CDP 命令与响应轨迹、以及临时工作区文件树快照。

**Rationale:** E2E 的固有脆弱性（WebView 时序、异步 RPC、Milkdown 编辑器就绪轮询）意味着 flakiness 难以完全避免。丰富的失败上下文是定位 CI 失败、修复 flaky 和快速回滚的唯一途径。

**Downsides:** 失败时会增加一定量的磁盘 I/O，但仅在失败路径触发，且对本地开发通常可忽略。

**Confidence:** 90%
**Complexity:** Low-Medium
**Status:** Explored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | 窗口池 (Window-Pool) Runner | 过早优化。Electrobun 多窗口状态共享复杂，在基础 runner 未建立前不应引入 |
| 2 | 声明式 YAML DSL | 在底层 API 和 runner 不成熟时，DSL 属于过早抽象 |
| 3 | 键盘优先 E2E | 过于偏激。强制所有功能都有快捷键是产品决策，不应由测试框架强制 |
| 4 | 视觉回归 (Golden Screenshot) | 高价值，但 baseline 管理和跨平台像素差异处理复杂，建议在基础设施稳定后再引入 |
| 5 | AI 驱动的 Test Oracle | 创新性强但实现复杂。Tailwind 选择器问题可通过 Page Object 更好解决 |
| 6 | Electrobun 版本门控元测试 | 偏离当前焦点（为 MarkBun 重构建立安全网），更适合框架维护者 |
| 7 | Dev-Only 菜单调度一致性探针 | 被 Idea #3（`_test` RPC 内部控制面）完全覆盖且更通用 |
| 8 | E2E 测试的菜单覆盖矩阵生成器 | 高价值，但更适合作为 linter/static-analysis 工具，不直接属于 E2E 测试 skill |
| 9 | 双模式 E2E：前端断言 + Bun 进程 spy | 被 Idea #5（分层测试架构）覆盖，mock peer 层已包含副作用断言能力 |
| 10 | 历史 Bug → 回归用例种子库 | 长期有价值，但属于测试内容填充工作，不是 skill/框架层面的基础设施设计 |
| 11 | 基于真实用户旅程的「黄金路径」测试合约 | 内容策略，非技能/框架设计；可在测试建成后作为补充文档 |
| 12 | 可重用的「测试 scaffolding」库 | 已被 Idea #2（Page Object 库）和 Idea #6（skill）覆盖 |
| 13 | 测试运行环境的「模板化工作区」 | 已被 Idea #4（Zero-Config 隔离工作区 Fixture）覆盖 |

## Session Log

- 2026-04-12: Initial ideation — ~35 candidates generated across 4 frames (pain/friction, inversion/automation, assumption-breaking, leverage/compounding), 7 survivors retained after merge/dedup/adversarial filtering.
- 2026-04-12: Brainstorm initiated — all 7 survivors selected as a unified system to design and build together.
