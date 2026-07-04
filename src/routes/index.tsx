import { createFileRoute } from "@tanstack/react-router";
import TaskPlanner from "@/components/TaskPlanner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "积木清单 · 把长期目标拆成今天的一块" },
      {
        name: "description",
        content: "两栏式任务规划：左边拆解长期目标，右边今日待办。不知道今天做什么？从左边拖一块过来。",
      },
      { property: "og:title", content: "积木清单" },
      { property: "og:description", content: "把长期目标拆成今天能做的一块任务。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TaskPlanner,
});
