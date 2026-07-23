"use client";

import { useEffect, useState } from "react";
import { slugifyBusinessName } from "@/lib/slug";
import { formatPrice, DEFAULT_CURRENCY } from "@/lib/currency";
import { useLanguage, useApplyHtmlDir, LanguageToggle } from "@/lib/i18n/LanguageProvider";
import { formatDateLocale, formatTimeLocale, type Locale } from "@/lib/i18n/format";
import { isDayNoteWholeDayBlocked, isTimeBlockedByDayNote } from "@/lib/dayNoteActions";

/**
 * Public booking page (customer-facing).
 *
 * Arabic-first + RTL by default (locale from LanguageProvider). ALL data
 * fetching goes through server-side API routes (service-role key).
 *
 *   GET  /api/booking-page-data?slug=   → business + services + hours + bookings + staff + currency + whatsapp
 *   GET  /api/group-sessions?businessId=&serviceId=  → upcoming group sessions
 *   POST /api/create-booking            → upsert customer + insert booking + emails
 */

/* ─── Types ──────────────────────────────────────────────── */
interface Business   { id: string; business_name: string; email: string; currency?: string | null; whatsapp_number?: string | null; address?: string | null; }
interface Service    { id: string; name: string; duration: number; price: number | null; is_group_service: boolean; }
interface StaffMember { id: string; name: string; role: string | null; bio: string | null; }
interface BusinessHour { day_of_week: number; start_time: string; end_time: string; }
interface ExistingBooking { booking_date: string; booking_time: string; }
interface GroupSession {
  id: string; service_id: string; session_date: string; session_time: string;
  capacity: number; notes: string | null; booked_count: number;
}
interface CustomField { id: string; label: string; placeholder: string | null; is_required: boolean; }
interface DayNoteBlock {
  date: string;
  block_type: "none" | "walk_ins_only" | "fully_blocked";
  block_start_time: string | null; // null = all day
  block_end_time: string | null;
}

/* ─── Helpers ────────────────────────────────────────────── */
function generateSlots(start: string, end: string): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur < endMin) {
    slots.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
    cur += 30;
  }
  return slots;
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/**
 * UI-side mirror of the day-block check (shared with the server via
 * lib/dayNoteActions.ts) — the real enforcement is the server-side re-check
 * in POST /api/create-booking; this only decides what the customer sees so
 * they never even try a blocked slot.
 */
function filterBlockedSlots(slots: string[], note: DayNoteBlock | undefined): string[] {
  return slots.filter(slot => !isTimeBlockedByDayNote(note ?? null, slot));
}

