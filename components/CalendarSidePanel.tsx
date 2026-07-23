"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { formatDateLocale, formatTimeLocale } from "@/lib/i18n/format";
import { showToast } from "@/components/Toast";
import { updateBookingStatus, type BookingStatus } from "@/lib/bookingActions";

// ── Shared types (also used by Calendar.tsx) ────────────────────────────────
export interface CalendarBooking {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  internal_note: string | null;
  booking_date: string; // "YYYY-MM-DD"
  booking_time: string; // "HH:MM:SS"
  status: BookingStatus;
  booking_type: "customer" | "blocked" | "manual" | null;
  group_session_id: string | null;
  service_id: string | null;
  service_name: string;
  staff_id: string | null;
  staff_name: string | null;
}

export interface CfAnswer { custom_field_id: string; answer: string; label: string; }
export type CfAnswersMap = Record<string, CfAnswer[]>;

export type PanelState =
  | { mode: "closed" }
  | { mode: "day"; date: string }
  | { mode: "detail"; booking: CalendarBooking; fromDate: string | null };

const STATUS_ORDER: BookingStatus[] = ["pending", "confirmed", "completed", "cancelled"];
const STATUS_BTN_CLS: Record<BookingStatus, string> = {
  pending:   "bg-amber-100 text-amber-800 border-amber-300",
  confirmed: "bg-blue-100  text-blue-800  border-blue-300",
  completed: "bg-green-100 text-green-800 border-green-300",
  cancelled: "bg-gray-100  text-gray-600  border-gray-300",
};

const SENTINEL_EMAIL = new Set(["blocked@internal", "noemail@internal"]);
const SENTINEL_PHONE = "0000000000";

/**
 * Card used both inside week-view grid cells and the panel's day-list.
 * `staffColor` is an accent only (a small dot) — status color via `cls`
 * remains the card's primary background/border signal.
 */
