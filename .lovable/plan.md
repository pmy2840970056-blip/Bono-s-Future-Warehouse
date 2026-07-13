
## 一、手机号 + 短信验证码登录

### 前置：短信通道
Lovable Cloud 原生支持 Phone Auth，但**发短信本身需要一个 SMS 服务商**（Twilio 是最常用的）。你需要：
1. 注册 Twilio 账号，买一个可发送国际短信的号码
2. 我用 `add_secret` 工具向你要 Twilio 的 Account SID、Auth Token、发送号码
3. 我在后端配置 Supabase Auth 的 Phone Provider 指向 Twilio

如果你想先跳过这一步，我可以先把前端界面做好，后端 SMS 通道等你拿到 Twilio 凭据再接。

### 前端改造
`src/routes/auth.tsx` 顶部新增一个 Tab 切换：**邮箱 / 手机号**
- 手机号登录 UI：国家区号选择器（默认 +86）+ 手机号输入 + 「获取验证码」按钮 → 输入 6 位验证码 → 登录
- 使用 `supabase.auth.signInWithOtp({ phone })` 发验证码，`supabase.auth.verifyOtp({ phone, token, type: "sms" })` 校验
- 注册流程同样支持手机号，但**仍需邀请码**（复用现有 `handle_new_user` 触发器逻辑，通过 `signInWithOtp` 的 `options.data.invite_code` 传入）
- 60 秒倒计时防止重复发送

### 数据库
`handle_new_user` 已通过 `raw_user_meta_data->>'invite_code'` 校验，手机号注册走同一路径无需改。但需要给 `profiles` 兼容手机号用户（原逻辑 `split_part(NEW.email, '@', 1)` 在无 email 时会返回空串）——修补触发器：优先用 meta 里的 `display_name`，否则用手机号后 4 位。

---

## 二、应用内版本更新提示条

### 机制
- 构建时把 `import.meta.env.VITE_APP_VERSION` 注入到前端（`vite.config.ts` 里读 `package.json` 的 version 或 build 时间戳）
- 新增静态文件 `public/version.json`（构建时由脚本生成，内容 `{ "version": "xxx" }`）
- 前端启动时读一次当前版本存 memory；每 5 分钟 / 页面重新聚焦时 fetch `/version.json?t=<timestamp>`（bust 缓存），对比不同则显示提示条
- 提示条 UI：顶部 sticky 横条，`bg-brick-3 border-b-2 border-ink`，文案「发现新版本，点此刷新体验」+ 关闭按钮（本次会话不再提示）
- 点击刷新：`window.location.reload()`

### 文件
- 新增 `src/components/UpdateBanner.tsx`
- 新增 `src/hooks/useVersionCheck.ts`
- `vite.config.ts` 加一个 build 阶段的 plugin，生成 `public/version.json`
- 在 `src/routes/__root.tsx` 里挂 `<UpdateBanner />`

---

## 三、手机端左右滑动 Tab

### 布局
仅在 **手机端**（`useIsMobile()` 为 true）时启用；桌面端保持现有左右并排布局不变。

手机端结构：
```text
┌──────────────────────────┐
│ Header（logo/齿轮/日历）    │
├──────────────────────────┤
│ [ 目标树 ] [ 今日待办 ]     │ ← Tab 头，当前选中高亮
├──────────────────────────┤
│                          │
│  滑动切换的内容区           │
│  （左：目标树 / 右：今日）   │
│                          │
└──────────────────────────┘
```

### 交互
- 左右滑动切换（用 `embla-carousel-react`，项目已装 shadcn 的 Carousel 组件，底层就是 embla）
- Tab 头点击也能切换，与滑动同步
- **代替拖拽的「加入今日」**：在目标树 Tab 里，任务卡片长按或点击 → 弹出小菜单「➕ 加入今日待办」→ 加入成功后 toast 提示「已加入今日，向右滑查看」
- 今日待办 Tab 里的完成/删除交互不变（原本就不依赖拖拽）

### 实现
- `TaskPlanner.tsx` 里以 `isMobile` 分叉：手机端渲染新组件 `<MobilePlanner />`，桌面端保持原样
- 新增 `src/components/MobilePlanner.tsx`：内含 Carousel + 两个 Tab 内容区
- 复用现有 `GoalsPanel` / `TodayPanel` 组件（如果目前是内联的，抽出成独立组件）
- 目标树里的任务卡片增加一个「+」小按钮（手机端可见），点击直接调用 `createDailyEntry`

---

## 四、需要你确认

1. **手机号短信通道**：现在就要接 Twilio（需要你去注册并给我凭据），还是先把前端做好、SMS 后端后面再接？
2. **发短信费用**：Twilio 发到中国大陆的短信约 0.05-0.08 美元/条，注册时你需要给账号充值，这个 OK 吗？
3. **手机端目标树里的 +**：只有一个 emoji「+」按钮就够，还是要更明显（比如带背景色的圆形按钮）？

三点确认后我就开工。
