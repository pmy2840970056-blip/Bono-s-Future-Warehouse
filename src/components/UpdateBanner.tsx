import { useLanguage } from "@/lib/i18n";
import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useVersionCheck } from "@/hooks/useVersionCheck";

const DISMISS_KEY = "brick-planner:update-dismissed-version";

export function UpdateBanner() {
  const { t, language, locale } = useLanguage();
  const hasUpdate = useVersionCheck();
  const [dismissed, setDismissed] = useState(false);

  if (!hasUpdate || dismissed) return null;

  // Respect a per-session dismissal so a manual reload doesn't get badgered again.
  if (typeof window !== "undefined") {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return null;
    } catch {
      // ignore
    }
  }

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div className="sticky top-0 z-50 border-b-2 border-ink bg-brick-3">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-6">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex flex-1 items-center gap-2 text-left text-xs font-bold sm:text-sm"
        >
          <RefreshCw className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          <span className="truncate">{t("发现新版本，点此刷新体验最新内容")}</span>
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 border-ink bg-background/60 hover:bg-background"
          aria-label={t("稍后再说")}
          title={t("稍后再说")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
