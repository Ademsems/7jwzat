"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { en } from "./en";
import { ar } from "./ar";
import type { Locale } from "./format";
import { currencyForCountry, DEFAULT_COUNTRY, DEFAULT_CURRENCY } from "../currency";

const DICTS: Record<Locale, Record<string, string>> = { en, ar };
const STORAGE_KEY   = "7jwzat-lang";
const COUNTRY_KEY   = "7jwzat-geo-country";
const CURRENCY_KEY  = "7jwzat-currency";
const DEFAULT_LOCALE: Locale = "ar";

/** Read the geo cookie set by middleware from Vercel's x-vercel-ip-country. */
function readCookieCountry(): string | null {
  try {
    const m = document.cookie.match(/(?:^|; )7jwzat-geo-country=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
}

/** country → default language (AE = English, everything else = Arabic). */
function langForCountry(country: string | null | undefined): Locale {
  return country === "AE" ? "en" : "ar";
}

// Countries we detect via geo. An unrecognized/unknown geo country falls back
// to the default (Jordan) rather than "Other", per the launch-market defaults.
const GEO_COUNTRIES = new Set(["JO", "AE", "SA", "KW", "QA", "BH", "OM", "EG"]);

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  // Geo / currency (marketing). Defaults only; manual choices persist and win.
  country: string;
  currency: string;
  setCountry: (c: string) => void;
  setCurrency: (c: string) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k) => k,
  country: DEFAULT_COUNTRY,
  currency: DEFAULT_CURRENCY,
  setCountry: () => {},
  setCurrency: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState]     = useState<Locale>(DEFAULT_LOCALE);
  const [country, setCountryState]   = useState<string>(DEFAULT_COUNTRY);
  const [currency, setCurrencyState] = useState<string>(DEFAULT_CURRENCY);

  // Resolve persisted + geo defaults on mount. Server and initial client render
  // both use the static defaults (ar / JO / JOD) so there is no hydration
  // mismatch; real values are applied post-mount (dir/lang flash is already
  // prevented by the pre-hydration script in app/layout.tsx).
  useEffect(() => {
    let storedLang: string | null = null;
    let storedCountry: string | null = null;
    let storedCurrency: string | null = null;
    try {
      storedLang     = localStorage.getItem(STORAGE_KEY);
      storedCountry  = localStorage.getItem(COUNTRY_KEY);
      storedCurrency = localStorage.getItem(CURRENCY_KEY);
    } catch { /* ignore */ }

    // Country: manual choice (honored as-is, incl. "OTHER") → geo cookie (only
    // if a recognized launch-market country) → default (Jordan).
    let resolvedCountry: string;
    if (storedCountry) {
      resolvedCountry = storedCountry;
    } else {
      const cookieCountry = readCookieCountry();
      resolvedCountry = cookieCountry && GEO_COUNTRIES.has(cookieCountry) ? cookieCountry : DEFAULT_COUNTRY;
    }
    setCountryState(resolvedCountry);

    // Currency: manual choice → country default.
    setCurrencyState(storedCurrency || currencyForCountry(resolvedCountry));

    // Language: explicit choice wins, else geo default.
    const resolvedLang: Locale =
      storedLang === "en" || storedLang === "ar"
        ? storedLang
        : langForCountry(resolvedCountry);
    setLocaleState(resolvedLang);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }, []);

  // Footer country selector: authoritative. Persists country + its currency,
  // and follows the country's default language UNLESS the user already locked
  // a language via the AR/EN toggle.
  const setCountry = useCallback((c: string) => {
    setCountryState(c);
    const cur = currencyForCountry(c);
    setCurrencyState(cur);
    try {
      localStorage.setItem(COUNTRY_KEY, c);
      localStorage.setItem(CURRENCY_KEY, cur);
      const lockedLang = localStorage.getItem(STORAGE_KEY);
      if (lockedLang !== "en" && lockedLang !== "ar") {
        setLocaleState(langForCountry(c));
      }
    } catch { /* ignore */ }
  }, []);

  const setCurrency = useCallback((c: string) => {
    setCurrencyState(c);
    try { localStorage.setItem(CURRENCY_KEY, c); } catch { /* ignore */ }
  }, []);

  const t = useCallback(
    (key: string) => DICTS[locale][key] ?? en[key] ?? key,
    [locale]
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t, country, currency, setCountry, setCurrency }}>
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
