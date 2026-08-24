# Sidebar Provider Panel Design

日期：2026-08-24

## 目标

把供应商推荐从输入框命令提升为左侧栏底部常驻入口，视觉与交互位置对齐“DSH 更新”和“Trace 对比”。移除 `/providers` 客户端命令；Agent 工具与设置卡片不变。

## 交互

- `sidebar.footer.action` 注册“供应商”按钮，展开侧栏时在其他 actions 下方独占完整一行，rail 模式只显示图标。
- 点击按钮切换 `shell.overlay` 面板；按钮用 `aria-pressed` 表示打开状态。
- 面板绑定当前普通会话，先从 `/models` 读取完整 DSH `session.models` 目录，再为当前或选中的模型请求推荐。
- 面板显示当前 DSH 模型、推荐 Top 5、其他合格供应商、当前供应商标记和刷新按钮。
- 点击供应商调用现有 `/apply`；成功后刷新并关闭，失败保留面板并显示错误。
- addressed subagent 或无活动会话时按钮禁用，不发请求。

## 边界

- 状态存储独立于 React 组件，trigger 与 overlay 共用同一个 store。
- 继续复用 Host API 与打分/切换逻辑，不新增 Host 路由。
- 不再注册 `ctx.commandUi`，并从 Client manifest inject 中移除 ui-commands。
- 设置卡片与两个 Agent 工具保持不变。

## 验证

- 单测 store 的打开/关闭、load/apply 状态与错误保留。
- 单测 option 分组和当前标记。
- 构建后确认 Client manifest 不再依赖 ui-commands。
- 浏览器确认侧栏入口、overlay Top 5、刷新和无控制台错误；不点击真实供应商以避免创建 preset。
