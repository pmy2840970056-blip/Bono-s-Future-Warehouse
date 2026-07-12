import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import TaskPlanner from "@/components/TaskPlanner";

const authenticatedRoute = getRouteApi("/_authenticated");

const HOME_TITLE = "积木清单 · 把长期目标拆成今天能做的一块";
const HOME_DESC =
  "积木清单是一款目标拆解与每日任务规划应用：左边是长期目标树，右边是今日待办，拖一块任务过来就能开始，完成有消除反馈，让漂浮的野心落到今天。";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESC },
      { property: "og:title", content: HOME_TITLE },
      { property: "og:description", content: HOME_DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://dream-path-maker-77.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://dream-path-maker-77.lovable.app/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "积木清单",
          alternateName: "Brick Planner",
          applicationCategory: "ProductivityApplication",
          operatingSystem: "All",
          url: "https://dream-path-maker-77.lovable.app/",
          description: HOME_DESC,
          inLanguage: "zh-CN",
          offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
        }),
      },
    ],
  }),
  component: PlannerRoute,
});

function PlannerRoute() {
  const { user } = authenticatedRoute.useRouteContext();
  return <TaskPlanner initialUserId={user.id} initialUserEmail={user.email ?? ""} />;
}
