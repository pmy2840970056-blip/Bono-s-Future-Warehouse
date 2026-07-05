import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  LogOut,
  Plus,
  Sparkles,
  Target,
  Trash2,
  Volume2,
  VolumeX,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { AiGoalDialog } from "@/components/AiGoalDialog";
import { TaskAttachments } from "@/components/TaskAttachments";
import { useNavigate } from "@tanstack/react-router";
import {
  isMuted,
  sfxCheer,
  sfxClick,
  sfxComplete,
  sfxDelete,
  sfxDrop,
  sfxPop,
  toggleMuted,
} from "@/lib/sfx";


import { supabase } from "@/integrations/supabase/client";
import {
  createDailyEntry,
  createGoal,
  createSubgoal,
  createTask,
  deleteGoal,
  deleteSubgoal,
  deleteTask,
  fetchGoalsTree,
  fetchTodayEntries,
  markDailyEntryDone,
  removeDailyEntry,
  seedSampleData,
} from "@/lib/planner-api";
import type { BrickColor, DailyTask, Goal, LeafTask, SubGoal } from "@/lib/planner-types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const colorClass: Record<BrickColor, string> = {
  "brick-1": "bg-brick-1",
  "brick-2": "bg-brick-2",
  "brick-3": "bg-brick-3",
  "brick-4": "bg-brick-4",
};
const colorRing: Record<BrickColor, string> = {
  "brick-1": "before:bg-brick-1",
  "brick-2": "before:bg-brick-2",
  "brick-3": "before:bg-brick-3",
  "brick-4": "before:bg-brick-4",
};
const CYCLE: BrickColor[] = ["brick-1", "brick-2", "brick-3", "brick-4"];

function MuteButton() {
  const [muted, setMutedState] = useState(false);
  useEffect(() => {
    setMutedState(isMuted());
    const h = () => setMutedState(isMuted());
    window.addEventListener("sfx:mute-change", h);
    return () => window.removeEventListener("sfx:mute-change", h);
  }, []);
  return (
    <button
      onClick={() => {
        const next = toggleMuted();
        if (!next) sfxClick();
      }}
      className="grid h-9 w-9 place-items-center rounded-md border-2 border-ink bg-background shadow-brick-sm hover:bg-accent"
      aria-label={muted ? "开启音效" : "关闭音效"}
      title={muted ? "开启音效" : "关闭音效"}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
    </button>
  );
}

type DragPayload = {
  taskId: string;
  title: string;
  goalTitle: string;
  subGoalTitle: string;
  color: BrickColor;
};

/* -------------- Inline add row ---------------- */
function InlineAdd({
  placeholder,
  onAdd,
  small,
}: {
  placeholder: string;
  onAdd: (v: string) => Promise<unknown> | void;
  small?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md border-2 border-dashed border-ink/30 px-2 py-1.5 text-xs font-bold text-muted-foreground hover:border-ink hover:text-ink hover:bg-background",
          small && "py-1 text-[11px]",
        )}
      >
        <Plus className="h-3 w-3" strokeWidth={3} />
        {placeholder}
      </button>
    );
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!val.trim() || busy) return;
        setBusy(true);
        try {
          await onAdd(val.trim());
          setVal("");
          setOpen(false);
        } finally {
          setBusy(false);
        }
      }}
      className="flex items-center gap-1"
    >
      <Input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if (!val.trim()) setOpen(false);
        }}
        placeholder={placeholder}
        className="h-8 border-2 border-ink text-sm"
      />
      <button
        type="submit"
        disabled={busy}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md border-2 border-ink bg-brick-2 shadow-brick-sm hover:shadow-brick"
      >
        <Plus className="h-4 w-4" strokeWidth={3} />
      </button>
    </form>
  );
}

