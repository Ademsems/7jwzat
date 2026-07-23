"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { InfoTooltip } from "@/components/InfoTooltip";
import { formatPrice } from "@/lib/currency";
import { formatTimeLocale } from "@/lib/i18n/format";
import {
  type RangeKey,
  type DateRange,
  computeRange,
  localDateStr,
  parseLocalDate,
  daysBetweenLocal,
} from "@/lib/analyticsRange";

// ── API payload types (mirrors app/api/analytics/route.ts) ─────────────────
interface ApiBooking {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  booking_type: string | null;
  service_id: string | null;
  staff_id: string | null;
  customer_id: string | null;
  group_session_id: string | null;
  created_at: string;
}
interface ApiService { id: string; name: string; price: number | null; is_group_service: boolean; }
interface ApiCustomer { id: string; name: string; created_at: string; }
interface ApiHistoryBooking { customer_id: string | null; booking_date: string; booking_type: string | null; }

interface ApiResponse {
  currency: string;
  range: DateRange;
  bookings: ApiBooking[];
  services: ApiService[];
  staff: { id: string; name: string; is_active: boolean }[];
  customers: ApiCustomer[];
  history: ApiHistoryBooking[];
}

const RANGES: { key: RangeKey; labelKey: string }[] = [
  { key: "this-week",  labelKey: "an2.thisWeek" },
  { key: "this-month", labelKey: "an.thisMonth" },
  { key: "last-30",    labelKey: "an2.last30" },
  { key: "last-90",    labelKey: "an2.last90" },
  { key: "custom",     labelKey: "an2.custom" },
];

function inRange(d: string, lo: string, hi: string): boolean {
  return d >= lo && d <= hi;
}

// ── Pure computations (i18n-free — components below attach labels) ─────────
function priceOf(b: ApiBooking, svcById: Record<string, ApiService>): number | null {
  if (!b.service_id) return null;
  const svc = svcById[b.service_id];
  if (!svc) return null;
  return svc.price;
}

interface RevenueStats { total: number; pending: number; lost: number; avgValue: number; excludedCount: number; }
function computeRevenue(bks: ApiBooking[], svcById: Record<string, ApiService>): RevenueStats {
  let total = 0, pending = 0, lost = 0, excludedCount = 0, completedPriced = 0;
  bks.forEach(b => {
    if (b.booking_type === "blocked") return;
    const price = priceOf(b, svcById);
    if (price === null) {
      // "Price on request" services have no price — exclude from revenue math
      // rather than silently treating them as zero.
      if (b.status === "completed" || b.status === "confirmed" || b.status === "cancelled") excludedCount++;
      return;
    }
    if (b.status === "completed")      { total   += price; completedPriced++; }
    else if (b.status === "confirmed") { pending += price; }
    else if (b.status === "cancelled") { lost    += price; }
  });
  return { total, pending, lost, avgValue: completedPriced > 0 ? total / completedPriced : 0, excludedCount };
}

interface BookingStats {
  total: number; blocked: number;
  pending: number; confirmed: number; completed: number; cancelled: number;
  cancellationRate: number | null; completionRate: number | null;
  online: number; manual: number;
  avgLeadDays: number | null;
  individual: number; group: number;
}
function computeBookingStats(periodBookings: ApiBooking[]): BookingStats {
  const real    = periodBookings.filter(b => b.booking_type !== "blocked");
  const blocked = periodBookings.length - real.length;

  const pending   = real.filter(b => b.status === "pending").length;
  const confirmed = real.filter(b => b.status === "confirmed").length;
  const completed = real.filter(b => b.status === "completed").length;
  const cancelled = real.filter(b => b.status === "cancelled").length;

  const online = periodBookings.filter(b => b.booking_type === "customer").length;
  const manual = periodBookings.filter(b => b.booking_type === "manual").length;

  const leadDays: number[] = [];
  real.forEach(b => {
    if (!b.created_at) return;
    const created = new Date(b.created_at);
    if (isNaN(created.getTime())) return;
    const createdLocalDay = new Date(created.getFullYear(), created.getMonth(), created.getDate());
    const apptDay = parseLocalDate(b.booking_date);
    leadDays.push(Math.max(0, daysBetweenLocal(createdLocalDay, apptDay)));
  });

  const group = real.filter(b => !!b.group_session_id).length;

  return {
    total: real.length,
    blocked,
    pending, confirmed, completed, cancelled,
    cancellationRate: real.length > 0 ? (cancelled / real.length) * 100 : null,
    completionRate:   real.length > 0 ? (completed / real.length) * 100 : null,
    online, manual,
    avgLeadDays: leadDays.length > 0 ? leadDays.reduce((a, b) => a + b, 0) / leadDays.length : null,
    individual: real.length - group,
    group,
  };
}

