import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import TaskPlanner from "@/components/TaskPlanner";

const authenticatedRoute = getRouteApi("/_authenticated");

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "积木清单 · 今天做哪一块" },
      { name: "description", content: "从左边拖一块任务到右边今日待办，看着积木堆起来。" },
      { property: "og:title", content: "积木清单" },
      { property: "og:description", content: "把长期目标拆成今天能做的一块任务。" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PlannerRoute,
});

function PlannerRoute() {
  const { user } = authenticatedRoute.useRouteContext();
  return <TaskPlanner initialUserId={user.id} initialUserEmail={user.email ?? ""} />;
}
