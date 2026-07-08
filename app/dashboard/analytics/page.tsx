"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────
type RangeKey = "this-month" | "last-month" | "last-3-months" | "last-6-months";

interface RangeBooking {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  booking_type: string | null;
  service_id: string | null;
  staff_id: string | null;
  customer_id: string | null;
  services: { id: string; name: string; price: number } | null; // merged client-side
}

interface ServiceRow { id: string; name: string; price: number; }

interface HistoryBooking {
  customer_id: string | null;
  booking_date: string;
}

interface StaffMember { id: string; name: string; }
interface Customer    { id: string; created_at: string; }

// ── Constants ─────────────────────────────────────────────────────────────────
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "this-month",    label: "This Month"    },
  { key: "last-month",    label: "Last Month"    },
  { key: "last-3-months", label: "Last 3 Months" },
  { key: "last-6-months", label: "Last 6 Months" },
];

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW_LABELS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DOW_JS      = [0, 1, 2, 3, 4, 5, 6]; // getDay() values, Sunday first (Jordan week)

// ── Helpers ───────────────────────────────────────────────────────────────────
function localDate(dt: Date): string {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function getDateRange(r: RangeKey): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  switch (r) {
    case "this-month":    return { start: localDate(new Date(y, m, 1)),      end: localDate(new Date(y, m, d))     };
    case "last-month":    return { start: localDate(new Date(y, m - 1, 1)),  end: localDate(new Date(y, m, 0))     };
    case "last-3-months": return { start: localDate(new Date(y, m - 3, d)),  end: localDate(new Date(y, m, d))     };
    case "last-6-months": return { start: localDate(new Date(y, m - 6, d)),  end: localDate(new Date(y, m, d))     };
  }
}

let ACTIVE_CURRENCY = "JOD"; // set at render time from the business profile
function fmtMoney(n: number): string {
  return ACTIVE_CURRENCY + " " + Math.round(n).toLocaleString("en-US");
}

function fmtHour(h: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return `${h12}:00 ${ampm}`;
}

function svcPrice(svc: unknown): number {
  if (!svc || typeof svc !== "object") return 0;
  // numeric columns can arrive as strings from PostgREST
  const p = Number((svc as { price?: unknown }).price);
  return isNaN(p) ? 0 : p;
}