function buildHistoryMap(history: ApiHistoryBooking[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  history.forEach(b => {
    // Blocked slots never carry a customer_id, but guard explicitly anyway —
    // they must never pollute customer statistics.
    if (!b.customer_id || b.booking_type === "blocked") return;
    (map[b.customer_id] ??= []).push(b.booking_date);
  });
  return map;
}

function uniqueCustomerIds(periodBookings: ApiBooking[]): string[] {
  const ids = new Set<string>();
  periodBookings.forEach(b => {
    if (b.booking_type !== "blocked" && b.customer_id) ids.add(b.customer_id);
  });
  return Array.from(ids);
}

function bookingHour(b: ApiBooking): number | null {
  const h = parseInt(b.booking_time.split(":")[0], 10);
  return isNaN(h) ? null : h;
}

/** Locale-correct short weekday abbreviation for a Date.getDay() index (0=Sun..6=Sat). */
function dowLabel(dow: number, locale: "ar" | "en"): string {
  const today = new Date();
  const sunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
  const d = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + dow);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-GB", { weekday: "short" }).format(d);
}

function hourLabel(hour: number, locale: "ar" | "en"): string {
  return formatTimeLocale(`${String(hour).padStart(2, "0")}:00`, locale);
}

// ── Small presentational helpers (pure CSS, no charting library) ───────────
function Sk({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded-xl ${className ?? ""}`} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="font-semibold text-gray-700 text-base mb-5">{title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-gray-400 text-sm text-center py-8">{text}</p>;
}

function ComparisonBadge({ cur, prev, vsLabel, newLabel }: { cur: number; prev: number; vsLabel: string; newLabel: string }) {
  if (prev === 0 && cur === 0) return null;
  if (prev === 0) return <span className="text-xs font-semibold text-indigo-500 shrink-0">{newLabel}</span>;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={`text-xs font-semibold shrink-0 ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "+" : ""}{pct.toFixed(0)}% {vsLabel}
    </span>
  );
}

function MetricTile({ title, value, sub, cmp }: { title: string; value: string; sub?: string; cmp?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border-t-4 border-emerald-500 p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      <p className="text-2xl sm:text-3xl font-bold text-gray-900 leading-none mb-2">{value}</p>
      <div className="flex items-center gap-2 flex-wrap">
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
        {cmp}
      </div>
    </div>
  );
}

