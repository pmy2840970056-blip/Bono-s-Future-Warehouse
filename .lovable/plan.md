## 目标

1. 设计一个更精致、更有辨识度的 App 图标，替换现有 PWA 图标（安装到桌面/主屏后显示的那个）
2. 新增「设置」入口和设置页，覆盖语言、地区、账号等通用设置

---

## 一、App 图标重设计

**视觉方向**（沿用「积木清单」的品牌基因）：
- 主体：几块堆叠的立体积木，其中最顶层带一个「勾选」符号，暗示「今天完成的一块」
- 配色：深紫 → 靛蓝渐变背景（呼应现有 `#7c3aed` 主题色），积木用暖白 + 一抹柔和的珊瑚色高光，增加温度
- 风格：iOS/Android 现代 App 图标质感，微光泽、柔和阴影、圆角矩形安全区内构图
- 保证 16px 缩略时仍能识别（主体占画面 60% 左右，避免过于细碎）

**输出文件**（覆盖现有）：
- `public/icon-512.png` — 主图标（512×512，premium 质量）
- `public/icon-192.png` — 从 512 缩放
- `public/apple-touch-icon.png` — 180×180，iOS 主屏
- `public/favicon.ico` 保持不变，或另生成一个 `public/favicon.png` 作为浏览器标签图标（可选，若做则更新 `__root.tsx` 的 `<link rel="icon">`）

**注意**：PWA 图标在用户设备上会被缓存，已安装用户需要卸载重装才能看到新图标。这一点会在完成时告知你。

---

## 二、设置页

### 入口
- 顶部工具栏（`TaskPlanner.tsx` 的 header）中，在"日历"图标旁新增一个「齿轮」图标按钮，`aria-label="设置"`
- 手机端同样显示（图标按钮不占空间）

### 路由
- 新增 `src/routes/_authenticated/settings.tsx`，位于登录保护布局下
- 页面标题：`设置 · 积木清单`

### 设置项分组

**账号**
- 显示当前登录邮箱（只读）
- 显示昵称（可编辑，写入 `profiles.display_name`）
- 修改密码入口（触发 Supabase `updateUser({ password })` 的对话框）
- 退出登录按钮
- 危险区：删除账号（暂时先做「联系我们删除」的说明，实际级联删除放后续阶段，避免误伤）

**通用**
- 语言：中文（简体）/ English —— 存入 `user_settings.language`（现无此列，需新增，见下）
- 地区/时区：下拉选择常见时区，默认跟随浏览器 —— 复用 `user_settings.timezone`（已存在）
- 每日任务上限：数字输入 —— 复用 `user_settings.daily_limit`

**外观**
- 主题：跟随系统 / 浅色 / 深色 —— 前端 `localStorage` 存储 + `<html>` class 切换（不入库，避免多设备体验冲突）

**关于**
- 版本号（写死在页面）
- 隐私政策 / 用户协议链接占位（若暂无正式条款，展示"敬请期待"）
- 反馈邮箱（mailto 链接，可先用你的邮箱占位——**这里需要你告诉我一个邮箱**，或先留 `hello@example.com`）

### 国际化（i18n）范围

第一版仅切换设置页与主界面**核心可见文案**（导航、按钮、空状态、AI 弹窗标题），不做完整 i18n 框架（避免范围爆炸）。方案：
- 新建 `src/lib/i18n.ts`，导出 `zh` / `en` 两份 key→文案 对象，加一个 `useLang()` hook 从 `user_settings.language` 读取（未登录默认 `zh`）
- 组件内用 `t("key")` 替换硬编码文案；本轮只替换设置页 + `TaskPlanner` 的顶部区域和主要按钮，其余保留中文，后续按需扩展

如果你希望**完整全站 i18n**（含所有对话框、错误提示、AI 生成内容语言随切换），范围会大很多，建议单独立项——本次计划先落地"设置项存在且能切换主界面主要文字"。

---

## 三、数据库改动

对 `user_settings` 表新增列：
- `language text not null default 'zh'`（可选值 `'zh' | 'en'`）

其他列已存在（`timezone`、`daily_limit`）。通过 migration 添加，不影响现有数据。

---

## 四、技术要点（给开发看）

- 图标：用 `imagegen--generate_image` 的 `premium` 质量生成 512 主图，再用 `sharp` 或直接复制为 192/180
- 设置页数据读写用 `createServerFn` + `requireSupabaseAuth`，遵循现有 `planner-api.ts` 模式
- Header 齿轮按钮：`<Link to="/settings">` + `lucide-react` 的 `Settings` 图标
- 主题切换：`document.documentElement.classList.toggle("dark")`，首屏用一段 inline script 防闪烁
- 密码修改：`supabase.auth.updateUser({ password })`，客户端调用即可（不需要 server fn）

---

## 五、需要你确认的两件事

1. **反馈邮箱**用什么？（先给个占位也行，后面再改）
2. **国际化范围**：本次只做「设置页 + 主界面顶部/主要按钮」的双语切换够不够？还是要一次性把全站文案都做成可切换？（后者工作量约 3-4 倍）

如果这两点你没意见，我就按上面的方案实现。
