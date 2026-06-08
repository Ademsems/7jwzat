"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { label: "Dashboard",      href: "/dashboard",                icon: "\u{1F3E0}" },
  { label: "Analytics",      href: "/dashboard/analytics",      icon: "\u{1F4CA}" },
  { label: "Services",       href: "/dashboard/services",       icon: "\u{2702}️" },
  { label: "Custom Fields",  href: "/dashboard/custom-fields",  icon: "\u{1F4DD}" },
  { label: "Sessions",       href: "/dashboard/sessions",       icon: "\u{1F465}" },
  { label: "Staff",          href: "/dashboard/staff",          icon: "\u{1F465}\u{200D}\u{1F91D}\u{200D}\u{1F465}" },
  { label: "Customers",      href: "/dashboard/customers",      icon: "\u{1F464}" },
  { label: "Business Hours", href: "/dashboard/business-hours", icon: "\u{1F550}" },
  { label: "Bookings",       href: "/dashboard/bookings",       icon: "\u{1F4C5}" },
  { label: "Settings",       href: "/dashboard/settings",       icon: "\u{2699}️" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  async function handleLogout() {
    setMobileOpen(false);
    await supabase.auth.signOut();
    router.push("/");
  }

  function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition
                ${active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <>
      {/* ── Desktop sidebar (lg+) ─────────────────────────────── */}
      <aside className="hidden lg:flex w-64 bg-white shadow-md flex-col shrink-0 min-h-screen">
        <div className="px-6 py-6 border-b">
          <Link href="/" className="text-2xl font-bold text-slate-900">7jwzat</Link>
          <p className="text-xs text-gray-400 mt-0.5">Booking System</p>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          <NavLinks />
        </nav>
        <div className="px-4 py-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition text-sm font-medium"
          >
            <span>{"\u{1F6AA}"}</span> Logout
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar (below lg) ─────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm h-14 flex items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-slate-900">7jwzat</Link>
        <button
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle navigation menu"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-700 text-2xl leading-none w-10 h-10 flex items-center justify-center"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* ── Mobile overlay + slide-down menu ──────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="lg:hidden fixed top-14 left-0 right-0 z-50 bg-white border-b shadow-xl px-4 py-3 space-y-1">
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-gray-100 pt-2 mt-2">
              <button
                onClick={handleLogout}
                className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition text-sm font-medium"
              >
                <span>{"\u{1F6AA}"}</span> Logout
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