/* --------- Leaf brick (draggable) --------- */
function LeafTaskBrick({
  task,
  goal,
  sub,
  usedIds,
  userId,
  onDelete,
}: {
  task: LeafTask;
  goal: Goal;
  sub: SubGoal;
  usedIds: Set<string>;
  userId: string;
  onDelete: () => void;
}) {
  const used = usedIds.has(task.id);
  const payload: DragPayload = {
    taskId: task.id,
    title: task.title,
    goalTitle: goal.title,
    subGoalTitle: sub.title,
    color: goal.color,
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `leaf-${task.id}`,
    data: payload,
    disabled: used,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative flex items-center gap-2 rounded-lg border-2 border-ink bg-card px-3 py-2.5",
        "shadow-brick-sm transition-all select-none",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1.5 before:rounded-l-md",
        colorRing[goal.color],
        used
          ? "opacity-40"
          : "hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-brick",
        isDragging && "opacity-30",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "flex flex-1 items-center gap-2 min-w-0",
          used ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
        )}
      >
        <GripVertical className="ml-1 h-4 w-4 shrink-0 text-muted-foreground opacity-40 group-hover:opacity-100" />
        <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{task.title}</span>
      </div>
      {used && (
        <span className="shrink-0 rounded border border-ink bg-done px-1.5 py-0.5 text-[10px] font-bold uppercase">
          已安排
        </span>
      )}
      <TaskAttachments taskId={task.id} userId={userId} compact />
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition"
        aria-label="删除任务"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function SubGoalBlock({
  sub,
  goal,
  usedIds,
  userId,
}: {
  sub: SubGoal;
  goal: Goal;
  usedIds: Set<string>;
  userId: string;
}) {
  const [open, setOpen] = useState(true);
  const qc = useQueryClient();

  const addTask = useMutation({
    mutationFn: (title: string) => createTask(userId, sub.id, title, sub.tasks.length),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals", userId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "添加失败"),
  });
  const delTask = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      sfxDelete();
      qc.invalidateQueries({ queryKey: ["goals", userId] });
    },
  });
  const delSub = useMutation({
    mutationFn: () => deleteSubgoal(sub.id),
    onSuccess: () => {
      sfxDelete();
      qc.invalidateQueries({ queryKey: ["goals", userId] });
    },
  });

  return (
    <div className="ml-3 border-l-2 border-dashed border-ink/30 pl-4">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-ink"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          {sub.title}
          <span className="ml-1 text-[10px] opacity-60">({sub.tasks.length})</span>
        </button>
        <button
          onClick={() => {
            if (confirm(`删除子目标「${sub.title}」及其下所有任务？`)) delSub.mutate();
          }}
          className="opacity-30 hover:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {open && (
        <div className="space-y-2">
          {sub.tasks.map((t) => (
            <LeafTaskBrick
              key={t.id}
              task={t}
              goal={goal}
              sub={sub}
              usedIds={usedIds}
              userId={userId}
              onDelete={() => delTask.mutate(t.id)}
            />
          ))}
          <InlineAdd placeholder="添加任务" small onAdd={(v) => addTask.mutateAsync(v)} />
        </div>
      )}
    </div>
  );
}

