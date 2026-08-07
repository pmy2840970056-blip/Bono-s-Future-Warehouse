# 内测邀请码申请页

访客填邮箱和一句话用途，提交后当场拿到一个专属邀请码，可直接去注册。

## 用户流程

```text
登录页 →「没有邀请码？申请一个」→ /invite 申请页
  填邮箱 + 一句话用途 → 提交
  → 页面直接显示邀请码（一键复制）→ 点「去注册」回登录页
  同一邮箱再次提交 → 显示上次已发的同一个码，不重复占用
```

## 页面

新增独立申请页 `/invite`（也方便单独分享到小红书），登录页「邀请码」输入框下方加一行「没有邀请码？申请一个」链接。

页面内容：
- 一句话说明内测规则（每个邮箱一个码，限 1 人使用，90 天有效）
- 邮箱输入 + 一句话用途输入（最多 200 字）
- 提交后的成功态：大字号邀请码 + 复制按钮 + 「去注册」按钮
- 库存发完时的提示：显示「本批名额已发完」，不报错

沿用现有积木风格（块状容器、卡片、现有配色与按钮），不引入新视觉语言。

## 发放规则

- 提交即自动从现有未使用的邀请码里领走一个（目前库存 53 个）
- 每个邮箱只对应一个码：重复提交返回同一个码
- 领取记录进新表，方便你后台看谁申请了、写了什么用途
- 一个邮箱每天最多提交 5 次，防刷
- 不发邮件（当前项目未配置发信域名），码在页面上直接给出

## 技术细节

**数据库迁移**
- 新表 `public.invite_applications`：`id`、`email`（唯一）、`purpose`、`code`、`created_at`、`ip_hash`
- 只授权 `service_role`，启用 RLS 且不给 `anon`/`authenticated` 任何策略（访客不能读别人的申请）
- SECURITY DEFINER 函数 `claim_invite_code(_email text, _purpose text)`：
  - 规范化邮箱（trim + lower），已存在则直接返回原 code
  - 否则 `SELECT ... FOR UPDATE SKIP LOCKED` 取一个 `active AND uses_count < max_uses AND (expires_at IS NULL OR expires_at > now())` 的码，写入申请记录并返回
  - 无可用码时返回 null，让前端显示「已发完」
  - 只授 `EXECUTE` 给 `service_role`

**服务端**
- `src/lib/invite.functions.ts`：未认证的 `createServerFn`（POST），用 zod 校验邮箱格式与用途长度（1–200），在 handler 内 `await import('@/integrations/supabase/client.server')` 用服务端管理客户端调用上述函数
- 同一邮箱每日 5 次的频率限制在函数里按申请表 + 一张轻量计数判断（按邮箱当天记录数），超限返回友好错误
- 不返回除 code 之外的任何数据

**前端**
- 新路由 `src/routes/invite.tsx`（公开、SSR，带自己的 `head()` 标题与描述）
- `src/routes/auth.tsx` 增加指向 `/invite` 的链接

## 不做的事

- 不配置发信域名、不发邮件（你确认自动发放页面直接显示）
- 不做人工审核后台（如需要可后续加）
