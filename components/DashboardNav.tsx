"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { label: "Dashboard",      href: "/dashboard",                icon: "🏠" },
  { label: "Services",       href: "/dashboard/services",       icon: "✂️" },
  { label: "Business Hours", href: "/dashboard/business-hours", icon: "🕐" },
  { label: "Bookings",       href: "/dashboard/bookings",       icon: "📅" },
  { label: "Settings",       href: "/dashboard/settings",       icon: "⚙️" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <aside className="w-64 bg-white shadow-md flex flex-col shrink-0 min-h-screen">
      {/* Brand */}
      <div className="px-6 py-6 border-b">
        <Link href="/" className="text-2xl font-bold text-slate-900">7jwzat</Link>
        <p className="text-xs text-gray-400 mt-0.5">Booking System</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition
                ${isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-600 hover:bg-emerald-50 hover:text-emerald-700"
                }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-4 py-4 border-t">
        <button
          onClick={handleLogout}
          className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition text-sm font-medium"
        >
          <span>🚪</span> Logout
        </button>
      </div>
    </aside>
  );
}
