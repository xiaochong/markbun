# Windows 前端菜单实现说明

## 概述

MarkBun 在 Windows 平台上使用了前端实现的自定义菜单栏（AppMenuBar），而不是 Electrobun 提供的原生系统菜单。本文档说明这一决策的原因以及未来如何切换回系统菜单。

## 为什么使用前端菜单

### 根本原因：Electrobun 的 Windows 菜单 Bug

Electrobun 框架在 Windows 平台上存在以下问题：

1. **菜单渲染问题**：原生菜单在 Windows 上无法正确渲染，可能导致菜单不显示或显示异常
2. **菜单事件丢失**：点击菜单项后，事件无法正确传递到 renderer 进程
3. **快捷键冲突**：系统菜单的快捷键处理与前端编辑器快捷键存在冲突
4. **样式不一致**：Windows 原生菜单样式与应用的暗黑/明亮主题无法统一

### 解决方案：前端自定义菜单

为了提供可靠的用户体验，我们实现了基于 React 的自定义菜单栏（`AppMenuBar`）：

- **位置**：`src/mainview/components/menu/AppMenuBar.tsx`
- **特点**：
  - 与应用主题完全一致（暗黑/明亮模式自动切换）
  - 支持完整的菜单层级（多级子菜单）
  - 菜单项状态实时同步（checked 状态）
  - 快捷键显示和映射（CmdOrCtrl → Ctrl 等）
  - 响应式交互（hover、click、escape 关闭）

## 架构设计

### 菜单配置流程

```
src/bun/menu.ts  →  通过 getMenuConfig() RPC  →  src/mainview/App.tsx  →  AppMenuBar
     ↑                                                    ↓
  定义菜单结构                                    监听 UI 状态变化
  (ApplicationMenuItemConfig)                     更新菜单项 checked 状态
```

### 菜单动作处理流程

```
用户点击菜单项  →  AppMenuBar  →  handleMenuAction  →  RPC sendMenuAction
                                                         ↓
                                                   src/bun/index.ts
                                                         ↓
                                                   rpc.send.menuAction
                                                         ↓
                                                   renderer 监听处理
```

### 关键代码位置

| 功能 | 文件路径 |
|------|----------|
| 菜单定义 | `src/bun/menu.ts` |
| 菜单配置 RPC | `src/bun/index.ts` (`getMenuConfig`) |
| 菜单动作 RPC | `src/bun/index.ts` (`sendMenuAction`) |
| 前端菜单组件 | `src/mainview/components/menu/AppMenuBar.tsx` |
| 菜单类型定义 | `src/shared/types.ts` (`MenuConfig`, `MenuItemConfig`) |
| 平台检测 | `src/mainview/App.tsx` (`const isWindows = ...`) |

## 如何切换回系统菜单

当 Electrobun 修复 Windows 菜单问题后，可以按以下步骤切换回原生系统菜单：

### 步骤 1：修改 `src/bun/menu.ts`

移除 Windows 平台的条件判断，恢复原生菜单：

```typescript
// 当前代码（使用前端菜单）
export function setupMenu(state: ViewMenuState, tFn: (key: string) => string): void {
  const menu: ApplicationMenuItemConfig[] = [...];

  currentMenuConfig = menu;

  // Windows 使用前端菜单，跳过原生菜单设置
  if (!isWindows) {
    ApplicationMenu.setApplicationMenu(menu);
  }
}

// 修改为（使用原生菜单）
export function setupMenu(state: ViewMenuState, tFn: (key: string) => string): void {
  const menu: ApplicationMenuItemConfig[] = [...];

  currentMenuConfig = menu;

  // 所有平台使用原生菜单
  ApplicationMenu.setApplicationMenu(menu);
}
```

### 步骤 2：移除前端菜单组件

从 `src/mainview/App.tsx` 中移除前端菜单相关代码：

1. 移除导入：
   ```typescript
   // 删除以下行
   import { AppMenuBar } from './components/menu';
   import type { MenuConfig, AppMenuState } from './components/menu';
   ```

2. 移除菜单状态：
   ```typescript
   // 删除以下状态和 hook
   const [menuConfig, setMenuConfig] = useState<MenuConfig[]>([]);
   const appMenuState = useMemo<AppMenuState>(...);
   ```

3. 移除菜单加载逻辑：
   ```typescript
   // 删除 useEffect 中的菜单配置加载
   useEffect(() => {
     if (!isWindows) return;
     // 加载菜单配置...
   }, [isWindows]);
   ```

4. 移除菜单渲染：
   ```tsx
   // 删除 JSX 中的 AppMenuBar
   {isWindows && menuConfig.length > 0 && (
     <AppMenuBar ... />
   )}
   ```

### 步骤 3：移除或弃用相关 RPC

如果不再需要前端菜单，可以移除以下 RPC：

- `getMenuConfig` - 获取菜单配置
- `sendMenuAction` - 发送菜单动作

**注意**：建议保留这些 RPC 一段时间，以便向后兼容或作为备选方案。

### 步骤 4：清理类型定义

如果完全移除前端菜单，可以清理类型定义：

- 从 `src/shared/types.ts` 中移除 `MenuConfig` 和 `MenuItemConfig`（如果不再使用）
- 移除 `src/mainview/components/menu/` 目录

### 步骤 5：测试验证

切换回系统菜单后，需要测试以下功能：

1. **菜单显示**：所有菜单项是否正确显示
2. **菜单点击**：点击菜单项是否触发正确动作
3. **快捷键**：快捷键是否正常工作
4. **菜单状态**：checked 状态是否正确更新
5. **主题一致性**：菜单样式是否与应用主题一致（如果 Electrobun 支持）

## 参考链接

- Electrobun 菜单文档：[待补充]
- Electrobun Windows 支持 Issue：[待补充]
- MarkBun 菜单实现 PR：#[待补充]

## 更新记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2025-03-29 | v0.x | 初始前端菜单实现 |
