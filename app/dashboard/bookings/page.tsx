"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { InfoTooltip } from "@/components/InfoTooltip";
import { formatDateLocale } from "@/lib/i18n/format";
import { Calendar, type CalendarBooking } from "@/components/Calendar";
import { updateBookingStatus } from "@/lib/bookingActions";
import { computeRange, parseLocalDate, type RangeKey } from "@/lib/analyticsRange";

type Status = "pending" | "confirmed" | "completed" | "cancelled";
type BookingType = "customer" | "blocked" | "manual";

interface Booking {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  internal_note: string | null;
  booking_date: string;
  booking_time: string;
  status: Status;
  booking_type: BookingType | null;
  group_session_id: string | null;
  service_id: string;
  service_name: string;
  staff_id: string | null;
  staff_preference: string | null;
}

interface StaffOption { id: string; name: string; }

interface CfAnswer { custom_field_id: string; answer: string; label: string; }
// Map: bookingId → CfAnswer[]
type AnswersMap = Record<string, CfAnswer[]>;

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-AE", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}
function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}
function getErr(e: unknown) {
  return e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Something went wrong.";
}

const STATUS_STYLES: Record<Status, string> = {
  pending:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100  text-green-800  border-green-200",
  completed: "bg-blue-100   text-blue-800   border-blue-200",
  cancelled: "bg-red-100    text-red-800    border-red-200",
};

type ViewMode = "table" | "calendar";
const VIEW_STORAGE_KEY = "7jwzat-bookings-viewmode";

function readStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "calendar";
  const v = localStorage.getItem(VIEW_STORAGE_KEY);
  return v === "table" ? "table" : "calendar";
}

interface BusinessHourRow { day_of_week: number; start_time: string; end_time: string; }

// ── Filter bar ────────────────────────────────────────────────────────────
type StatusFilterValue = Status | "blocked";
const STATUS_FILTER_OPTIONS: StatusFilterValue[] = ["pending", "confirmed", "completed", "cancelled", "blocked"];
type BookingTypeFilter = "all" | "individual" | "group" | "manual-blocked";
type StaffFilterValue = "all" | "unassigned" | string;

