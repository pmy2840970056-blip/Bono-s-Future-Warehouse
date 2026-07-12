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
  "登录或凭邀请码注册积木清单——一款把长期目标拆成今天能做的一小块任务的规划应用，支持邮箱和 Google 登录。";

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
  if (msg.includes("INVITE_CODE_REQUIRED")) return "请填写邀请码";
  if (msg.includes("INVITE_CODE_INVALID")) return "邀请码无效，请联系邀请你的人";
  if (msg.includes("INVITE_CODE_EXPIRED")) return "邀请码已过期";
  if (msg.includes("INVITE_CODE_EXHAUSTED")) return "邀请码已被用完";
  return msg;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
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

  async function handleGoogle() {
    if (mode === "signup") {
      toast.error("首次使用请先用邮箱+邀请码注册，之后可用 Google 登录");
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
          <div className="mb-5 flex rounded-lg border-2 border-ink bg-background p-1">
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

          <form onSubmit={handleSubmit} className="space-y-3">
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
                <p className="mt-1 text-[11px] text-muted-foreground">
                  内测阶段仅限受邀用户注册。
                </p>
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