export function CalendarCard({ booking, onClick, compact, staffColor }: { booking: CalendarBooking; onClick?: () => void; compact?: boolean; staffColor?: string }) {
  const { locale } = useLanguage();
  const isMuted = booking.booking_type === "blocked" || booking.booking_type === "manual";
  const cls = isMuted
    ? "bg-slate-100 text-slate-700 border-slate-300"
    : STATUS_BTN_CLS[booking.status];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-start rounded-md border px-1.5 py-1 ${compact ? "text-[10px] leading-tight" : "text-xs"} ${cls} hover:brightness-95 transition truncate`}
    >
      <p className="font-semibold truncate flex items-center gap-1">
        {staffColor && <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: staffColor }} aria-hidden="true" />}
        <span className="truncate">{booking.booking_type === "blocked" ? "🚫" : booking.customer_name}</span>
      </p>
      {!compact && <p className="truncate opacity-80">{booking.service_name}</p>}
      <p className="opacity-70">{formatTimeLocale(booking.booking_time, locale)}</p>
      {!compact && booking.staff_name && <p className="opacity-70 truncate">{booking.staff_name}</p>}
    </button>
  );
}

export function CalendarSidePanel({
  panelState, dayBookings, answersMap, staffColors, onClose, onOpenBooking, onBackToDay, onStatusChanged,
}: {
  panelState: PanelState;
  dayBookings: CalendarBooking[];
  answersMap: CfAnswersMap;
  /** staff_id → accent color hex, shown as a small dot on cards (All Staff view only). */
  staffColors?: Record<string, string>;
  onClose: () => void;
  onOpenBooking: (b: CalendarBooking) => void;
  onBackToDay: () => void;
  onStatusChanged: (id: string, status: BookingStatus) => void;
}) {
  const { t, locale } = useLanguage();
  const [savingStatus, setSavingStatus] = useState(false);
  const open = panelState.mode !== "closed";

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleStatus(id: string, status: BookingStatus) {
    setSavingStatus(true);
    const { error } = await updateBookingStatus(id, status);
    if (error) showToast(t("book.err.generic"), "error");
    else onStatusChanged(id, status);
    setSavingStatus(false);
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} aria-hidden="true" />
      )}
      {/* Panel */}
      <div
        className={`fixed top-0 bottom-0 end-0 z-50 w-full sm:w-96 bg-white shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full rtl:-translate-x-full pointer-events-none"
        }`}
        role="dialog"
        aria-modal="true"
      >
        {panelState.mode === "day" && (
          <DayListPanel
            date={panelState.date}
            bookings={dayBookings}
            staffColors={staffColors}
            onClose={onClose}
            onOpenBooking={onOpenBooking}
          />
        )}
        {panelState.mode === "detail" && (
          <DetailPanel
            booking={panelState.booking}
            answers={answersMap[panelState.booking.id] ?? []}
            showBack={!!panelState.fromDate}
            savingStatus={savingStatus}
            onClose={onClose}
            onBack={onBackToDay}
            onStatus={handleStatus}
            locale={locale}
            t={t}
          />
        )}
      </div>
    </>
  );
}

function PanelHeader({ title, onClose, onBack }: { title: string; onClose: () => void; onBack?: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-gray-100 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {onBack && (
          <button type="button" onClick={onBack} className="text-gray-400 hover:text-gray-600 shrink-0" aria-label={t("d.back")}>
            <span className="rtl:inline hidden">→</span><span className="rtl:hidden inline">←</span>
          </button>
        )}
        <h3 className="font-semibold text-gray-800 truncate">{title}</h3>
      </div>
      <button type="button" onClick={onClose} aria-label={t("cal.close")} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
        ✕
      </button>
    </div>
  );
}

function DayListPanel({ date, bookings, staffColors, onClose, onOpenBooking }: {
  date: string; bookings: CalendarBooking[]; staffColors?: Record<string, string>; onClose: () => void; onOpenBooking: (b: CalendarBooking) => void;
}) {
  const { t, locale } = useLanguage();
  return (
    <div className="h-full flex flex-col">
      <PanelHeader title={formatDateLocale(date, locale)} onClose={onClose} />
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {bookings.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-10">{t("cal.noBookingsDay")}</p>
        ) : (
          bookings
            .slice()
            .sort((a, b) => a.booking_time.localeCompare(b.booking_time))
            .map(b => (
              <CalendarCard
                key={b.id}
                booking={b}
                onClick={() => onOpenBooking(b)}
                staffColor={b.staff_id ? staffColors?.[b.staff_id] : undefined}
              />
            ))
        )}
      </div>
    </div>
  );
}

function DetailPanel({ booking, answers, showBack, savingStatus, onClose, onBack, onStatus, locale, t }: {
  booking: CalendarBooking;
  answers: CfAnswer[];
  showBack: boolean;
  savingStatus: boolean;
  onClose: () => void;
  onBack: () => void;
  onStatus: (id: string, status: BookingStatus) => void;
  locale: "ar" | "en";
  t: (key: string) => string;
}) {
  const isBlocked = booking.booking_type === "blocked";
  const isManual = booking.booking_type === "manual";
  const isGroup = !!booking.group_session_id;
  const email = SENTINEL_EMAIL.has(booking.customer_email) ? null : booking.customer_email;
  const phone = booking.customer_phone === SENTINEL_PHONE ? null : booking.customer_phone;

  return (
    <div className="h-full flex flex-col">
      <PanelHeader
        title={isBlocked ? t("bk.blocked") : booking.customer_name}
        onClose={onClose}
        onBack={showBack ? onBack : undefined}
      />
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Type badges */}
        <div className="flex flex-wrap gap-1.5">
          {isManual && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">📋 {t("bk.manual")}</span>}
          {isGroup && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">👥 {t("bk.group")}</span>}
          {!isBlocked && !isManual && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{t("cal.typeOnline")}</span>}
        </div>

        {/* Status control */}
        {!isBlocked && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("cal.changeStatus")}</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_ORDER.map(s => (
                <button
                  key={s}
                  type="button"
                  disabled={savingStatus}
                  onClick={() => onStatus(booking.id, s)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition disabled:opacity-50 ${
                    booking.status === s ? STATUS_BTN_CLS[s] + " ring-2 ring-offset-1 ring-emerald-400" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {t(`status.${s}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date / time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("cust.colDate")}</p>
            <p className="text-sm text-gray-800">{formatDateLocale(booking.booking_date, locale)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("cust.colTime")}</p>
            <p className="text-sm text-gray-800">{formatTimeLocale(booking.booking_time, locale)}</p>
          </div>
        </div>

        {/* Service / staff */}
        {!isBlocked && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("bk.colService")}</p>
              <p className="text-sm text-gray-800">{booking.service_name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("bk.colStaff")}</p>
              <p className="text-sm text-gray-800">{booking.staff_name ?? t("bk.anyUnassigned")}</p>
            </div>
          </div>
        )}

        {/* Contact */}
        {!isBlocked && (email || phone) && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("bk.colContact")}</p>
            {email && <p className="text-sm text-gray-800">{email}</p>}
            {phone && <p className="text-sm text-gray-500">{phone}</p>}
          </div>
        )}

        {/* Customer notes */}
        {!isBlocked && booking.notes && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t("cust.notes")}</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{booking.notes}</p>
          </div>
        )}

        {/* Internal note (owner-only) */}
        {booking.internal_note && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {isBlocked ? t("nb.reasonLabel") : t("nb.howMadeLabel")}
            </p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{booking.internal_note}</p>
          </div>
        )}

        {/* Custom field answers */}
        {answers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{t("bk.customAnswers")}</p>
            <div className="space-y-1.5">
              {answers.map(a => (
                <p key={a.custom_field_id} className="text-sm">
                  <span className="font-medium text-gray-700">{a.label}:</span>{" "}
                  <span className="text-gray-500">{a.answer}</span>
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