/** Multi-select status dropdown — click-outside pattern mirrors InfoTooltip.tsx. */
function StatusMultiSelect({ selected, onChange }: { selected: Set<StatusFilterValue>; onChange: (next: Set<StatusFilterValue>) => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggleOption(v: StatusFilterValue) {
    const next = new Set(selected);
    next.has(v) ? next.delete(v) : next.add(v);
    onChange(next);
  }

  const label = selected.size === 0 ? t("flt.all") : `${selected.size} ${t("flt.selected")}`;

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs text-gray-500 mb-1">{t("flt.statusLabel")}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-start min-w-[130px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {label}
      </button>
      {open && (
        <div className="absolute start-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1.5 min-w-[160px]">
          <label className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={selected.size === 0} onChange={() => onChange(new Set())} className="accent-emerald-600" />
            {t("flt.all")}
          </label>
          <div className="border-t border-gray-100 my-1" />
          {STATUS_FILTER_OPTIONS.map(opt => (
            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selected.has(opt)} onChange={() => toggleOption(opt)} className="accent-emerald-600" />
              {t(`status.${opt}`)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BookingsPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHourRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [updatingId, setUpdatingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [answersMap, setAnswersMap]   = useState<AnswersMap>({});
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode]       = useState<ViewMode>(() => readStoredViewMode());

  function selectViewMode(mode: ViewMode) {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_STORAGE_KEY, mode); } catch { /* ignore */ }
  }

  // ── Filters — one shared state, both Table and Calendar read from it ────
  // Default date range differs by view (This Month for the less time-
  // constrained table, This Week for the calendar), but only at first mount —
  // toggling Table ↔ Calendar afterward never silently resets the filter.
  const initialDateRange: RangeKey = viewMode === "table" ? "this-month" : "this-week";
  const [statusFilter, setStatusFilter]   = useState<Set<StatusFilterValue>>(new Set());
  const [dateRangeFilter, setDateRangeFilter] = useState<RangeKey>(initialDateRange);
  const [customStart, setCustomStart]     = useState("");
  const [customEnd, setCustomEnd]         = useState("");
  const [appliedCustom, setAppliedCustom] = useState<{ start: string; end: string } | null>(null);
  const [rangeError, setRangeError]       = useState<string | null>(null);
  const [bookingTypeFilter, setBookingTypeFilter] = useState<BookingTypeFilter>("all");
  const [staffFilter, setStaffFilter]     = useState<StaffFilterValue>("all");

  function selectDateRangeFilter(key: RangeKey) {
    setRangeError(null);
    if (key === "custom") {
      if (!customStart || !customEnd) {
        const seed = computeRange(dateRangeFilter === "custom" ? "this-week" : dateRangeFilter);
        setCustomStart(seed.start);
        setCustomEnd(seed.end);
      }
    } else {
      setAppliedCustom(null);
    }
    setDateRangeFilter(key);
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

  function clearFilters() {
    setStatusFilter(new Set());
    setBookingTypeFilter("all");
    setStaffFilter("all");
    setDateRangeFilter(viewMode === "table" ? "this-month" : "this-week");
    setCustomStart(""); setCustomEnd(""); setAppliedCustom(null); setRangeError(null);
  }

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth/login"); return; }

    const [{ data: profile }, { data: svcRows }, { data: bkRows }, { data: staffRows }, { data: hoursRows }] = await Promise.all([
      supabase.from("users").select("business_name").eq("id", session.user.id).single(),
      supabase.from("services").select("id, name"),
      supabase.from("bookings").select("*").order("booking_date", { ascending: false }).order("booking_time", { ascending: false }),
      supabase.from("staff").select("id, name").eq("user_id", session.user.id).eq("is_active", true).order("name"),
      supabase.from("business_hours").select("day_of_week, start_time, end_time").eq("user_id", session.user.id),
    ]);
    setBusinessHours(hoursRows ?? []);

    if (profile) setBusinessName(profile.business_name);

    const svcMap: Record<string, string> = {};
    (svcRows ?? []).forEach((s: { id: string; name: string }) => { svcMap[s.id] = s.name; });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bookingList = (bkRows ?? []).map((b: any) => ({
      ...b,
      service_name: svcMap[b.service_id as string] ?? "—",
    }));
    setBookings(bookingList);

    // Fetch custom field answers for all bookings in one query
    if (bookingList.length > 0) {
      const bkIds = bookingList.map((b: { id: string }) => b.id);
      const { data: cfaRows } = await supabase
        .from("custom_field_answers")
        .select("booking_id, custom_field_id, answer, custom_fields(label)")
        .in("booking_id", bkIds);

      const map: AnswersMap = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cfaRows ?? []).forEach((row: any) => {
        if (!map[row.booking_id]) map[row.booking_id] = [];
        map[row.booking_id].push({
          custom_field_id: row.custom_field_id,
          answer: row.answer,
          label: row.custom_fields?.label ?? row.custom_field_id,
        });
      });
      setAnswersMap(map);
    }

    setStaffOptions(staffRows ?? []);
    setLoading(false);
  }

  async function handleStatusChange(id: string, status: Status) {
    setUpdatingId(id);
    const { error: upErr } = await updateBookingStatus(id, status);
    if (upErr) setError(upErr);
    else setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    setUpdatingId(null);
  }

  // The calendar's side panel already calls updateBookingStatus itself before
  // invoking this — this only needs to keep the table's local state in sync
  // so switching Table ↔ Calendar always reflects the same data.
  function handleCalendarStatusChange(id: string, status: Status) {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  }

  async function handleStaffChange(id: string, staffId: string) {
    const resolved = staffId === "" ? null : staffId;
    const name = staffOptions.find(s => s.id === resolved)?.name ?? null;
    setUpdatingId(id);
    const { error: upErr } = await supabase
      .from("bookings")
      .update({ staff_id: resolved, staff_preference: resolved ? name : "any" })
      .eq("id", id);
    if (upErr) setError(getErr(upErr));
    else setBookings(prev => prev.map(b => b.id === id ? { ...b, staff_id: resolved, staff_preference: resolved ? name : "any" } : b));
    setUpdatingId(null);
  }

  async function handleDelete(booking: Booking) {
    const label = booking.booking_type === "blocked" ? "this blocked slot" : `booking for ${booking.customer_name}`;
    if (!window.confirm(`Delete ${label}?`)) return;
    setDeletingId(booking.id);
    const { error: delErr } = await supabase.from("bookings").delete().eq("id", booking.id);
    if (delErr) setError(getErr(delErr));
    else setBookings(prev => prev.filter(b => b.id !== booking.id));
    setDeletingId(null);
  }

  function toggleAnswers(id: string) {
    setExpandedAnswers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Apply filters (AND across all four — a booking must match every
  // active filter) — one predicate feeds both the table and the calendar. ──
  const activeRange = dateRangeFilter === "custom"
    ? (appliedCustom ? computeRange("custom", appliedCustom.start, appliedCustom.end) : null)
    : computeRange(dateRangeFilter);

  function matchesFilters(b: Booking): boolean {
    if (statusFilter.size > 0) {
      const key: StatusFilterValue = b.booking_type === "blocked" ? "blocked" : b.status;
      if (!statusFilter.has(key)) return false;
    }
    if (activeRange && (b.booking_date < activeRange.start || b.booking_date > activeRange.end)) return false;
    if (bookingTypeFilter === "individual" && !(b.booking_type === "customer" && !b.group_session_id)) return false;
    if (bookingTypeFilter === "group" && !(b.booking_type === "customer" && !!b.group_session_id)) return false;
    if (bookingTypeFilter === "manual-blocked" && !(b.booking_type === "manual" || b.booking_type === "blocked")) return false;
    if (staffFilter === "unassigned" && b.staff_id !== null) return false;
    if (staffFilter !== "all" && staffFilter !== "unassigned" && b.staff_id !== staffFilter) return false;
    return true;
  }
  const filteredBookings = bookings.filter(matchesFilters);
  const filtersActive =
    statusFilter.size > 0 ||
    bookingTypeFilter !== "all" ||
    staffFilter !== "all" ||
    dateRangeFilter !== (viewMode === "table" ? "this-month" : "this-week");

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">{t("d.loading")}</p>
    </div>
  );

  const staffById: Record<string, string> = {};
  staffOptions.forEach(s => { staffById[s.id] = s.name; });
  const calendarBookings: CalendarBooking[] = filteredBookings.map(b => ({
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
    service_name: b.service_name,
    staff_id: b.staff_id,
    staff_name: b.staff_id ? (staffById[b.staff_id] ?? b.staff_preference) : null,
  }));

  return (
    <main className="flex-1 p-4 sm:p-8 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 inline-flex items-center gap-2">{t("bk.title")} <InfoTooltip textKey="tip.page.bookings" /></h2>
          <p className="text-gray-500 text-sm mt-1">{t("bk.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
            <button type="button" onClick={() => selectViewMode("table")}
              className={`px-3 py-2 transition ${viewMode === "table" ? "bg-emerald-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
              {t("bk.viewTable")}
            </button>
            <button type="button" onClick={() => selectViewMode("calendar")}
              className={`px-3 py-2 transition ${viewMode === "calendar" ? "bg-emerald-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
              {t("bk.viewCalendar")}
            </button>
          </div>
          <Link
            href="/dashboard/bookings/new"
            className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"
          >
            {t("bk.addBlock")}
          </Link>
        </div>
      </div>

      {/* ── Filter bar — one shared state feeds both Table and Calendar ── */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <StatusMultiSelect selected={statusFilter} onChange={setStatusFilter} />

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t("flt.dateRangeLabel")}</label>
            <select
              value={dateRangeFilter}
              onChange={e => selectDateRangeFilter(e.target.value as RangeKey)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="this-week">{t("an2.thisWeek")}</option>
              <option value="this-month">{t("an.thisMonth")}</option>
              <option value="last-30">{t("an2.last30")}</option>
              <option value="custom">{t("an2.custom")}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">{t("flt.typeLabel")}</label>
            <select
              value={bookingTypeFilter}
              onChange={e => setBookingTypeFilter(e.target.value as BookingTypeFilter)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">{t("flt.all")}</option>
              <option value="individual">{t("an2.individualBookings")}</option>
              <option value="group">{t("an2.groupBookings")}</option>
              <option value="manual-blocked">{t("flt.manualBlocked")}</option>
            </select>
          </div>

          {staffOptions.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t("flt.staffLabel")}</label>
              <select
                value={staffFilter}
                onChange={e => setStaffFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">{t("flt.all")}</option>
                <option value="unassigned">{t("flt.unassigned")}</option>
                {staffOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {filtersActive && (
            <button type="button" onClick={clearFilters} className="text-sm text-emerald-600 hover:underline font-medium">
              {t("flt.clearFilters")}
            </button>
          )}
        </div>

        {dateRangeFilter === "custom" && (
          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-3">
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
              type="button"
              onClick={applyCustomRange}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
            >
              {t("an2.apply")}
            </button>
            {rangeError && <p className="text-xs text-red-500 w-full">{rangeError}</p>}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">{error}</div>
      )}

      {viewMode === "calendar" ? (
        <Calendar
          bookings={calendarBookings}
          businessHours={businessHours}
          answersMap={answersMap}
          onBookingStatusChange={handleCalendarStatusChange}
          storageKey="7jwzat-calendar-view-bookings"
          defaultView="week"
          emptyStateMessage={bookings.length > 0 && filteredBookings.length === 0 ? t("bk.noFilterMatches") : undefined}
        />
      ) : (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {bookings.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm mb-4">{t("bk.empty")}</p>
            {businessName && (
              <Link href={`/book/${encodeURIComponent(businessName)}`} className="text-emerald-600 text-sm hover:underline font-medium">
                {t("bk.shareLink")}
              </Link>
            )}
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm mb-4">{t("bk.noFilterMatches")}</p>
            <button type="button" onClick={clearFilters} className="text-emerald-600 text-sm hover:underline font-medium">
              {t("flt.clearFilters")}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">{t("bk.colCustomer")}</th>
                  <th className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">{t("bk.colService")}</th>
                  <th className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">{t("bk.colDateTime")}</th>
                  <th className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">{t("bk.colStaff")}</th>
                  <th className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">{t("bk.colContact")}</th>
                  <th className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">{t("bk.colStatus")}</th>
                  <th className="text-end text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">{t("d.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredBookings.map(b => {
                  const isBlocked = b.booking_type === "blocked";
                  const isManual  = b.booking_type === "manual";
                  const isGroup   = !!b.group_session_id;

                  return (
                    <tr key={b.id} className={`hover:bg-gray-50 transition ${isBlocked ? "opacity-70" : ""}`}>

                      {/* Customer */}
                      <td className="px-6 py-4">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                            &#128683; {t("bk.blocked")}
                          </span>
                        ) : (
                          <p className="font-medium text-gray-800">{b.customer_name}</p>
                        )}
                        {isManual && (
                          <span className="inline-flex items-center gap-1 mt-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                            &#128203; {t("bk.manual")}
                          </span>
                        )}
                        {isGroup && (
                          <span className="inline-flex items-center gap-1 mt-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                            &#128101; {t("bk.group")}
                          </span>
                        )}
                        {(isBlocked || isManual) && b.internal_note && (
                          <p className="text-xs text-gray-400 italic mt-1">{b.internal_note}</p>
                        )}
                        {!isBlocked && b.notes && (
                          <p className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate" title={b.notes}>
                            &#128221; {b.notes}
                          </p>
                        )}
                        {/* Custom field answers */}
                        {!isBlocked && answersMap[b.id] && answersMap[b.id].length > 0 && (
                          <div className="mt-1">
                            <button
                              onClick={() => toggleAnswers(b.id)}
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              {expandedAnswers.has(b.id) ? `▾ ${t("bk.hideAnswers")}` : `▸ ${t("bk.customAnswers")}`}
                            </button>
                            {expandedAnswers.has(b.id) && (
                              <div className="mt-1.5 space-y-1">
                                {answersMap[b.id].map(a => (
                                  <p key={a.custom_field_id} className="text-xs text-gray-600">
                                    <span className="font-medium">{a.label}:</span>{" "}
                                    <span className="text-gray-500">{a.answer}</span>
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Service */}
                      <td className="px-6 py-4 text-gray-700">{b.service_name}</td>

                      {/* Date & Time */}
                      <td className="px-6 py-4">
                        <p className="text-gray-700">{formatDateLocale(b.booking_date, locale)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtTime(b.booking_time)}</p>
                      </td>

                      {/* Staff */}
                      <td className="px-6 py-4">
                        {isBlocked ? (
                          <span className="text-gray-300 text-xs">—</span>
                        ) : staffOptions.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">{t("bk.noStaff")}</span>
                        ) : (
                          <select
                            value={b.staff_id ?? ""}
                            disabled={updatingId === b.id}
                            onChange={e => handleStaffChange(b.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60 max-w-[130px]"
                          >
                            <option value="">{t("bk.anyUnassigned")}</option>
                            {staffOptions.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        )}
                        {staffOptions.length > 0 && !b.staff_id && (
                          <p className="text-xs text-gray-400 italic mt-0.5">{t("bk.any")}</p>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-6 py-4">
                        {isBlocked ? (
                          <span className="text-gray-300 text-xs">—</span>
                        ) : (
                          <>
                            <p className="text-gray-700">{b.customer_email !== "blocked@internal" && b.customer_email !== "noemail@internal" ? b.customer_email : "—"}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{b.customer_phone !== "0000000000" ? b.customer_phone : "—"}</p>
                          </>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {isBlocked ? (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full border bg-gray-100 text-gray-500 border-gray-200">
                            {t("status.blocked")}
                          </span>
                        ) : (
                          <select
                            value={b.status}
                            disabled={updatingId === b.id}
                            onChange={e => handleStatusChange(b.id, e.target.value as Status)}
                            className={`text-xs font-semibold px-2 py-1 rounded-full border cursor-pointer focus:outline-none disabled:opacity-60 ${STATUS_STYLES[b.status]}`}
                          >
                            <option value="pending">{t("status.pending")}</option>
                            <option value="confirmed">{t("status.confirmed")}</option>
                            <option value="completed">{t("status.completed")}</option>
                            <option value="cancelled">{t("status.cancelled")}</option>
                          </select>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-end">
                        <button
                          onClick={() => handleDelete(b)}
                          disabled={deletingId === b.id}
                          className="text-xs font-medium text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-60 transition"
                        >
                          {deletingId === b.id ? "..." : t("d.delete")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-end">
              <span className="text-xs text-gray-400">{filteredBookings.length} {t("bk.records")}</span>
            </div>
          </div>
        )}
      </div>
      )}

      <div className="mt-6">
        <Link href="/dashboard" className="text-sm text-emerald-600 hover:underline">{t("bk.backToDashboard")}</Link>
      </div>
    </main>
  );
}
