"use client";

import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { RevealOnScroll } from "@/components/RevealOnScroll";
import { useLanguage, useApplyHtmlDir } from "@/lib/i18n/LanguageProvider";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCalendar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconUserPlus() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="16" y1="11" x2="22" y2="11" />
    </svg>
  );
}

function IconSettingsGear() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconShare() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function IconDashboard() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function IconNoFee() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    </svg>
  );
}

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 250ms ease" }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-row border-b border-slate-200 last:border-0 px-2 -mx-2">
      <button
        className="w-full flex items-center justify-between gap-4 py-5 text-start text-slate-900 font-medium hover:text-emerald-700 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span>{q}</span>
        <span className="flex-shrink-0 text-slate-400"><IconChevron open={open} /></span>
      </button>
      <div
        style={{
          maxHeight: open ? "260px" : "0px",
          opacity: open ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 300ms ease, opacity 250ms ease",
        }}
      >
        <p className="pb-5 text-slate-600 leading-relaxed text-sm pe-8">{a}</p>
      </div>
    </div>
  );
}

// ─── Email validation ─────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  useApplyHtmlDir(); // Arabic-first RTL by default; flips <html> dir/lang.
  const { t, locale } = useLanguage();

  const [contactEmail, setContactEmail]   = useState("");
  const [contactSent, setContactSent]     = useState(false);
  const [contactError, setContactError]   = useState("");
  const [mousePos, setMousePos]           = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setContactError("");
    if (!EMAIL_RE.test(contactEmail.trim())) {
      setContactError(t("m.cta.err"));
      return;
    }
    setContactSent(true);
    setContactEmail("");
  }

  const features = [
    { icon: <IconCalendar />,  key: "1" },
    { icon: <IconNoFee />,     key: "2" },
    { icon: <IconPhone />,     key: "3" },
    { icon: <IconMail />,      key: "4" },
    { icon: <IconClock />,     key: "5" },
    { icon: <IconDashboard />, key: "6" },
  ];

  const steps = [
    { icon: <IconUserPlus />,     n: "01", key: "s1" },
    { icon: <IconSettingsGear />, n: "02", key: "s2" },
    { icon: <IconShare />,        n: "03", key: "s3" },
  ];

  // Arabic headlines want a touch more line-height so they read as designed.
  const heroTitleClass = `text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 ${
    locale === "ar" ? "leading-[1.35]" : "leading-tight"
  }`;

  return (
    <div className="page-enter">
      <Navbar />

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className="hero-bg relative overflow-hidden text-white"
        onMouseMove={handleMouseMove}
      >
        {/* Cursor glow */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: mousePos.x,
            top: mousePos.y,
            width: 600,
            height: 600,
            background: "radial-gradient(circle, rgba(16,185,129,0.09) 0%, transparent 68%)",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* Floating orbs */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
          <div style={{ position: "absolute", top: "10%", insetInlineStart: "8%",  width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)", filter: "blur(40px)", animation: "orb1 14s ease-in-out infinite" }} />
          <div style={{ position: "absolute", top: "55%", insetInlineEnd: "6%", width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)", filter: "blur(40px)", animation: "orb2 18s ease-in-out infinite" }} />
          <div style={{ position: "absolute", bottom: "8%", insetInlineStart: "30%", width: 280, height: 280, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)", filter: "blur(30px)", animation: "orb3 22s ease-in-out infinite" }} />
          <div style={{ position: "absolute", top: "30%", insetInlineEnd: "25%", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(52,211,153,0.07) 0%, transparent 70%)", filter: "blur(24px)", animation: "orb4 12s ease-in-out infinite" }} />
        </div>

        {/* Grid overlay */}
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-28 text-center">
          {/* Badge */}
          <div className="hero-badge inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            {t("m.hero.badge")}
          </div>

          {/* Headline — line by line */}
          <h1 className={heroTitleClass}>
            <span className="hero-line-1 block">{t("m.hero.title1")}</span>
            <span className="hero-line-2 block text-emerald-400">{t("m.hero.title2")}</span>
          </h1>

          <p className="hero-sub text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t("m.hero.sub")}
          </p>

          <div className="hero-cta flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/auth/signup"
              className="btn-shimmer w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-8 py-4 rounded-xl text-base shadow-lg shadow-emerald-500/25"
            >
              {t("m.hero.ctaPrimary")}
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto text-slate-300 hover:text-white font-medium px-8 py-4 rounded-xl border border-slate-700 hover:border-slate-500 text-base transition-colors duration-200"
            >
              {t("m.hero.ctaSecondary")} <span className="inline-block">↓</span>
            </a>
          </div>

          <p className="hero-proof mt-10 text-sm text-slate-400">
            {t("m.hero.proof")}
          </p>

          {/* Mock booking UI */}
          <div className="hero-mock mt-16 max-w-sm mx-auto bg-white/5 border border-white/10 rounded-2xl p-6 text-start backdrop-blur-sm hover:bg-white/8 transition-colors duration-300">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">{t("m.hero.mock.title")}</p>
            <div className="space-y-3">
              <div className="bg-white/10 rounded-lg px-4 py-3 text-sm text-slate-200 font-medium hover:bg-white/15 transition-colors duration-200 cursor-default">{t("m.hero.mock.item1")}</div>
              <div className="bg-white/10 rounded-lg px-4 py-3 text-sm text-slate-200 font-medium hover:bg-white/15 transition-colors duration-200 cursor-default">{t("m.hero.mock.item2")}</div>
              <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-lg px-4 py-3 text-sm text-emerald-300 font-medium">{t("m.hero.mock.selected")}</div>
            </div>
            <div className="mt-4 bg-emerald-500 text-slate-900 text-sm font-bold text-center py-2.5 rounded-lg hover:bg-emerald-400 transition-colors duration-200 cursor-default">
              {t("m.hero.mock.confirm")}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{t("m.how.title")}</h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">{t("m.how.sub")}</p>
            </div>
          </RevealOnScroll>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((item, i) => (
              <RevealOnScroll key={item.key} delay={i * 110} className="h-full">
                <div className="step-card h-full bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-300 tracking-widest mb-4">{item.n}</div>
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-5">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{t(`m.how.${item.key}.title`)}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{t(`m.how.${item.key}.desc`)}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>

          <RevealOnScroll delay={330}>
            <div className="text-center mt-12">
              <Link href="/auth/signup" className="btn-shimmer inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3.5 rounded-xl">
                {t("m.how.cta")}
              </Link>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{t("m.feat.title")}</h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">{t("m.feat.sub")}</p>
            </div>
          </RevealOnScroll>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <RevealOnScroll key={f.key} delay={(i % 3) * 100} className="h-full">
                <div className="feature-card h-full bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <div className="w-10 h-10 bg-white text-emerald-600 rounded-lg flex items-center justify-center mb-4 shadow-sm border border-slate-200">
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2">{t(`m.feat.${f.key}.title`)}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{t(`m.feat.${f.key}.desc`)}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING — single launch-year card ── */}
      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{t("m.price.title")}</h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">{t("m.price.sub")}</p>
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={120}>
            <div className="max-w-lg mx-auto">
              <div className="pricing-card pricing-card-pro bg-slate-900 text-white rounded-2xl p-8 sm:p-10 shadow-xl relative overflow-hidden">
                <div className="mb-6">
                  <p className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-2">{t("m.hero.proof")}</p>
                  <h3 className="text-2xl sm:text-3xl font-bold mb-2">{t("m.price.cardTitle")}</h3>
                  <p className="text-slate-400 text-sm">{t("m.price.cardSub")}</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {["m.price.f1","m.price.f2","m.price.f3","m.price.f4","m.price.f5","m.price.f6"].map((k) => (
                    <li key={k} className="flex items-center gap-3 text-sm text-slate-200">
                      <span className="w-5 h-5 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">✓</span>
                      {t(k)}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className="btn-shimmer block text-center bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-3.5 rounded-xl">
                  {t("m.price.cta")}
                </Link>
              </div>

              <p className="text-center text-slate-500 text-sm mt-6 max-w-md mx-auto leading-relaxed">
                {t("m.price.founding")}
              </p>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <RevealOnScroll>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">{t("m.faq.title")}</h2>
              <p className="text-slate-500 text-lg">{t("m.faq.sub")}</p>
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={100}>
            <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50 px-6">
              {["1","2","3","4","5","6","7","8"].map((n) => (
                <FaqItem key={n} q={t(`m.faq.q${n}`)} a={t(`m.faq.a${n}`)} />
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section id="contact" className="py-24 bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <RevealOnScroll>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("m.cta.title")}</h2>
            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">{t("m.cta.sub")}</p>

            <Link
              href="/auth/signup"
              className="btn-shimmer inline-block bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-10 py-4 rounded-xl text-base shadow-lg shadow-emerald-500/25 mb-12"
            >
              {t("m.cta.button")}
            </Link>
          </RevealOnScroll>

          <RevealOnScroll delay={150}>
            <div className="border-t border-white/10 pt-12">
              <p className="text-slate-400 text-sm mb-6">{t("m.cta.prompt")}</p>
              {contactSent ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium px-6 py-4 rounded-xl inline-block">
                  {t("m.cta.sent")}
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="flex flex-col gap-2 max-w-md mx-auto">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={contactEmail}
                      onChange={(e) => { setContactEmail(e.target.value); setContactError(""); }}
                      placeholder="your@email.com"
                      className={`flex-1 bg-white/10 border text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors duration-200 ${contactError ? "border-red-400" : "border-white/20"}`}
                    />
                    <button type="submit" className="btn-shimmer bg-white text-slate-900 font-semibold px-6 py-3 rounded-xl text-sm hover:bg-slate-100">
                      {t("m.cta.getInTouch")}
                    </button>
                  </div>
                  {contactError && (
                    <p className="text-red-400 text-xs text-start ps-1">{contactError}</p>
                  )}
                </form>
              )}
              <p className="text-slate-600 text-sm mt-4">
                {t("m.cta.orEmail")}{" "}
                <a href="mailto:support@7jwzat.com" className="text-slate-400 hover:text-white transition-colors underline">
                  support@7jwzat.com
                </a>
              </p>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-950 text-slate-500 py-12">
        <RevealOnScroll threshold={0.05}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-lg">{t("brand.logo")}</span>
                {locale === "ar" && <span className="text-xs text-slate-600">7jwzat</span>}
                <span className="text-slate-700">·</span>
                <span className="text-sm">{t("m.footer.tagline")}</span>
              </div>
              <nav className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-sm">
                <Link href="/privacy"    className="hover:text-slate-300 transition-colors">{t("m.footer.privacy")}</Link>
                <Link href="/terms"      className="hover:text-slate-300 transition-colors">{t("m.footer.terms")}</Link>
                <a href="mailto:support@7jwzat.com" className="hover:text-slate-300 transition-colors">{t("m.footer.contact")}</a>
                <Link href="/auth/login" className="hover:text-slate-300 transition-colors">{t("m.footer.signIn")}</Link>
                <LanguageToggleFooter />
              </nav>
            </div>
            <div className="border-t border-slate-900 mt-8 pt-8 text-center text-xs text-slate-700">
              {t("m.footer.rights")}
            </div>
          </div>
        </RevealOnScroll>
      </footer>
    </div>
  );
}

// Footer toggle styled for the dark background.
function LanguageToggleFooter() {
  const { locale, setLocale } = useLanguage();
  return (
    <div className="inline-flex items-center rounded-full border border-slate-700 overflow-hidden text-xs font-semibold">
      <button
        type="button"
        onClick={() => setLocale("ar")}
        className={`px-3 py-1 transition ${locale === "ar" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"}`}
        aria-pressed={locale === "ar"}
      >
        AR
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`px-3 py-1 transition ${locale === "en" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"}`}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
    </div>
  );
}
