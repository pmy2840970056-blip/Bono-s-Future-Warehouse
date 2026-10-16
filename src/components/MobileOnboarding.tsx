import { useLanguage } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

const KEY = "brick.onboarded.v1";

export default function MobileOnboarding() {
  const { t, language, locale } = useLanguage();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) return;
    try {
      if (localStorage.getItem(KEY) !== "1") setOpen(true);
    } catch {
      /* ignore */
    }
  }, [isMobile]);

  if (!open) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/40 px-6 backdrop-blur-sm lg:hidden">
      <div className="w-full max-w-sm rounded-2xl border-2 border-ink bg-paper p-5 shadow-brick">
        <h2 className="mb-1 text-lg font-black">{t("欢迎来到积木清单 🧱")}</h2>
        <p className="mb-4 text-xs text-muted-foreground">{t("手机端小贴士，30 秒上手：")}</p>
        <ul className="mb-5 space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="text-lg leading-none">👉</span>
            <span>
              <b>{t("左右滑动")}</b>{t("切换「长期目标 / 今天要做」两个视图")}</span>
          </li>
          <li className="flex gap-3">
            <span className="text-lg leading-none">➕</span>
            <span>
              {t("叶子任务右侧的")}<b>{t("「+」按钮")}</b>{t("：一键把它加进今日待办")}</span>
          </li>
          <li className="flex gap-3">
            <span className="text-lg leading-none">✊</span>
            <span>
              <b>{t("长按任务")}</b>{t("后向右滑 → 拖入今日待办（更有拖拽手感）")}</span>
          </li>
        </ul>
        <button
          type="button"
          onClick={dismiss}
          className="w-full rounded-lg border-2 border-ink bg-brick-2 py-2.5 text-sm font-bold shadow-brick-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-brick-press"
        >
          {t("知道了，开始使用")}</button>
      </div>
    </div>
  );
}
