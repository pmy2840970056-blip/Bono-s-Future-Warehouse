import { useMemo, useState } from "react";
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
import { ChevronDown, ChevronRight, GripVertical, Plus, Sparkles, Target } from "lucide-react";
import { initialGoals } from "@/lib/planner-data";
import type { BrickColor, DailyTask, Goal, LeafTask, SubGoal } from "@/lib/planner-types";
import { cn } from "@/lib/utils";

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

type DragPayload = {
  taskId: string;
  title: string;
  goalTitle: string;
  subGoalTitle: string;
  color: BrickColor;
};

/* ------------------------- Left column: goal tree ------------------------- */

function LeafTaskBrick({
  task,
  goal,
  sub,
  usedIds,
}: {
  task: LeafTask;
  goal: Goal;
  sub: SubGoal;
  usedIds: Set<string>;
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
      {...attributes}
      {...listeners}
      className={cn(
        "group relative flex items-center gap-2 rounded-lg border-2 border-ink bg-card px-3 py-2.5",
        "shadow-brick-sm transition-all select-none",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1.5 before:rounded-l-md",
        colorRing[goal.color],
        used
          ? "opacity-40 cursor-not-allowed"
          : "cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-brick",
        isDragging && "opacity-30",
      )}
    >
      <GripVertical className="ml-1 h-4 w-4 shrink-0 text-muted-foreground opacity-40 group-hover:opacity-100" />
      <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{task.title}</span>
      {used && (
        <span className="shrink-0 rounded border border-ink bg-done px-1.5 py-0.5 text-[10px] font-bold uppercase">
          已安排
        </span>
      )}
    </div>
  );
}

function SubGoalBlock({
  sub,
  goal,
  usedIds,
}: {
  sub: SubGoal;
  goal: Goal;
  usedIds: Set<string>;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="ml-3 border-l-2 border-dashed border-ink/30 pl-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-ink"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {sub.title}
        <span className="ml-1 text-[10px] opacity-60">({sub.tasks.length})</span>
      </button>
      {open && (
        <div className="space-y-2">
          {sub.tasks.map((t) => (
            <LeafTaskBrick key={t.id} task={t} goal={goal} sub={sub} usedIds={usedIds} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalBlock({ goal, usedIds }: { goal: Goal; usedIds: Set<string> }) {
  const [open, setOpen] = useState(true);
  const total = goal.subgoals.reduce((n, s) => n + s.tasks.length, 0);
  const done = goal.subgoals.reduce(
    (n, s) => n + s.tasks.filter((t) => usedIds.has(t.id)).length,
    0,
  );
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-xl border-2 border-ink bg-card p-4 shadow-brick">
      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-3 flex w-full items-center gap-3 text-left"
      >
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
              <div
                className={cn("h-full transition-all", colorClass[goal.color])}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 font-mono text-[11px] font-bold">
              {done}/{total}
            </span>
          </div>
        </div>
        {open ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
      </button>
      {open && (
        <div className="space-y-4 pt-1">
          {goal.subgoals.map((s) => (
            <SubGoalBlock key={s.id} sub={s} goal={goal} usedIds={usedIds} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------- Right column: daily list ----------------------- */

function DailyBrick({
  task,
  onToggle,
  animating,
}: {
  task: DailyTask;
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
          onClick={() => onToggle(task.id)}
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
          {/* breadcrumb — WHY */}
          <div className="mb-1.5 flex items-center gap-1.5 overflow-hidden text-[10px] font-bold uppercase tracking-wider">
            <span className={cn("rounded border border-ink px-1.5 py-0.5", colorClass[task.color])}>
              {task.goalTitle}
            </span>
            <span className="text-muted-foreground">›</span>
            <span className="truncate text-muted-foreground">{task.subGoalTitle}</span>
          </div>
          <p
            className={cn(
              "relative text-[15px] font-semibold leading-snug",
              task.done && "text-muted-foreground",
            )}
          >
            {task.title}
            {task.done && (
              <span className="pointer-events-none absolute left-0 top-1/2 h-[3px] w-full origin-left animate-strike bg-ink" />
            )}
          </p>
        </div>
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

/* ------------------------------- The page --------------------------------- */

export default function TaskPlanner() {
  const [goals] = useState<Goal[]>(initialGoals);
  const [daily, setDaily] = useState<DailyTask[]>([]);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [isOver, setIsOver] = useState(false);
  const [justDroppedId, setJustDroppedId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const usedIds = useMemo(
    () => new Set(daily.filter((d) => !d.done).map((d) => d.taskId)),
    [daily],
  );

  const activeCount = daily.filter((d) => !d.done).length;
  const doneCount = daily.filter((d) => d.done).length;

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
    const id = `d-${Date.now()}-${payload.taskId}`;
    setDaily((prev) => [...prev, { ...payload, id, done: false }]);
    setJustDroppedId(id);
    setTimeout(() => setJustDroppedId(null), 400);
  }

  function toggleDone(id: string) {
    setDaily((prev) => prev.map((t) => (t.id === id ? { ...t, done: true } : t)));
    setTimeout(() => {
      setDaily((prev) => prev.filter((t) => t.id !== id));
    }, 900);
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
        {/* Header */}
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
            <div className="hidden items-center gap-2 sm:flex">
              <div className="rounded-lg border-2 border-ink bg-background px-3 py-1.5 font-mono text-xs font-bold shadow-brick-sm">
                {today}
              </div>
            </div>
          </div>
        </header>

        {/* Two columns */}
        <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* LEFT — goal tree */}
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
              {goals.map((g) => (
                <GoalBlock key={g.id} goal={g} usedIds={usedIds} />
              ))}
            </div>
          </section>

          {/* RIGHT — daily */}
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
                  onToggle={toggleDone}
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
              <span
                className={cn(
                  "rounded border border-ink px-1.5 py-0.5",
                  colorClass[dragPayload.color],
                )}
              >
                {dragPayload.goalTitle}
              </span>
            </div>
            <p className="text-sm font-semibold">{dragPayload.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