function svcName(svc: unknown): string {
  if (!svc || typeof svc !== "object") return "Unknown service";
  return (svc as { name?: string }).name ?? "Unknown service";
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className ?? ""}`} />;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border-t-4 border-emerald-500 p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <p className="text-3xl font-bold text-gray-900 leading-none mb-2">{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="font-semibold text-gray-700 text-base mb-5">{title}</h3>
      {children}
    </div>
  );
}

// ── Bar Chart (revenue over time, pure CSS) ───────────────────────────────────
function BarChart({ bars }: { bars: { label: string; value: number }[] }) {
  const max     = Math.max(...bars.map(b => b.value), 1);
  const allZero = bars.every(b => b.value === 0);

  if (allZero) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No completed appointments in this period yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${Math.max(bars.length * 32, 300)}px` }}>
        {/* Max label */}
        <div className="flex justify-between items-center mb-1 px-1">
          <span className="text-xs text-gray-400">0</span>
          <span className="text-xs text-gray-400">{fmtMoney(max)}</span>
        </div>
        {/* Bar area */}
        <div className="relative flex items-end gap-1 h-48 border-b border-l border-gray-100">
          {/* Dashed top line */}
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200 pointer-events-none" />
          {bars.map((bar, i) => (
            <div key={i} className="group flex flex-col justify-end items-stretch flex-1 h-full relative">
              {/* Tooltip */}
              {bar.value > 0 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 pointer-events-none transition z-20">
                  <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                    {fmtMoney(bar.value)}
                  </div>
                </div>
              )}
              {/* Bar */}
              <div
                className="w-full bg-emerald-500 rounded-t hover:bg-emerald-600 transition-colors"
                style={{
                  height: `${(bar.value / max) * 100}%`,
                  minHeight: bar.value > 0 ? "3px" : "0",
                }}
              />
            </div>
          ))}
        </div>
        {/* X labels */}
        <div className="flex gap-1 mt-1.5">
          {bars.map((bar, i) => (
            <div key={i} className="flex-1 text-center overflow-hidden">
              <span className="text-xs text-gray-500 truncate block">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── DOW Bar Chart (busiest days of week) ──────────────────────────────────────
function DowChart({ data }: { data: { label: string; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div>
      <div className="relative flex items-end gap-1.5 h-28 border-b border-l border-gray-100">
        {data.map((d, i) => {
          const isMax = d.count > 0 && d.count === max;
          return (
            <div key={i} className="group flex flex-col justify-end items-center flex-1 h-full relative">
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 pointer-events-none transition z-20">
                <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                  {d.count} booking{d.count !== 1 ? "s" : ""}
                </div>
              </div>
              <div
                className={`w-full rounded-t transition-colors ${isMax ? "bg-emerald-700" : "bg-emerald-400"}`}
                style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? "3px" : "0" }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-xs text-gray-500">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Status Breakdown Bar ──────────────────────────────────────────────────────
interface StatusSegment { label: string; count: number; barCls: string; dotCls: string; }

function StatusBar({ items }: { items: StatusSegment[] }) {
  const total = items.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <p className="text-gray-400 text-sm text-center py-6">No bookings in this period.</p>;
  }
  return (
    <div className="space-y-5">
      {/* Segmented bar */}
      <div className="flex h-9 rounded-xl overflow-hidden">
        {items.filter(d => d.count > 0).map((d, i) => (
          <div
            key={i}
            className={`${d.barCls} transition-all`}
            style={{ width: `${(d.count / total) * 100}%` }}
            title={`${d.label}: ${d.count}`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {items.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className={`w-3 h-3 rounded-full shrink-0 ${d.dotCls}`} />
            <span className="text-gray-600">{d.label}</span>
            <span className="font-semibold text-gray-800">{d.count}</span>
            <span className="text-gray-400 text-xs">({total > 0 ? Math.round((d.count / total) * 100) : 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top Items List (services / staff) ─────────────────────────────────────────
interface TopItem { name: string; count: number; revenue: number; }

function TopList({ items, emptyMsg }: { items: TopItem[]; emptyMsg: string }) {
  if (items.length === 0) return <p className="text-gray-400 text-sm text-center py-6">{emptyMsg}</p>;
  const maxCount = items[0]?.count ?? 1;
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="relative rounded-lg overflow-hidden">
          {/* Background progress bar */}
          <div
            className="absolute inset-y-0 left-0 bg-emerald-50 rounded-lg"
            style={{ width: `${maxCount > 0 ? (item.count / maxCount) * 100 : 0}%` }}
          />
          <div className="relative flex items-center gap-3 px-3 py-2.5">
            <span className="text-sm font-bold text-gray-300 w-5 text-center shrink-0">{i + 1}</span>
            <span className="text-sm font-medium text-gray-800 flex-1 truncate">{item.name}</span>
            <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full shrink-0">
              {item.count} booking{item.count !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-gray-400 shrink-0 w-24 text-right hidden sm:block">
              {fmtMoney(item.revenue)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Hour Progress Bars ────────────────────────────────────────────────────────
function HourBars({ items }: { items: { label: string; count: number }[] }) {
  if (items.length === 0) return <p className="text-gray-400 text-sm">No booking data yet.</p>;
  const max = items[0]?.count ?? 1;
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-20 shrink-0">{item.label}</span>
          <div className="flex-1 h-4 bg-emerald-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${max > 0 ? (item.count / max) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-600 w-8 text-right shrink-0">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

// ── New vs Returning ──────────────────────────────────────────────────────────
function NewReturning({ newCount, retCount }: { newCount: number; retCount: number }) {
  const total = newCount + retCount;
  if (total === 0) {
    return <p className="text-gray-400 text-sm text-center py-6">No customer data for this period.</p>;
  }
  const newPct = Math.round((newCount / total) * 100);
  const retPct = 100 - newPct;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-indigo-50 rounded-xl p-5 text-center">
          <p className="text-4xl font-bold text-indigo-700">{newCount}</p>
          <p className="text-sm text-indigo-500 mt-1 font-medium">New</p>
          <p className="text-xs text-gray-400 mt-0.5">{newPct}% of customers</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-5 text-center">
          <p className="text-4xl font-bold text-emerald-700">{retCount}</p>
          <p className="text-sm text-emerald-600 mt-1 font-medium">Returning</p>
          <p className="text-xs text-gray-400 mt-0.5">{retPct}% of customers</p>
        </div>
      </div>
      {/* Split bar */}
      <div className="flex h-4 rounded-full overflow-hidden">
        {newCount > 0 && (
          <div className="bg-indigo-400 transition-all" style={{ width: `${newPct}%` }} />
        )}
        {retCount > 0 && (
          <div className="bg-emerald-500 flex-1" />
        )}
      </div>
    </div>
  );
}

// ── Main Analytics Page ───────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const router = useRouter();

  const [userId,    setUserId]    = useState<string | null>(null);
  const [currency,  setCurrency]  = useState<string>("JOD");
  const [range,     setRange]     = useState<RangeKey>("this-month");
  const [loading,   setLoading]   = useState(true);

  // Make the business currency available to module-level money formatters.
  ACTIVE_CURRENCY = currency;

  // Raw data state
  const [rb,        setRb]        = useState<RangeBooking[]>([]);
  const [allBk,     setAllBk]     = useState<HistoryBooking[]>([]);
  const [staff,     setStaff]     = useState<StaffMember[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Auth: get userId once on mount
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth/login"); return; }
      setUserId(session.user.id);
      const { data: profile } = await supabase.from("users").select("currency").eq("id", session.user.id).single();
      if (profile?.currency) setCurrency(profile.currency);
    }
    init();
  }, [router]);

  // Fetch all analytics data in parallel whenever range or userId changes
  const fetchData = useCallback(async (uid: string, r: RangeKey) => {
    setLoading(true);
    const { start, end } = getDateRange(r);

    const [rbRes, svcRes, abRes, staffRes, custRes] = await Promise.all([
      // Bookings in the date range (no embedded join — merged with services below)
      supabase
        .from("bookings")
        .select("id, booking_date, booking_time, status, booking_type, service_id, staff_id, customer_id")
        .eq("user_id", uid)
        .gte("booking_date", start)
        .lte("booking_date", end),

      // Services (for name + price lookup)
      supabase
        .from("services")
        .select("id, name, price")
        .eq("user_id", uid),

      // All-time bookings (lightweight — just customer_id + booking_date for new/returning calc)
      supabase
        .from("bookings")
        .select("customer_id, booking_date")
        .eq("user_id", uid),

      // Active staff members
      supabase
        .from("staff")
        .select("id, name")
        .eq("user_id", uid)
        .eq("is_active", true),

      // All customers (for new-customer metric)
      supabase
        .from("customers")
        .select("id, created_at")
        .eq("user_id", uid),
    ]);

    if (rbRes.error)    console.error("analytics: range bookings error:", rbRes.error.message);
    if (svcRes.error)   console.error("analytics: services error:",       svcRes.error.message);
    if (abRes.error)    console.error("analytics: all bookings error:",   abRes.error.message);
    if (staffRes.error) console.error("analytics: staff error:",          staffRes.error.message);
    if (custRes.error)  console.error("analytics: customers error:",      custRes.error.message);

    // Merge service data into bookings client-side (avoids fragile embedded join)
    const svcById: Record<string, ServiceRow> = {};
    ((svcRes.data ?? []) as ServiceRow[]).forEach(s => { svcById[s.id] = s; });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRb(((rbRes.data ?? []) as any[]).map(b => ({
      ...b,
      services: b.service_id ? (svcById[b.service_id] ?? null) : null,
    })) as RangeBooking[]);
    setAllBk((abRes.data ?? []) as HistoryBooking[]);
    setStaff(staffRes.data ?? []);
    setCustomers(custRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userId) fetchData(userId, range);
  }, [userId, range, fetchData]);

  // ── Derived analytics (computed from raw data) ─────────────────────────────
  const { start, end } = getDateRange(range);

  // Real bookings = exclude blocked slots
  const real = rb.filter(b => b.booking_type !== "blocked");

  // ── Stat card 1: total bookings ──────────────────────────────────────────
  const totalN     = real.length;
  const confirmedN = real.filter(b => b.status === "confirmed").length;
  const pendingN   = real.filter(b => b.status === "pending").length;
  const cancelledN = real.filter(b => b.status === "cancelled").length;
  const completedN = real.filter(b => b.status === "completed").length;

  // ── Stat card 2: completed revenue ──────────────────────────────────────
  const completedRev = real
    .filter(b => b.status === "completed")
    .reduce((s, b) => s + svcPrice(b.services), 0);

  // Build all-time booking history per customer (for new/returning logic)
  const histByCustomer: Record<string, string[]> = {};
  allBk.forEach(b => {
    if (!b.customer_id) return;
    if (!histByCustomer[b.customer_id]) histByCustomer[b.customer_id] = [];
    histByCustomer[b.customer_id].push(b.booking_date);
  });
  const rangeCustomerIds = new Set(real.filter(b => b.customer_id).map(b => b.customer_id!));

  // Stat card 3: new customers = customers whose FIRST booking falls in the
  // selected range (recalculates when the range changes). Returning = had a
  // booking before the range started.
  let newCustN = 0, returningN = 0;
  rangeCustomerIds.forEach(cid => {
    if ((histByCustomer[cid] ?? []).some(d => d < start)) returningN++;
    else newCustN++;
  });

  // ── Stat card 4: cancellation rate ──────────────────────────────────────
  const cancelRate = totalN > 0 ? ((cancelledN / totalN) * 100).toFixed(1) : "0.0";

  // ── Section 3: revenue over time ─────────────────────────────────────────
  const completedBk = real.filter(b => b.status === "completed");

  function buildRevBars(): { label: string; value: number }[] {
    if (range === "this-month" || range === "last-month") {
      // Daily
      const s = new Date(start + "T00:00:00");
      const e = new Date(end   + "T00:00:00");
      const out: { label: string; value: number }[] = [];
      const cur = new Date(s);
      while (cur <= e) {
        const ds  = localDate(cur);
        const rev = completedBk.filter(b => b.booking_date === ds).reduce((acc, b) => acc + svcPrice(b.services), 0);
        out.push({ label: String(cur.getDate()), value: rev });
        cur.setDate(cur.getDate() + 1);
      }
      return out;
    } else {
      // Monthly
      const s = new Date(start + "T00:00:00");
      const e = new Date(end   + "T00:00:00");
      const out: { label: string; value: number }[] = [];
      let y = s.getFullYear(), mo = s.getMonth();
      while (new Date(y, mo, 1) <= e) {
        const prefix = `${y}-${String(mo + 1).padStart(2, "0")}`;
        const rev = completedBk.filter(b => b.booking_date.startsWith(prefix)).reduce((acc, b) => acc + svcPrice(b.services), 0);
        out.push({ label: MONTH_NAMES[mo], value: rev });
        mo++; if (mo > 11) { mo = 0; y++; }
      }
      return out;
    }
  }
  const revBars = buildRevBars();

  // ── Section 4: status breakdown ──────────────────────────────────────────
  const statusItems: StatusSegment[] = [
    { label: "Confirmed", count: confirmedN, barCls: "bg-emerald-500", dotCls: "bg-emerald-500" },
    { label: "Pending",   count: pendingN,   barCls: "bg-amber-400",   dotCls: "bg-amber-400"   },
    { label: "Completed", count: completedN, barCls: "bg-emerald-800", dotCls: "bg-emerald-800" },
    { label: "Cancelled", count: cancelledN, barCls: "bg-red-400",     dotCls: "bg-red-400"     },
  ];

  // ── Section 5: top services ───────────────────────────────────────────────
  const svcAgg: Record<string, TopItem> = {};
  real.forEach(b => {
    const key  = b.service_id ?? "__unknown__";
    const name = svcName(b.services);
    const rev  = b.status === "completed" ? svcPrice(b.services) : 0;
    if (!svcAgg[key]) svcAgg[key] = { name, count: 0, revenue: 0 };
    svcAgg[key].count++;
    svcAgg[key].revenue += rev;
  });
  const topServices = Object.values(svcAgg).sort((a, b) => b.count - a.count).slice(0, 5);

  // ── Section 6: top staff ─────────────────────────────────────────────────
  const hasStaff = staff.length > 0;
  const staffAgg: Record<string, TopItem> = {};
  if (hasStaff) {
    real.filter(b => b.staff_id).forEach(b => {
      const sid   = b.staff_id!;
      const sName = staff.find(s => s.id === sid)?.name ?? "Unknown";
      const rev   = b.status === "completed" ? svcPrice(b.services) : 0;
      if (!staffAgg[sid]) staffAgg[sid] = { name: sName, count: 0, revenue: 0 };
      staffAgg[sid].count++;
      staffAgg[sid].revenue += rev;
    });
  }
  const topStaff = Object.values(staffAgg).sort((a, b) => b.count - a.count).slice(0, 5);

  // ── Section 7A: busiest days of week ─────────────────────────────────────
  const dowCounts = Array(7).fill(0) as number[];
  real.forEach(b => {
    const dow = new Date(b.booking_date + "T00:00:00").getDay();
    const idx = DOW_JS.indexOf(dow);
    if (idx >= 0) dowCounts[idx]++;
  });
  const dowData = DOW_LABELS.map((label, i) => ({ label, count: dowCounts[i] }));

  // ── Section 7B: busiest time slots ───────────────────────────────────────
  const hourMap: Record<number, number> = {};
  real.forEach(b => {
    const h = parseInt(b.booking_time.split(":")[0], 10);
    if (!isNaN(h)) hourMap[h] = (hourMap[h] ?? 0) + 1;
  });
  const topHours = Object.entries(hourMap)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 5)
    .map(([h, count]) => ({ label: fmtHour(Number(h)), count: Number(count) }));

  // ── Section 8: new vs returning ───────────────────────────────────────────
  const hasCustomerData = customers.length > 0;
  let newCountSec8 = 0, retCountSec8 = 0;
  rangeCustomerIds.forEach(cid => {
    const dates = histByCustomer[cid] ?? [];
    if (dates.some(d => d < start)) retCountSec8++;
    else newCountSec8++;
  });

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex-1 p-4 sm:p-8 min-w-0">
        <Sk className="h-8 w-40 mb-2" />
        <Sk className="h-4 w-64 mb-8" />
        <div className="flex flex-wrap gap-2 mb-8">
          {[1,2,3,4].map(i => <Sk key={i} className="h-9 w-28" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1,2,3,4].map(i => <Sk key={i} className="h-28" />)}
        </div>
        <div className="space-y-6">
          <Sk className="h-72" />
          <Sk className="h-32" />
          <Sk className="h-48" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Sk className="h-48" />
            <Sk className="h-48" />
          </div>
        </div>
      </main>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main className="flex-1 p-4 sm:p-8 min-w-0">

      {/* ── Header + date range toggle ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Analytics</h2>
          <p className="text-gray-500 text-sm mt-1">Understanding your business performance</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
                range === r.key
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Section 2: Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Bookings"
          value={String(totalN)}
          sub={`${confirmedN} confirmed, ${pendingN} pending, ${cancelledN} cancelled`}
        />
        <StatCard
          title="Completed Revenue"
          value={fmtMoney(completedRev)}
          sub={`From ${completedN} completed appointment${completedN !== 1 ? "s" : ""}`}
        />
        <StatCard
          title="New Customers"
          value={String(newCustN)}
          sub={`${returningN} returning`}
        />
        <StatCard
          title="Cancellation Rate"
          value={`${cancelRate}%`}
          sub={`${cancelledN} cancellation${cancelledN !== 1 ? "s" : ""} out of ${totalN} total`}
        />
      </div>

      <div className="space-y-6">

        {/* ── Section 3: Revenue over time ── */}
        <Section title="Revenue Over Time">
          <BarChart bars={revBars} />
        </Section>

        {/* ── Section 4: Status breakdown ── */}
        <Section title="Booking Status Breakdown">
          <StatusBar items={statusItems} />
        </Section>

        {/* ── Section 5: Top services ── */}
        <Section title="Top Services">
          <TopList items={topServices} emptyMsg="No bookings yet in this period." />
        </Section>

        {/* ── Section 6: Team performance (only if staff exist) ── */}
        {hasStaff && (
          <Section title="Team Performance">
            <TopList items={topStaff} emptyMsg="No assigned bookings in this period." />
          </Section>
        )}

        {/* ── Section 7: Busiest days and times ── */}
        <Section title="When You're Busiest">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* 7A: Busiest days of week */}
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-4">Busiest Days of the Week</p>
              {real.length === 0
                ? <p className="text-gray-400 text-sm">No booking data yet.</p>
                : <DowChart data={dowData} />
              }
            </div>
            {/* 7B: Busiest time slots */}
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-4">Busiest Time Slots</p>
              {topHours.length === 0
                ? <p className="text-gray-400 text-sm">No booking data yet.</p>
                : <HourBars items={topHours} />
              }
            </div>
          </div>
        </Section>

        {/* ── Section 8: New vs Returning (only if customer data exists) ── */}
        {hasCustomerData && (
          <Section title="New vs Returning Customers">
            <NewReturning newCount={newCountSec8} retCount={retCountSec8} />
          </Section>
        )}

      </div>
    </main>
  );
}
