"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { en } from "./en";
import { ar } from "./ar";
import type { Locale } from "./format";

const DICTS: Record<Locale, Record<string, string>> = { en, ar };
const STORAGE_KEY = "7jwzat-lang";
const DEFAULT_LOCALE: Locale = "ar";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Load persisted choice on mount (default stays Arabic).
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    const initial: Locale = stored === "en" || stored === "ar" ? stored : DEFAULT_LOCALE;
    setLocaleState(initial);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }, []);

  const t = useCallback(
    (key: string) => DICTS[locale][key] ?? en[key] ?? key,
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * Sync <html> dir/lang to the active locale WHILE the calling surface is
 * mounted, restoring LTR/en on unmount. Localized surfaces (booking page,
 * and in Part B the dashboard) call this; the marketing site stays LTR.
 */
export function useApplyHtmlDir() {
  const { locale } = useLanguage();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    return () => {
      document.documentElement.lang = "en";
      document.documentElement.dir = "ltr";
    };
  }, [locale]);
}

/** Small AR/EN pill toggle. */
export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLanguage();
  return (
    <div className={`inline-flex items-center rounded-full border border-gray-300 bg-white overflow-hidden text-xs font-semibold ${className}`}>
      <button
        type="button"
        onClick={() => setLocale("ar")}
        className={`px-3 py-1.5 transition ${locale === "ar" ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
        aria-pressed={locale === "ar"}
      >
        AR
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`px-3 py-1.5 transition ${locale === "en" ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
    </div>
  );
}
