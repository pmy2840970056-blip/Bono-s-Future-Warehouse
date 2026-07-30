import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AUTH_TITLE = "登录 / 注册 · 积木清单";
const AUTH_DESC =
  "登录或凭邀请码注册积木清单——一款把长期目标拆成今天能做的一小块任务的规划应用，支持邮箱、手机号和 Google 登录。";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: AUTH_TITLE },
      { name: "description", content: AUTH_DESC },
      { property: "og:title", content: AUTH_TITLE },
      { property: "og:description", content: AUTH_DESC },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function friendlyInviteError(msg: string): string {
  const m = msg.toLowerCase();
  if (msg.includes("INVITE_CODE_REQUIRED")) return "请填写邀请码";
  if (msg.includes("INVITE_CODE_INVALID")) return "邀请码无效，请联系邀请你的人";
  if (msg.includes("INVITE_CODE_EXPIRED")) return "邀请码已过期";
  if (msg.includes("INVITE_CODE_EXHAUSTED")) return "邀请码已被用完（每个码限一人使用）";
  if (m.includes("sms") || m.includes("phone provider") || m.includes("phone_provider"))
    return "短信登录暂未开放，请使用邮箱或 Google 登录";
  if (m.includes("weak") || m.includes("pwned"))
    return "这个密码太常见了，请换一个更复杂的密码（建议大小写+数字+符号，8 位以上）";
  if (m.includes("invalid login credentials")) return "邮箱或密码不正确";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "该邮箱已注册，请直接登录";
  if (m.includes("password should be at least")) return "密码至少需要 6 位";
  if (m.includes("email address") && m.includes("invalid")) return "邮箱格式不正确";
  if (m.includes("rate limit") || m.includes("too many")) return "操作过于频繁，请稍后再试";
  return msg;
}

