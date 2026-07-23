"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { formatTimeLocale } from "@/lib/i18n/format";
import type { BookingStatus } from "@/lib/bookingActions";
import {
  CalendarCard,
  CalendarSidePanel,
  type CalendarBooking,
  type CfAnswersMap,
  type PanelState,
} from "@/components/CalendarSidePanel";

export type { CalendarBooking, CfAnswer, CfAnswersMap } from "@/components/CalendarSidePanel";

interface BusinessHourRow { day_of_week: number; start_time: string; end_time: string; }
type ViewMode = "week" | "month";

const FALLBACK_START_MIN = 9 * 60;
const FALLBACK_END_MIN = 17 * 60;

// ── Date helpers (timezone-safe: local Date fields only, never toISOString) ─
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function startOfWeek(d: Date): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return addDays(c, -c.getDay());
}
function parseMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function weekdayShort(d: Date, locale: "ar" | "en"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-GB", { weekday: "short" }).format(d);
}
function monthYearLabel(d: Date, locale: "ar" | "en"): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-JO" : "en-GB", { month: "long", year: "numeric", numberingSystem: "latn" }).format(d);
}

function readStoredView(key: string, fallback: ViewMode): ViewMode {
  if (typeof window === "undefined") return fallback;
  const v = localStorage.getItem(key);
  return v === "week" || v === "month" ? v : fallback;
}

const MUTED_TYPES = new Set(["blocked", "manual"]);
const DOT_CLASS: Record<string, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-blue-400",
  completed: "bg-green-500",
  cancelled: "bg-gray-400",
  muted: "bg-slate-400",
};

/**
 * Reusable calendar (week + month views + side panel), used by the bookings
 * page and the dashboard. Purely presentational — receives all data as
 * props (no internal fetching), matching the rest of the codebase's
 * "each page fetches its own data" convention.
 */
