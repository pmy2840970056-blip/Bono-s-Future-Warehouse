import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Wand2, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { decomposeGoal, type DecomposedTree } from "@/lib/ai.functions";
import { createGoal, createSubgoal, createTask } from "@/lib/planner-api";
import type { BrickColor } from "@/lib/planner-types";
import { sfxCheer, sfxPop } from "@/lib/sfx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CYCLE: BrickColor[] = ["brick-1", "brick-2", "brick-3", "brick-4"];
const colorClass: Record<BrickColor, string> = {
  "brick-1": "bg-brick-1",
  "brick-2": "bg-brick-2",
  "brick-3": "bg-brick-3",
  "brick-4": "bg-brick-4",
};

type Tree = DecomposedTree;

export function AiGoalDialog({
  open,
  onOpenChange,
  userId,
  goalsCount,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  goalsCount: number;
}) {
  const qc = useQueryClient();
  const [goalTitle, setGoalTitle] = useState("");
  const [tree, setTree] = useState<Tree | null>(null);
  const [color, setColor] = useState<BrickColor>(CYCLE[goalsCount % CYCLE.length]);
  const [confirming, setConfirming] = useState(false);

  const decomposeFn = useServerFn(decomposeGoal);

  const decomposeM = useMutation({
    mutationFn: (goal: string) => decomposeFn({ data: { goal } }),
    onSuccess: (data) => {
      sfxPop();
      setTree(data);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "AI 拆解失败"),
  });

  const importM = useMutation({
    mutationFn: async () => {
      if (!tree) return;
      const goal = await createGoal(userId, goalTitle.trim(), color, goalsCount);
      for (let si = 0; si < tree.subgoals.length; si++) {
        const s = tree.subgoals[si];
        const sub = await createSubgoal(userId, goal.id, s.title.trim(), si);
        for (let ti = 0; ti < s.tasks.length; ti++) {
          const t = s.tasks[ti].trim();
          if (t) await createTask(userId, sub.id, t, ti);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals", userId] });
      sfxCheer();
      toast.success("已导入目标树");
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "导入失败"),
  });

  function reset() {
    setGoalTitle("");
    setTree(null);
    setColor(CYCLE[goalsCount % CYCLE.length]);
    setConfirming(false);
  }

  function updateSub(idx: number, title: string) {
    if (!tree) return;
    const next = { ...tree, subgoals: tree.subgoals.map((s, i) => (i === idx ? { ...s, title } : s)) };
    setTree(next);
  }
  function removeSub(idx: number) {
    if (!tree) return;
    setTree({ ...tree, subgoals: tree.subgoals.filter((_, i) => i !== idx) });
  }
  function addSub() {
    if (!tree) return;
    setTree({ ...tree, subgoals: [...tree.subgoals, { title: "新的子目标", tasks: ["新任务"] }] });
  }
  function updateTask(si: number, ti: number, title: string) {
    if (!tree) return;
    setTree({
      ...tree,
      subgoals: tree.subgoals.map((s, i) =>
        i === si ? { ...s, tasks: s.tasks.map((t, j) => (j === ti ? title : t)) } : s,
      ),
    });
  }
  function removeTask(si: number, ti: number) {
    if (!tree) return;
    setTree({
      ...tree,
      subgoals: tree.subgoals.map((s, i) =>
        i === si ? { ...s, tasks: s.tasks.filter((_, j) => j !== ti) } : s,
      ),
    });
  }
  function addTask(si: number) {
    if (!tree) return;
    setTree({
      ...tree,
      subgoals: tree.subgoals.map((s, i) =>
        i === si ? { ...s, tasks: [...s.tasks, "新任务"] } : s,
      ),
    });
  }

  const cleanSubs =
    tree?.subgoals
      .map((s) => ({ title: s.title.trim(), tasks: s.tasks.map((t) => t.trim()).filter(Boolean) }))
      .filter((s) => s.title && s.tasks.length > 0) ?? [];
  const subCount = cleanSubs.length;
  const taskCount = cleanSubs.reduce((n, s) => n + s.tasks.length, 0);
  const canImport = !!tree && goalTitle.trim().length > 0 && subCount > 0;

  const timeline: Array<{ date: Date; sub: string; task: string }> = [];
  {
    const start = new Date();
    let i = 0;
    for (const s of cleanSubs) {
      for (const t of s.tasks) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        timeline.push({ date: d, sub: s.title, task: t });
        i++;
      }
    }
  }
  const timelineFmt = (d: Date) =>
    d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", weekday: "short" });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border-2 border-ink">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <div className="grid h-8 w-8 place-items-center rounded-md border-2 border-ink bg-brick-3 shadow-brick-sm">
              <Wand2 className="h-4 w-4" strokeWidth={2.5} />
            </div>
            AI 目标拆解
          </DialogTitle>
          <DialogDescription>
            输入一个长期目标，AI 会拆成子目标和今天就能动手的一块块任务。你可以编辑后再导入。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
              长期目标
            </label>
            <div className="flex gap-2">
              <Textarea
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="例如：半年内跑完一次半程马拉松 / 三个月内做出一个可上线的独立产品"
                className="min-h-[64px] border-2 border-ink"
                maxLength={200}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-muted-foreground">颜色</span>
                {CYCLE.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-6 w-6 rounded-md border-2 border-ink transition",
                      colorClass[c],
                      color === c ? "scale-110 shadow-brick-sm" : "opacity-60",
                    )}
                    aria-label={c}
                  />
                ))}
              </div>
              <Button
                onClick={() => decomposeM.mutate(goalTitle.trim())}
                disabled={goalTitle.trim().length < 2 || decomposeM.isPending}
                className="border-2 border-ink bg-brick-3 text-ink font-bold shadow-brick-sm hover:shadow-brick"
              >
                {decomposeM.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> AI 拆解中…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> {tree ? "重新拆解" : "AI 拆解"}
                  </>
                )}
              </Button>
            </div>
          </div>

          {decomposeM.isPending && !tree && (
            <div className="rounded-lg border-2 border-dashed border-ink/30 p-8 text-center text-sm text-muted-foreground">
              正在把「{goalTitle}」拆成一块块能动手的任务…
            </div>
          )}

          {tree && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  AI 建议 · 可编辑
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={addSub}
                  className="h-7 border-2 border-ink bg-background text-xs font-bold shadow-brick-sm"
                >
                  <Plus className="h-3 w-3" strokeWidth={3} /> 加子目标
                </Button>
              </div>

              {tree.subgoals.map((s, si) => (
                <div key={si} className="rounded-lg border-2 border-ink bg-card p-3 shadow-brick-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={cn(
                        "grid h-6 w-6 shrink-0 place-items-center rounded border-2 border-ink text-[11px] font-bold",
                        colorClass[color],
                      )}
                    >
                      {si + 1}
                    </span>
                    <Input
                      value={s.title}
                      onChange={(e) => updateSub(si, e.target.value)}
                      className="h-8 border-2 border-ink font-bold"
                    />
                    <button
                      onClick={() => removeSub(si)}
                      className="opacity-40 hover:opacity-100"
                      aria-label="删除子目标"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="ml-8 space-y-1.5">
                    {s.tasks.map((t, ti) => (
                      <div key={ti} className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground w-4">·</span>
                        <Input
                          value={t}
                          onChange={(e) => updateTask(si, ti, e.target.value)}
                          className="h-7 border-2 border-ink text-sm"
                        />
                        <button
                          onClick={() => removeTask(si, ti)}
                          className="opacity-30 hover:opacity-100"
                          aria-label="删除任务"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addTask(si)}
                      className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-ink"
                    >
                      <Plus className="h-3 w-3" strokeWidth={3} /> 加任务
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {tree && confirming && (
            <div className="rounded-lg border-2 border-ink bg-accent/40 p-4 shadow-brick-sm space-y-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  即将创建
                </p>
                <p className="mt-1 text-sm">
                  长期目标{" "}
                  <span
                    className={cn(
                      "inline-block rounded border-2 border-ink px-1.5 py-0.5 text-xs font-bold",
                      colorClass[color],
                    )}
                  >
                    {goalTitle.trim()}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-md border-2 border-ink bg-card px-2 py-1 shadow-brick-sm">
                    {subCount} 个子目标
                  </span>
                  <span className="rounded-md border-2 border-ink bg-card px-2 py-1 shadow-brick-sm">
                    {taskCount} 块每日任务
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  示例时间表 · 每天一块（可后续调整）
                </p>
                <ul className="space-y-1 text-xs">
                  {timeline.slice(0, 6).map((row, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-20 shrink-0 rounded border border-ink bg-background px-1.5 py-0.5 text-center font-mono font-bold">
                        {timelineFmt(row.date)}
                      </span>
                      <span className="truncate">
                        <span className="text-muted-foreground">{row.sub} · </span>
                        {row.task}
                      </span>
                    </li>
                  ))}
                  {timeline.length > 6 && (
                    <li className="pl-[5.5rem] text-muted-foreground">
                      …还有 {timeline.length - 6} 块，共 {timeline.length} 天
                    </li>
                  )}
                </ul>
              </div>

              <p className="text-[11px] text-muted-foreground">
                导入后目标和任务会保存到你的目标列表，任务不会自动放进今日待办 —— 你随时可以拖进来。
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t-2 border-ink/10">
          {confirming ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setConfirming(false)}
                disabled={importM.isPending}
                className="border-2 border-ink bg-background font-bold shadow-brick-sm"
              >
                返回修改
              </Button>
              <Button
                onClick={() => importM.mutate()}
                disabled={importM.isPending}
                className="border-2 border-ink bg-brick-2 text-ink font-bold shadow-brick"
              >
                {importM.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 导入中…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" strokeWidth={3} /> 确认导入
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="border-2 border-ink bg-background font-bold shadow-brick-sm"
              >
                取消
              </Button>
              <Button
                onClick={() => setConfirming(true)}
                disabled={!canImport}
                className="border-2 border-ink bg-brick-2 text-ink font-bold shadow-brick"
              >
                预览并导入
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