/* WhatsApp greeting text (header) + booking-reference text (confirmation). */
function waHeaderText(locale: Locale) {
  return locale === "ar"
    ? "مرحباً، أود الاستفسار عن حجز موعد"
    : "Hello, I'd like to ask about booking an appointment";
}
function waBookingText(locale: Locale, service: string, date: string) {
  return locale === "ar"
    ? `مرحباً، حجزت موعد ${service} يوم ${date}`
    : `Hello, I booked ${service} on ${date}`;
}
function waLink(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/* ─── WhatsApp button ────────────────────────────────────── */
function WhatsAppButton({ href, label, full = false }: { href: string; label: string; full?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition ${
        full ? "w-full py-3 text-base" : "px-4 py-2 text-sm"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.489-.917zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
      </svg>
      {label}
    </a>
  );
}

/* ─── Mini Calendar ──────────────────────────────────────── */
function MiniCalendar({ selected, onSelect, minDate, maxDate, locale }:
  { selected: string | null; onSelect: (d: string) => void; minDate: Date; maxDate: Date; locale: Locale }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = view.getFullYear(), month = view.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const rtl = locale === "ar";
  // Chevron meaning flips under RTL so "previous" always points toward the past.
  const prevGlyph = rtl ? "›" : "‹";
  const nextGlyph = rtl ? "‹" : "›";

  const monthLabel = new Date(year, month, 1).toLocaleDateString(rtl ? "ar-JO" : "en-GB", {
    month: "long", year: "numeric", numberingSystem: "latn",
  });
  const dayNames = rtl
    ? ["أحد", "إثن", "ثلا", "أرب", "خمي", "جمع", "سبت"]
    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 select-none">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setView(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 text-lg">{prevGlyph}</button>
        <span className="font-semibold text-gray-800">{monthLabel}</span>
        <button onClick={() => setView(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 text-lg">{nextGlyph}</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {dayNames.map(d => <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const date    = new Date(year, month, day);
          const dateStr = isoDate(date);
          const isSelected = selected === dateStr;
          const isToday    = isoDate(today) === dateStr;
          const disabled   = date < minDate || date > maxDate;
          return (
            <button key={i} onClick={() => !disabled && onSelect(dateStr)} disabled={disabled}
              className={`mx-auto w-8 h-8 rounded-full text-sm flex items-center justify-center transition
                ${isSelected ? "bg-indigo-600 text-white font-semibold" : ""}
                ${isToday && !isSelected ? "border-2 border-indigo-400 text-indigo-600 font-semibold" : ""}
                ${!isSelected && !disabled ? "hover:bg-indigo-50 text-gray-700" : ""}
                ${disabled ? "text-gray-300 cursor-not-allowed" : "cursor-pointer"}`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Staff Card ─────────────────────────────────────────── */
function StaffCard({ member, selected, onSelect, t }: {
  member: StaffMember | null; // null = "No preference"
  selected: boolean;
  onSelect: () => void;
  t: (k: string) => string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-start p-4 rounded-xl border-2 transition w-full
        ${selected
          ? "border-emerald-500 bg-emerald-50"
          : "border-gray-200 bg-white hover:border-emerald-300"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0
          ${selected ? "bg-emerald-200 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
          {member ? member.name.charAt(0).toUpperCase() : "\u{1F464}"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-800 text-sm">
              {member ? member.name : t("book.noPreference")}
            </p>
            {selected && <span className="text-emerald-600 text-xs font-bold">&#10003;</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {member
              ? (member.role ?? t("book.teamMember"))
              : t("book.noPreferenceDesc")}
          </p>
          {member?.bio && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{member.bio}</p>
          )}
        </div>
      </div>
    </button>
  );
}

/* ─── Loading skeleton ───────────────────────────────────── */
function BookingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-32 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-white rounded-xl shadow-sm animate-pulse" />)}
        </div>
      </div>
    </div>
  );
}

/* ─── Form / booking constants ───────────────────────────── */
const EMPTY_FORM   = { name: "", email: "", phone: "", note: "" };
const EMPTY_ERRORS = { name: "", email: "", phone: "" };
type CustomFieldAnswers = Record<string, string>; // fieldId → answer
const EMAIL_RE     = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ─── Main Page ──────────────────────────────────────────── */
export default function BookPage({ params }: { params: { businessname: string } }) {
  const businessSlug = slugifyBusinessName(decodeURIComponent(params.businessname));
  const { t, locale } = useLanguage();
  useApplyHtmlDir(); // flip <html> dir/lang to the active locale while mounted

  const [loading, setLoading]   = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [notFound, setNotFound] = useState(false);   // API said: no such business
  const [loadError, setLoadError] = useState(false); // API failed / network error
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours]       = useState<BusinessHour[]>([]);
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([]);
  const [dayNotes, setDayNotes] = useState<DayNoteBlock[]>([]);

  // Staff
  const [staffByService, setStaffByService] = useState<Record<string, StaffMember[]>>({});
  const [hasStaff, setHasStaff]             = useState(false);
  const [selectedStaff, setSelectedStaff]   = useState<StaffMember | null | "no-pref">("no-pref");

  // 1-on-1 flow
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate]       = useState<string | null>(null);
  const [selectedTime, setSelectedTime]       = useState<string | null>(null);
  const [slots, setSlots]                     = useState<string[]>([]);
  const [closedDay, setClosedDay]             = useState(false);
  const [dayBlockMessage, setDayBlockMessage] = useState<string | null>(null);

  // Group flow
  const [groupSessions, setGroupSessions]     = useState<GroupSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<GroupSession | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Custom fields
  const [customFields, setCustomFields]   = useState<CustomField[]>([]);
  const [customAnswers, setCustomAnswers] = useState<CustomFieldAnswers>({});
  const [customErrors, setCustomErrors]   = useState<Record<string, string>>({});

  // Booking form
  const [form, setForm]             = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_ERRORS);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState("");
  const [confirmed, setConfirmed]   = useState(false);
  const [confirmedData, setConfirmedData] = useState<{
    service: Service; date: string; time: string; name: string; email: string; isGroup: boolean;
  } | null>(null);

  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setDate(today.getDate() + 30);

  const currency = business?.currency ?? DEFAULT_CURRENCY;
  const fmtDate = (s: string) => formatDateLocale(s, locale);
  const fmtTime = (t2: string) => formatTimeLocale(t2, locale);
  const fmtPrice = (price: number | null | undefined) =>
    price !== null && price !== undefined ? formatPrice(price, currency) : t("services.priceOnRequest");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    setLoadError(false);
    setNotFound(false);
    try {
      const res  = await fetch(`/api/booking-page-data?slug=${encodeURIComponent(businessSlug)}`);
      if (res.status === 404) { setNotFound(true); setLoading(false); return; }
      if (!res.ok) { setLoadError(true); setLoading(false); return; }
      const data = await res.json();
      setBusiness(data.business);
      setServices(data.services ?? []);
      setHours(data.hours ?? []);
      setExistingBookings(data.existingBookings ?? []);
      setStaffByService(data.staffByService ?? {});
      setHasStaff(data.has_staff ?? false);
      setDayNotes(data.dayNotes ?? []);
    } catch (e) {
      console.error("loadAll error:", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleServiceSelect(svc: Service) {
    const isSame = svc.id === selectedService?.id;
    setSelectedService(isSame ? null : svc);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedSession(null);
    setSelectedStaff("no-pref");
    setFormError("");
    setCustomAnswers({});
    setCustomErrors({});

    if (!isSame && business) {
      try {
        const res  = await fetch(`/api/booking-page-data?slug=${encodeURIComponent(businessSlug)}&serviceId=${encodeURIComponent(svc.id)}`);
        if (res.ok) {
          const data = await res.json();
          setCustomFields(data.customFields ?? []);
        }
      } catch { setCustomFields([]); }
    }

    if (!isSame && svc.is_group_service && business) {
      setLoadingSessions(true);
      try {
        const res  = await fetch(`/api/group-sessions?businessId=${encodeURIComponent(business.id)}&serviceId=${encodeURIComponent(svc.id)}`);
        if (!res.ok) {
          console.error("group-sessions fetch failed with status:", res.status);
          setGroupSessions([]);
        } else {
          const data = await res.json();
          setGroupSessions(data.sessions ?? []);
        }
      } catch (e) {
        console.error("group-sessions fetch error:", e);
        setGroupSessions([]);
      }
      finally { setLoadingSessions(false); }
    } else {
      setGroupSessions([]);
    }
  }

  function handleDateSelect(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedTime(null);
    setFormError("");

    const note = dayNotes.find(n => n.date === dateStr);
    if (isDayNoteWholeDayBlocked(note)) {
      setClosedDay(true);
      setDayBlockMessage(note!.block_type === "walk_ins_only" ? t("dn.walkInsOnlyMessage") : t("dn.dayBlockedMessage"));
      setSlots([]);
      return;
    }
    setDayBlockMessage(null);

    const dow      = new Date(dateStr + "T00:00:00").getDay();
    const dayHours = hours.find(h => h.day_of_week === dow);
    if (!dayHours) { setClosedDay(true); setSlots([]); return; }
    const allSlots = generateSlots(dayHours.start_time, dayHours.end_time);
    const taken    = new Set(existingBookings.filter(b => b.booking_date === dateStr).map(b => b.booking_time.slice(0, 5)));
    setClosedDay(false);
    setSlots(filterBlockedSlots(allSlots.filter(s => !taken.has(s)), note));
  }

  function validateForm(): boolean {
    const errs = { name: "", email: "", phone: "" };
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = t("book.err.name");
    if (!EMAIL_RE.test(form.email.trim()))                 errs.email = t("book.err.email");
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 10)                                errs.phone = t("book.err.phone");
    setFieldErrors(errs);

    const cfErrs: Record<string, string> = {};
    customFields.forEach(f => {
      if (f.is_required && !(customAnswers[f.id] ?? "").trim()) {
        cfErrs[f.id] = `${f.label} ${t("book.err.requiredSuffix")}`;
      }
    });
    setCustomErrors(cfErrs);

    return !errs.name && !errs.email && !errs.phone && Object.keys(cfErrs).length === 0;
  }
  function handleFieldChange(field: "name" | "email" | "phone" | "note", val: string) {
    setForm(f => ({ ...f, [field]: val }));
    if (field === "name")  setFieldErrors(e => ({ ...e, name:  val.trim().length >= 2 ? "" : t("book.err.name") }));
    if (field === "email") setFieldErrors(e => ({ ...e, email: EMAIL_RE.test(val.trim()) ? "" : t("book.err.email") }));
    if (field === "phone") {
      const d = val.replace(/\D/g, "");
      setFieldErrors(e => ({ ...e, phone: d.length >= 10 ? "" : t("book.err.phone") }));
    }
  }

  async function submitBooking(isGroup: boolean) {
    if (!business || !selectedService) return;
    if (!validateForm()) return;
    setFormError("");
    setSubmitting(true);

    const resolvedStaff: StaffMember | null = selectedStaff === "no-pref" ? null : selectedStaff;

    const customFieldAnswers = customFields
      .map(f => ({ customFieldId: f.id, answer: (customAnswers[f.id] ?? "").trim() }))
      .filter(a => a.answer);

    try {
      const common = {
        businessId:      business.id,
        serviceId:       selectedService.id,
        customerName:    form.name.trim(),
        customerEmail:   form.email.trim(),
        customerPhone:   form.phone.trim(),
        notes:           form.note.trim() || null,
        staffId:         resolvedStaff?.id   ?? null,
        staffPreference: resolvedStaff?.name ?? "any",
        customFieldAnswers,
        serviceName:     selectedService.name,
        duration:        selectedService.duration,
        price:           selectedService.price,
        businessName:    business.business_name,
        ownerEmail:      business.email,
        currency,
        locale,
      };
      const body = isGroup
        ? { ...common, groupSessionId: selectedSession!.id, bookingDate: selectedSession!.session_date, bookingTime: selectedSession!.session_time }
        : { ...common, bookingDate: selectedDate!, bookingTime: selectedTime! };

      const res  = await fetch("/api/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) { setFormError(data.error ?? t("book.err.generic")); return; }

      setConfirmedData({
        service:  selectedService,
        date:     isGroup ? selectedSession!.session_date : selectedDate!,
        time:     isGroup ? selectedSession!.session_time : selectedTime!,
        name:     form.name.trim(),
        email:    form.email.trim(),
        isGroup,
      });
      setConfirmed(true);
    } catch {
      setFormError(t("book.err.network"));
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Confirmation Screen ────────────────────────────────── */
  if (confirmed && confirmedData) {
    const waNumber = business?.whatsapp_number;
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md flex justify-end mb-3">
          <LanguageToggle />
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="text-6xl mb-4">&#127881;</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            {confirmedData.isGroup ? t("book.confirm.reserved") : t("book.confirm.booked")}
          </h1>
          <p className="text-gray-500 text-sm mb-6">{t("book.confirm.sub")}</p>
          <div className="bg-indigo-50 rounded-xl p-5 text-start space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t("book.confirm.service")}</span>
              <span className="font-semibold text-gray-800">{confirmedData.service.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t("book.confirm.duration")}</span>
              <span className="font-semibold text-gray-800">{confirmedData.service.duration} {t("book.confirm.minutes")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t("book.confirm.price")}</span>
              <span className="font-semibold text-indigo-600">{fmtPrice(confirmedData.service.price)}</span>
            </div>
            <div className="border-t border-indigo-100 pt-3 flex justify-between text-sm">
              <span className="text-gray-500">{t("book.confirm.date")}</span>
              <span className="font-semibold text-gray-800">{fmtDate(confirmedData.date)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t("book.confirm.time")}</span>
              <span className="font-semibold text-gray-800">{fmtTime(confirmedData.time)}</span>
            </div>
            <div className="border-t border-indigo-100 pt-3 flex justify-between text-sm">
              <span className="text-gray-500">{t("book.confirm.name")}</span>
              <span className="font-semibold text-gray-800">{confirmedData.name}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-6">
            {t("book.confirm.emailNote")} <span className="font-medium text-gray-600">{confirmedData.email}</span>
          </p>
          {waNumber && (
            <div className="mb-4">
              <WhatsAppButton
                href={waLink(waNumber, waBookingText(locale, confirmedData.service.name, fmtDate(confirmedData.date)))}
                label={t("book.confirm.whatsapp")}
                full
              />
            </div>
          )}
          <a href="/" className="block w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition text-center">
            {t("common.backToHome")}
          </a>
        </div>
      </div>
    );
  }

  /* ─── Loading / Not Found ────────────────────────────────── */
  if (loading) return <BookingSkeleton />;

  if (loadError) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-6xl mb-4">&#9888;&#65039;</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{t("book.err.somethingWrong")}</h1>
      <p className="text-gray-500 mb-6 text-center">{t("book.err.loadPage")}</p>
      <button
        onClick={() => loadAll()}
        className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition"
      >
        {t("common.retry")}
      </button>
    </div>
  );
  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-6xl mb-4">404</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{t("book.notFound.title")}</h1>
      <p className="text-gray-500">{t("book.notFound.body")} &ldquo;{businessSlug}&rdquo;.</p>
    </div>
  );

  const isGroupService       = !!selectedService?.is_group_service;
  const serviceStaff         = selectedService ? (staffByService[selectedService.id] ?? []) : [];
  const showStaffStep        = hasStaff && !!selectedService && serviceStaff.length > 0;
  const staffStepComplete    = !showStaffStep || selectedStaff !== null;
  const readyFor1on1Form     = !!(selectedService && !isGroupService && selectedDate && selectedTime && staffStepComplete);
  const readyForGroupForm    = !!(selectedService && isGroupService && selectedSession && staffStepComplete);

  const dateStepNum  = showStaffStep ? 3 : 2;
  const timeStepNum  = showStaffStep ? 4 : 3;
  const formStepNum  = isGroupService ? (showStaffStep ? 3 : 2) : (showStaffStep ? 5 : 4);

  const waNumber = business!.whatsapp_number;

  /* ─── Main Booking UI ────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-2xl font-bold text-indigo-600 shrink-0">
            {business!.business_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-800">{t("book.welcome")} {business!.business_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{t("book.subtitle")}</p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <LanguageToggle />
            {waNumber && (
              <WhatsAppButton href={waLink(waNumber, waHeaderText(locale))} label={t("book.whatsapp")} />
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {services.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
            {t("book.noServices")}
          </div>
        )}
        {/* Hours warning only gates the 1-on-1 calendar flow — group sessions
            carry their own explicit date/time and must not be blocked. */}
        {selectedService && !isGroupService && hours.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
            {t("book.hoursNotConfigured")}
          </div>
        )}

        {/* STEP 1 — Service */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold me-2">1</span>
            {t("book.step.selectService")}
          </h2>
          {services.length === 0
            ? <p className="text-gray-400 text-sm">{t("book.noServicesShort")}</p>
            : <div className="grid gap-3 sm:grid-cols-2">
                {services.map(svc => (
                  <button key={svc.id} onClick={() => handleServiceSelect(svc)}
                    className={`text-start p-4 rounded-xl border-2 transition
                      ${selectedService?.id === svc.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white hover:border-indigo-300"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-800">{svc.name}</p>
                      {svc.is_group_service && (
                        <span className="shrink-0 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{t("book.group")}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-gray-500">{svc.duration} {t("book.minutesShort")}</span>
                      <span className="text-sm font-medium text-indigo-600">{fmtPrice(svc.price)}</span>
                    </div>
                  </button>
                ))}
              </div>
          }
        </section>

        {/* STEP 1.5 — Staff selection */}
        {selectedService && showStaffStep && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold me-2">2</span>
              {t("book.step.chooseTeam")}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <StaffCard member={null} selected={selectedStaff === "no-pref"} onSelect={() => setSelectedStaff("no-pref")} t={t} />
              {serviceStaff.map(member => (
                <StaffCard
                  key={member.id}
                  member={member}
                  selected={typeof selectedStaff === "object" && selectedStaff !== null && selectedStaff.id === member.id}
                  onSelect={() => setSelectedStaff(member)}
                  t={t}
                />
              ))}
            </div>
          </section>
        )}

        {/* GROUP FLOW — session picker */}
        {selectedService && isGroupService && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold me-2">
                {showStaffStep ? 3 : 2}
              </span>
              {t("book.step.chooseSession")}
            </h2>
            {loadingSessions ? (
              <p className="text-gray-400 text-sm">{t("book.loadingSessions")}</p>
            ) : groupSessions.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
                {t("book.noSessions")}
              </div>
            ) : (
              <div className="space-y-3">
                {groupSessions.map(session => {
                  const remaining = session.capacity - session.booked_count;
                  const isFull    = remaining <= 0;
                  const isSel     = selectedSession?.id === session.id;
                  return (
                    <button key={session.id}
                      onClick={() => { if (!isFull) { setSelectedSession(isSel ? null : session); setFormError(""); } }}
                      disabled={isFull}
                      className={`w-full text-start p-4 rounded-xl border-2 transition
                        ${isSel ? "border-indigo-500 bg-indigo-50" : isFull ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed" : "border-gray-200 bg-white hover:border-indigo-300"}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-800">
                            {fmtDate(session.session_date)} &mdash; {fmtTime(session.session_time)}
                          </p>
                          {session.notes && <p className="text-xs text-gray-500 mt-0.5">{session.notes}</p>}
                        </div>
                        <div className="shrink-0 text-end">
                          {isFull ? (
                            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">{t("book.full")}</span>
                          ) : (
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                              remaining <= 3
                                ? "text-amber-700 bg-amber-50 border-amber-100"
                                : "text-emerald-700 bg-emerald-50 border-emerald-100"
                            }`}>
                              {remaining} {remaining === 1 ? t("book.spotLeft") : t("book.spotsLeft")}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 1-ON-1 FLOW — date */}
        {selectedService && !isGroupService && (
          <>
            <section>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold me-2">
                  {dateStepNum}
                </span>
                {t("book.step.pickDate")}
              </h2>
              <MiniCalendar selected={selectedDate} onSelect={handleDateSelect} minDate={today} maxDate={maxDate} locale={locale} />
            </section>

            {selectedDate && (
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold me-2">
                    {timeStepNum}
                  </span>
                  {t("book.step.pickTime")}
                </h2>
                {closedDay
                  ? <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
                      {dayBlockMessage ?? t("book.closedDay")}
                    </div>
                  : slots.length === 0
                    ? <p className="text-gray-400 text-sm">{t("book.noSlots")}</p>
                    : <div className="flex flex-wrap gap-2">
                        {slots.map(slot => (
                          <button key={slot}
                            onClick={() => { setSelectedTime(slot === selectedTime ? null : slot); setFormError(""); }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition
                              ${selectedTime === slot
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:text-indigo-600"}`}
                          >
                            {fmtTime(slot)}
                          </button>
                        ))}
                      </div>
                }
              </section>
            )}
          </>
        )}

        {/* BOOKING FORM */}
        {(readyFor1on1Form || readyForGroupForm) && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold me-2">
                {formStepNum}
              </span>
              {t("book.step.yourDetails")}
            </h2>

            {/* Summary bar */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span><span className="text-gray-500">{t("book.summary.service")}</span> <strong>{selectedService!.name}</strong></span>
              <span><span className="text-gray-500">{t("book.summary.price")}</span> <strong className="text-indigo-600">{fmtPrice(selectedService!.price)}</strong></span>
              {isGroupService && selectedSession
                ? <>
                    <span><span className="text-gray-500">{t("book.summary.date")}</span> <strong>{fmtDate(selectedSession.session_date)}</strong></span>
                    <span><span className="text-gray-500">{t("book.summary.time")}</span> <strong>{fmtTime(selectedSession.session_time)}</strong></span>
                  </>
                : <>
                    <span><span className="text-gray-500">{t("book.summary.date")}</span> <strong>{fmtDate(selectedDate!)}</strong></span>
                    <span><span className="text-gray-500">{t("book.summary.time")}</span> <strong>{fmtTime(selectedTime!)}</strong></span>
                  </>
              }
              {showStaffStep && (
                <span>
                  <span className="text-gray-500">{t("book.summary.teamMember")}</span>{" "}
                  <strong>
                    {selectedStaff === "no-pref" || selectedStaff === null
                      ? t("book.noPreference")
                      : (selectedStaff as StaffMember).name}
                  </strong>
                </span>
              )}
            </div>

            <form
              onSubmit={e => { e.preventDefault(); submitBooking(isGroupService); }}
              className="bg-white rounded-xl shadow-sm p-6 space-y-4"
            >
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("book.field.fullName")} *</label>
                <input type="text" value={form.name} onChange={e => handleFieldChange("name", e.target.value)}
                  placeholder={t("book.placeholder.name")} minLength={2} maxLength={80}
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${fieldErrors.name ? "border-red-400 bg-red-50" : "border-gray-300"}`} />
                {fieldErrors.name && <p className="text-red-600 text-xs mt-1">{fieldErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("book.field.email")} *</label>
                <input type="email" value={form.email} onChange={e => handleFieldChange("email", e.target.value)}
                  placeholder={t("book.placeholder.email")} dir="ltr"
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${fieldErrors.email ? "border-red-400 bg-red-50" : "border-gray-300"}`} />
                {fieldErrors.email && <p className="text-red-600 text-xs mt-1">{fieldErrors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("book.field.phone")} *</label>
                <input type="tel" value={form.phone} onChange={e => handleFieldChange("phone", e.target.value)}
                  placeholder={t("book.placeholder.phone")} dir="ltr"
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${fieldErrors.phone ? "border-red-400 bg-red-50" : "border-gray-300"}`} />
                {fieldErrors.phone && <p className="text-red-600 text-xs mt-1">{fieldErrors.phone}</p>}
              </div>

              {/* Custom fields (labels are owner-authored — never translated) */}
              {customFields.map(cf => (
                <div key={cf.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {cf.label}{" "}
                    {cf.is_required
                      ? <span className="text-red-500">*</span>
                      : <span className="text-gray-400 font-normal">{t("common.optional")}</span>}
                  </label>
                  <input
                    type="text"
                    value={customAnswers[cf.id] ?? ""}
                    onChange={e => {
                      const val = e.target.value;
                      setCustomAnswers(a => ({ ...a, [cf.id]: val }));
                      if (cf.is_required && val.trim()) {
                        setCustomErrors(errs => { const n = { ...errs }; delete n[cf.id]; return n; });
                      }
                    }}
                    placeholder={cf.placeholder ?? ""}
                    className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                      customErrors[cf.id] ? "border-red-400 bg-red-50" : "border-gray-300"
                    }`}
                  />
                  {customErrors[cf.id] && (
                    <p className="text-red-600 text-xs mt-1">{customErrors[cf.id]}</p>
                  )}
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("book.field.specialRequests")} <span className="text-gray-400 font-normal">{t("common.optional")}</span>
                </label>
                <textarea value={form.note} onChange={e => handleFieldChange("note", e.target.value)}
                  placeholder={t("book.placeholder.note")} rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-60 transition text-base">
                {submitting ? t("book.submit.booking") : isGroupService ? t("book.submit.reserve") : t("book.submit.book")}
              </button>
            </form>
          </section>
        )}

        {/* Location block — only rendered when the business has a non-empty address */}
        {business!.address && (
          <section className="pb-4">
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{t("book.location")}</h2>
              <p className="text-sm text-gray-700 mb-3 whitespace-pre-line">{business!.address}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(business!.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:underline"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {t("book.viewOnMap")}
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
