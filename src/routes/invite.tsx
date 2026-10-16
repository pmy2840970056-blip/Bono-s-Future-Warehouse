import { LanguageSwitch } from "@/components/LanguageSwitch";
import { useLanguage } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Sparkles } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applyForInvite } from "@/lib/invite.functions";

const TITLE = "申请内测邀请码 · 积木清单";
const DESC =
  "留下邮箱和一句话用途，立刻领取积木清单的内测邀请码，把长期目标拆成今天能动手的一小块任务。";

export const Route = createFileRoute("/invite")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { t, language, locale } = useLanguage();
  const apply = useServerFn(applyForInvite);
  const [email, setEmail] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [soldOut, setSoldOut] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !purpose.trim()) {
      toast.error(t("请填写邮箱和一句话用途"));
      return;
    }
    setLoading(true);
    try {
      const result = await apply({ data: { email: email.trim(), purpose: purpose.trim() } });
      if (result.status === "sold_out") {
        setSoldOut(true);
      } else if (result.status === "rate_limited") {
        toast.error(t("申请太频繁了，请明天再试"));
      } else {
        setCode(result.code);
        setRepeat(result.repeat);
      }
    } catch {
      toast.error(t("提交失败，请稍后重试"));
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t("邀请码已复制"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("复制失败，请手动选中复制"));
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4 flex justify-end"><LanguageSwitch /></div>
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg border-2 border-ink bg-brick-1 shadow-brick-sm">
            <Sparkles className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black">{t("申请内测邀请码")}</h1>
            <p className="text-xs text-muted-foreground">{t("把长期目标拆成今天的一块")}</p>
          </div>
        </div>

        <div className="rounded-2xl border-2 border-ink bg-card p-6 shadow-brick">
          {code ? (
            <div className="space-y-4 text-center">
              <p className="text-sm font-bold">
                {repeat ? t("你之前已经申请过，这就是你的邀请码：") : t("申请成功，这是你的邀请码：")}
              </p>
              <div className="rounded-lg border-2 border-ink bg-brick-2 px-4 py-5 font-mono text-2xl font-black tracking-widest">
                {code}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleCopy}
                className="w-full border-2 border-ink font-bold"
              >
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? t("已复制") : t("复制邀请码")}
              </Button>
              <Button
                asChild
                className="w-full border-2 border-ink bg-brick-1 text-ink font-bold shadow-brick-sm transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brick"
              >
                <Link to="/auth">{t("去注册")}</Link>
              </Button>
              <p className="text-[11px] text-muted-foreground">
                {t("注册时选「邮箱」并填入这个邀请码即可。限 1 人使用，90 天内有效。")}</p>
            </div>
          ) : soldOut ? (
            <div className="space-y-3 text-center">
              <p className="text-sm font-bold">{t("本批内测名额已发完")}</p>
              <p className="text-xs text-muted-foreground">
                {t("我们会陆续放出新名额，欢迎稍后再来看看。")}</p>
              <Button asChild variant="outline" className="w-full border-2 border-ink font-bold">
                <Link to="/auth">{t("已有邀请码，去注册")}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="rounded-md border-2 border-ink bg-brick-3/40 px-3 py-2 text-[11px] font-bold">
                {t("每个邮箱可领一个邀请码，限 1 人使用，90 天内有效。提交后立刻显示。")}</p>
              <div>
                <Label htmlFor="apply-email">{t("邮箱")}</Label>
                <Input
                  id="apply-email"
                  type="email"
                  required
                  maxLength={255}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="border-2 border-ink"
                />
              </div>
              <div>
                <Label htmlFor="apply-purpose">{t("一句话用途")}</Label>
                <Textarea
                  id="apply-purpose"
                  required
                  maxLength={200}
                  rows={3}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder={t("例如：想用它把考研计划拆到每天")}
                  className="border-2 border-ink"
                />
                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                  {purpose.length}/200
                </p>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full border-2 border-ink bg-brick-1 text-ink font-bold shadow-brick-sm transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brick"
              >
                {loading ? t("提交中…") : t("领取邀请码")}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/auth" className="underline">
            {t("返回登录")}</Link>
        </p>
      </div>
    </main>
  );
}
