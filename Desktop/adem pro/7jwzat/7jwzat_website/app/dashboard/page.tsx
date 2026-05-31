"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface UserProfile {
  email: string;
  business_name: string;
}

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "🏠" },
  { label: "Services", href: "/dashboard/services", icon: "✂️" },
  { label: "Business Hours", href: "/dashboard/business-hours", icon: "🕐" },
  { label: "Bookings", href: "/dashboard/bookings", icon: "📅" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/auth/login");
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("email, business_name")
        .eq("id", session.user.id)
        .single();
      setProfile(data ?? { email: session.user.email ?? "", business_name: "My Business" });
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md flex flex-col">
        <div className="px-6 py-6 border-b">
          <h1 className="text-2xl font-bold text-indigo-700">7jwzat</h1>
          <p className="text-xs text-gray-400 mt-0.5">حجوزات</p>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition text-sm font-medium"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition text-sm font-medium"
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Welcome, {profile?.business_name} 👋
            </h2>
            <p className="text-gray-500 text-sm mt-1">{profile?.email}</p>
          </div>
        </div>

        {/* Stats placeholders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[
            { label: "Total Bookings", value: "—", color: "indigo" },
            { label: "Today's Appointments", value: "—", color: "emerald" },
            { label: "Active Services", value: "—", color: "violet" },
            { label: "Revenue (MTD)", value: "—", color: "amber" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Section placeholders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-700 mb-3">✂️ Services</h3>
            <p className="text-sm text-gray-400">
              No services yet. Go to{" "}
              <Link href="/dashboard/services" className="text-indigo-600 hover:underline">
                Services
              </Link>{" "}
              to add your first service.
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-700 mb-3">🕐 Business Hours</h3>
            <p className="text-sm text-gray-400">
              Set your working hours in{" "}
              <Link href="/dashboard/business-hours" className="text-indigo-600 hover:underline">
                Business Hours
              </Link>
              .
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 lg:col-span-2">
            <h3 className="font-semibold text-gray-700 mb-3">📅 Recent Bookings</h3>
            <p className="text-sm text-gray-400">
              No bookings yet. Share your booking page to start receiving appointments.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
