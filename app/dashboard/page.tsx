"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { bookingUrl } from "@/lib/slug";
import { showToast } from "@/components/Toast";
import { QRCodeCard } from "@/components/QRCodeCard";
import { formatPrice, DEFAULT_CURRENCY } from "@/lib/currency";

interface UserProfile {
  email: string;
  business_name: string;
  business_type?: string | null;
  currency?: string | null;
}
interface Stats {
  totalBookings: number;
  todayBookings: number;
  serviceCount: number;
  revenueMTD: number;
}

function localDateString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWelcomeTag(type?: string | null): string {
  switch (type) {
    case "hair_beauty":
    case "spa_wellness":
      return "Your clients are booking while you work. \u{1F487}";
    case "clinic_healthcare":
    case "mental_health":
      return "Your patients are self-scheduling. \u{1F3E5}";
    case "fitness_movement":
      return "Your members are booking sessions. \u{1F3CB}️";
    default:
      return "Here’s an overview of your business. \u{1F44B}";
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats>({ totalBookings: 0, todayBookings: 0, serviceCount: 0, revenueMTD: 0 });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth/login"); return; }

      const userId = session.user.id;
      const today = localDateString();
      const firstOfMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;

      const [profileRes, totalRes, todayRes, svcRes, revenueRes] = await Promise.all([
        supabase.from("users").select("email, business_name, business_type, currency").eq("id", userId).single(),
        supabase.from("bookings").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("bookings").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("booking_date", today),
        supabase.from("services").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("bookings").select("services(price)").eq("user_id", userId).gte("booking_date", firstOfMonth).neq("status", "cancelled"),
      ]);

      setProfile(profileRes.data ?? { email: session.user.email ?? "", business_name: "My Business" });

      const revenueMTD = (revenueRes.data ?? []).reduce((sum: number, b: { services: { price: number } | null }) => {
        return sum + (b.services?.price ? Number(b.services.price) : 0);
      }, 0);

      setStats({
        totalBookings: totalRes.count ?? 0,
        todayBookings: todayRes.count ?? 0,
        serviceCount:  svcRes.count  ?? 0,
        revenueMTD,
      });

      setLoading(false);
    }
    load();
  }, [router]);

  async function copyLink() {
    if (!profile) return;
    const url = bookingUrl(profile.business_name);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    showToast("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  );

  const link = profile ? bookingUrl(profile.business_name) : "";

  const statCards = [
    { label: "Total Bookings", value: String(stats.totalBookings) },
    { label: "Today",          value: String(stats.todayBookings) },
    { label: "Services",       value: String(stats.serviceCount) },
    { label: "Revenue (MTD)",  value: formatPrice(stats.revenueMTD, profile?.currency ?? DEFAULT_CURRENCY) },
  ];

  return (
    <main className="flex-1 p-4 sm:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Welcome, {profile?.business_name}</h2>
        <p className="text-gray-500 text-sm mt-1">{getWelcomeTag(profile?.business_type)}</p>
      </div>

      {/* Share Booking Link Card + QR (side by side on desktop, stacked on mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 mb-8 items-start">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">&#128279;</span>
              <h3 className="font-semibold text-lg">Share Your Booking Link</h3>
            </div>
            <p className="text-emerald-100 text-sm mb-4">Share this link with customers so they can book appointments.</p>
            <div className="bg-white/15 rounded-xl px-4 py-2.5 text-sm font-mono truncate text-white/90">
              {link}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          <button
            onClick={copyLink}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition ${
              copied ? "bg-green-500 text-white" : "bg-white text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent("Book your appointment here: " + link)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-white/15 hover:bg-white/25 transition"
          >
            WhatsApp
          </a>
          <a
            href={`mailto:?subject=Book%20an%20appointment&body=${encodeURIComponent("Book here: " + link)}`}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-white/15 hover:bg-white/25 transition"
          >
            Email
          </a>
        </div>
      </div>

      {/* QR code for the same booking URL */}
      {profile && <QRCodeCard url={link} businessName={profile.business_name} />}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map(stat => (
          <div key={stat.label} className="bg-white rounded-xl shadow-sm p-6">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-800 mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-2">Services</h3>
          <p className="text-sm text-gray-400">
            <Link href="/dashboard/services" className="text-emerald-600 hover:underline">Manage your services &rarr;</Link>
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-2">Business Hours</h3>
          <p className="text-sm text-gray-400">
            <Link href="/dashboard/business-hours" className="text-emerald-600 hover:underline">Set your working hours &rarr;</Link>
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-2">Recent Bookings</h3>
          <p className="text-sm text-gray-400">
            <Link href="/dashboard/bookings" className="text-emerald-600 hover:underline">View all bookings &rarr;</Link>
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-2">Settings</h3>
          <p className="text-sm text-gray-400">
            <Link href="/dashboard/settings" className="text-emerald-600 hover:underline">Profile &amp; account settings &rarr;</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
