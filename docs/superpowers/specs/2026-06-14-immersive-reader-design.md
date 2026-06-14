# Immersive Full-Screen Reader Mode — Design Spec

## Context

用户反馈阅读器"可以看的区域特别小，很多控件都被工具条等占用了"。当前 reader-stage 布局在 900px 屏幕下图片流可用高度约 610px（`100vh - 290px`）。

## Goal

实现全屏沉浸式阅读模式：阅读时隐藏所有辅助控件，只显示图片；鼠标悬停顶部时临时显示工具条。

## Design

### 交互

- ReaderPanel header 中增加"全屏"切换按钮（图标按钮）
- 全屏模式下：
  - `.app-header`（顶部标题栏）→ 隐藏
  - `.reader-grid-col--chapters`（左侧章节目录）→ 隐藏
  - `.reader-panel-header`（工具条）→ 默认隐藏，鼠标悬停顶部区域（top 0 ~ 60px）时显示
  - `.reader-actions--endcap`（Up next 区块）→ 隐藏
  - Reader panel 占据整个 grid 可用宽度（`grid-column: 1 / -1`）
  - 图片流 `max-height` 重新计算为 `calc(100vh - 120px)`（因为只保留底部滚动条等少量元素）
- 按 ESC 键退出全屏模式
- 工具条 hover 显示从顶部滑出（slide-down），带有 smooth transition

### State

- `immersiveReader: boolean`（session state，放在 `App.tsx` 的 `useState`，通过 props 传给 ReaderPanel）
- 不做跨会话持久化

### CSS Contract

- `.app-shell--reader-stage.app-shell--immersive` 启用沉浸式布局
- `.reader-panel-header` 增加 `.reader-panel-header--immersive` 状态
- `.reader-actions--endcap` 增加隐藏类或控制显示

### Visual

- 全屏按钮图标：使用 Unicode expand symbol（`⛶` 或 `⊞`）或 SVG
- 工具条背景在沉浸模式下使用半透明深色背景，带 blur
- 过渡动画：opacity + transform，300ms ease

## Key Decisions

- 工具条 hover 区域限定在顶部 60px，防止误触发
- ESC 键用 `keydown` 监听，在 `App.tsx` 的 `useEffect` 中注册
- 全屏状态不影响 setup-stage，只在 reader-stage 下生效
- 切换全屏时保持当前滚动位置
- 不隐藏 status-row（日志/进度区），保持下载状态可见