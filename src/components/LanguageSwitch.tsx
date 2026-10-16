import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

export function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
      aria-label={language === "zh" ? "Switch to English" : "切换为中文"}
      title={language === "zh" ? "Switch to English" : "切换为中文"}
      className="h-9 shrink-0 gap-1.5 border-2 border-ink bg-background px-2 font-bold shadow-brick-sm"
    >
      <Globe className="h-4 w-4" />
      <span>{language === "zh" ? "EN" : "中文"}</span>
    </Button>
  );
}