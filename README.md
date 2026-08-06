# 积木清单 (Brick Planner)

> 把长期目标拆到「今天能动手的一块」。左边是长期目标树，右边是今日待办，拖一块过来就能开始。

解决两个真实痛点：**不知道今天该干什么**、**忘了做这件事是为了什么**。任务被做成一块块「积木」，拖拽、勾选、消除都有明确反馈。

演示地址：https://dream-path-maker-77.lovable.app

---

## ✨ 功能概览

**目标与任务**
- 长期目标 → 子目标 → 每日可执行任务，三层拆解
- 拖拽把叶子任务放进今日待办（桌面拖拽 / 手机长按右滑）
- 目标标题可重命名，支持一键全部折叠 / 展开
- 完成的任务进入「收纳箱」归档，目标进度条自动更新

**今日待办**
- 优先级（高 / 中 / 低）颜色区分并自动排序
- 已完成区：置灰保留，可再次点击撤销，支持一键清空
- 完成时有消除动画 + 音效反馈（可静音）

**AI 目标拆解**
- 输入一句野心，自动生成子目标与每日任务
- 导入前预览：目标 / 子目标 / 任务数量 + 示例时间表，可逐条编辑

**其他**
- 附件：每个任务可挂链接、图片、小型文件（≤10MB），降低行动阻力
- 日历视图：日 / 周 / 月三种视角
- 设置页：账号、语言（中 / 英）、主题、时区
- 账号：邮箱密码、Google 登录，内测期需邀请码
- PWA：可安装到手机桌面，自带版本更新提示

---

## 🧱 技术栈

| 层 | 技术 |
| --- | --- |
| 框架 | TanStack Start v1（React 19 + SSR + Server Functions） |
| 构建 | Vite 7 |
| 样式 | Tailwind CSS v4 + shadcn/ui |
| 数据 | TanStack Query（乐观更新） |
| 拖拽 | dnd-kit |
| 后端 | Supabase（Postgres + Auth + Storage，全表启用 RLS） |
| AI | 通过服务端 Server Function 调用大模型网关 |

---

## 🚀 本地运行

前置：Node.js 20+（推荐 [Bun](https://bun.sh)）。

```bash
git clone <your-repo-url>
cd brick-planner

bun install          # 或 npm install
cp .env.example .env # 填入你的后端配置，见下一节
bun run dev          # http://localhost:8080
```

常用脚本：

```bash
bun run dev        # 开发服务器
bun run build      # 生产构建
bun run preview    # 本地预览生产构建
bun run lint       # ESLint
bun run format     # Prettier
```

---

## 🔑 环境变量

在项目根目录创建 `.env`（**不要提交到仓库**）：

```dotenv
# ---- 前端可见（浏览器可读，只能放 publishable / anon 级别的 key）----
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-ref

# ---- 仅服务端可见（Server Functions / SSR）----
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
SUPABASE_PROJECT_ID=your-project-ref

# 服务端管理操作（绕过 RLS，绝不可暴露给前端）
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI 拆解所需的模型网关密钥
LOVABLE_API_KEY=your-ai-gateway-key
```

说明：
- `VITE_` 前缀的变量会被打进前端产物，只能放公开可见的值。
- 其余变量只在服务端读取，且必须在 handler 内部读取（`process.env['X']`），不要在模块顶层取值。
- 手机号短信登录需要额外接入短信服务商（如 Twilio）的凭据，未配置时该入口会提示不可用。

新建一份 `.env.example` 只保留变量名、不带真实值，方便协作者复制。

---

## 🗄️ 数据库

主要表（均在 `public` schema，启用 RLS，按 `auth.uid()` 隔离数据）：

| 表 | 用途 |
| --- | --- |
| `goals` | 长期目标（标题、颜色、排序） |
| `subgoals` | 子目标，归属某个目标 |
| `tasks` | 叶子任务（可执行的一块） |
| `daily_entries` | 今日待办条目（日期、优先级、完成状态） |
| `attachments` | 任务附件（链接或 Storage 文件） |
| `profiles` / `user_settings` | 用户资料与偏好 |
| `invite_codes` | 内测邀请码（仅服务端可读写） |

用 Supabase CLI 同步 schema：

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

---

## 📦 部署

**Lovable（最简单）**：点右上角 Publish，前端改动点 Update 生效，后端改动即时生效；可在 Project Settings → Domains 绑定自定义域名。

**自建部署**：项目面向边缘运行时（Cloudflare Workers 类）构建。

```bash
bun run build   # 产物在 .output/
```

1. 在托管平台（Cloudflare Workers / Vercel / Netlify 等）配置上面所有环境变量。
2. Build command：`bun run build`；入口按平台适配 `.output/` 中的 server 产物。
3. 在 Supabase Auth 设置里把线上域名加入 Site URL 与 Redirect URLs，否则 Google 登录会回跳失败。

注意：服务端运行在边缘运行时，请避免依赖 `child_process`、`sharp`、原生二进制等 Node-only 包。

---

## 🤝 贡献

欢迎 Issue 与 PR。提交 PR 即视为同意以 AGPL-3.0 授权贡献代码。

发现安全问题请通过私下渠道联系作者，不要在公开 issue 中披露。

---

## 📄 授权 License

源代码以 **AGPL-3.0** 发布，详见 [LICENSE](./LICENSE)。

- ✅ 允许个人学习、研究、修改和自建部署
- ⚠️ 以网络服务形式对外提供的衍生版本**必须开源全部源代码**
- ❌ 未经书面授权，禁止以商业闭源形式使用本项目的品牌、设计或代码

「积木清单 / Brick Planner」名称、logo 及视觉语言（积木化交互、消除反馈动画等）属于作者原创品牌资产，未经授权不得用于商业产品的名称、logo 或宣传物料。商业授权与合作咨询请联系项目所有者。

Copyright © 2026 积木清单作者。保留所有权利。