export function Calendar({
  bookings, businessHours, answersMap, onBookingStatusChange, storageKey, defaultView = "week", compact = false,
}: {
  bookings: CalendarBooking[];
  businessHours: BusinessHourRow[];
  answersMap: CfAnswersMap;
  onBookingStatusChange: (id: string, status: BookingStatus) => void;
  storageKey: string;
  defaultView?: ViewMode;
  compact?: boolean;
}) {
  const { t, locale } = useLanguage();

  const [view, setView] = useState<ViewMode>(() => readStoredView(storageKey, defaultView));
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [panelState, setPanelState] = useState<PanelState>({ mode: "closed" });
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOffset, setMobileOffset] = useState(0);

  const today = new Date();
  const todayStr = localDateStr(today);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  function selectView(v: ViewMode) {
    setView(v);
    try { localStorage.setItem(storageKey, v); } catch { /* ignore */ }
  }

  // ── Week geometry ─────────────────────────────────────────────────────────
  const weekStart = startOfWeek(anchorDate);
  const weekStartStr = localDateStr(weekStart);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStartStr]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setMobileOffset(0); }, [weekStartStr]);

  const visibleDays = isMobile ? weekDays.slice(mobileOffset, mobileOffset + 3) : weekDays;

  // Operating-hours row range, from the business's own configured hours —
  // never a hardcoded 9–5 unless nothing is configured at all. Also widened
  // to cover any booking in the visible week that falls outside those hours
  // (manual/blocked entries aren't constrained to business_hours) so a
  // booking is never silently dropped from the grid.
  const weekDateSet = useMemo(() => new Set(weekDays.map(localDateStr)), [weekDays]);
  const { firstHour, lastHour } = useMemo(() => {
    let minStart = Infinity, maxEnd = -Infinity;
    businessHours.forEach(bh => {
      minStart = Math.min(minStart, parseMinutes(bh.start_time));
      maxEnd = Math.max(maxEnd, parseMinutes(bh.end_time));
    });
    if (!isFinite(minStart) || !isFinite(maxEnd) || maxEnd <= minStart) {
      minStart = FALLBACK_START_MIN;
      maxEnd = FALLBACK_END_MIN;
    }
    bookings.forEach(b => {
      if (!weekDateSet.has(b.booking_date)) return;
      const mins = parseMinutes(b.booking_time);
      minStart = Math.min(minStart, Math.floor(mins / 60) * 60);
      maxEnd = Math.max(maxEnd, (Math.floor(mins / 60) + 1) * 60);
    });
    return { firstHour: Math.floor(minStart / 60), lastHour: Math.ceil(maxEnd / 60) - 1 };
  }, [businessHours, bookings, weekDateSet]);
  const hourRows = useMemo(() => {
    const rows: number[] = [];
    for (let h = firstHour; h <= lastHour; h++) rows.push(h);
    return rows;
  }, [firstHour, lastHour]);

  // ── Month geometry ───────────────────────────────────────────────────────
  const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
  const monthGridStart = startOfWeek(monthStart);
  const monthCells = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i)),
    [monthGridStart.getTime()] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Indexes over the full bookings array (all-time — navigation is fully
  // client-side, no refetch on prev/next) ──────────────────────────────────
  const cellMap = useMemo(() => {
    const map: Record<string, CalendarBooking[]> = {};
    bookings.forEach(b => {
      const hour = Math.floor(parseMinutes(b.booking_time) / 60);
      const key = `${b.booking_date}|${hour}`;
      (map[key] ??= []).push(b);
    });
    return map;
  }, [bookings]);

  const dayMap = useMemo(() => {
    const map: Record<string, CalendarBooking[]> = {};
    bookings.forEach(b => { (map[b.booking_date] ??= []).push(b); });
    return map;
  }, [bookings]);

  const weekBookingCount = weekDays.reduce((sum, d) => sum + (dayMap[localDateStr(d)]?.length ?? 0), 0);
  const monthBookingCount = monthCells
    .filter(d => d.getMonth() === monthStart.getMonth())
    .reduce((sum, d) => sum + (dayMap[localDateStr(d)]?.length ?? 0), 0);

  // ── Navigation ────────────────────────────────────────────────────────────
  function goToday() { setAnchorDate(new Date()); }
  function goPrevWeek() { setAnchorDate(d => addDays(d, -7)); }
  function goNextWeek() { setAnchorDate(d => addDays(d, 7)); }
  function goPrevMonth() { setAnchorDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); }
  function goNextMonth() { setAnchorDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); }

  // ── Panel wiring ──────────────────────────────────────────────────────────
  function openDetailFromWeek(b: CalendarBooking) {
    setPanelState({ mode: "detail", booking: b, fromDate: null });
  }
  function openDay(dateStr: string) {
    setPanelState({ mode: "day", date: dateStr });
  }
  function openDetailFromDay(b: CalendarBooking) {
    setPanelState(prev => ({ mode: "detail", booking: b, fromDate: prev.mode === "day" ? prev.date : null }));
  }
  function closePanel() { setPanelState({ mode: "closed" }); }
  function backToDay() {
    setPanelState(prev => (prev.mode === "detail" && prev.fromDate ? { mode: "day", date: prev.fromDate } : { mode: "closed" }));
  }
  function handleStatusChanged(id: string, status: BookingStatus) {
    onBookingStatusChange(id, status);
    setPanelState(prev => (prev.mode === "detail" && prev.booking.id === id ? { ...prev, booking: { ...prev.booking, status } } : prev));
  }
  const panelDayBookings = panelState.mode === "day" ? (dayMap[panelState.date] ?? []) : [];

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
      {/* ── Header: view toggle + navigation ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={goToday}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-300 text-gray-600 hover:border-emerald-400 hover:text-emerald-700 transition">
            {t("dash.stat.today")}
          </button>
          {view === "week" ? (
            <div className="flex items-center gap-1">
              <button type="button" onClick={goPrevWeek} aria-label={t("cal.prevWeek")} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">‹</button>
              <button type="button" onClick={goNextWeek} aria-label={t("cal.nextWeek")} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">›</button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button type="button" onClick={goPrevMonth} aria-label={t("cal.prevMonth")} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">‹</button>
              <button type="button" onClick={goNextMonth} aria-label={t("cal.nextMonth")} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition">›</button>
            </div>
          )}
          <span className="text-sm font-semibold text-gray-700">{monthYearLabel(view === "week" ? weekStart : monthStart, locale)}</span>
        </div>

        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
          <button type="button" onClick={() => selectView("week")}
            className={`px-3 py-1.5 transition ${view === "week" ? "bg-emerald-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
            {t("cal.weekView")}
          </button>
          <button type="button" onClick={() => selectView("month")}
            className={`px-3 py-1.5 transition ${view === "month" ? "bg-emerald-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
            {t("cal.monthView")}
          </button>
        </div>
      </div>

      {/* ── Week view ── */}
      {view === "week" && (
        <div>
          {weekBookingCount === 0 && (
            <p className="text-gray-400 text-sm text-center py-3">{t("cal.noBookingsWeek")}</p>
          )}
          {isMobile && (
            <div className="flex items-center justify-between mb-2">
              <button type="button" onClick={() => setMobileOffset(o => Math.max(0, o - 3))} disabled={mobileOffset === 0}
                aria-label={t("cal.prevDays")} className="text-xs text-gray-400 disabled:opacity-30 px-2 py-1">‹</button>
              <button type="button" onClick={() => setMobileOffset(o => Math.min(4, o + 3))} disabled={mobileOffset >= 4}
                aria-label={t("cal.nextDays")} className="text-xs text-gray-400 disabled:opacity-30 px-2 py-1">›</button>
            </div>
          )}
          {hourRows.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">{t("cal.noBookingsWeek")}</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="grid min-w-[420px]" style={{ gridTemplateColumns: `44px repeat(${visibleDays.length}, minmax(0,1fr))` }}>
                <div />
                {visibleDays.map(d => {
                  const isToday = localDateStr(d) === todayStr;
                  return (
                    <div key={localDateStr(d)} className="text-center pb-2">
                      <p className="text-[10px] text-gray-400 uppercase">{weekdayShort(d, locale)}</p>
                      <p className={`text-sm font-semibold ${isToday ? "text-emerald-600" : "text-gray-700"}`}>{d.getDate()}</p>
                    </div>
                  );
                })}
                {hourRows.map(hour => (
                  <Fragment key={hour}>
                    <div className="text-[9px] text-gray-400 text-end pe-1 pt-0.5 border-t border-gray-50">
                      {formatTimeLocale(`${String(hour).padStart(2, "0")}:00`, locale)}
                    </div>
                    {visibleDays.map(d => {
                      const dateStr = localDateStr(d);
                      const cellBookings = cellMap[`${dateStr}|${hour}`] ?? [];
                      return (
                        <div key={dateStr} className={`border-t border-s border-gray-50 p-0.5 space-y-0.5 ${compact ? "min-h-[32px]" : "min-h-[46px]"}`}>
                          {cellBookings.map(b => (
                            <CalendarCard key={b.id} booking={b} compact onClick={() => openDetailFromWeek(b)} />
                          ))}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Month view ── */}
      {view === "month" && (
        <div>
          {monthBookingCount === 0 && (
            <p className="text-gray-400 text-sm text-center py-3">{t("cal.noBookingsMonth")}</p>
          )}
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map(d => (
              <div key={`h-${localDateStr(d)}`} className="text-center text-[10px] text-gray-400 font-medium py-1 uppercase">
                {weekdayShort(d, locale)}
              </div>
            ))}
            {monthCells.map(d => {
              const dateStr = localDateStr(d);
              const inMonth = d.getMonth() === monthStart.getMonth();
              const isToday = dateStr === todayStr;
              const dayBookings = dayMap[dateStr] ?? [];
              const dotKeys = Array.from(new Set(dayBookings.map(b => (MUTED_TYPES.has(b.booking_type ?? "") ? "muted" : b.status))));
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => openDay(dateStr)}
                  className={`aspect-square sm:aspect-auto ${compact ? "sm:h-12" : "sm:h-16"} rounded-lg border p-1 text-start flex flex-col transition ${
                    inMonth ? "border-gray-100 bg-white hover:border-emerald-300" : "border-transparent bg-gray-50/60"
                  } ${isToday ? "ring-2 ring-emerald-400" : ""}`}
                >
                  <span className={`text-[11px] font-semibold ${inMonth ? "text-gray-700" : "text-gray-300"}`}>{d.getDate()}</span>
                  {dayBookings.length > 0 && (
                    <div className="mt-auto flex items-center gap-0.5 flex-wrap">
                      {dotKeys.slice(0, 4).map((k, i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${DOT_CLASS[k] ?? "bg-gray-300"}`} />)}
                      <span className="text-[9px] text-gray-400 ms-auto">{dayBookings.length}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <CalendarSidePanel
        panelState={panelState}
        dayBookings={panelDayBookings}
        answersMap={answersMap}
        onClose={closePanel}
        onOpenBooking={openDetailFromDay}
        onBackToDay={backToDay}
        onStatusChanged={handleStatusChanged}
      />
    </div>
  );
}
