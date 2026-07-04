import type { Goal } from "./planner-types";

export const initialGoals: Goal[] = [
  {
    id: "g1",
    title: "开一家独立设计工作室",
    color: "brick-1",
    subgoals: [
      {
        id: "g1-s1",
        title: "品牌视觉系统",
        tasks: [
          { id: "g1-s1-t1", title: "画 5 版 logo 草图" },
          { id: "g1-s1-t2", title: "确定主色与副色搭配" },
          { id: "g1-s1-t3", title: "选定品牌字体组合" },
        ],
      },
      {
        id: "g1-s2",
        title: "作品集网站",
        tasks: [
          { id: "g1-s2-t1", title: "整理 3 个精选项目文案" },
          { id: "g1-s2-t2", title: "拍摄成品实物照片" },
        ],
      },
    ],
  },
  {
    id: "g2",
    title: "半年内跑完半马",
    color: "brick-2",
    subgoals: [
      {
        id: "g2-s1",
        title: "基础耐力",
        tasks: [
          { id: "g2-s1-t1", title: "慢跑 5 公里" },
          { id: "g2-s1-t2", title: "核心训练 20 分钟" },
        ],
      },
    ],
  },
  {
    id: "g3",
    title: "读完《深度工作》",
    color: "brick-3",
    subgoals: [
      {
        id: "g3-s1",
        title: "阅读进度",
        tasks: [
          { id: "g3-s1-t1", title: "读第 3 章并做笔记" },
          { id: "g3-s1-t2", title: "整理本周金句到卡片" },
        ],
      },
    ],
  },
];