const COUNTRY_CODES = [
  { code: "+86", label: "中国大陆" },
  { code: "+852", label: "中国香港" },
  { code: "+853", label: "中国澳门" },
  { code: "+886", label: "中国台湾" },
  { code: "+1", label: "美国/加拿大" },
  { code: "+44", label: "英国" },
  { code: "+81", label: "日本" },
  { code: "+82", label: "韩国" },
  { code: "+65", label: "新加坡" },
  { code: "+61", label: "澳大利亚" },
];

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [method, setMethod] = useState<"email" | "phone">("email");

  // Email fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  // Phone fields
  const [countryCode, setCountryCode] = useState("+86");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const fullPhone = () => `${countryCode}${phone.trim().replace(/\D/g, "")}`;

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const code = inviteCode.trim().toUpperCase();
        if (!code) {
          toast.error("请填写邀请码");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              display_name: displayName || email.split("@")[0],
              invite_code: code,
            },
          },
        });
        if (error) throw error;
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session) {
          toast.success("注册成功！请前往邮箱点击验证链接后再登录");
          setMode("signin");
          setLoading(false);
          return;
        }
        toast.success("注册成功！正在进入…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("欢迎回来");
      }
      navigate({ to: "/", replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "出错了，请重试";
      toast.error(friendlyInviteError(raw));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    const digits = phone.trim().replace(/\D/g, "");
    if (!digits) {
      toast.error("请输入手机号");
      return;
    }
    if (mode === "signup" && !inviteCode.trim()) {
      toast.error("请填写邀请码");
      return;
    }
    setLoading(true);
    try {
      const options: {
        shouldCreateUser: boolean;
        data?: Record<string, string>;
      } = {
        shouldCreateUser: mode === "signup",
      };
      if (mode === "signup") {
        options.data = {
          display_name: displayName || `用户${digits.slice(-4)}`,
          invite_code: inviteCode.trim().toUpperCase(),
        };
      }
      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone(),
        options,
      });
      if (error) throw error;
      setOtpSent(true);
      setCooldown(60);
      toast.success("验证码已发送，请查收短信");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "发送失败";
      toast.error(friendlyInviteError(raw));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) {
      toast.error("请输入验证码");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: fullPhone(),
        token: otp.trim(),
        type: "sms",
      });
      if (error) throw error;
      toast.success(mode === "signup" ? "注册成功！正在进入…" : "欢迎回来");
      navigate({ to: "/", replace: true });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "验证失败";
      toast.error(friendlyInviteError(raw));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (mode === "signup") {
      toast.error("首次使用请先用邮箱或手机号+邀请码注册，之后可用 Google 登录");
      return;
    }
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google 登录失败");
      setLoading(false);
    }
  }

  const switchMethod = (m: "email" | "phone") => {
    setMethod(m);
    setOtpSent(false);
    setOtp("");
  };

  return (
    <main className="min-h-screen grid place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg border-2 border-ink bg-brick-1 shadow-brick-sm">
            <Sparkles className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black">积木清单</h1>
            <p className="text-xs text-muted-foreground">把长期目标拆成今天的一块</p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-ink bg-card p-6 shadow-brick">
          <div className="mb-4 flex rounded-lg border-2 border-ink bg-background p-1">
            <button
              className={`flex-1 rounded-md py-1.5 text-sm font-bold ${mode === "signin" ? "bg-brick-2" : ""}`}
              onClick={() => setMode("signin")}
              type="button"
            >
              登录
            </button>
            <button
              className={`flex-1 rounded-md py-1.5 text-sm font-bold ${mode === "signup" ? "bg-brick-2" : ""}`}
              onClick={() => setMode("signup")}
              type="button"
            >
              注册
            </button>
          </div>

          <div className="mb-4 flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => switchMethod("email")}
              className={`flex-1 rounded-md border-2 border-ink py-1.5 font-bold ${method === "email" ? "bg-brick-4 shadow-brick-sm" : "bg-background text-muted-foreground"}`}
            >
              邮箱
            </button>
            <button
              type="button"
              onClick={() => switchMethod("phone")}
              className={`flex-1 rounded-md border-2 border-ink py-1.5 font-bold ${method === "phone" ? "bg-brick-4 shadow-brick-sm" : "bg-background text-muted-foreground"}`}
            >
              手机号
            </button>
          </div>

          {method === "email" ? (
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="name">显示名（可选）</Label>
                  <Input
                    id="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="小明"
                    className="border-2 border-ink"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-2 border-ink"
                />
              </div>
              <div>
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-2 border-ink"
                />
              </div>
              {mode === "signup" && (
                <div>
                  <Label htmlFor="invite">邀请码</Label>
                  <Input
                    id="invite"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="向邀请你的人索取"
                    className="border-2 border-ink font-mono tracking-wider"
                    autoCapitalize="characters"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">内测阶段仅限受邀用户注册。</p>
                </div>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full border-2 border-ink bg-brick-1 text-ink font-bold shadow-brick-sm hover:shadow-brick hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all"
              >
                {mode === "signin" ? "登录" : "创建账号"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="pname">显示名（可选）</Label>
                  <Input
                    id="pname"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="小明"
                    className="border-2 border-ink"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="phone">手机号</Label>
                <div className="flex gap-2">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="rounded-md border-2 border-ink bg-background px-2 text-sm font-bold"
                    aria-label="国家/地区区号"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} {c.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="13800001234"
                    className="flex-1 border-2 border-ink"
                  />
                </div>
              </div>
              {mode === "signup" && (
                <div>
                  <Label htmlFor="pinvite">邀请码</Label>
                  <Input
                    id="pinvite"
                    required
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="向邀请你的人索取"
                    className="border-2 border-ink font-mono tracking-wider"
                    autoCapitalize="characters"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="otp">验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="otp"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="6 位验证码"
                    className="flex-1 border-2 border-ink font-mono tracking-widest"
                    disabled={!otpSent}
                  />
                  <Button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading || cooldown > 0}
                    variant="outline"
                    className="shrink-0 border-2 border-ink font-bold"
                  >
                    {cooldown > 0 ? `${cooldown}s` : otpSent ? "重新发送" : "获取验证码"}
                  </Button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading || !otpSent}
                className="w-full border-2 border-ink bg-brick-1 text-ink font-bold shadow-brick-sm hover:shadow-brick hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all"
              >
                {mode === "signin" ? "登录" : "创建账号"}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                提示：短信服务由后台配置，若发送失败请稍后再试或改用邮箱登录。
              </p>
            </form>
          )}

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-ink/20" />
            <span>或</span>
            <div className="h-px flex-1 bg-ink/20" />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={handleGoogle}
            className="w-full border-2 border-ink font-bold"
          >
            使用 Google 继续
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          注册即表示同意我们的服务条款和隐私政策。
        </p>
      </div>
    </main>
  );
}