function GoalBlock({ goal, usedIds, userId }: { goal: Goal; usedIds: Set<string>; userId: string }) {
  const [open, setOpen] = useState(true);
  const qc = useQueryClient();
  const total = goal.subgoals.reduce((n, s) => n + s.tasks.length, 0);
  const done = goal.subgoals.reduce(
    (n, s) => n + s.tasks.filter((t) => usedIds.has(t.id)).length,
    0,
  );
  const pct = total ? Math.round((done / total) * 100) : 0;

  const addSub = useMutation({
    mutationFn: (title: string) => createSubgoal(userId, goal.id, title, goal.subgoals.length),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals", userId] }),
  });
  const delGoal = useMutation({
    mutationFn: () => deleteGoal(goal.id),
    onSuccess: () => {
      sfxDelete();
      qc.invalidateQueries({ queryKey: ["goals", userId] });
    },
  });

  return (
    <div className="rounded-xl border-2 border-ink bg-card p-4 shadow-brick">
      <div className="mb-3 flex items-center gap-3">
        <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-md border-2 border-ink shadow-brick-sm",
              colorClass[goal.color],
            )}
          >
            <Target className="h-4 w-4 text-ink" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold">{goal.title}</h3>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full border border-ink bg-background">
                <div className={cn("h-full transition-all", colorClass[goal.color])} style={{ width: `${pct}%` }} />
              </div>
              <span className="shrink-0 font-mono text-[11px] font-bold">{done}/{total}</span>
            </div>
          </div>
          {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        <button
          onClick={() => {
            if (confirm(`删除目标「${goal.title}」及其下所有内容？`)) delGoal.mutate();
          }}
          className="opacity-30 hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {open && (
        <div className="space-y-4 pt-1">
          {goal.subgoals.map((s) => (
            <SubGoalBlock key={s.id} sub={s} goal={goal} usedIds={usedIds} userId={userId} />
          ))}
          <div className="ml-3 pl-4">
            <InlineAdd placeholder="添加子目标" onAdd={(v) => addSub.mutateAsync(v)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------- Daily brick --------------- */
function DailyBrick({
  task,
  userId,
  onToggle,
  animating,
}: {
  task: DailyTask;
  userId: string;
  onToggle: (id: string) => void;
  animating: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border-2 border-ink bg-card p-4 shadow-brick transition-all",
        "hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-brick-lg",
        !animating && "animate-brick-drop",
        task.done && "animate-brick-fade",
      )}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => {
            if (!task.done) sfxComplete();
            onToggle(task.id);
          }}
          className={cn(
            "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 border-ink transition-all",
            "shadow-brick-sm hover:shadow-brick-press hover:translate-x-0.5 hover:translate-y-0.5",
            task.done ? colorClass[task.color] : "bg-background",
          )}
          aria-label="完成"
        >
          {task.done && (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="4">
              <path d="M4 12l6 6L20 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-1.5 overflow-hidden text-[10px] font-bold uppercase tracking-wider">
            <span className={cn("rounded border border-ink px-1.5 py-0.5", colorClass[task.color])}>
              {task.goalTitle}
            </span>
            <span className="text-muted-foreground">›</span>
            <span className="truncate text-muted-foreground">{task.subGoalTitle}</span>
          </div>
          <p className={cn("relative text-[15px] font-semibold leading-snug", task.done && "text-muted-foreground")}>
            {task.title}
            {task.done && (
              <span className="pointer-events-none absolute left-0 top-1/2 h-[3px] w-full origin-left animate-strike bg-ink" />
            )}
          </p>
        </div>
        {task.taskId && !task.done && (
          <TaskAttachments taskId={task.taskId} userId={userId} />
        )}
      </div>
    </div>
  );
}

function DropZone({ isOver, hasTasks }: { isOver: boolean; hasTasks: boolean }) {
  const { setNodeRef } = useDroppable({ id: "daily-drop" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-3 border-dashed border-ink/40 bg-background/50 p-8 text-center transition-all",
        hasTasks ? "min-h-[120px]" : "min-h-[240px]",
        isOver && "border-ink bg-accent/40 scale-[1.02] shadow-brick",
      )}
      style={{ borderWidth: 3 }}
    >
      <div
        className={cn(
          "mb-3 grid h-12 w-12 place-items-center rounded-lg border-2 border-ink bg-card shadow-brick-sm transition-transform",
          isOver && "rotate-6 scale-110",
        )}
      >
        <Plus className="h-6 w-6" strokeWidth={3} />
      </div>
      <p className="text-sm font-bold">{isOver ? "松手放下！" : "从左边拖一块任务过来"}</p>
      <p className="mt-1 max-w-[28ch] text-xs text-muted-foreground">
        不知道今天做什么？拖一块过来，看着它，就想起来为什么要做了。
      </p>
    </div>
  );
}

