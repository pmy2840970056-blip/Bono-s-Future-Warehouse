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
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  LogOut,
  Package,
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
import { fetchAttachmentCounts } from "@/lib/attachments-api";
import { useNavigate, Link } from "@tanstack/react-router";
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
  fetchCompletedTaskIds,
  fetchGoalsTree,
  fetchTodayEntries,
  markDailyEntryDone,
  unmarkDailyEntryDone,
  removeDailyEntry,
  seedSampleData,
  updateDailyEntryPriority,
} from "@/lib/planner-api";
import type { BrickColor, DailyTask, Goal, LeafTask, Priority, SubGoal } from "@/lib/planner-types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const colorClass: Record<BrickColor, string> = {
  "brick-1": "bg-brick-1",
  "brick-2": "bg-brick-2",
  "brick-3": "bg-brick-3",
  "brick-4": "bg-brick-4",
};

const PRIORITY_META: Record<Priority, { label: string; short: string; dot: string; ring: string; chip: string }> = {
  1: {
    label: "高优先级",
    short: "高",
    dot: "bg-red-500",
    ring: "ring-red-500/60",
    chip: "bg-red-100 text-red-700 border-red-500",
  },
  2: {
    label: "中优先级",
    short: "中",
    dot: "bg-amber-400",
    ring: "ring-amber-400/60",
    chip: "bg-amber-100 text-amber-800 border-amber-500",
  },
  3: {
    label: "低优先级",
    short: "低",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500/60",
    chip: "bg-emerald-100 text-emerald-700 border-emerald-500",
  },
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
      onSubmit={(e) => {
        e.preventDefault();
        const next = val.trim();
        if (!next) return;
        setVal("");
        setOpen(false);
        Promise.resolve(onAdd(next)).catch(() => {
          setVal(next);
          setOpen(true);
        });
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
  completedIds,
  justCompletedIds,
  userId,
  onDelete,
}: {
  task: LeafTask;
  goal: Goal;
  sub: SubGoal;
  usedIds: Set<string>;
  completedIds: Set<string>;
  justCompletedIds: Set<string>;
  userId: string;
  onDelete: () => void;
}) {
  const completed = completedIds.has(task.id);
  const used = usedIds.has(task.id);
  const justDone = justCompletedIds.has(task.id);
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
    disabled: used || completed,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative flex items-center gap-2 rounded-lg border-2 border-ink px-3 py-2.5 transition-all select-none",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1.5 before:rounded-l-md",
        colorRing[goal.color],
        completed
          ? "bg-muted/60 shadow-none opacity-60 before:opacity-30 grayscale"
          : "bg-card shadow-brick-sm",
        !completed && used && "opacity-40",
        !completed && !used && "hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-brick",
        isDragging && "opacity-30",
        justDone && "animate-brick-drop",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "flex flex-1 items-center gap-2 min-w-0",
          completed || used ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
        )}
      >
        {completed ? (
          <span
            className={cn(
              "ml-1 grid h-4 w-4 shrink-0 place-items-center rounded-sm border border-ink/60 bg-done text-ink",
              justDone && "animate-brick-shake",
            )}
            aria-label="已完成"
          >
            <Check className="h-3 w-3" strokeWidth={4} />
          </span>
        ) : (
          <GripVertical className="ml-1 h-4 w-4 shrink-0 text-muted-foreground opacity-40 group-hover:opacity-100" />
        )}
        <span
          className={cn(
            "min-w-0 flex-1 text-sm font-medium leading-snug",
            completed && "line-through text-muted-foreground",
          )}
        >
          {task.title}
        </span>
      </div>
      {!completed && used && (
        <span className="shrink-0 rounded border border-ink bg-done px-1.5 py-0.5 text-[10px] font-bold uppercase">
          已安排
        </span>
      )}
      {!completed && <TaskAttachments taskId={task.id} userId={userId} compact />}
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
  completedIds,
  justCompletedIds,
  userId,
}: {
  sub: SubGoal;
  goal: Goal;
  usedIds: Set<string>;
  completedIds: Set<string>;
  justCompletedIds: Set<string>;
  userId: string;
}) {
  const [open, setOpen] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const activeTasks = useMemo(() => sub.tasks.filter((t) => !completedIds.has(t.id)), [sub.tasks, completedIds]);
  const archivedTasks = useMemo(() => sub.tasks.filter((t) => completedIds.has(t.id)), [sub.tasks, completedIds]);
  const allDone = sub.tasks.length > 0 && archivedTasks.length === sub.tasks.length;
  const qc = useQueryClient();

  const addTask = useMutation({
    mutationFn: (title: string) => createTask(userId, sub.id, title, sub.tasks.length),
    onMutate: async (title) => {
      await qc.cancelQueries({ queryKey: ["goals", userId] });
      const prev = qc.getQueryData<Goal[]>(["goals", userId]);
      const tempId = `temp-${Date.now()}`;
      qc.setQueryData<Goal[]>(["goals", userId], (old) =>
        (old ?? []).map((g) =>
          g.id !== goal.id
            ? g
            : {
                ...g,
                subgoals: g.subgoals.map((s) =>
                  s.id !== sub.id ? s : { ...s, tasks: [...s.tasks, { id: tempId, title }] },
                ),
              },
        ),
      );
      sfxPop();
      return { prev, tempId };
    },
    onSuccess: (row, _title, ctx) => {
      if (!ctx) return;
      qc.setQueryData<Goal[]>(["goals", userId], (old) =>
        (old ?? []).map((g) =>
          g.id !== goal.id
            ? g
            : {
                ...g,
                subgoals: g.subgoals.map((s) =>
                  s.id !== sub.id
                    ? s
                    : { ...s, tasks: s.tasks.map((t) => (t.id === ctx.tempId ? { id: row.id, title: row.title } : t)) },
                ),
              },
        ),
      );
    },
    onError: (e, _title, ctx) => {
      if (ctx?.prev) qc.setQueryData(["goals", userId], ctx.prev);
      toast.error(e instanceof Error ? e.message : "添加失败");
    },
  });
  const delTask = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["goals", userId] });
      const prev = qc.getQueryData<Goal[]>(["goals", userId]);
      qc.setQueryData<Goal[]>(["goals", userId], (old) =>
        (old ?? []).map((g) =>
          g.id !== goal.id
            ? g
            : {
                ...g,
                subgoals: g.subgoals.map((s) =>
                  s.id !== sub.id ? s : { ...s, tasks: s.tasks.filter((t) => t.id !== id) },
                ),
              },
        ),
      );
      return { prev };
    },
    onSuccess: () => {
      sfxDelete();
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["goals", userId], ctx.prev);
    },
  });
  const delSub = useMutation({
    mutationFn: () => deleteSubgoal(sub.id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["goals", userId] });
      const prev = qc.getQueryData<Goal[]>(["goals", userId]);
      qc.setQueryData<Goal[]>(["goals", userId], (old) =>
        (old ?? []).map((g) =>
          g.id !== goal.id ? g : { ...g, subgoals: g.subgoals.filter((s) => s.id !== sub.id) },
        ),
      );
      return { prev };
    },
    onSuccess: () => {
      sfxDelete();
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["goals", userId], ctx.prev);
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
          <span className={cn(allDone && "line-through opacity-60")}>{sub.title}</span>
          <span className="ml-1 text-[10px] opacity-60">
            ({archivedTasks.length}/{sub.tasks.length})
          </span>
          {allDone && (
            <span className="ml-1 rounded border border-ink bg-done px-1 py-px text-[9px] font-bold">
              全部完成
            </span>
          )}
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
          {activeTasks.map((t) => (
            <LeafTaskBrick
              key={t.id}
              task={t}
              goal={goal}
              sub={sub}
              usedIds={usedIds}
              completedIds={completedIds}
              justCompletedIds={justCompletedIds}
              userId={userId}
              onDelete={() => delTask.mutate(t.id)}
            />
          ))}
          <InlineAdd placeholder="添加任务" small onAdd={(v) => addTask.mutateAsync(v)} />

          {archivedTasks.length > 0 && (
            <div className="mt-2 rounded-md border-2 border-dashed border-ink/25 bg-muted/30 p-2">
              <button
                onClick={() => setArchiveOpen((o) => !o)}
                className="flex w-full items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-ink"
              >
                {archiveOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <Package className="h-3 w-3" />
                已完成收纳箱
                <span className="opacity-70">({archivedTasks.length})</span>
              </button>
              {archiveOpen && (
                <div className="mt-2 space-y-2">
                  {archivedTasks.map((t) => (
                    <LeafTaskBrick
                      key={t.id}
                      task={t}
                      goal={goal}
                      sub={sub}
                      usedIds={usedIds}
                      completedIds={completedIds}
                      justCompletedIds={justCompletedIds}
                      userId={userId}
                      onDelete={() => delTask.mutate(t.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GoalBlock({
  goal,
  usedIds,
  completedIds,
  justCompletedIds,
  userId,
}: {
  goal: Goal;
  usedIds: Set<string>;
  completedIds: Set<string>;
  justCompletedIds: Set<string>;
  userId: string;
}) {
  const [open, setOpen] = useState(true);
  const qc = useQueryClient();
  const total = goal.subgoals.reduce((n, s) => n + s.tasks.length, 0);
  const done = goal.subgoals.reduce(
    (n, s) => n + s.tasks.filter((t) => completedIds.has(t.id)).length,
    0,
  );
  const pct = total ? Math.round((done / total) * 100) : 0;

  const addSub = useMutation({
    mutationFn: (title: string) => createSubgoal(userId, goal.id, title, goal.subgoals.length),
    onMutate: async (title) => {
      await qc.cancelQueries({ queryKey: ["goals", userId] });
      const prev = qc.getQueryData<Goal[]>(["goals", userId]);
      const tempId = `temp-${Date.now()}`;
      qc.setQueryData<Goal[]>(["goals", userId], (old) =>
        (old ?? []).map((g) =>
          g.id !== goal.id
            ? g
            : { ...g, subgoals: [...g.subgoals, { id: tempId, title, tasks: [] }] },
        ),
      );
      sfxPop();
      return { prev, tempId };
    },
    onSuccess: (row, _title, ctx) => {
      if (!ctx) return;
      qc.setQueryData<Goal[]>(["goals", userId], (old) =>
        (old ?? []).map((g) =>
          g.id !== goal.id
            ? g
            : {
                ...g,
                subgoals: g.subgoals.map((s) => (s.id === ctx.tempId ? { ...s, id: row.id, title: row.title } : s)),
              },
        ),
      );
    },
    onError: (_e, _title, ctx) => {
      if (ctx?.prev) qc.setQueryData(["goals", userId], ctx.prev);
    },
  });
  const delGoal = useMutation({
    mutationFn: () => deleteGoal(goal.id),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["goals", userId] });
      const prev = qc.getQueryData<Goal[]>(["goals", userId]);
      qc.setQueryData<Goal[]>(["goals", userId], (old) => (old ?? []).filter((g) => g.id !== goal.id));
      return { prev };
    },
    onSuccess: () => {
      sfxDelete();
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["goals", userId], ctx.prev);
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
            <SubGoalBlock
              key={s.id}
              sub={s}
              goal={goal}
              usedIds={usedIds}
              completedIds={completedIds}
              justCompletedIds={justCompletedIds}
              userId={userId}
            />
          ))}
          <div className="ml-3 pl-4">
            <InlineAdd placeholder="添加子目标" onAdd={(v) => addSub.mutateAsync(v)} />
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------- Priority picker --------------- */
function PriorityPicker({
  value,
  disabled,
  onChange,
}: {
  value: Priority;
  disabled?: boolean;
  onChange: (p: Priority) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = PRIORITY_META[value];
  return (
    <Popover open={open} onOpenChange={(o: boolean) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "flex items-center gap-1 rounded-md border-2 border-ink px-1.5 py-0.5 text-[10px] font-bold shadow-brick-sm transition-all",
            "hover:shadow-brick-press hover:translate-x-0.5 hover:translate-y-0.5",
            meta.chip,
            disabled && "opacity-60 cursor-not-allowed",
          )}
          aria-label={`设置优先级：当前${meta.label}`}
          title={`优先级：${meta.label}`}
        >
          <span className={cn("h-2 w-2 rounded-full border border-ink/60", meta.dot)} />
          {meta.short}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={6}
        className="w-auto min-w-[160px] rounded-lg border-2 border-ink bg-card p-1.5 shadow-brick"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1.5">
          {([1, 2, 3] as Priority[]).map((p) => {
            const m = PRIORITY_META[p];
            return (
              <button
                key={p}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  if (p !== value) onChange(p);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md border-2 border-ink px-3 py-2 text-sm font-bold shadow-brick-sm transition-all",
                  "hover:shadow-brick hover:-translate-y-0.5",
                  m.chip,
                  p === value && "ring-2 ring-ink ring-offset-1",
                )}
              >
                <span className={cn("h-3 w-3 rounded-full border border-ink/60", m.dot)} />
                {m.label}
                {p === value && <span className="ml-auto text-xs opacity-70">✓</span>}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -------------- Daily brick --------------- */
function DailyBrick({
  task,
  userId,
  onToggle,
  onSetPriority,
  animating,
}: {
  task: DailyTask;
  userId: string;
  onToggle: (id: string) => void;
  onSetPriority: (id: string, p: Priority) => void;
  animating: boolean;
}) {
  const pmeta = PRIORITY_META[task.priority];
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border-2 border-ink p-4 pl-5 transition-all",
        task.done
          ? "bg-done/50 shadow-brick-sm opacity-70"
          : "bg-card shadow-brick hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-brick-lg",
        !animating && !task.done && "animate-brick-drop",
      )}
    >
      {/* priority stripe */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 top-0 h-full w-1.5 border-r-2 border-ink",
          pmeta.dot,
          task.done && "opacity-50",
        )}
      />
      <div className="flex items-start gap-3">
        <button
          onClick={() => {
            if (!task.done) sfxComplete();
            else sfxClick();
            onToggle(task.id);
          }}
          className={cn(
            "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 border-ink transition-all",
            "shadow-brick-sm hover:shadow-brick-press hover:translate-x-0.5 hover:translate-y-0.5",
            task.done ? colorClass[task.color] : "bg-background",
          )}
          aria-label={task.done ? "取消完成" : "完成"}
          title={task.done ? "点一下取消完成，放回今日待办" : "完成"}
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
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <PriorityPicker
            value={task.priority}
            disabled={task.done}
            onChange={(p) => onSetPriority(task.id, p)}
          />
          {task.taskId && !task.done && (
            <TaskAttachments taskId={task.taskId} userId={userId} />
          )}
        </div>
      </div>
    </div>
  );
}

function DropZone({ hasTasks }: { hasTasks: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "daily-drop" });
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
export default function TaskPlanner({
  initialUserId,
  initialUserEmail,
}: {
  initialUserId?: string;
  initialUserEmail?: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(initialUserId ?? null);
  const [userEmail, setUserEmail] = useState<string>(initialUserEmail ?? "");
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [loadAttachmentCounts, setLoadAttachmentCounts] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (initialUserId) return;
    // Use cached session (no network) — the _authenticated gate already validated the user.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setUserId(data.session.user.id);
        setUserEmail(data.session.user.email ?? "");
      }
    });
  }, [initialUserId]);

  const goalsQ = useQuery({
    queryKey: ["goals", userId],
    queryFn: () => fetchGoalsTree(userId!),
    enabled: !!userId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const dailyQ = useQuery({
    queryKey: ["daily", userId],
    queryFn: () => fetchTodayEntries(userId!),
    enabled: !!userId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const goals = goalsQ.data ?? [];
  const daily = dailyQ.data ?? [];
  const allTaskIds = useMemo(
    () => goals.flatMap((goal) => goal.subgoals.flatMap((sub) => sub.tasks.map((task) => task.id))),
    [goals],
  );

  useEffect(() => {
    if (!userId || allTaskIds.length === 0) return;
    setLoadAttachmentCounts(false);
    const run = () => setLoadAttachmentCounts(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(run, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(run, 600);
    return () => globalThis.clearTimeout(id);
  }, [userId, allTaskIds]);

  useQuery({
    queryKey: ["attachment-counts", userId],
    queryFn: () => fetchAttachmentCounts(allTaskIds),
    enabled: !!userId && allTaskIds.length > 0 && loadAttachmentCounts,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const usedIds = useMemo(
    () => new Set(daily.map((d) => d.taskId).filter(Boolean) as string[]),
    [daily],
  );
  const activeDaily = useMemo(
    () =>
      daily
        .filter((d) => !d.done)
        .slice()
        .sort((a, b) => a.priority - b.priority),
    [daily],
  );
  const doneDaily = useMemo(() => daily.filter((d) => d.done), [daily]);
  const activeCount = activeDaily.length;
  const doneCount = doneDaily.length;

  const addGoal = useMutation({
    mutationFn: (title: string) =>
      createGoal(userId!, title, CYCLE[goals.length % CYCLE.length], goals.length),
    onMutate: async (title) => {
      await qc.cancelQueries({ queryKey: ["goals", userId] });
      const prev = qc.getQueryData<Goal[]>(["goals", userId]);
      const tempId = `temp-${Date.now()}`;
      const optimistic: Goal = {
        id: tempId,
        title,
        color: CYCLE[goals.length % CYCLE.length],
        subgoals: [],
      };
      qc.setQueryData<Goal[]>(["goals", userId], (old) => [...(old ?? []), optimistic]);
      sfxPop();
      return { prev, tempId };
    },
    onSuccess: (row, _title, ctx) => {
      if (!ctx) return;
      qc.setQueryData<Goal[]>(["goals", userId], (old) =>
        (old ?? []).map((g) =>
          g.id === ctx.tempId ? { ...g, id: row.id, title: row.title, color: row.color as BrickColor } : g,
        ),
      );
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["goals", userId], ctx.prev);
      toast.error(e instanceof Error ? e.message : "创建失败");
    },
  });

  const dropEntry = useMutation({
    mutationFn: (p: DragPayload) => createDailyEntry(userId!, p),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: ["daily", userId] });
      const prev = qc.getQueryData<DailyTask[]>(["daily", userId]);
      const tempId = `temp-${Date.now()}`;
      const optimistic: DailyTask = {
        id: tempId,
        taskId: p.taskId,
        title: p.title,
        goalTitle: p.goalTitle,
        subGoalTitle: p.subGoalTitle,
        color: p.color,
        done: false,
        priority: 2,
      };
      qc.setQueryData<DailyTask[]>(["daily", userId], (old) => [...(old ?? []), optimistic]);
      sfxDrop();
      setJustDroppedId(tempId);
      setTimeout(() => setJustDroppedId(null), 400);
      return { prev, tempId };
    },
    onSuccess: (row, _v, ctx) => {
      if (row && ctx) {
        qc.setQueryData<DailyTask[]>(["daily", userId], (old) =>
          (old ?? []).map((t) =>
            t.id === ctx.tempId
              ? {
                  id: row.id,
                  taskId: row.task_id ?? "",
                  title: row.title_snapshot,
                  goalTitle: row.goal_title_snapshot,
                  subGoalTitle: row.subgoal_title_snapshot,
                  color: row.color_snapshot as BrickColor,
                  done: !!row.done_at,
                  priority: ((row as { priority?: number }).priority ?? 2) as Priority,
                }
              : t,
          ),
        );
      }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["daily", userId], ctx.prev);
      toast.error(e instanceof Error ? e.message : "拖入失败");
    },
  });

  const toggleEntry = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      done ? unmarkDailyEntryDone(id) : markDailyEntryDone(id),
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: ["daily", userId] });
      const prev = qc.getQueryData<DailyTask[]>(["daily", userId]);
      qc.setQueryData<DailyTask[]>(["daily", userId], (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, done: !done } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["daily", userId], ctx.prev);
    },
    // No onSettled refetch — optimistic value already matches server state.
  });

  const setPriority = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: Priority }) =>
      updateDailyEntryPriority(id, priority),
    onMutate: async ({ id, priority }) => {
      await qc.cancelQueries({ queryKey: ["daily", userId] });
      const prev = qc.getQueryData<DailyTask[]>(["daily", userId]);
      qc.setQueryData<DailyTask[]>(["daily", userId], (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, priority } : t)),
      );
      sfxClick();
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["daily", userId], ctx.prev);
    },
  });



  const clearDone = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => removeDailyEntry(id)));
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: ["daily", userId] });
      const prev = qc.getQueryData<DailyTask[]>(["daily", userId]);
      const set = new Set(ids);
      qc.setQueryData<DailyTask[]>(["daily", userId], (old) =>
        (old ?? []).filter((t) => !set.has(t.id)),
      );
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
      onDragCancel={() => {
        setDragPayload(null);
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
              <Link
                to="/calendar"
                className="grid h-9 w-9 place-items-center rounded-md border-2 border-ink bg-background shadow-brick-sm hover:bg-accent"
                aria-label="日历视图"
                title="日历视图"
              >
                <CalendarDays className="h-4 w-4" />
              </Link>
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
              {activeDaily.map((t) => (
                <DailyBrick
                  key={t.id}
                  task={t}
                  userId={userId!}
                  onToggle={(id) => toggleEntry.mutate({ id, done: t.done })}
                  onSetPriority={(id, priority) => setPriority.mutate({ id, priority })}
                  animating={justDroppedId !== t.id}
                />
              ))}
              <DropZone hasTasks={daily.length > 0} />

              {doneCount > 0 && (
                <div className="pt-4">
                  <div className="mb-2 flex items-center justify-between border-t-2 border-dashed border-ink/20 pt-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border-2 border-ink bg-done px-2 py-0.5 text-xs font-bold shadow-brick-sm">
                        已完成 {doneCount}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        今天已经消掉 {doneCount} 块 · 继续加油
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`清空 ${doneCount} 块已完成的任务？`)) {
                          clearDone.mutate(doneDaily.map((d) => d.id));
                        }
                      }}
                      className="text-[11px] font-bold text-muted-foreground hover:text-ink"
                    >
                      清空
                    </button>
                  </div>
                  <div className="space-y-2">
                    {doneDaily.map((t) => (
                      <DailyBrick
                        key={t.id}
                        task={t}
                        userId={userId!}
                        onToggle={(id) => toggleEntry.mutate({ id, done: t.done })}
                        onSetPriority={(id, priority) => setPriority.mutate({ id, priority })}
                        animating
                      />
                    ))}
                  </div>
                </div>
              )}
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
