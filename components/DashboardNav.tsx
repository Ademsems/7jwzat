"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage, useApplyHtmlDir, LanguageToggle } from "@/lib/i18n/LanguageProvider";

// ── Nav structure ──────────────────────────────────────────────────────────
type NavItem = { key: string; href: string; icon: string };
type NavGroup = { groupKey: string; storageKey: string; items: NavItem[] };
type NavEntry = { type: "item"; item: NavItem } | { type: "group"; group: NavGroup };

const NAV: NavEntry[] = [
  { type: "item", item: { key: "nav.dashboard", href: "/dashboard",         icon: "🏠" } },
  { type: "item", item: { key: "nav.bookings",  href: "/dashboard/bookings", icon: "📅" } },

  {
    type: "group",
    group: {
      groupKey:   "nav.group.calendar",
      storageKey: "7jwzat-nav-calendar",
      items: [
        { key: "nav.businessHours", href: "/dashboard/business-hours", icon: "🕐" },
        { key: "nav.sessions",      href: "/dashboard/sessions",       icon: "👥" },
      ],
    },
  },

  {
    type: "group",
    group: {
      groupKey:   "nav.group.setup",
      storageKey: "7jwzat-nav-setup",
      items: [
        { key: "nav.services",     href: "/dashboard/services",      icon: "✂️" },
        { key: "nav.customFields", href: "/dashboard/custom-fields", icon: "📝" },
        { key: "nav.staff",        href: "/dashboard/staff",         icon: "👥‍🤝‍👥" },
      ],
    },
  },

  { type: "item", item: { key: "nav.customers", href: "/dashboard/customers", icon: "👤" } },

  {
    type: "group",
    group: {
      groupKey:   "nav.group.insights",
      storageKey: "7jwzat-nav-insights",
      items: [
        { key: "nav.analytics", href: "/dashboard/analytics", icon: "📊" },
      ],
    },
  },

  { type: "item", item: { key: "nav.settings", href: "/dashboard/settings", icon: "⚙️" } },
];

// Read stored collapse state; default = expanded (true)
function readStored(key: string): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(key);
  return v === null ? true : v !== "false";
}

// ── Collapsible group ──────────────────────────────────────────────────────
function NavGroup({
  group,
  isActive,
  onNavigate,
}: {
  group: NavGroup;
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
}) {
  const { t } = useLanguage();
  const hasActive = group.items.some(i => isActive(i.href));

  // Default open; auto-open if active item is inside
  const [open, setOpen] = useState<boolean>(() => {
    const stored = readStored(group.storageKey);
    return stored || hasActive;
  });

  // If the active route changes to inside this group while it's collapsed, expand
  useEffect(() => {
    if (hasActive && !open) setOpen(true);
  }, [hasActive]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    setOpen(prev => {
      const next = !prev;
      localStorage.setItem(group.storageKey, String(next));
      return next;
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-2 py-1.5 mt-3 mb-0.5 text-[10px] font-semibold tracking-widest text-gray-400 uppercase hover:text-gray-600 transition select-none"
      >
        <span>{t(group.groupKey)}</span>
        {/* Chevron — rotates 180° when open; flipped for RTL via transform */}
        <svg
          className={`w-3 h-3 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="space-y-0.5">
          {group.items.map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 ps-6 pe-3 py-2 rounded-lg text-sm font-medium transition
                  ${active
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
                  }`}
              >
                <span>{item.icon}</span>
                <span>{t(item.key)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Single nav item ────────────────────────────────────────────────────────
function NavItemLink({
  item,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
}) {
  const { t } = useLanguage();
  const active = isActive(item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition
        ${active
          ? "bg-emerald-50 text-emerald-700"
          : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
        }`}
    >
      <span>{item.icon}</span>
      <span>{t(item.key)}</span>
    </Link>
  );
}

// ── Full nav links list ────────────────────────────────────────────────────
function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="space-y-0.5">
      {NAV.map((entry, i) =>
        entry.type === "item" ? (
          <NavItemLink key={entry.item.href} item={entry.item} isActive={isActive} onNavigate={onNavigate} />
        ) : (
          <NavGroup key={entry.group.storageKey} group={entry.group} isActive={isActive} onNavigate={onNavigate} />
        )
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  useApplyHtmlDir();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    setMobileOpen(false);
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <>
      {/* ── Desktop sidebar (lg+) ─────────────────────────────── */}
      <aside className="hidden lg:flex w-64 bg-white shadow-md flex-col shrink-0 min-h-screen">
        <div className="px-6 py-6 border-b">
          <Link href="/" className="text-2xl font-bold text-slate-900">Sajjel</Link>
          <p className="text-xs text-gray-400 mt-0.5">{t("nav.tagline")}</p>
        </div>
        <nav className="flex-1 px-4 py-4 overflow-y-auto">
          <NavLinks />
        </nav>
        <div className="px-4 py-4 border-t space-y-3">
          <LanguageToggle className="w-full justify-center" />
          <button
            onClick={handleLogout}
            className="w-full text-start flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition text-sm font-medium"
          >
            <span>🚪</span> {t("nav.logout")}
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar (below lg) ─────────────────────────── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm h-14 flex items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-slate-900">Sajjel</Link>
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
          <div className="lg:hidden fixed top-14 left-0 right-0 z-50 bg-white border-b shadow-xl px-4 py-3 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-gray-100 pt-2 mt-3 space-y-2">
              <LanguageToggle className="w-full justify-center" />
              <button
                onClick={handleLogout}
                className="w-full text-start flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition text-sm font-medium"
              >
                <span>🚪</span> {t("nav.logout")}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