/* ---------------- Main page --------------- */
export default function TaskPlanner() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [isOver, setIsOver] = useState(false);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
        setUserEmail(data.user.email ?? "");
      }
    });
  }, []);

  const goalsQ = useQuery({
    queryKey: ["goals", userId],
    queryFn: () => fetchGoalsTree(userId!),
    enabled: !!userId,
  });
  const dailyQ = useQuery({
    queryKey: ["daily", userId],
    queryFn: () => fetchTodayEntries(userId!),
    enabled: !!userId,
  });
  useQuery({
    queryKey: ["attachment-counts", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_attachments")
        .select("task_id")
        .eq("user_id", userId!);
      if (error) throw error;
      const out: Record<string, number> = {};
      for (const r of data ?? []) out[r.task_id] = (out[r.task_id] ?? 0) + 1;
      return out;
    },
    enabled: !!userId,
  });

  const goals = goalsQ.data ?? [];
  const daily = dailyQ.data ?? [];
  const usedIds = useMemo(
    () => new Set(daily.filter((d) => !d.done).map((d) => d.taskId).filter(Boolean)),
    [daily],
  );
  const activeCount = daily.filter((d) => !d.done).length;
  const doneCount = daily.filter((d) => d.done).length;

  const addGoal = useMutation({
    mutationFn: (title: string) =>
      createGoal(userId!, title, CYCLE[goals.length % CYCLE.length], goals.length),
    onSuccess: () => {
      sfxPop();
      qc.invalidateQueries({ queryKey: ["goals", userId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "创建失败"),
  });

  const dropEntry = useMutation({
    mutationFn: (p: DragPayload) => createDailyEntry(userId!, p),
    onSuccess: (row) => {
      sfxDrop();
      qc.invalidateQueries({ queryKey: ["daily", userId] });
      if (row) {
        setJustDroppedId(row.id);
        setTimeout(() => setJustDroppedId(null), 400);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "拖入失败"),
  });

  const doneEntry = useMutation({
    mutationFn: (id: string) => markDailyEntryDone(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["daily", userId] });
      const prev = qc.getQueryData<DailyTask[]>(["daily", userId]);
      qc.setQueryData<DailyTask[]>(["daily", userId], (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, done: true } : t)),
      );
      // Remove after fade animation
      setTimeout(async () => {
        await removeDailyEntry(id);
        qc.invalidateQueries({ queryKey: ["daily", userId] });
      }, 900);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["daily", userId], ctx.prev);
    },
  });

  const seed = useMutation({
    mutationFn: () => seedSampleData(userId!),
    onSuccess: () => {
      sfxCheer();
      qc.invalidateQueries({ queryKey: ["goals", userId] });
      toast.success("已载入示例目标");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "载入失败"),
  });


  function handleDragStart(e: DragStartEvent) {
    setDragPayload(e.active.data.current as DragPayload);
  }
  function handleDragEnd(e: DragEndEvent) {
    const payload = e.active.data.current as DragPayload | undefined;
    setDragPayload(null);
    setIsOver(false);
    if (!payload) return;
    if (e.over?.id !== "daily-drop") return;
    if (usedIds.has(payload.taskId)) return;
    dropEntry.mutate(payload);
  }

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const today = new Date().toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={(e) => setIsOver(e.over?.id === "daily-drop")}
      onDragCancel={() => {
        setDragPayload(null);
        setIsOver(false);
      }}
    >
      <div className="min-h-screen">
        <header className="border-b-2 border-ink bg-card">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg border-2 border-ink bg-brick-1 shadow-brick-sm">
                <Sparkles className="h-5 w-5" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight">积木清单</h1>
                <p className="text-xs text-muted-foreground">把长期目标拆成今天能做的一块</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:block rounded-lg border-2 border-ink bg-background px-3 py-1.5 font-mono text-xs font-bold shadow-brick-sm">
                {today}
              </div>
              <button
                onClick={() => setAiOpen(true)}
                disabled={!userId}
                className="flex items-center gap-1.5 rounded-md border-2 border-ink bg-brick-3 px-3 py-1.5 text-xs font-bold shadow-brick-sm hover:shadow-brick disabled:opacity-50"
              >
                <Wand2 className="h-3.5 w-3.5" strokeWidth={2.5} />
                <span className="hidden sm:inline">AI 拆解</span>
              </button>
              <MuteButton />
              <div className="hidden md:block text-xs text-muted-foreground">{userEmail}</div>

              <button
                onClick={handleSignOut}
                className="grid h-9 w-9 place-items-center rounded-md border-2 border-ink bg-background shadow-brick-sm hover:bg-accent"
                aria-label="退出登录"
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-black">长期目标</h2>
                <p className="text-sm text-muted-foreground">拆到能立刻动手的那一块</p>
              </div>
              <span className="rounded-md border-2 border-ink bg-brick-4 px-2 py-1 text-xs font-bold shadow-brick-sm">
                {goals.length} 个目标
              </span>
            </div>

            <div className="space-y-4">
              {goalsQ.isLoading && (
                <div className="rounded-xl border-2 border-dashed border-ink/30 p-8 text-center text-sm text-muted-foreground">
                  加载中…
                </div>
              )}

              {!goalsQ.isLoading && goals.length === 0 && (
                <div className="rounded-xl border-2 border-dashed border-ink/40 bg-card p-8 text-center">
                  <p className="mb-1 text-base font-bold">还没有目标</p>
                  <p className="mb-4 text-sm text-muted-foreground">
                    让 AI 帮你把长期目标拆成一块块任务，或先载入示例看看效果
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      onClick={() => setAiOpen(true)}
                      className="border-2 border-ink bg-brick-3 text-ink font-bold shadow-brick-sm"
                    >
                      <Wand2 className="h-4 w-4" strokeWidth={2.5} /> AI 拆解一个目标
                    </Button>
                    <Button
                      onClick={() => seed.mutate()}
                      disabled={seed.isPending}
                      variant="ghost"
                      className="border-2 border-ink bg-background text-ink font-bold shadow-brick-sm"
                    >
                      载入示例
                    </Button>
                  </div>
                </div>
              )}

              {goals.map((g) => (
                <GoalBlock key={g.id} goal={g} usedIds={usedIds} userId={userId!} />
              ))}

              {userId && (
                <InlineAdd placeholder="添加长期目标" onAdd={(v) => addGoal.mutateAsync(v)} />
              )}
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-black">今天要做</h2>
                <p className="text-sm text-muted-foreground">
                  {activeCount} 块待办 · {doneCount} 块已消除
                </p>
              </div>
              {activeCount > 0 && (
                <span className="rounded-md border-2 border-ink bg-brick-2 px-2 py-1 text-xs font-bold shadow-brick-sm">
                  加油
                </span>
              )}
            </div>

            <div className="space-y-3">
              {daily.map((t) => (
                <DailyBrick
                  key={t.id}
                  task={t}
                  userId={userId!}
                  onToggle={(id) => doneEntry.mutate(id)}
                  animating={justDroppedId !== t.id}
                />
              ))}
              <DropZone isOver={isOver} hasTasks={daily.length > 0} />
            </div>
          </section>
        </main>
      </div>

      <DragOverlay dropAnimation={{ duration: 250, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
        {dragPayload && (
          <div
            className={cn(
              "rotate-3 cursor-grabbing rounded-xl border-2 border-ink bg-card p-3 shadow-brick-lg",
              "animate-brick-shake",
            )}
            style={{ minWidth: 240 }}
          >
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
              <span className={cn("rounded border border-ink px-1.5 py-0.5", colorClass[dragPayload.color])}>
                {dragPayload.goalTitle}
              </span>
            </div>
            <p className="text-sm font-semibold">{dragPayload.title}</p>
          </div>
        )}
      </DragOverlay>

      {userId && (
        <AiGoalDialog
          open={aiOpen}
          onOpenChange={setAiOpen}
          userId={userId}
          goalsCount={goals.length}
        />
      )}
    </DndContext>
  );
}
