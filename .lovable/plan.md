
# 积木清单 · 完整产品规划

一份从「demo」走到「可上线赚钱的 SaaS」的落地路线。分四阶段推进，每阶段结束都是一个可用的里程碑。

---

## 一、产品定位（重申，作为决策锚点）

- **一句话**：帮用户把"长期目标"拆到"今天能动手的一块"，用积木化的拖拽和消除反馈解决"不知道今天干什么 / 忘了为什么要做"的痛点。
- **形态**：Web + PWA（可"添加到主屏幕"，桌面/手机通用）
- **模式**：Freemium 订阅（免费版够用，Pro 解锁 AI 与高级功能）
- **差异化**：AI 目标拆解 + 极强的"块状"操作反馈

---

## 二、竞品与差异化建议（帮你避坑）

主流对手：滴答清单 / Todoist / Things / Notion / Sunsama。它们的共同短板：
- 都是"任务列表"思维，缺少"从目标到今天"的视觉链路
- AI 拆解要么没有，要么藏得很深
- 缺乏"消除感"的完成反馈

**我们要坚持的三条护城河**：
1. **积木化视觉语言**——已经做出来了，继续放大（拖拽阴影、消除动画、微振动反馈）
2. **强制显示"WHY"**——每个每日任务上都挂着父目标面包屑，这是我们最独特的心理设计
3. **AI 是拆解伙伴，不是话痨**——只在"我不知道怎么拆"和"今天做什么"两个关键节点介入

**建议新增的差异化点**：
- **"三块法则"**：每天最多推荐 3 个核心任务（灵感来自 Ivy Lee Method），避免每日待办变成焦虑清单
- **周复盘**：周日 AI 自动生成"这周你在哪个目标上真正推进了"
- **目标关联提醒**：一个目标 7 天没动 → 温和提醒（不是打卡式的施压）

---

## 三、四阶段路线图

### 阶段 1 · 基础后端 + 账号 + 同步（第 1-2 周）

让现有 demo 变成"能保存 / 换设备打开还在"的产品。

- 启用 **Lovable Cloud**（Supabase）
- 数据表：
  - `goals`（长期目标，含颜色、进度）
  - `subgoals`（子目标，属于 goal）
  - `tasks`（叶子任务，属于 subgoal）
  - `daily_entries`（拖入每日的记录，含完成时间、快照）
  - `user_settings`（时区、每日任务上限、提醒偏好）
- 全部表启用 RLS，策略 `auth.uid() = user_id`
- 认证方式：**邮箱 + Google 登录**（Cloud 原生支持）
- 路由拆分：`/`（登录后进入主界面）、`/auth`（登录注册页）
- 现有的 `TaskPlanner` 由本地 state 改成读写云端（用 TanStack Query 缓存）

**验收**：换台电脑登录，看到的还是同一份数据。

---

### 阶段 2 · AI 目标拆解 + 数据回顾（第 3-4 周）

把差异化能力真正做出来。

- **AI 目标拆解**（用 Lovable AI Gateway，默认 `google/gemini-3-flash-preview`）
  - 用户输入"我想在半年内跑完半马"
  - AI 输出：3-5 个子目标 → 每个子目标下 3-8 个可执行的每日任务
  - 用户可编辑/删除/接受 → 一键导入目标树
- **AI 每日推荐**
  - 早上打开时，AI 根据"哪些目标最近没动 + 用户偏好"推荐今天的 3 块
  - 用户仍可自由拖拽覆盖
- **数据回顾页 `/insights`**
  - 本周消除积木数、坚持天数、每个目标推进比例
  - 目标进度趋势折线图（用 recharts）
- **周复盘**（每周日晚上生成）
  - 用 AI 总结"本周在 X 目标上推进了 3 块，Y 目标 7 天没动，要不要调整？"

**验收**：新用户能在 3 分钟内从"想开个咖啡馆"生成一整套目标树。

---

### 阶段 3 · 商业化 · 订阅付费（第 5-6 周）

- 支付通道：**Stripe**（seamless 集成，无需自己申请商户）
- 免费 / Pro 分界：

