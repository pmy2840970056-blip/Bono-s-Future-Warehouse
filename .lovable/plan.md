## 目标

1. 手机端首次进入时显示新手引导，告诉用户：左右滑动切 Tab；叶子任务上的「+」按钮可以快速加入今日待办；长按任务后向右滑可以拖入今日待办。
2. 手机端新增**长按 + 右滑**的拖拽交互：在长期目标 Tab 里长按任一叶子任务约 400ms 后，卡片进入"待拖动"高亮态，此时手指向右滑动超过阈值 → 把任务加入今日待办 + toast + 自动切到今日 Tab；松手不达标则取消。

---

## 一、新手引导浮层

新增组件 `src/components/MobileOnboarding.tsx`：
- 只在 `useIsMobile()` 为 true 且 `localStorage["brick.onboarded.v1"] !== "1"` 时渲染
- 半透明遮罩 + 居中卡片，卡片风格沿用现有 `border-2 border-ink bg-paper` 拟物砖块风
- 内容三条要点（emoji + 短句）：
  - 👉 左右滑动切换「长期目标 / 今天要做」
  - ➕ 叶子任务右侧的「+」按钮：一键加入今日
  - ✊ 长按任务后向右滑：也能拖入今日
- 底部一个「知道了」按钮，点击写入 localStorage 并关闭
- 挂在 `TaskPlanner.tsx` 顶层（进入首页即可见），登录页/日历页不显示

---

## 二、手机端长按 + 右滑拖拽

改动集中在 `TaskPlanner.tsx`：

### 交互流程
```text
touchstart  →  启动 400ms 长按计时器 + 轻震动
              （若期间手指移动 > 8px 或抬起，取消长按）
长按触发     →  卡片进入 "armed" 态：轻微放大 + 边框加粗 + 阴影
touchmove   →  实时跟随水平位移做 translateX（最多 120px）
              超过 80px 阈值时右侧出现 "→ 加入今日" 提示条
touchend    →  超过阈值：调用现有 addToToday 逻辑 + toast + 切到今日 Tab
              未过阈值：回弹动画，恢复原状
```

### 实现要点
- 只在 `isMobile` 时启用；桌面端保持 HTML5 DnD 不变
- 长按期间**阻止** `<main>` 上的水平滑动切 Tab 逻辑（在 armed 状态时，`onTouchMove` 的父级 handler 提前 return），避免和 Tab 手势冲突
- 复用现有 `createDailyEntry` 乐观更新的 mutation，不新增 API
- 触觉反馈：`navigator.vibrate?.(15)` 在长按触发与拖入成功时各响一次
- 卡片本地状态：`armedId`、`dragOffsetX`，卸载时清理计时器

### 保留现有能力
- 手机端「+」按钮保留（快速点击派）
- Tab 头点击 + 空白区域左右滑动切 Tab 依旧生效（只有在 armed 态的卡片会拦截）

---

## 三、文件清单

- 新增：`src/components/MobileOnboarding.tsx`
- 修改：`src/components/TaskPlanner.tsx`
  - 挂载 `<MobileOnboarding />`
  - `LeafTaskBrick` 增加 touch 手势 props（长按 + 位移）
  - `<main>` 的 swipe handler 在 armed 期间让位

---

## 需要你确认

1. 新手引导的关闭策略：**只显示一次**（默认方案，写 localStorage），还是"每次新版本再弹一次"？
2. 长按时长 **400ms** 是否合适？（太短容易误触发，太长手感迟钝）
3. 是否需要"设置里可以重置新手引导"入口，方便你演示给朋友看？
