import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { english } from "@/lib/translations";

export type Language = "zh" | "en";
export const LANGUAGE_KEY = "brick-planner:language";
const LanguageContext = createContext({
  language: "zh" as Language,
  setLanguage: (_language: Language) => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>("zh");
  useEffect(() => {
    try {
      if (localStorage.getItem(LANGUAGE_KEY) === "en") updateLanguage("en");
    } catch { /* Storage may be unavailable in private browsing. */ }
    const sync = (event: StorageEvent) => {
      if (event.key === LANGUAGE_KEY) updateLanguage(event.newValue === "en" ? "en" : "zh");
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
  }, [language]);
  const setLanguage = (next: Language) => {
    updateLanguage(next);
    try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* Keep the in-memory choice. */ }
  };
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  const t = (text: string, values?: Record<string, string | number>) => {
    let result = context.language === "en" ? (english[text] ?? text) : text;
    for (const [key, value] of Object.entries(values ?? {})) result = result.replaceAll(`{${key}}`, String(value));
    return result;
  };
  return { ...context, t, locale: context.language === "en" ? "en-US" : "zh-CN" };
}