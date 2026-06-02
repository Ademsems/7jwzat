"use client";

import Link from "next/link";
import { useState } from "react";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-slate-900 tracking-tight">
          7jwzat
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
          <a href="/#how-it-works" className="hover:text-slate-900 transition-colors">How It Works</a>
          <a href="/#features" className="hover:text-slate-900 transition-colors">Features</a>
          <a href="/#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
          <a href="/#faq" className="hover:text-slate-900 transition-colors">FAQ</a>
          <a href="/#contact" className="hover:text-slate-900 transition-colors">Contact</a>
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Start Free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 flex flex-col gap-4">
          <a href="/#how-it-works" className="text-sm font-medium text-slate-700 hover:text-slate-900" onClick={() => setMobileOpen(false)}>How It Works</a>
          <a href="/#features"     className="text-sm font-medium text-slate-700 hover:text-slate-900" onClick={() => setMobileOpen(false)}>Features</a>
          <a href="/#pricing"      className="text-sm font-medium text-slate-700 hover:text-slate-900" onClick={() => setMobileOpen(false)}>Pricing</a>
          <a href="/#faq"          className="text-sm font-medium text-slate-700 hover:text-slate-900" onClick={() => setMobileOpen(false)}>FAQ</a>
          <a href="/#contact"      className="text-sm font-medium text-slate-700 hover:text-slate-900" onClick={() => setMobileOpen(false)}>Contact</a>
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-slate-600 text-center py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="bg-emerald-600 text-white text-sm font-semibold text-center py-2 rounded-lg hover:bg-emerald-700 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Start Free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
