---
date: 2026-04-06
topic: consolidated-i18n
---

# Consolidated i18n Source of Truth

## Problem Frame

MarkBun 的翻译文件分散在两个进程树中：`src/bun/i18n/locales/`（主进程 menu）和 `src/mainview/i18n/locales/`（渲染进程 6 个 namespace）。渲染进程已经通过跨进程导入 `../../bun/i18n/locales/` 来获取 menu 翻译，`src/shared/i18n/types.ts` 也分别从两个进程树导入类型定义——方向错误，且意味着添加新语言或新 namespace 时必须同步维护多处。

当前已存在 key 漂移：`editor` namespace 在 6 个非 en 语言中（de, es, fr, ja, ko, pt）缺少约 10 个 key（search 相关），`ai` namespace 缺少 1 个 key（session.history），zh-CN 已同步无缺失（共约 66 个缺失项）。这些漂移发生在同一进程树内部（mainview），不是跨进程问题。随着 v0.5.0 新增 find/replace、command palette、tab chrome 等功能，翻译量会持续增长，漂移将继续恶化。

## Requirements

**文件整合**
- R1. 所有 7 个 namespace（common, dialog, settings, editor, file, ai, menu）的 locale JSON 统一移至 `src/shared/i18n/locales/` 下，按 `{lang}/{namespace}.json` 组织
- R2. 两个进程及 `src/shared/i18n/types.ts` 都仅从 `src/shared/i18n/locales/` 导入翻译文件，消除进程间直接交叉引用
- R3. 每个进程保留各自的 i18next 初始化逻辑（主进程 = plain i18next，渲染进程 = react-i18next），仅更新导入来源（渲染进程使用相对路径 `../../shared/i18n/locales/` 导入，与现有 `../../bun/` 导入方式一致）

**Key 完整性验证**
- R4. 新增验证脚本，递归比较每个 namespace 下所有语言的 key 集合是否与 `en` 完全一致（嵌套 JSON 深度比较，缺 key 和多余 key 都报错，key 路径用 dot notation 表示）
- R5. 新建 pre-commit hook（如通过 husky 或手动 `.git/hooks/pre-commit`），将验证脚本与 typecheck + bun test 并列运行
- R6. 验证失败时输出清晰的错误信息：哪个 namespace、哪个语言、缺少或多余的 key 路径
- R7. 在启用 pre-commit hook 前，回填所有非 en 语言中缺失的 key（以 en 为基准），确保验证脚本能通过

## Success Criteria

- 所有翻译 JSON 仅存在于 `src/shared/i18n/locales/`，无残留副本
- 主进程和渲染进程功能与行为不变（静态导入、同一 i18next 实例配置）
- 新增 namespace 只需在 shared 下加文件 + 两端 i18next init 注册
- 新增语言只需在 shared 下加目录 + `config.ts` 注册
- pre-commit 能捕获翻译 key 不一致

## Scope Boundaries

- 不引入动态加载/按需加载——保持现有静态导入方式
- 不改变 i18next 实例配置（namespace 列表、fallback 策略等保持不变）
- 不改变翻译 key 的命名约定或内容
- 不引入 TypeScript 编译时 key 检查（仅 build-time 脚本）
- 不合并两个进程的 i18next 实例为单一实例

## Key Decisions

- **全部 namespace 合并到 shared**：虽然目前只有 `menu` 被两个进程共用，但将所有 namespace 放在同一位置（1）统一新增语言/namespace 的操作路径，（2）使 key 完整性验证能覆盖全部 namespace，（3）避免未来新功能需要判断"放 bun 还是 mainview"。代价是一次性文件搬移+导入路径更新，后续维护成本为零。
- **Key 检查仅用脚本**：平衡复杂度与收益，TS 严格类型留作未来考虑
- **Pre-commit 集成**：与项目现有 gate 模式一致，最早拦截问题

## Outstanding Questions

### Deferred to Planning
- [Affects R4][Technical] 验证脚本的实现方式（纯 Bun 脚本 vs 复用 i18next API）
- [Affects R3][Technical] 是否需要一个 shared helper 来减少两端初始化代码的重复（如公共的 resources 构建逻辑）

## Next Steps

→ `/ce:plan` for structured implementation planning