| 能力 | 免费 | Pro |
|---|---|---|
| 目标数 | 3 个 | 无限 |
| 每日任务上限 | 无限 | 无限 |
| AI 目标拆解 | 每月 3 次 | 无限 |
| 每日 AI 推荐 | ✗ | ✓ |
| 周复盘 | ✗ | ✓ |
| 数据导出 | ✗ | ✓ |
| 历史记录 | 30 天 | 无限 |

- 定价建议：**¥28/月** 或 **¥228/年**（约 8 折），首月 ¥9 试用
- 关键页面：`/pricing`、`/account`（订阅管理、发票、取消）
- Webhook：Stripe 事件写入 `subscriptions` 表，前端读 subscription 状态控制 gating

**验收**：新用户可以完成"注册 → 试用 → 订阅 → 取消"完整闭环。

---

### 阶段 4 · PWA + 打磨 + 冷启动准备（第 7-8 周）

- **PWA**：`manifest.webmanifest` + 图标，支持"添加到主屏幕"（不做离线，避免复杂度）
- **移动端体验优化**：单栏 tab 切换（长期目标 / 今日），拖拽改为"长按 → 选择放入今日"
- **官网 / 落地页**：路由 `/`（未登录时展示营销页），`/about`、`/pricing`
- **SEO 基础**：每个页面独立 `head()`、`llms.txt`、sitemap
- **邮件通知**：Resend 或 SendGrid，做"周复盘邮件推送"
- **反馈渠道**：右下角悬浮按钮，写入 `feedback` 表

**验收**：手机加到主屏幕后启动像原生 App；官网 SEO 分数 > 90。

---

## 四、技术方案（给你和后续开发看的技术卡）

**技术栈**（沿用现有）：
- 前端：TanStack Start + React 19 + Tailwind v4 + shadcn/ui + dnd-kit
- 后端：Lovable Cloud（Supabase：Postgres + Auth + Storage）
- AI：Lovable AI Gateway（`google/gemini-3-flash-preview` 默认，Pro 用 `google/gemini-2.5-pro` 做拆解）
- 支付：Stripe seamless（`enable_stripe_payments`）
- 部署：Lovable 托管（Cloudflare Workers）

**数据模型草图**：
```text
profiles (id → auth.users, display_name, timezone, plan)
goals (id, user_id, title, color, order, archived_at)
subgoals (id, goal_id, title, order)
tasks (id, subgoal_id, title, order, ai_generated)
daily_entries (id, user_id, task_id, date, done_at, snapshot_json)
user_settings (user_id, daily_limit, reminder_time, weekly_digest)
subscriptions (user_id, stripe_customer_id, status, current_period_end)
ai_usage (user_id, month, count) -- 用于免费额度限流
```

**RLS 原则**：所有表 `user_id = auth.uid()`；`user_roles` 表 + `has_role()` 安全函数（未来做管理后台用）。

**Server 边界**：
- 全部业务逻辑用 `createServerFn` + `requireSupabaseAuth`
- Stripe webhook 用 `/api/public/webhooks/stripe` 路由，签名校验后写库
- AI 调用在服务端，永不暴露 `LOVABLE_API_KEY`

---

## 五、我建议接下来这样启动

**先做阶段 1 的第一步**：启用 Lovable Cloud + 建数据表 + 把现有 demo 接上云端存储。

原因：这是所有后续功能（AI、订阅、数据回顾）的地基。做完这一步，你就有了一个"真实可用"的产品雏形，可以先给 5-10 个朋友试用，收集第一波反馈，再决定阶段 2 的 AI 拆解细节该怎么设计。

---

## 六、需要你确认的一件事

我建议免费版给 **3 个目标 + 每月 3 次 AI 拆解**，够用户判断价值但会主动想升级。你觉得这个免费额度合理吗？还是想更宽松（比如 5 个目标）或更紧（1 个目标）？这会影响付费转化率的模型，也影响阶段 3 的定价。

如果这个方案没问题，我就开始阶段 1：启用 Cloud、建表、把 demo 接上云。
