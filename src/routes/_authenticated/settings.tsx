import { useLanguage } from "@/lib/i18n";
import { createFileRoute, Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Settings as SettingsIcon, User, Globe, Palette, Info, LogOut, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const authenticatedRoute = getRouteApi("/_authenticated");

const TITLE = "设置 · 积木清单";
const DESC = "管理账号、语言、时区、外观等通用偏好设置。";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

type ThemeMode = "system" | "light" | "dark";
type Lang = "zh" | "en";

const APP_VERSION = "0.1.0";

const TIMEZONES = [
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Seoul",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "UTC",
];

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  root.classList.toggle("dark", dark);
}

async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, timezone")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchSettings(userId: string) {
  const { data, error } = await supabase
    .from("user_settings")
    .select("daily_limit, language")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function SettingsPage() {
  const { t, language, locale, setLanguage } = useLanguage();
  const { user } = authenticatedRoute.useRouteContext();
  const userId = user.id;
  const email = user.email ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const profileQ = useQuery({ queryKey: ["profile", userId], queryFn: () => fetchProfile(userId) });
  const settingsQ = useQuery({ queryKey: ["settings", userId], queryFn: () => fetchSettings(userId) });

  const [displayName, setDisplayName] = useState("");

  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [dailyLimit, setDailyLimit] = useState(3);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("theme") as ThemeMode) || "system";
  });

  useEffect(() => {
    if (profileQ.data) {
      setDisplayName(profileQ.data.display_name ?? "");
      setTimezone(profileQ.data.timezone ?? "Asia/Shanghai");
    }
  }, [profileQ.data]);
  useEffect(() => {
    if (settingsQ.data) {

      setDailyLimit(settingsQ.data.daily_limit ?? 3);
    }
  }, [settingsQ.data]);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() || null, timezone })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      toast.success(t("已保存"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("user_settings")
        .update({ language, daily_limit: dailyLimit })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", userId] });
      toast.success(t("设置已保存"));
    },
    onError: (e: Error) => toast.error(e.message),
  });


  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const [pwOpen, setPwOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-ink bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="grid h-10 w-10 place-items-center rounded-lg border-2 border-ink bg-background shadow-brick-sm hover:bg-accent"
            aria-label={t("返回")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="grid h-10 w-10 place-items-center rounded-lg border-2 border-ink bg-brick-4 shadow-brick-sm">
            <SettingsIcon className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">{t("设置")}</h1>
            <p className="text-xs text-muted-foreground">{t("账号 · 通用偏好 · 外观")}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Account */}
        <Section icon={<User className="h-4 w-4" />} title={t("账号")} desc={t("登录信息与个人资料")}>
          <Row label={t("邮箱")}>
            <div className="rounded-md border-2 border-ink bg-background px-3 py-2 text-sm font-mono">{email}</div>
          </Row>
          <Row label={t("昵称")}>
            <div className="flex gap-2">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("给自己起个名字")}
                className="border-2 border-ink"
                maxLength={40}
              />
              <Button
                onClick={() => saveProfile.mutate()}
                disabled={saveProfile.isPending}
                className="border-2 border-ink bg-brick-2 text-ink shadow-brick-sm hover:shadow-brick"
              >
                {t("保存")}</Button>
            </div>
          </Row>
          <Row label={t("密码")}>
            <Button
              variant="outline"
              onClick={() => setPwOpen(true)}
              className="border-2 border-ink shadow-brick-sm"
            >
              <KeyRound className="mr-2 h-4 w-4" /> {t("修改密码")}</Button>
          </Row>
          <Row label={t("退出登录")}>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="border-2 border-ink shadow-brick-sm"
            >
              <LogOut className="mr-2 h-4 w-4" /> {t("退出当前账号")}</Button>
          </Row>
          <Row label={t("删除账号")}>
            <p className="text-xs text-muted-foreground">
              {t("如需删除账号与全部数据，请发送邮件至")}{" "}
              <a href="mailto:hello@example.com" className="font-bold underline">
                hello@example.com
              </a>
              {t("，我们会在 7 个工作日内处理。")}</p>
          </Row>
        </Section>

        {/* General */}
        <Section icon={<Globe className="h-4 w-4" />} title={t("通用")} desc={t("语言、地区、每日节奏")}>
          <Row label={t("语言 Language")}>
            <SegChoice
              value={language}
              onChange={(v) => setLanguage(v as Lang)}
              options={[
                { value: "zh", label: "中文" },
                { value: "en", label: "English" },
              ]}
            />
          </Row>
          <Row label={t("时区 / 地区")}>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-md border-2 border-ink bg-background px-3 py-2 text-sm shadow-brick-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Row>
          <Row label={t("每日任务上限")}>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={20}
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="w-24 border-2 border-ink"
              />
              <span className="text-xs text-muted-foreground">{t("建议 3 块，专注今天最重要的事")}</span>
            </div>
          </Row>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                saveSettings.mutate();
                saveProfile.mutate();
              }}
              disabled={saveSettings.isPending || saveProfile.isPending}
              className="border-2 border-ink bg-brick-2 text-ink shadow-brick-sm hover:shadow-brick"
            >
              {t("保存通用设置")}</Button>
          </div>
        </Section>

        {/* Appearance */}
        <Section icon={<Palette className="h-4 w-4" />} title={t("外观")} desc={t("主题风格（存储在本设备）")}>
          <Row label={t("主题")}>
            <SegChoice
              value={theme}
              onChange={(v) => setTheme(v as ThemeMode)}
              options={[
                { value: "system", label: t("跟随系统") },
                { value: "light", label: t("浅色") },
                { value: "dark", label: t("深色") },
              ]}
            />
          </Row>
        </Section>

        {/* About */}
        <Section icon={<Info className="h-4 w-4" />} title={t("关于")} desc={t("版本与支持")}>
          <Row label={t("版本")}>
            <span className="font-mono text-sm">v{APP_VERSION}</span>
          </Row>
          <Row label={t("反馈与建议")}>
            <a href="mailto:hello@example.com" className="text-sm font-bold underline">
              hello@example.com
            </a>
          </Row>
          <Row label={t("隐私与条款")}>
            <span className="text-xs text-muted-foreground">{t("敬请期待")}</span>
          </Row>
        </Section>
      </main>

      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </div>
  );
}

function Section({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border-2 border-ink bg-card p-4 shadow-brick sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-md border-2 border-ink bg-background shadow-brick-sm">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-black tracking-tight">{title}</h2>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function SegChoice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg border-2 border-ink bg-background p-1 shadow-brick-sm">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-bold transition-all",
            value === o.value
              ? "border-2 border-ink bg-brick-3 shadow-brick-sm"
              : "border-2 border-transparent hover:bg-accent",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t, language, locale } = useLanguage();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (pw1.length < 6) return toast.error(t("密码至少 6 位"));
    if (pw1 !== pw2) return toast.error(t("两次输入不一致"));
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("密码已更新"));
    setPw1("");
    setPw2("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-2 border-ink">
        <DialogHeader>
          <DialogTitle>{t("修改密码")}</DialogTitle>
          <DialogDescription>{t("新密码至少 6 位，修改后当前登录状态保持有效。")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>{t("新密码")}</Label>
            <Input type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} className="border-2 border-ink" />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("再次输入")}</Label>
            <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className="border-2 border-ink" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-2 border-ink">
            {t("取消")}</Button>
          <Button
            onClick={submit}
            disabled={busy}
            className="border-2 border-ink bg-brick-2 text-ink shadow-brick-sm"
          >
            {t("确认修改")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
