import { useLanguage } from "@/lib/i18n";
import { createFileRoute, Link, getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { zhCN, enUS } from "date-fns/locale";
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { fetchEntriesInRange, type DatedEntry } from "@/lib/planner-api";
import type { BrickColor, Priority } from "@/lib/planner-types";
import { cn } from "@/lib/utils";

const authenticatedRoute = getRouteApi("/_authenticated");

const CAL_TITLE = "日历视图 · 积木清单";
const CAL_DESC =
  "以日、周、月三种视角回看你的积木任务：查看每天完成了哪几块、这周还有多少待办、按月俯瞰整体进度节奏。";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: CAL_TITLE },
      { name: "description", content: CAL_DESC },
      { property: "og:title", content: CAL_TITLE },
      { property: "og:description", content: CAL_DESC },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CalendarPage,
});

type ViewMode = "day" | "week" | "month";

const colorClass: Record<BrickColor, string> = {
  "brick-1": "bg-brick-1",
  "brick-2": "bg-brick-2",
  "brick-3": "bg-brick-3",
  "brick-4": "bg-brick-4",
};

const priorityDot: Record<Priority, string> = {
  1: "bg-red-500",
  2: "bg-amber-400",
  3: "bg-emerald-500",
};

const priorityLabel: Record<Priority, string> = {
  1: "高优先级",
  2: "中优先级",
  3: "低优先级",
};

function fmtDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function CalendarPage() {
  const { t, language, locale } = useLanguage();
  const { user } = authenticatedRoute.useRouteContext();
  const userId = user.id;
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState<Date>(new Date());

  const range = useMemo(() => {
    if (view === "day") {
      return { start: cursor, end: cursor };
    }
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      return { start: s, end: endOfWeek(cursor, { weekStartsOn: 1 }) };
    }
    // month: include leading/trailing days to fill grid
    const s = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const e = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return { start: s, end: e };
  }, [view, cursor]);

  const startStr = fmtDate(range.start);
  const endStr = fmtDate(range.end);

  const q = useQuery({
    queryKey: ["calendar-entries", userId, startStr, endStr],
    queryFn: () => fetchEntriesInRange(userId, startStr, endStr),
    staleTime: 30_000,
  });
  const entries = q.data ?? [];

  const byDate = useMemo(() => {
    const m = new Map<string, DatedEntry[]>();
    for (const e of entries) {
      const arr = m.get(e.date) ?? [];
      arr.push(e);
      m.set(e.date, arr);
    }
    return m;
  }, [entries]);

  function shift(delta: 1 | -1) {
    if (view === "day") setCursor((d) => addDays(d, delta));
    else if (view === "week") setCursor((d) => (delta > 0 ? addWeeks(d, 1) : subWeeks(d, 1)));
    else setCursor((d) => (delta > 0 ? addMonths(d, 1) : subMonths(d, 1)));
  }

  const title = useMemo(() => {
    if (view === "day") return format(cursor, language === "en" ? "EEEE, MMMM d, yyyy" : "yyyy年 M月 d日 EEEE", { locale: language === "en" ? enUS : zhCN });
    if (view === "week") {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      const e = endOfWeek(cursor, { weekStartsOn: 1 });
      return `${format(s, language === "en" ? "MMM d" : "M月d日", { locale: language === "en" ? enUS : zhCN })} — ${format(e, language === "en" ? "MMM d" : "M月d日", { locale: language === "en" ? enUS : zhCN })}`;
    }
    return format(cursor, language === "en" ? "MMMM yyyy" : "yyyy年 M月", { locale: language === "en" ? enUS : zhCN });
  }, [view, cursor, language]);

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-ink bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="grid h-10 w-10 place-items-center rounded-lg border-2 border-ink bg-background shadow-brick-sm hover:bg-accent"
              aria-label={t("返回")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="grid h-10 w-10 place-items-center rounded-lg border-2 border-ink bg-brick-3 shadow-brick-sm">
              <CalendarDays className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">{t("日历视图")}</h1>
              <p className="text-xs text-muted-foreground">{t("日 · 周 · 月 三种视角回看积木")}</p>
            </div>
          </div>
          <ViewSwitch view={view} onChange={setView} />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => shift(-1)}
              className="grid h-9 w-9 place-items-center rounded-md border-2 border-ink bg-background shadow-brick-sm hover:bg-accent"
              aria-label={t("上一段")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCursor(new Date())}
              className="rounded-md border-2 border-ink bg-brick-2 px-3 py-1.5 text-xs font-bold shadow-brick-sm hover:shadow-brick"
            >
              {t("回到今天")}</button>
            <button
              onClick={() => shift(1)}
              className="grid h-9 w-9 place-items-center rounded-md border-2 border-ink bg-background shadow-brick-sm hover:bg-accent"
              aria-label={t("下一段")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-lg font-black tracking-tight sm:text-2xl">{title}</h2>
          <div className="w-[136px]" aria-hidden />
        </div>

        {view === "day" && <DayView date={cursor} entries={byDate.get(fmtDate(cursor)) ?? []} loading={q.isLoading} />}
        {view === "week" && (
          <WeekView cursor={cursor} byDate={byDate} onPick={(d) => { setCursor(d); setView("day"); }} loading={q.isLoading} />
        )}
        {view === "month" && (
          <MonthView cursor={cursor} start={range.start} end={range.end} byDate={byDate} onPick={(d) => { setCursor(d); setView("day"); }} loading={q.isLoading} />
        )}
      </main>
    </div>
  );
}

