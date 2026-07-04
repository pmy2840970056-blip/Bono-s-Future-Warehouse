import { supabase } from "@/integrations/supabase/client";
import type { BrickColor, DailyTask, Goal } from "./planner-types";

export async function fetchGoalsTree(userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("goals")
    .select(
      `id, title, color, sort_order,
       subgoals:subgoals(id, title, sort_order,
         tasks:tasks(id, title, sort_order))`,
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((g) => ({
    id: g.id,
    title: g.title,
    color: g.color as BrickColor,
    subgoals: (g.subgoals ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s) => ({
        id: s.id,
        title: s.title,
        tasks: (s.tasks ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((t) => ({ id: t.id, title: t.title })),
      })),
  }));
}

export async function fetchTodayEntries(userId: string): Promise<DailyTask[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("daily_entries")
    .select("id, task_id, title_snapshot, goal_title_snapshot, subgoal_title_snapshot, color_snapshot, done_at")
    .eq("user_id", userId)
    .eq("entry_date", today)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((d) => ({
    id: d.id,
    taskId: d.task_id ?? "",
    title: d.title_snapshot,
    goalTitle: d.goal_title_snapshot,
    subGoalTitle: d.subgoal_title_snapshot,
    color: d.color_snapshot as BrickColor,
    done: !!d.done_at,
  }));
}

export async function createGoal(userId: string, title: string, color: BrickColor, sortOrder: number) {
  const { data, error } = await supabase
    .from("goals")
    .insert({ user_id: userId, title, color, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createSubgoal(userId: string, goalId: string, title: string, sortOrder: number) {
  const { data, error } = await supabase
    .from("subgoals")
    .insert({ user_id: userId, goal_id: goalId, title, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createTask(userId: string, subgoalId: string, title: string, sortOrder: number) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({ user_id: userId, subgoal_id: subgoalId, title, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGoal(id: string) {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}
export async function deleteSubgoal(id: string) {
  const { error } = await supabase.from("subgoals").delete().eq("id", id);
  if (error) throw error;
}
export async function deleteTask(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function createDailyEntry(
  userId: string,
  payload: {
    taskId: string;
    title: string;
    goalTitle: string;
    subGoalTitle: string;
    color: BrickColor;
  },
) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("daily_entries")
    .insert({
      user_id: userId,
      task_id: payload.taskId,
      entry_date: today,
      title_snapshot: payload.title,
      goal_title_snapshot: payload.goalTitle,
      subgoal_title_snapshot: payload.subGoalTitle,
      color_snapshot: payload.color,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markDailyEntryDone(id: string) {
  const { error } = await supabase
    .from("daily_entries")
    .update({ done_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function removeDailyEntry(id: string) {
  const { error } = await supabase.from("daily_entries").delete().eq("id", id);
  if (error) throw error;
}

const SAMPLE_COLORS: BrickColor[] = ["brick-1", "brick-2", "brick-3", "brick-4"];

export async function seedSampleData(userId: string) {
  const samples = [
    {
      title: "开一家独立设计工作室",
      subgoals: [
        { title: "品牌视觉系统", tasks: ["画 5 版 logo 草图", "确定主色与副色搭配", "选定品牌字体组合"] },
        { title: "作品集网站", tasks: ["整理 3 个精选项目文案", "拍摄成品实物照片"] },
      ],
    },
    {
      title: "半年内跑完半马",
      subgoals: [{ title: "基础耐力", tasks: ["慢跑 5 公里", "核心训练 20 分钟"] }],
    },
    {
      title: "读完《深度工作》",
      subgoals: [{ title: "阅读进度", tasks: ["读第 3 章并做笔记", "整理本周金句到卡片"] }],
    },
  ];

  for (let gi = 0; gi < samples.length; gi++) {
    const g = samples[gi];
    const goal = await createGoal(userId, g.title, SAMPLE_COLORS[gi % SAMPLE_COLORS.length], gi);
    for (let si = 0; si < g.subgoals.length; si++) {
      const s = g.subgoals[si];
      const sub = await createSubgoal(userId, goal.id, s.title, si);
      for (let ti = 0; ti < s.tasks.length; ti++) {
        await createTask(userId, sub.id, s.tasks[ti], ti);
      }
    }
  }
}
