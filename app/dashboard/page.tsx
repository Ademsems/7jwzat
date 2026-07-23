"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { bookingUrl } from "@/lib/slug";
import { showToast } from "@/components/Toast";
import { QRCodeCard } from "@/components/QRCodeCard";
import { formatPrice, DEFAULT_CURRENCY } from "@/lib/currency";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { InfoTooltip } from "@/components/InfoTooltip";
import { Calendar, type CalendarBooking, type CfAnswer, type CfAnswersMap } from "@/components/Calendar";

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
interface BusinessHourRow { day_of_week: number; start_time: string; end_time: string; }

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
  const { t } = useLanguage();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats>({ totalBookings: 0, todayBookings: 0, serviceCount: 0, revenueMTD: 0 });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Calendar block data
  const [calendarBookings, setCalendarBookings] = useState<CalendarBooking[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHourRow[]>([]);
  const [answersMap, setAnswersMap] = useState<CfAnswersMap>({});

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth/login"); return; }

      const userId = session.user.id;
      const today = localDateString();
      const firstOfMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;

      const [profileRes, totalRes, todayRes, svcRes, revenueRes, svcNamesRes, staffRes, hoursRes, bkRes] = await Promise.all([
        supabase.from("users").select("email, business_name, business_type, currency").eq("id", userId).single(),
        supabase.from("bookings").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("bookings").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("booking_date", today),
        supabase.from("services").select("*", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("bookings").select("services(price)").eq("user_id", userId).gte("booking_date", firstOfMonth).neq("status", "cancelled"),
        // Calendar block — mirrors the merge-client-side pattern used on the bookings page.
        supabase.from("services").select("id, name").eq("user_id", userId),
        supabase.from("staff").select("id, name").eq("user_id", userId).eq("is_active", true),
        supabase.from("business_hours").select("day_of_week, start_time, end_time").eq("user_id", userId),
        supabase.from("bookings").select("*").eq("user_id", userId),
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

      // ── Calendar block ─────────────────────────────────────────────────
      setBusinessHours(hoursRes.data ?? []);
      const svcNameById: Record<string, string> = {};
      (svcNamesRes.data ?? []).forEach((s: { id: string; name: string }) => { svcNameById[s.id] = s.name; });
      const staffNameById: Record<string, string> = {};
      (staffRes.data ?? []).forEach((s: { id: string; name: string }) => { staffNameById[s.id] = s.name; });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawBookings = (bkRes.data ?? []) as any[];
      setCalendarBookings(rawBookings.map(b => ({
        id: b.id,
        customer_name: b.customer_name,
        customer_email: b.customer_email,
        customer_phone: b.customer_phone,
        notes: b.notes,
        internal_note: b.internal_note,
        booking_date: b.booking_date,
        booking_time: b.booking_time,
        status: b.status,
        booking_type: b.booking_type,
        group_session_id: b.group_session_id,
        service_id: b.service_id,
        service_name: svcNameById[b.service_id] ?? "—",
        staff_id: b.staff_id,
        staff_name: b.staff_id ? (staffNameById[b.staff_id] ?? b.staff_preference) : null,
      })));

      if (rawBookings.length > 0) {
        const { data: cfaRows } = await supabase
          .from("custom_field_answers")
          .select("booking_id, custom_field_id, answer, custom_fields(label)")
          .in("booking_id", rawBookings.map(b => b.id));
        const map: CfAnswersMap = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (cfaRows ?? []).forEach((row: any) => {
          const entry: CfAnswer = { custom_field_id: row.custom_field_id, answer: row.answer, label: row.custom_fields?.label ?? row.custom_field_id };
          (map[row.booking_id] ??= []).push(entry);
        });
        setAnswersMap(map);
      }

      setLoading(false);
    }
    load();
  }, [router]);

  function handleCalendarStatusChange(id: string, status: CalendarBooking["status"]) {
    setCalendarBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  }

  async function copyLink() {
    if (!profile) return;
    const url = bookingUrl(profile.business_name);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    showToast(t("dash.linkCopied"));
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500">Loading...</div>
    </div>
  );

  const link = profile ? bookingUrl(profile.business_name) : "";

  const statCards = [
    { label: t("dash.stat.totalBookings"), value: String(stats.totalBookings) },
    { label: t("dash.stat.today"),         value: String(stats.todayBookings) },
    { label: t("dash.stat.services"),      value: String(stats.serviceCount) },
    { label: t("dash.stat.revenue"),       value: formatPrice(stats.revenueMTD, profile?.currency ?? DEFAULT_CURRENCY) },
  ];

  return (
    <main className="flex-1 p-4 sm:p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800 inline-flex items-center gap-2">{t("dash.welcome")} {profile?.business_name} <InfoTooltip textKey="tip.page.dashboard" /></h2>
        <p className="text-gray-500 text-sm mt-1">{getWelcomeTag(profile?.business_type)}</p>
      </div>

      {/* Share Booking Link Card + QR (side by side on desktop, stacked on mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 mb-8 items-start">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">&#128279;</span>
              <h3 className="font-semibold text-lg">{t("dash.share.title")}</h3>
            </div>
            <p className="text-emerald-100 text-sm mb-4">{t("dash.share.desc")}</p>
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
            {copied ? t("dash.copied") : t("dash.copyLink")}
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

      {/* Calendar — read-only browsing; status changes still work via the side panel */}
      <div className="mb-8">
        <h3 className="font-semibold text-gray-700 mb-3">{t("cal.dashboardTitle")}</h3>
        <Calendar
          bookings={calendarBookings}
          businessHours={businessHours}
          answersMap={answersMap}
          onBookingStatusChange={handleCalendarStatusChange}
          storageKey="7jwzat-calendar-view-dashboard"
          defaultView="week"
          compact
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-2">{t("dash.quick.services")}</h3>
          <p className="text-sm text-gray-400">
            <Link href="/dashboard/services" className="text-emerald-600 hover:underline">{t("dash.quick.servicesLink")}</Link>
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-2">{t("dash.quick.hours")}</h3>
          <p className="text-sm text-gray-400">
            <Link href="/dashboard/business-hours" className="text-emerald-600 hover:underline">{t("dash.quick.hoursLink")}</Link>
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-2">{t("dash.quick.recent")}</h3>
          <p className="text-sm text-gray-400">
            <Link href="/dashboard/bookings" className="text-emerald-600 hover:underline">{t("dash.quick.recentLink")}</Link>
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-2">{t("dash.quick.settings")}</h3>
          <p className="text-sm text-gray-400">
            <Link href="/dashboard/settings" className="text-emerald-600 hover:underline">{t("dash.quick.settingsLink")}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