function ViewSwitch({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const { t, language, locale } = useLanguage();
  const opts: { key: ViewMode; label: string }[] = [
    { key: "day", label: t("日") },
    { key: "week", label: t("周") },
    { key: "month", label: t("月") },
  ];
  return (
    <div className="flex items-center gap-1 rounded-lg border-2 border-ink bg-background p-1 shadow-brick-sm">
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "min-w-[42px] rounded-md px-3 py-1 text-sm font-bold transition-all",
            view === o.key
              ? "bg-brick-3 border-2 border-ink shadow-brick-sm"
              : "border-2 border-transparent hover:bg-accent",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function EntryChip({ e, compact }: { e: DatedEntry; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold shadow-brick-sm",
        colorClass[e.color],
        e.done && "opacity-60",
      )}
      title={`${e.goalTitle} › ${e.title}`}
    >
      <span
        className={cn("h-1.5 w-1.5 shrink-0 rounded-full border border-ink/60", priorityDot[e.priority])}
        role="img"
        aria-label={t(priorityLabel[e.priority])}
      />
      <span className={cn("truncate", compact ? "max-w-[80px]" : "max-w-[140px]", e.done && "line-through")}>
        {e.title}
      </span>
    </div>
  );
}

function DayView({ date, entries, loading }: { date: Date; entries: DatedEntry[]; loading: boolean }) {
  const { t, language, locale } = useLanguage();
  const active = entries.filter((e) => !e.done).sort((a, b) => a.priority - b.priority);
  const done = entries.filter((e) => e.done);
  return (
    <div className="rounded-xl border-2 border-ink bg-card p-6 shadow-brick">
      <div className="mb-4 flex items-center gap-2">
        <div className={cn(
          "grid h-12 w-12 place-items-center rounded-lg border-2 border-ink shadow-brick-sm",
          isToday(date) ? "bg-brick-1" : "bg-background",
        )}>
          <span className="text-lg font-black">{format(date, "d")}</span>
        </div>
        <div>
          <div className="text-sm font-bold">{format(date, "EEEE", { locale: language === "en" ? enUS : zhCN })}</div>
          <div className="text-xs text-muted-foreground">
            {loading ? t("加载中…") : `${active.length} 块待办 · ${done.length} 块已消除`}
          </div>
        </div>
      </div>
      {!loading && entries.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-ink/30 p-8 text-center text-sm text-muted-foreground">
          {t("这一天没有积木记录")}</div>
      )}
      <div className="space-y-2">
        {active.map((e) => (
          <DayEntryRow key={e.id} e={e} />
        ))}
        {done.length > 0 && (
          <div className="mt-4 space-y-2 border-t-2 border-dashed border-ink/20 pt-4">
            <div className="text-xs font-bold uppercase text-muted-foreground">{t("已完成")}{done.length}</div>
            {done.map((e) => (
              <DayEntryRow key={e.id} e={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DayEntryRow({ e }: { e: DatedEntry }) {
  const { t, language, locale } = useLanguage();
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 overflow-hidden rounded-lg border-2 border-ink bg-card p-3 pl-4 shadow-brick-sm",
        e.done && "opacity-70",
      )}
    >
      <span
        role="img"
        aria-label={priorityLabel[e.priority]}
        className={cn("absolute left-0 top-0 h-full w-1.5 border-r-2 border-ink", priorityDot[e.priority])}
      />
      <div className="flex-1 min-w-0">
        <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
          <span className={cn("rounded border border-ink px-1.5 py-0.5", colorClass[e.color])}>{e.goalTitle}</span>
          <span className="text-muted-foreground">›</span>
          <span className="truncate text-muted-foreground">{e.subGoalTitle}</span>
        </div>
        <p className={cn("text-sm font-semibold", e.done && "text-muted-foreground line-through")}>{e.title}</p>
      </div>
      {e.done && (
        <span className="shrink-0 rounded border-2 border-ink bg-done px-1.5 py-0.5 text-[10px] font-bold">{t("已完成")}</span>
      )}
    </div>
  );
}

function WeekView({
  cursor,
  byDate,
  onPick,
  loading,
}: {
  cursor: Date;
  byDate: Map<string, DatedEntry[]>;
  onPick: (d: Date) => void;
  loading: boolean;
}) {
  const { t, language, locale } = useLanguage();
  const start = startOfWeek(cursor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((d) => {
        const key = fmtDate(d);
        const items = byDate.get(key) ?? [];
        const active = items.filter((e) => !e.done).length;
        const done = items.filter((e) => e.done).length;
        return (
          <button
            key={key}
            onClick={() => onPick(d)}
            className={cn(
              "flex min-h-[180px] flex-col rounded-xl border-2 border-ink p-3 text-left shadow-brick-sm transition-all hover:-translate-y-0.5 hover:shadow-brick",
              isToday(d) ? "bg-brick-1/30" : "bg-card",
            )}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase text-muted-foreground">
                  {format(d, "EEE", { locale: language === "en" ? enUS : zhCN })}
                </div>
                <div className="text-xl font-black">{format(d, "d")}</div>
              </div>
              {items.length > 0 && (
                <span className="rounded border-2 border-ink bg-background px-1.5 py-0.5 text-[10px] font-bold">
                  {done}/{items.length}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {loading && <span className="text-[11px] text-muted-foreground">…</span>}
              {items.slice(0, 4).map((e) => (
                <EntryChip key={e.id} e={e} compact />
              ))}
              {items.length > 4 && (
                <span className="text-[10px] font-bold text-muted-foreground">+{items.length - 4} {t("更多")}</span>
              )}
              {!loading && items.length === 0 && (
                <span className="text-[11px] text-muted-foreground">—</span>
              )}
            </div>
            {active > 0 && (
              <div className="mt-auto pt-2 text-[10px] font-bold text-muted-foreground">
                {active} {t("未完成")}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function MonthView({
  cursor,
  start,
  end,
  byDate,
  onPick,
  loading,
}: {
  cursor: Date;
  start: Date;
  end: Date;
  byDate: Map<string, DatedEntry[]>;
  onPick: (d: Date) => void;
  loading: boolean;
}) {
  const { t, language, locale } = useLanguage();
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  const weekHeaders = [t("一"), t("二"), t("三"), t("四"), t("五"), t("六"), t("日")];
  return (
    <div className="overflow-hidden rounded-xl border-2 border-ink bg-card shadow-brick">
      <div className="grid grid-cols-7 border-b-2 border-ink bg-background">
        {weekHeaders.map((h) => (
          <div key={h} className="border-r-2 border-ink px-2 py-2 text-center text-xs font-bold last:border-r-0">
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = fmtDate(d);
          const items = byDate.get(key) ?? [];
          const inMonth = isSameMonth(d, cursor);
          const isSel = isSameDay(d, cursor);
          const last = (i + 1) % 7 === 0;
          const bottom = i >= days.length - 7;
          return (
            <button
              key={key}
              onClick={() => onPick(d)}
              className={cn(
                "flex min-h-[92px] flex-col border-ink p-1.5 text-left transition-colors",
                !last && "border-r-2",
                !bottom && "border-b-2",
                inMonth ? "bg-card" : "bg-background/60",
                isToday(d) && "bg-brick-1/30",
                isSel && "ring-2 ring-ink ring-inset",
                "hover:bg-accent/40",
              )}
            >
              <div className={cn(
                "mb-1 text-xs font-bold",
                !inMonth && "text-muted-foreground/50",
                isToday(d) && "text-ink",
              )}>
                {format(d, "d")}
              </div>
              <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                {loading && inMonth && <span className="text-[10px] text-muted-foreground">…</span>}
                {items.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className={cn(
                      "flex items-center gap-1 rounded border border-ink/70 px-1 py-0.5 text-[9px] font-bold",
                      colorClass[e.color],
                      e.done && "opacity-50 line-through",
                    )}
                    title={e.title}
                  >
                    <span className={cn("h-1 w-1 shrink-0 rounded-full", priorityDot[e.priority])} />
                    <span className="truncate">{e.title}</span>
                  </div>
                ))}
                {items.length > 3 && (
                  <span className="text-[9px] font-bold text-muted-foreground">+{items.length - 3}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
