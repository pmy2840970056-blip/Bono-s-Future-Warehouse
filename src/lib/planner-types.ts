export type BrickColor = "brick-1" | "brick-2" | "brick-3" | "brick-4";

export type LeafTask = {
  id: string;
  title: string;
};

export type SubGoal = {
  id: string;
  title: string;
  tasks: LeafTask[];
};

export type Goal = {
  id: string;
  title: string;
  color: BrickColor;
  subgoals: SubGoal[];
};

export type DailyTask = {
  id: string;             // unique id in daily list
  taskId: string;         // leaf task id
  title: string;
  goalTitle: string;
  subGoalTitle: string;
  color: BrickColor;
  done: boolean;
};
