"use client";

import Link from "next/link";
import { useState } from "react";
import { Navbar } from "@/components/Navbar";

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconCalendar() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

function IconSettings() {
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
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        className="w-full flex items-center justify-between gap-4 py-5 text-left text-slate-900 font-medium hover:text-emerald-700 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span>{q}</span>
        <span className="flex-shrink-0 text-slate-400"><IconChevron open={open} /></span>
      </button>
      {open && (
        <p className="pb-5 text-slate-600 leading-relaxed text-sm pr-8">{a}</p>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Home() {
  const [contactEmail, setContactEmail] = useState("");
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState("");

  function handleContactSubmit(e: React.FormEvent) {
    e.preventDefault();
    setContactError("");
    if (!EMAIL_RE.test(contactEmail.trim())) {
      setContactError("Please enter a valid email address.");
      return;
    }
    setContactSent(true);
    setContactEmail("");
  }

  return (
    <>
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-28 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
            For salons, spas &amp; clinics in the Middle East
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
            Your booking system.
            <br />
            <span className="text-emerald-400">No coding. No setup.</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            Turn walk-ins into online bookings. Share one link on Google, Instagram, or WhatsApp — customers book themselves, you stay focused on your work.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-8 py-4 rounded-xl text-base transition-colors shadow-lg shadow-emerald-500/20"
            >
              Start Free — No credit card needed
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto text-slate-300 hover:text-white font-medium px-8 py-4 rounded-xl border border-slate-700 hover:border-slate-500 text-base transition-colors"
            >
              See how it works ↓
            </a>
          </div>

          {/* Social proof */}
          <p className="mt-10 text-sm text-slate-500">
            Used by businesses in UAE, Saudi Arabia &amp; Jordan
          </p>

          {/* Mock booking UI */}
          <div className="mt-16 max-w-sm mx-auto bg-white/5 border border-white/10 rounded-2xl p-6 text-left backdrop-blur">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Customer booking page</p>
            <div className="space-y-3">
              <div className="bg-white/10 rounded-lg px-4 py-3 text-sm text-slate-200 font-medium">✂️ Haircut &amp; Styling — 60 min — 150 AED</div>
              <div className="bg-white/10 rounded-lg px-4 py-3 text-sm text-slate-200 font-medium">💅 Manicure — 45 min — 80 AED</div>
              <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-lg px-4 py-3 text-sm text-emerald-300 font-medium">✓ Friday, 10:30 AM — Selected</div>
            </div>
            <div className="mt-4 bg-emerald-500 text-slate-900 text-sm font-bold text-center py-2.5 rounded-lg">
              Confirm Booking
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Get booking in 3 minutes</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              No technical knowledge required. If you can fill out a form, you can set this up.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <IconUserPlus />,
                step: "01",
                title: "Sign up",
                desc: "Create your account with your business name. No payment required to start.",
              },
              {
                icon: <IconSettings />,
                step: "02",
                title: "Add services & hours",
                desc: "List your services with prices, and set your opening hours. Takes about 2 minutes.",
              },
              {
                icon: <IconShare />,
                step: "03",
                title: "Share your link",
                desc: "Copy your booking URL and add it to Google My Business, Instagram, or WhatsApp. Done.",
              },
            ].map((item) => (
              <div key={item.step} className="relative bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                <div className="text-xs font-bold text-slate-300 tracking-widest mb-4">{item.step}</div>
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-5">
                  {item.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/auth/signup"
              className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3.5 rounded-xl transition-colors"
            >
              Try Free
            </Link>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Everything you need</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Straightforward tools that cover what a small business actually needs.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <IconCalendar />,
                title: "Customers book 24/7",
                desc: "Your booking page is always open. Customers pick a time and confirm — no calls back and forth.",
              },
              {
                icon: <IconNoFee />,
                title: "Zero platform fees",
                desc: "Customers pay you in person. We don't touch the money, so we don't take a cut.",
              },
              {
                icon: <IconPhone />,
                title: "Works on any device",
                desc: "The customer booking page looks great on mobile. Most of your customers will book from their phone.",
              },
              {
                icon: <IconMail />,
                title: "Email confirmations",
                desc: "Customers get an automatic confirmation email when they book. You get notified too.",
              },
              {
                icon: <IconClock />,
                title: "Real-time availability",
                desc: "The calendar only shows open time slots. No double bookings, no confusion.",
              },
              {
                icon: <IconDashboard />,
                title: "Simple admin dashboard",
                desc: "See all your bookings in one place. Update status, manage services, adjust your hours.",
              },
            ].map((f) => (
              <div key={f.title} className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <div className="w-10 h-10 bg-white text-emerald-600 rounded-lg flex items-center justify-center mb-4 shadow-sm border border-slate-200">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              One flat monthly fee. No percentage cuts, no hidden charges.
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-8">
            {/* Starter */}
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Starter</p>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold text-slate-900">Free</span>
                </div>
                <p className="text-slate-500 text-sm mt-1">Forever, no credit card needed</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Unlimited bookings",
                  "Email confirmations",
                  "Public booking page",
                  "Admin dashboard",
                  "No credit card needed",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-slate-700">
                    <span className="w-5 h-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className="block text-center border-2 border-emerald-600 text-emerald-700 font-semibold py-3 rounded-xl hover:bg-emerald-50 transition-colors"
              >
                Start Free
              </Link>
            </div>

            {/* Pro */}
            <div className="bg-slate-900 text-white rounded-2xl p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-bl-xl">
                POPULAR
              </div>
              <div className="mb-6">
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Pro</p>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold">29</span>
                  <span className="text-slate-400 mb-1">AED / month</span>
                </div>
                <p className="text-slate-400 text-sm mt-1">About $8 USD. Cancel anytime.</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Unlimited bookings",
                  "Up to 3 locations",
                  "Priority email support",
                  "Everything in Starter",
                  "Arabic language (coming soon)",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="w-5 h-5 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className="block text-center bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-3 rounded-xl transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
          </div>

          <p className="text-center text-slate-500 text-sm mt-8">
            All plans include a 14-day free trial of Pro features. No card required.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Questions?</h2>
            <p className="text-slate-500 text-lg">Common things people ask before signing up.</p>
          </div>

          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50 px-6">
            <FaqItem
              q="Is there a setup fee?"
              a="No. You can sign up and start using 7jwzat for free — no credit card required. Paid plans are optional and only needed when you want unlimited bookings."
            />
            <FaqItem
              q="Can customers pay online through 7jwzat?"
              a="Not currently. Customers book their appointment through your page, then pay you in person at the time of their visit. This keeps things simple and means we never take a percentage of your revenue."
            />
            <FaqItem
              q="How many bookings can I take?"
              a="Unlimited. There are no booking caps on any plan — take as many appointments as your schedule allows."
            />
            <FaqItem
              q="What if I need to cancel my subscription?"
              a="You can cancel anytime from your account settings. No questions, no cancellation fees. Your data stays available until the end of your billing period."
            />
            <FaqItem
              q="Do you support Arabic?"
              a="Arabic interface is on the roadmap and coming soon. For now, 7jwzat is in English only. Customer-facing booking pages can be set up with Arabic service names."
            />
            <FaqItem
              q="Which countries do you support?"
              a="Currently UAE, Saudi Arabia, and Jordan. We're actively expanding to more countries in the region — contact us if yours isn't listed."
            />
            <FaqItem
              q="How do customers find my booking page?"
              a="You get a unique URL like yourdomain.com/book/yourbusiness. Share it on Google My Business, Instagram bio, WhatsApp, or anywhere else you promote your business."
            />
            <FaqItem
              q="Is there customer support?"
              a="Yes. Email support is included on all plans. Pro plan users get priority responses. Reach us at support@7jwzat.com."
            />
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section id="contact" className="py-24 bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Ready to get your first online booking?
          </h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
            Join businesses in UAE, Saudi Arabia, and Jordan already using 7jwzat to manage their appointments.
          </p>

          <Link
            href="/auth/signup"
            className="inline-block bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold px-10 py-4 rounded-xl text-base transition-colors shadow-lg shadow-emerald-500/20 mb-12"
          >
            Sign Up Free — Takes 2 Minutes
          </Link>

          {/* Contact form */}
          <div className="border-t border-white/10 pt-12">
            <p className="text-slate-400 text-sm mb-6">Have a question before signing up?</p>
            {contactSent ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium px-6 py-4 rounded-xl inline-block">
                Thanks! We&apos;ll be in touch within 24 hours.
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="flex flex-col gap-2 max-w-md mx-auto">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={contactEmail}
                    onChange={(e) => { setContactEmail(e.target.value); setContactError(""); }}
                    placeholder="your@email.com"
                    className={`flex-1 bg-white/10 border text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors ${contactError ? "border-red-400" : "border-white/20"}`}
                  />
                  <button
                    type="submit"
                    className="bg-white text-slate-900 font-semibold px-6 py-3 rounded-xl text-sm hover:bg-slate-100 transition-colors"
                  >
                    Get in touch
                  </button>
                </div>
                {contactError && (
                  <p className="text-red-400 text-xs text-left pl-1">{contactError}</p>
                )}
              </form>
            )}
            <p className="text-slate-600 text-sm mt-4">
              Or email us directly:{" "}
              <a href="mailto:support@7jwzat.com" className="text-slate-400 hover:text-white transition-colors underline">
                support@7jwzat.com
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-950 text-slate-500 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <span className="text-white font-bold text-lg">7jwzat</span>
              <span className="text-slate-700">·</span>
              <span className="text-sm">Online booking for the Middle East</span>
            </div>

            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
              <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of Service</Link>
              <a href="mailto:support@7jwzat.com" className="hover:text-slate-300 transition-colors">Contact</a>
              <Link href="/auth/login" className="hover:text-slate-300 transition-colors">Sign in</Link>
            </nav>
          </div>

          <div className="border-t border-slate-900 mt-8 pt-8 text-center text-xs text-slate-700">
            © 2026 7jwzat. All rights reserved.
          </div>
        </div>
      </footer>
    </>
  );
}
