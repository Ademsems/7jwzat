"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/components/Toast";

const DAYS = [
  { label: "Monday",    index: 1 },
  { label: "Tuesday",   index: 2 },
  { label: "Wednesday", index: 3 },
  { label: "Thursday",  index: 4 },
  { label: "Friday",    index: 5 },
  { label: "Saturday",  index: 6 },
  { label: "Sunday",    index: 0 },
];

interface DayState { open: boolean; start: string; end: string; }
type WeekState = Record<number, DayState>;

function defaultWeek(): WeekState {
  const s: WeekState = {};
  DAYS.forEach(({ index }) => { s[index] = { open: false, start: "09:00", end: "17:00" }; });
  return s;
}

function getErr(e: unknown) {
  return e && typeof e === "object" && "message" in e ? String((e as {message:unknown}).message) : "Something went wrong.";
}

const NAV = [
  { label: "Dashboard",      href: "/dashboard" },
  { label: "Services",       href: "/dashboard/services" },
  { label: "Business Hours", href: "/dashboard/business-hours" },
  { label: "Bookings",       href: "/dashboard/bookings" },
];

export default function BusinessHoursPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [week, setWeek] = useState<WeekState>(defaultWeek());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth/login"); return; }
    setUserId(session.user.id);
    const { data, error } = await supabase.from("business_hours").select("*").eq("user_id", session.user.id);
    if (!error && data && data.length > 0) {
      const loaded = defaultWeek();
      data.forEach((row: { day_of_week: number; start_time: string; end_time: string }) => {
        loaded[row.day_of_week] = { open: true, start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5) };
      });
      setWeek(loaded);
    }
    setLoading(false);
  }

  function setDay(index: number, patch: Partial<DayState>) {
    setWeek(prev => ({ ...prev, [index]: { ...prev[index], ...patch } }));
  }

  function validate(): string | null {
    for (const { label, index } of DAYS) {
      const d = week[index];
      if (!d.open) continue;
      if (!d.start || !d.end) return `${label}: enter both start and end times.`;
      if (d.start >= d.end) return `${label}: end time must be after start time (${d.start} → ${d.end}).`;
    }
    return null;
  }

  async function handleSave() {
    const err = validate();
    if (err) { showToast(err, "error"); return; }
    if (!userId) return;
    setSaving(true);
    const { error: delErr } = await supabase.from("business_hours").delete().eq("user_id", userId);
    if (delErr) { showToast(getErr(delErr), "error"); setSaving(false); return; }
    const rows = DAYS.filter(({ index }) => week[index].open)
      .map(({ index }) => ({ user_id: userId, day_of_week: index, start_time: week[index].start, end_time: week[index].end }));
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("business_hours").insert(rows);
      if (insErr) { showToast(getErr(insErr), "error"); setSaving(false); return; }
    }
    showToast("Business hours saved successfully.");
    setSaving(false);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>;

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 bg-white shadow-md flex flex-col shrink-0">
        <div className="px-6 py-6 border-b"><h1 className="text-2xl font-bold text-indigo-700">7jwzat</h1><p className="text-xs text-gray-400 mt-0.5">Booking System</p></div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {NAV.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${item.href === "/dashboard/business-hours" ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t">
          <button onClick={async () => { await supabase.auth.signOut(); router.push("/"); }}
            className="w-full text-left px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition text-sm font-medium">Logout</button>
        </div>
      </aside>

      <main className="flex-1 p-8 max-w-2xl">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Business Hours</h2>
        <p className="text-gray-500 text-sm mb-8">Set the days and times your business is open for bookings.</p>

        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 mb-6">
          {DAYS.map(({ label, index }) => {
            const day = week[index];
            const timeError = day.open && day.start && day.end && day.start >= day.end;
            return (
              <div key={index} className="px-6 py-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4 min-w-[160px]">
                    <span className="font-medium text-gray-800 w-24">{label}</span>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                      <button type="button" onClick={() => setDay(index, { open: true })}
                        className={`px-3 py-1.5 font-medium transition ${day.open ? "bg-indigo-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>Open</button>
                      <button type="button" onClick={() => setDay(index, { open: false })}
                        className={`px-3 py-1.5 font-medium transition ${!day.open ? "bg-gray-700 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>Closed</button>
                    </div>
                  </div>
                  {day.open ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 uppercase tracking-wide">From</span>
                          <input type="time" value={day.start} onChange={e => setDay(index, { start: e.target.value })}
                            className={`border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${timeError ? "border-red-400" : "border-gray-300"}`} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 uppercase tracking-wide">To</span>
                          <input type="time" value={day.end} onChange={e => setDay(index, { end: e.target.value })}
                            className={`border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${timeError ? "border-red-400" : "border-gray-300"}`} />
                        </div>
                      </div>
                      {timeError && <p className="text-red-600 text-xs">End time must be after start time.</p>}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Closed all day</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={handleSave} disabled={saving}
          className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition">
          {saving ? "Saving..." : "Save Hours"}
        </button>
      </main>
    </div>
  );
}