interface Segment { label: string; count: number; barCls: string; dotCls: string; }
function SegmentBar({ items }: { items: Segment[] }) {
  const total = items.reduce((s, d) => s + d.count, 0);
  if (total === 0) return null;
  return (
    <div className="space-y-4">
      <div className="flex h-8 rounded-lg overflow-hidden">
        {items.filter(d => d.count > 0).map((d, i) => (
          <div key={i} className={`${d.barCls} transition-all`} style={{ width: `${(d.count / total) * 100}%` }} title={`${d.label}: ${d.count}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {items.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${d.dotCls}`} />
            <span className="text-gray-600">{d.label}</span>
            <span className="font-semibold text-gray-800">{d.count}</span>
            <span className="text-gray-400 text-xs">({Math.round((d.count / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface RankedItem { id: string; name: string; primary: string; }
function RankedList({ items, emptyMsg }: { items: RankedItem[]; emptyMsg: string }) {
  if (items.length === 0) return <EmptyState text={emptyMsg} />;
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50">
          <span className="text-sm font-bold text-gray-300 w-5 text-center shrink-0">{i + 1}</span>
          <span className="text-sm font-medium text-gray-800 flex-1 truncate">{item.name}</span>
          <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full shrink-0">{item.primary}</span>
        </div>
      ))}
    </div>
  );
}

interface StatRowData { id: string; name: string; stats: { label: string; value: string }[]; }
function StatRowList({ rows, emptyMsg }: { rows: StatRowData[]; emptyMsg: string }) {
  if (rows.length === 0) return <EmptyState text={emptyMsg} />;
  return (
    <div className="space-y-2">
      {rows.map(r => (
        <div key={r.id} className="border border-gray-100 rounded-lg px-3 py-2.5">
          <p className="text-sm font-medium text-gray-800 mb-1.5 truncate">{r.name}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {r.stats.map((s, i) => (
              <span key={i} className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">{s.value}</span> {s.label}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Daily booking-volume bars (pure CSS), horizontally scrollable for long ranges. */
function CountBarChart({ bars }: { bars: { label: string; value: number }[] }) {
  const max = Math.max(...bars.map(b => b.value), 1);
  const allZero = bars.every(b => b.value === 0);
  if (allZero) return null;
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${Math.max(bars.length * 20, 300)}px` }}>
        <div className="relative flex items-end gap-1 h-32 border-b border-l border-gray-100">
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200 pointer-events-none" />
          {bars.map((bar, i) => (
            <div key={i} className="group flex flex-col justify-end items-stretch flex-1 h-full relative">
              {bar.value > 0 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 pointer-events-none transition z-20">
                  <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">{bar.value}</div>
                </div>
              )}
              <div
                className="w-full bg-emerald-500 rounded-t hover:bg-emerald-600 transition-colors"
                style={{ height: `${(bar.value / max) * 100}%`, minHeight: bar.value > 0 ? "3px" : "0" }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-1.5">
          {bars.map((bar, i) => (
            <div key={i} className="flex-1 text-center overflow-hidden">
              <span className="text-[10px] text-gray-400 truncate block">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function heatCellColor(count: number, max: number): string {
  if (count === 0) return "#f3f4f6"; // gray-100
  const intensity = 0.18 + (count / max) * 0.72;
  return `rgba(16,185,129,${intensity.toFixed(2)})`; // emerald-500 scale
}

/** 7-row (Sun–Sat) × N-column (observed hour range) booking density heatmap. */
function Heatmap({ grid, hourCols, dowLabels, hourLabels }: {
  grid: number[][]; hourCols: number[]; dowLabels: string[]; hourLabels: string[];
}) {
  const max = Math.max(1, ...grid.flat());
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: `${Math.max(hourCols.length * 34 + 48, 320)}px` }}>
        <div className="flex gap-0.5 mb-1 ps-12">
          {hourCols.map((h, i) => (
            <div key={h} className="flex-1 text-center text-[9px] text-gray-400 truncate">{i % 2 === 0 ? hourLabels[i] : ""}</div>
          ))}
        </div>
        {grid.map((row, dow) => (
          <div key={dow} className="flex items-center gap-0.5 mb-0.5">
            <div className="w-12 shrink-0 text-[11px] text-gray-500 text-end pe-1">{dowLabels[dow]}</div>
            {row.map((count, i) => (
              <div
                key={i}
                className="flex-1 aspect-square rounded-sm min-w-[14px]"
                style={{ backgroundColor: heatCellColor(count, max) }}
                title={`${dowLabels[dow]} ${hourLabels[i]}: ${count}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Analytics Page ──────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();

  const [userId, setUserId] = useState<string | null>(null);
  const [rangeKey, setRangeKey] = useState<RangeKey>("this-month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedCustom, setAppliedCustom] = useState<{ start: string; end: string } | null>(null);
  const [rangeError, setRangeError] = useState<string | null>(null);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Auth: redirect if not logged in (mirrors every other dashboard page).
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth/login"); return; }
      setUserId(session.user.id);
    }
    init();
  }, [router]);

  const fetchData = useCallback(async (range: DateRange) => {
    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams({
        start: range.start, end: range.end,
        prevStart: range.prevStart, prevEnd: range.prevEnd,
      });
      const res = await fetch(`/api/analytics?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch (e) {
      console.error("analytics: fetch failed:", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    if (rangeKey === "custom") {
      if (!appliedCustom) return; // wait for the user to press Apply
      fetchData(computeRange("custom", appliedCustom.start, appliedCustom.end));
    } else {
      fetchData(computeRange(rangeKey));
    }
  }, [userId, rangeKey, appliedCustom, fetchData]);

  function selectRange(key: RangeKey) {
    if (key === "custom") {
      if (!customStart || !customEnd) {
        const seed = computeRange(rangeKey === "custom" ? "last-30" : rangeKey);
        setCustomStart(seed.start);
        setCustomEnd(seed.end);
      }
      setRangeError(null);
      setRangeKey("custom");
    } else {
      setRangeError(null);
      setAppliedCustom(null);
      setRangeKey(key);
    }
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) return;
    if (parseLocalDate(customStart) > parseLocalDate(customEnd)) {
      setRangeError(t("an2.invalidRange"));
      return;
    }
    setRangeError(null);
    setAppliedCustom({ start: customStart, end: customEnd });
  }

  // ── Loading / error / skeleton states ───────────────────────────────────
  if (loading && !data) {
    return (
      <main className="flex-1 p-4 sm:p-8 min-w-0">
        <Sk className="h-8 w-40 mb-2" />
        <Sk className="h-4 w-64 mb-8" />
        <div className="flex flex-wrap gap-2 mb-8">
          {[1, 2, 3, 4, 5].map(i => <Sk key={i} className="h-9 w-28" />)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => <Sk key={i} className="h-28" />)}
        </div>
        <div className="space-y-6">
          <Sk className="h-48" />
          <Sk className="h-48" />
          <Sk className="h-48" />
        </div>
      </main>
    );
  }

  if (loadError && !data) {
    return (
      <main className="flex-1 p-4 sm:p-8 min-w-0">
        <p className="text-red-500 text-sm">{t("an2.loadError")}</p>
      </main>
    );
  }

  if (!data) return null;

  // ── Derived analytics (computed from the raw API payload) ───────────────
  const { currency, range, bookings, services, staff, customers, history } = data;

  const svcById: Record<string, ApiService> = {};
  services.forEach(s => { svcById[s.id] = s; });

  const curBookings  = bookings.filter(b => inRange(b.booking_date, range.start, range.end));
  const prevBookings = bookings.filter(b => inRange(b.booking_date, range.prevStart, range.prevEnd));

  const curRevenue  = computeRevenue(curBookings, svcById);
  const prevRevenue = computeRevenue(prevBookings, svcById);

  const curStats  = computeBookingStats(curBookings);
  const prevStats = computeBookingStats(prevBookings);

  const histByCustomer = buildHistoryMap(history);
  const curCustIds  = uniqueCustomerIds(curBookings);
  const prevCustIds = uniqueCustomerIds(prevBookings);

  let newCount = 0, returningCount = 0, repeatCount = 0;
  curCustIds.forEach(cid => {
    const hist = histByCustomer[cid] ?? [];
    const firstEver = hist.length > 0 ? hist.reduce((a, b) => (a < b ? a : b)) : null;
    if (firstEver && firstEver < range.start) returningCount++; else newCount++;
    if (hist.length > 1) repeatCount++;
  });
  const repeatRate = curCustIds.length > 0 ? (repeatCount / curCustIds.length) * 100 : null;
  const avgBookingsPerCustomer = curCustIds.length > 0
    ? curBookings.filter(b => b.booking_type !== "blocked" && b.customer_id).length / curCustIds.length
    : 0;

  const cutoff60 = (() => { const d = new Date(); d.setDate(d.getDate() - 60); return localDateStr(d); })();
  let lapsedCount = 0;
  Object.values(histByCustomer).forEach(dates => {
    const last = dates.reduce((a, b) => (a > b ? a : b));
    if (last < cutoff60) lapsedCount++;
  });

  const nameById: Record<string, string> = {};
  customers.forEach(c => { nameById[c.id] = c.name; });

  const visitAgg: Record<string, number> = {};
  const spendAgg: Record<string, number> = {};
  curBookings.forEach(b => {
    if (b.booking_type === "blocked" || !b.customer_id) return;
    visitAgg[b.customer_id] = (visitAgg[b.customer_id] ?? 0) + 1;
    if (b.status === "completed") {
      const price = priceOf(b, svcById);
      if (price !== null) spendAgg[b.customer_id] = (spendAgg[b.customer_id] ?? 0) + price;
    }
  });
  const bookingWord = (n: number) => (n === 1 ? t("an.bookingCount") : t("an.bookingsCount"));
  const topByVisits: RankedItem[] = Object.entries(visitAgg)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([id, count]) => ({ id, name: nameById[id] ?? "—", primary: `${count} ${bookingWord(count)}` }));
  const topBySpend: RankedItem[] = Object.entries(spendAgg)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([id, spend]) => ({ id, name: nameById[id] ?? "—", primary: formatPrice(spend, currency) }));

  const statusSegments: Segment[] = [
    { label: t("an2.statusPending"),   count: curStats.pending,   barCls: "bg-amber-400",   dotCls: "bg-amber-400"   },
    { label: t("an2.statusConfirmed"), count: curStats.confirmed, barCls: "bg-emerald-500",  dotCls: "bg-emerald-500" },
    { label: t("an2.statusCompleted"), count: curStats.completed, barCls: "bg-emerald-800",  dotCls: "bg-emerald-800" },
    { label: t("an2.statusCancelled"), count: curStats.cancelled, barCls: "bg-red-400",      dotCls: "bg-red-400"     },
    { label: t("an2.statusBlocked"),   count: curStats.blocked,   barCls: "bg-gray-400",     dotCls: "bg-gray-400"    },
  ];

  const sourceSegments: Segment[] = [
    { label: t("an2.onlineBookings"), count: curStats.online,  barCls: "bg-emerald-500", dotCls: "bg-emerald-500" },
    { label: t("an2.manualBookings"), count: curStats.manual,  barCls: "bg-indigo-400",  dotCls: "bg-indigo-400"  },
    { label: t("an2.blockedSlots"),   count: curStats.blocked, barCls: "bg-gray-400",    dotCls: "bg-gray-400"    },
  ];

  const hasAnyRealBooking = curStats.total > 0;
  const hasAnyCustomerActivity = curCustIds.length > 0;

  // Shared "real" (non-blocked) current-period bookings for the sections below —
  // blocked slots reference an arbitrary service/staff FK and must never be
  // counted as if they were customer traffic.
  const curReal = curBookings.filter(b => b.booking_type !== "blocked");

  // ── Days & Timings ───────────────────────────────────────────────────────
  const dowCounts = Array(7).fill(0) as number[];
  const hourCounts: Record<number, number> = {};
  curReal.forEach(b => {
    dowCounts[parseLocalDate(b.booking_date).getDay()]++;
    const h = bookingHour(b);
    if (h !== null) hourCounts[h] = (hourCounts[h] ?? 0) + 1;
  });

  const dowBars = dowCounts.map((count, dow) => ({ label: dowLabel(dow, locale), value: count }));

  const topHours: RankedItem[] = Object.entries(hourCounts)
    .sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 8)
    .map(([h, count]) => ({ id: h, name: hourLabel(Number(h), locale), primary: `${count} ${bookingWord(count)}` }));

  const hoursPresent = Object.keys(hourCounts).map(Number).sort((a, b) => a - b);
  const heatMinHour = hoursPresent.length > 0 ? hoursPresent[0] : 9;
  const heatMaxHour = hoursPresent.length > 0 ? hoursPresent[hoursPresent.length - 1] : 17;
  const heatHourCols: number[] = [];
  for (let h = heatMinHour; h <= heatMaxHour; h++) heatHourCols.push(h);
  const heatGrid: number[][] = Array.from({ length: 7 }, () => Array(heatHourCols.length).fill(0));
  curReal.forEach(b => {
    const dow = parseLocalDate(b.booking_date).getDay();
    const h = bookingHour(b);
    if (h === null) return;
    const col = heatHourCols.indexOf(h);
    if (col >= 0) heatGrid[dow][col]++;
  });
  const heatDowLabels = Array.from({ length: 7 }, (_, i) => dowLabel(i, locale));
  const heatHourLabels = heatHourCols.map(h => hourLabel(h, locale));

  let quietestDow = 0;
  dowCounts.forEach((c, i) => { if (c < dowCounts[quietestDow]) quietestDow = i; });
  let quietestHour: number | null = null;
  heatHourCols.forEach(h => {
    const c = hourCounts[h] ?? 0;
    if (quietestHour === null || c < (hourCounts[quietestHour] ?? 0)) quietestHour = h;
  });

  function buildVolumeBars(): { label: string; value: number }[] {
    const out: { label: string; value: number }[] = [];
    const s = parseLocalDate(range.start);
    const e = parseLocalDate(range.end);
    const cur = new Date(s);
    while (cur <= e) {
      const ds = localDateStr(cur);
      out.push({ label: String(cur.getDate()), value: curReal.filter(b => b.booking_date === ds).length });
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }
  const volumeBars = buildVolumeBars();

  // ── Services ──────────────────────────────────────────────────────────────
  interface SvcAgg { count: number; revenue: number; completedPriced: number; visits: Record<string, number>; }
  const svcAgg: Record<string, SvcAgg> = {};
  curReal.forEach(b => {
    if (!b.service_id) return;
    const agg = (svcAgg[b.service_id] ??= { count: 0, revenue: 0, completedPriced: 0, visits: {} });
    agg.count++;
    if (b.status === "completed") {
      const price = priceOf(b, svcById);
      if (price !== null) { agg.revenue += price; agg.completedPriced++; }
    }
    if (b.customer_id) agg.visits[b.customer_id] = (agg.visits[b.customer_id] ?? 0) + 1;
  });

  const serviceRows: StatRowData[] = services
    .map(s => {
      const agg = svcAgg[s.id];
      const count = agg?.count ?? 0;
      const revenue = agg?.revenue ?? 0;
      const avgPrice = agg && agg.completedPriced > 0 ? agg.revenue / agg.completedPriced : null;
      const visitCounts = agg ? Object.values(agg.visits) : [];
      const repeatCustomers = visitCounts.filter(v => v > 1).length;
      const repeatRate = visitCounts.length > 0 ? (repeatCustomers / visitCounts.length) * 100 : null;
      return {
        id: s.id, name: s.name, count,
        stats: [
          { label: t("an2.bookingsLabel"), value: String(count) },
          { label: t("an2.revenueLabel"), value: formatPrice(revenue, currency) },
          { label: t("an2.avgPrice"), value: avgPrice !== null ? formatPrice(avgPrice, currency) : "—" },
          { label: t("an2.repeatRate"), value: repeatRate !== null ? `${repeatRate.toFixed(0)}%` : "—" },
        ],
      };
    })
    .sort((a, b) => b.count - a.count)
    .map(({ id, name, stats }) => ({ id, name, stats })); // drop the sort-only `count` field
  const zeroBookingServiceNames = services.filter(s => !svcAgg[s.id] || svcAgg[s.id].count === 0).map(s => s.name);

  // ── Staff ─────────────────────────────────────────────────────────────────
  interface StaffAgg { count: number; revenue: number; cancelled: number; hourCounts: Record<number, number>; }
  const staffAgg: Record<string, StaffAgg> = {};
  let unassignedCount = 0, unassignedRevenue = 0, unassignedCancelled = 0;
  const unassignedHourCounts: Record<number, number> = {};

  curReal.forEach(b => {
    const price = b.status === "completed" ? priceOf(b, svcById) : null;
    const h = bookingHour(b);
    if (b.staff_id) {
      const agg = (staffAgg[b.staff_id] ??= { count: 0, revenue: 0, cancelled: 0, hourCounts: {} });
      agg.count++;
      if (b.status === "cancelled") agg.cancelled++;
      if (price !== null) agg.revenue += price;
      if (h !== null) agg.hourCounts[h] = (agg.hourCounts[h] ?? 0) + 1;
    } else {
      unassignedCount++;
      if (b.status === "cancelled") unassignedCancelled++;
      if (price !== null) unassignedRevenue += price;
      if (h !== null) unassignedHourCounts[h] = (unassignedHourCounts[h] ?? 0) + 1;
    }
  });

  function peakHourLabel(counts: Record<number, number>): string {
    const entries = Object.entries(counts);
    if (entries.length === 0) return "—";
    const [h] = entries.sort((a, b) => b[1] - a[1])[0];
    return hourLabel(Number(h), locale);
  }

  const staffRows: StatRowData[] = staff
    .map(s => {
      const agg = staffAgg[s.id];
      const count = agg?.count ?? 0;
      const cancellationRate = agg && agg.count > 0 ? (agg.cancelled / agg.count) * 100 : null;
      return {
        id: s.id, name: s.name, count,
        stats: [
          { label: t("an2.bookingsLabel"), value: String(count) },
          { label: t("an2.revenueLabel"), value: formatPrice(agg?.revenue ?? 0, currency) },
          { label: t("an2.cancelRateLabel"), value: cancellationRate !== null ? `${cancellationRate.toFixed(0)}%` : "—" },
          { label: t("an2.peakHourLabel"), value: agg ? peakHourLabel(agg.hourCounts) : "—" },
        ],
      };
    })
    .sort((a, b) => b.count - a.count)
    .map(({ id, name, stats }) => ({ id, name, stats }));

  const unassignedRow: StatRowData = {
    id: "__unassigned__",
    name: t("an2.noStaffAssigned"),
    stats: [
      { label: t("an2.bookingsLabel"), value: String(unassignedCount) },
      { label: t("an2.revenueLabel"), value: formatPrice(unassignedRevenue, currency) },
      { label: t("an2.cancelRateLabel"), value: unassignedCount > 0 ? `${((unassignedCancelled / unassignedCount) * 100).toFixed(0)}%` : "—" },
      { label: t("an2.peakHourLabel"), value: peakHourLabel(unassignedHourCounts) },
    ],
  };
  // Always appended — unassigned bookings must never silently disappear from totals.
  const staffRowsWithUnassigned = [...staffRows, unassignedRow];

  const onlineBookings = curReal.filter(b => b.booking_type === "customer");
  const staffRequestedCount = onlineBookings.filter(b => b.staff_id).length;
  const staffNoPreferenceCount = onlineBookings.length - staffRequestedCount;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="flex-1 p-4 sm:p-8 min-w-0">

      {/* ── Header ── */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 inline-flex items-center gap-2">{t("an.title")} <InfoTooltip textKey="tip.page.analytics" /></h2>
        <p className="text-gray-500 text-sm mt-1">{t("an.subtitle")}</p>
      </div>

      {/* ── Global date-range filter ── */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => selectRange(r.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition border ${
                rangeKey === r.key
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-700"
              }`}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>
        {rangeKey === "custom" && (
          <div className="mt-3 flex flex-wrap items-end gap-3 bg-white border border-gray-200 rounded-lg p-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t("an2.startDate")}</label>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t("an2.endDate")}</label>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={applyCustomRange}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
            >
              {t("an2.apply")}
            </button>
            {rangeError && <p className="text-xs text-red-500 w-full">{rangeError}</p>}
          </div>
        )}
      </div>

      <div className="space-y-6">

        {/* ── Revenue Overview ── */}
        <Section title={t("an2.revenueTitle")}>
          {!hasAnyRealBooking ? (
            <EmptyState text={t("an2.notEnoughData")} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricTile
                  title={t("an2.totalRevenue")}
                  value={formatPrice(curRevenue.total, currency)}
                  sub={t("an2.fromCompletedBookings")}
                  cmp={<ComparisonBadge cur={curRevenue.total} prev={prevRevenue.total} vsLabel={t("an2.vsPrevious")} newLabel={t("an2.newBadge")} />}
                />
                <MetricTile
                  title={t("an2.pendingRevenue")}
                  value={formatPrice(curRevenue.pending, currency)}
                  sub={t("an2.pendingRevenueSub")}
                />
                <MetricTile
                  title={t("an2.lostRevenue")}
                  value={formatPrice(curRevenue.lost, currency)}
                  sub={t("an2.lostRevenueSub")}
                />
                <MetricTile
                  title={t("an2.avgBookingValue")}
                  value={formatPrice(curRevenue.avgValue, currency)}
                  sub={t("an2.avgBookingValueSub")}
                />
              </div>
              {curRevenue.excludedCount > 0 && (
                <p className="text-xs text-gray-400 mt-4">
                  {curRevenue.excludedCount} {bookingWord(curRevenue.excludedCount)} {t("an2.excludedPriceOnRequest")}
                </p>
              )}
            </>
          )}
        </Section>

        {/* ── Bookings ── */}
        <Section title={t("an2.bookingsTitle")}>
          {!hasAnyRealBooking ? (
            <EmptyState text={t("an2.notEnoughData")} />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricTile
                  title={t("an.totalBookings")}
                  value={String(curStats.total)}
                  cmp={<ComparisonBadge cur={curStats.total} prev={prevStats.total} vsLabel={t("an2.vsPrevious")} newLabel={t("an2.newBadge")} />}
                />
                <MetricTile
                  title={t("an2.completionRate")}
                  value={curStats.completionRate !== null ? `${curStats.completionRate.toFixed(0)}%` : "—"}
                />
                <MetricTile
                  title={t("an.cancellationRate")}
                  value={curStats.cancellationRate !== null ? `${curStats.cancellationRate.toFixed(0)}%` : "—"}
                />
                <MetricTile
                  title={t("an2.avgLeadTime")}
                  value={curStats.avgLeadDays !== null ? `${curStats.avgLeadDays.toFixed(1)} ${t("an2.daysUnit")}` : "—"}
                  sub={t("an2.leadTimeSub")}
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-3">{t("an.statusBreakdown")}</p>
                <SegmentBar items={statusSegments} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-3">{t("an2.bookingSourceTitle")}</p>
                  <SegmentBar items={sourceSegments} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-3">{t("an2.sessionTypeTitle")}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">{curStats.individual}</p>
                      <p className="text-xs text-gray-500 mt-1">{t("an2.individualBookings")}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">{curStats.group}</p>
                      <p className="text-xs text-gray-500 mt-1">{t("an2.groupBookings")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ── Customers ── */}
        <Section title={t("an2.customersTitle")}>
          {!hasAnyCustomerActivity ? (
            <EmptyState text={t("an2.noCustomerActivity")} />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricTile
                  title={t("an2.totalCustomers")}
                  value={String(curCustIds.length)}
                  cmp={<ComparisonBadge cur={curCustIds.length} prev={prevCustIds.length} vsLabel={t("an2.vsPrevious")} newLabel={t("an2.newBadge")} />}
                />
                <MetricTile
                  title={t("an2.repeatRate")}
                  value={repeatRate !== null ? `${repeatRate.toFixed(0)}%` : "—"}
                  sub={t("an2.repeatRateSub")}
                />
                <MetricTile
                  title={t("an2.avgBookingsPerCustomer")}
                  value={avgBookingsPerCustomer.toFixed(1)}
                />
                <MetricTile
                  title={t("an2.lapsedCustomers")}
                  value={String(lapsedCount)}
                  sub={t("an2.lapsedCustomersSub")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-indigo-50 rounded-xl p-5 text-center">
                  <p className="text-3xl font-bold text-indigo-700">{newCount}</p>
                  <p className="text-sm text-indigo-500 mt-1 font-medium">{t("an.new")}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-5 text-center">
                  <p className="text-3xl font-bold text-emerald-700">{returningCount}</p>
                  <p className="text-sm text-emerald-600 mt-1 font-medium">{t("an.returningLabel")}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-3">{t("an2.topByVisits")}</p>
                  <RankedList items={topByVisits} emptyMsg={t("an2.noTopCustomers")} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-3">{t("an2.topBySpend")}</p>
                  <RankedList items={topBySpend} emptyMsg={t("an2.noTopCustomers")} />
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ── Days & Timings ── */}
        <Section title={t("an2.daysTimingsTitle")}>
          {!hasAnyRealBooking ? (
            <EmptyState text={t("an2.notEnoughData")} />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("an2.quietestDay")}</p>
                  <p className="text-xl font-bold text-gray-800">{dowLabel(quietestDow, locale)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{t("an2.quietestSub")} · {dowCounts[quietestDow]} {bookingWord(dowCounts[quietestDow])}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("an2.quietestHour")}</p>
                  <p className="text-xl font-bold text-gray-800">{quietestHour !== null ? hourLabel(quietestHour, locale) : "—"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {t("an2.quietestSub")}{quietestHour !== null ? ` · ${hourCounts[quietestHour] ?? 0} ${bookingWord(hourCounts[quietestHour] ?? 0)}` : ""}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-3">{t("an2.volumeTrendTitle")}</p>
                <div dir="ltr"><CountBarChart bars={volumeBars} /></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-3">{t("an.busiestDays")}</p>
                  <div dir="ltr"><CountBarChart bars={dowBars} /></div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600 mb-3">{t("an.busiestTimes")}</p>
                  <RankedList items={topHours} emptyMsg={t("an2.notEnoughData")} />
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600 mb-3">{t("an2.heatmapTitle")}</p>
                <div dir="ltr">
                  <Heatmap grid={heatGrid} hourCols={heatHourCols} dowLabels={heatDowLabels} hourLabels={heatHourLabels} />
                </div>
              </div>
            </div>
          )}
        </Section>

        {/* ── Services ── */}
        <Section title={t("an2.servicesTitle")}>
          {services.length === 0 ? (
            <EmptyState text={t("an2.noServicesConfigured")} />
          ) : !hasAnyRealBooking ? (
            <EmptyState text={t("an2.notEnoughData")} />
          ) : (
            <div>
              <StatRowList rows={serviceRows} emptyMsg={t("an2.notEnoughData")} />
              {zeroBookingServiceNames.length > 0 && (
                <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-1">{t("an2.zeroBookingServicesTitle")}</p>
                  <p className="text-xs text-amber-600">{zeroBookingServiceNames.join(", ")}</p>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ── Staff ── */}
        <Section title={t("an2.staffTitle")}>
          {staff.length === 0 ? (
            <EmptyState text={t("an2.noStaffConfigured")} />
          ) : !hasAnyRealBooking ? (
            <EmptyState text={t("an2.notEnoughData")} />
          ) : (
            <div className="space-y-6">
              {onlineBookings.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-indigo-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-indigo-700">{staffRequestedCount}</p>
                    <p className="text-xs text-indigo-500 mt-1 font-medium">{t("an2.staffRequested")}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-700">{staffNoPreferenceCount}</p>
                    <p className="text-xs text-gray-500 mt-1 font-medium">{t("an2.noPreference")}</p>
                  </div>
                  <p className="col-span-2 text-xs text-gray-400 -mt-2">{t("an2.staffPreferenceSub")}</p>
                </div>
              )}
              <StatRowList rows={staffRowsWithUnassigned} emptyMsg={t("an2.notEnoughData")} />
            </div>
          )}
        </Section>

      </div>
    </main>
  );
}
