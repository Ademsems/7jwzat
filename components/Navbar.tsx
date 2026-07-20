"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage, LanguageToggle } from "@/lib/i18n/LanguageProvider";

const NAV_LINKS = [
  { key: "m.nav.how",      href: "/#how-it-works", id: "how-it-works" },
  { key: "m.nav.features", href: "/#features",     id: "features"     },
  { key: "m.nav.pricing",  href: "/#pricing",      id: "pricing"      },
  { key: "m.nav.faq",      href: "/#faq",          id: "faq"          },
  { key: "m.nav.contact",  href: "/#contact",      id: "contact"      },
];

export function Navbar() {
  const { t, locale } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled]     = useState(false);
  const [activeId, setActiveId]     = useState("");

  /* ── Scroll-based navbar blur ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Active section detection ── */
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observers: IntersectionObserver[] = [];
    NAV_LINKS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveId(id); },
        { threshold: 0.35 }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  /* ── Close mobile menu on resize to desktop ── */
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const headerClass = scrolled
    ? "sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 transition-all duration-300"
    : "sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100 transition-all duration-300";

  return (
    <header className={headerClass}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo — Arabic renders حجوزات with 7jwzat alongside for recognition */}
        <Link href="/" className="flex items-baseline gap-2 hover:text-emerald-700 transition-colors">
          <span className="text-xl font-bold text-slate-900 tracking-tight">{t("brand.logo")}</span>
          {locale === "ar" && (
            <span className="text-xs font-semibold text-slate-400 tracking-wide">7jwzat</span>
          )}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          {NAV_LINKS.map(({ key, href, id }) => {
            const isActive = activeId === id;
            return (
              <a
                key={id}
                href={href}
                className={`relative py-1 transition-colors duration-200 ${
                  isActive ? "text-emerald-600" : "hover:text-slate-900"
                }`}
              >
                {t(key)}
                <span
                  className="absolute bottom-0 start-0 h-0.5 bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: isActive ? "100%" : "0%" }}
                />
              </a>
            );
          })}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageToggle />
          <Link
            href="/auth/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            {t("m.nav.signIn")}
          </Link>
          <Link
            href="/auth/signup"
            className="btn-shimmer bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            {t("m.nav.startFree")}
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <div className="relative w-5 h-5 flex flex-col justify-center gap-[5px]">
            <span
              className="block h-[2px] bg-current rounded-full transition-all duration-300 origin-center"
              style={{ transform: mobileOpen ? "rotate(45deg) translate(2px, 7px)" : "none" }}
            />
            <span
              className="block h-[2px] bg-current rounded-full transition-all duration-200"
              style={{ opacity: mobileOpen ? 0 : 1, transform: mobileOpen ? "scaleX(0)" : "none" }}
            />
            <span
              className="block h-[2px] bg-current rounded-full transition-all duration-300 origin-center"
              style={{ transform: mobileOpen ? "rotate(-45deg) translate(2px, -7px)" : "none" }}
            />
          </div>
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="mobile-menu-enter md:hidden border-t border-slate-100 bg-white px-4 py-4 flex flex-col gap-4">
          {NAV_LINKS.map(({ key, href, id }) => (
            <a
              key={id}
              href={href}
              className={`text-sm font-medium transition-colors py-1 ${
                activeId === id ? "text-emerald-600" : "text-slate-700 hover:text-slate-900"
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {t(key)}
            </a>
          ))}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
            <div className="flex justify-center pb-1">
              <LanguageToggle />
            </div>
            <Link
              href="/auth/login"
              className="text-sm font-medium text-slate-600 text-center py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {t("m.nav.signIn")}
            </Link>
            <Link
              href="/auth/signup"
              className="btn-shimmer bg-emerald-600 text-white text-sm font-semibold text-center py-2 rounded-lg hover:bg-emerald-700 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {t("m.nav.startFree")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
