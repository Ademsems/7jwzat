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
  { label: "Dashboard", href: "/dashboard", icon: "Home" },
  { label: "Services", href: "/dashboard/services", icon: "Scissors" },
  { label: "Business Hours", href: "/dashboard/hours", icon: "Clock" },
  { label: "Bookings", href: "/dashboard/bookings", icon: "Calendar" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth/login"); return; }
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
      <aside className="w-64 bg-white shadow-md flex flex-col">
        <div className="px-6 py-6 border-b">
          <h1 className="text-2xl font-bold text-indigo-700">7jwzat</h1>
          <p className="text-xs text-gray-400 mt-0.5">Booking System</p>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition text-sm font-medium"
            >
              <span className="w-5 text-center text-base">[{item.icon[0]}]</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t">
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition text-sm font-medium"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800">
            Welcome, {profile?.business_name}!
          </h2>
          <p className="text-gray-500 text-sm mt-1">{profile?.email}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[
            { label: "Total Bookings", value: "0" },
            { label: "Today", value: "0" },
            { label: "Services", value: "0" },
            { label: "Revenue (MTD)", value: "AED 0" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-700 mb-3">Services</h3>
            <p className="text-sm text-gray-400">
              No services yet.{" "}
              <Link href="/dashboard/services" className="text-indigo-600 hover:underline">
                Add your first service
              </Link>
              .
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-700 mb-3">Business Hours</h3>
            <p className="text-sm text-gray-400">
              Set your working hours in{" "}
              <Link href="/dashboard/hours" className="text-indigo-600 hover:underline">
                Business Hours
              </Link>
              .
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 lg:col-span-2">
            <h3 className="font-semibold text-gray-700 mb-3">Recent Bookings</h3>
            <p className="text-sm text-gray-400">
              No bookings yet. Share your booking page to start receiving appointments.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}