"use client";

import { useEffect, useState } from "react";
import { slugifyBusinessName } from "@/lib/slug";

/**
 * Public booking page.
 *
 * ALL data fetching goes through server-side API routes (service-role key).
 *
 *   GET  /api/booking-page-data?slug=   → business + services + hours + bookings + staff
 *   GET  /api/group-sessions?businessId=&serviceId=  → upcoming group sessions
 *   POST /api/create-booking            → upsert customer + insert booking + emails
 */

/* ─── Types ──────────────────────────────────────────────── */
interface Business   { id: string; business_name: string; email: string; }
interface Service    { id: string; name: string; duration: number; price: number; is_group_service: boolean; }
interface StaffMember { id: string; name: string; role: string | null; bio: string | null; }
interface BusinessHour { day_of_week: number; start_time: string; end_time: string; }
interface ExistingBooking { booking_date: string; booking_time: string; }
interface GroupSession {
  id: string; service_id: string; session_date: string; session_time: string;
  capacity: number; notes: string | null; booked_count: number;
}
interface CustomField { id: string; label: string; placeholder: string | null; is_required: boolean; }

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
function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-AE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}
function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DNAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

/* ─── Mini Calendar ──────────────────────────────────────── */
function MiniCalendar({ selected, onSelect, minDate, maxDate }:
  { selected: string | null; onSelect: (d: string) => void; minDate: Date; maxDate: Date }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = view.getFullYear(), month = view.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 select-none">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setView(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 text-lg">&#8249;</button>
        <span className="font-semibold text-gray-800">{MONTHS[month]} {year}</span>
        <button onClick={() => setView(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 text-lg">&#8250;</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DNAMES.map(d => <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>)}
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
function StaffCard({ member, selected, onSelect }: {
  member: StaffMember | null; // null = "No preference"
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left p-4 rounded-xl border-2 transition w-full
        ${selected
          ? "border-emerald-500 bg-emerald-50"
          : "border-gray-200 bg-white hover:border-emerald-300"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0
          ${selected ? "bg-emerald-200 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
          {member ? member.name.charAt(0).toUpperCase() : "&#128100;"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-800 text-sm">
              {member ? member.name : "No preference"}
            </p>
            {selected && <span className="text-emerald-600 text-xs font-bold">&#10003;</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {member
              ? (member.role ?? "Team member")
              : "We'll assign the best available person"}
          </p>
          {member?.bio && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">{member.bio}</p>
          )}
        </div>
      </div>
    </button>
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

  const [loading, setLoading]   = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours]       = useState<BusinessHour[]>([]);
  const [existingBookings, setExistingBookings] = useState<ExistingBooking[]>([]);

  // Staff
  const [staffByService, setStaffByService] = useState<Record<string, StaffMember[]>>({});
  const [hasStaff, setHasStaff]             = useState(false);
  const [selectedStaff, setSelectedStaff]   = useState<StaffMember | null | "no-pref">("no-pref");
  // "no-pref" = customer chose "No preference", null = not yet shown/selected, StaffMember = specific choice

  // 1-on-1 flow
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate]       = useState<string | null>(null);
  const [selectedTime, setSelectedTime]       = useState<string | null>(null);
  const [slots, setSlots]                     = useState<string[]>([]);
  const [closedDay, setClosedDay]             = useState(false);

  // Group flow
  const [groupSessions, setGroupSessions]     = useState<GroupSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<GroupSession | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Custom fields
  const [customFields, setCustomFields]         = useState<CustomField[]>([]);
  const [customAnswers, setCustomAnswers]       = useState<CustomFieldAnswers>({});
  const [customErrors, setCustomErrors]         = useState<Record<string, string>>({});

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

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const res  = await fetch(`/api/booking-page-data?slug=${encodeURIComponent(businessSlug)}`);
      if (res.status === 404) { setNotFound(true); setLoading(false); return; }
      if (!res.ok) { setNotFound(true); setLoading(false); return; }
      const data = await res.json();
      setBusiness(data.business);
      setServices(data.services ?? []);
      setHours(data.hours ?? []);
      setExistingBookings(data.existingBookings ?? []);
      setStaffByService(data.staffByService ?? {});
      setHasStaff(data.has_staff ?? false);
    } catch (e) {
      console.error("loadAll error:", e);
      setNotFound(true);
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
      // Fetch custom fields for this service (apply_to_all + service-specific)
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
        const data = await res.json();
        setGroupSessions(data.sessions ?? []);
      } catch { setGroupSessions([]); }
      finally { setLoadingSessions(false); }
    } else {
      setGroupSessions([]);
    }
  }

  function handleDateSelect(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedTime(null);
    setFormError("");
    const dow      = new Date(dateStr + "T00:00:00").getDay();
    const dayHours = hours.find(h => h.day_of_week === dow);
    if (!dayHours) { setClosedDay(true); setSlots([]); return; }
    const allSlots = generateSlots(dayHours.start_time, dayHours.end_time);
    const taken    = new Set(existingBookings.filter(b => b.booking_date === dateStr).map(b => b.booking_time.slice(0, 5)));
    setClosedDay(false);
    setSlots(allSlots.filter(s => !taken.has(s)));
  }

  function validateForm(): boolean {
    const errs = { name: "", email: "", phone: "" };
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = "Full name required (min 2 characters).";
    if (!EMAIL_RE.test(form.email.trim()))                 errs.email = "Please enter a valid email address.";
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 10)                                errs.phone = "Phone must have at least 10 digits.";
    setFieldErrors(errs);

    // Validate required custom fields
    const cfErrs: Record<string, string> = {};
    customFields.forEach(f => {
      if (f.is_required && !(customAnswers[f.id] ?? "").trim()) {
        cfErrs[f.id] = `${f.label} is required.`;
      }
    });
    setCustomErrors(cfErrs);

    return !errs.name && !errs.email && !errs.phone && Object.keys(cfErrs).length === 0;
  }
  function handleFieldChange(field: "name" | "email" | "phone" | "note", val: string) {
    setForm(f => ({ ...f, [field]: val }));
    if (field === "name")  setFieldErrors(e => ({ ...e, name:  val.trim().length >= 2 ? "" : "Full name required (min 2 characters)." }));
    if (field === "email") setFieldErrors(e => ({ ...e, email: EMAIL_RE.test(val.trim()) ? "" : "Please enter a valid email address." }));
    if (field === "phone") {
      const d = val.replace(/\D/g, "");
      setFieldErrors(e => ({ ...e, phone: d.length >= 10 ? "" : "Phone must have at least 10 digits." }));
    }
  }

  async function submitBooking(isGroup: boolean) {
    if (!business || !selectedService) return;
    if (!validateForm()) return;
    setFormError("");
    setSubmitting(true);

    const resolvedStaff: StaffMember | null = selectedStaff === "no-pref" ? null : selectedStaff;

    // Build customFieldAnswers array
    const customFieldAnswers = customFields
      .map(f => ({ customFieldId: f.id, answer: (customAnswers[f.id] ?? "").trim() }))
      .filter(a => a.answer);

    try {
      const body = isGroup
        ? {
            businessId:         business.id,
            serviceId:          selectedService.id,
            groupSessionId:     selectedSession!.id,
            bookingDate:        selectedSession!.session_date,
            bookingTime:        selectedSession!.session_time,
            customerName:       form.name.trim(),
            customerEmail:      form.email.trim(),
            customerPhone:      form.phone.trim(),
            notes:              form.note.trim() || null,
            staffId:            resolvedStaff?.id   ?? null,
            staffPreference:    resolvedStaff?.name ?? "any",
            customFieldAnswers,
            serviceName:        selectedService.name,
            duration:           selectedService.duration,
            price:              Number(selectedService.price),
            businessName:       business.business_name,
            ownerEmail:         business.email,
          }
        : {
            businessId:         business.id,
            serviceId:          selectedService.id,
            bookingDate:        selectedDate!,
            bookingTime:        selectedTime!,
            customerName:       form.name.trim(),
            customerEmail:      form.email.trim(),
            customerPhone:      form.phone.trim(),
            notes:              form.note.trim() || null,
            staffId:            resolvedStaff?.id   ?? null,
            staffPreference:    resolvedStaff?.name ?? "any",
            customFieldAnswers,
            serviceName:        selectedService.name,
            duration:           selectedService.duration,
            price:              Number(selectedService.price),
            businessName:       business.business_name,
            ownerEmail:         business.email,
          };

      const res  = await fetch("/api/create-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) { setFormError(data.error ?? "Something went wrong. Please try again."); return; }

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
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Confirmation Screen ────────────────────────────────── */
  if (confirmed && confirmedData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="text-6xl mb-4">&#127881;</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">
            {confirmedData.isGroup ? "Spot Reserved!" : "Booking Confirmed!"}
          </h1>
          <p className="text-gray-500 text-sm mb-6">Your appointment has been booked.</p>
          <div className="bg-indigo-50 rounded-xl p-5 text-left space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Service</span>
              <span className="font-semibold text-gray-800">{confirmedData.service.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Duration</span>
              <span className="font-semibold text-gray-800">{confirmedData.service.duration} minutes</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Price</span>
              <span className="font-semibold text-indigo-600">AED {Number(confirmedData.service.price).toFixed(2)}</span>
            </div>
            <div className="border-t border-indigo-100 pt-3 flex justify-between text-sm">
              <span className="text-gray-500">Date</span>
              <span className="font-semibold text-gray-800">{fmtDate(confirmedData.date)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Time</span>
              <span className="font-semibold text-gray-800">{fmtTime(confirmedData.time)}</span>
            </div>
            <div className="border-t border-indigo-100 pt-3 flex justify-between text-sm">
              <span className="text-gray-500">Name</span>
              <span className="font-semibold text-gray-800">{confirmedData.name}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-6">
            A confirmation will be sent to <span className="font-medium text-gray-600">{confirmedData.email}</span>
          </p>
          <a href="/" className="block w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition text-center">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  /* ─── Loading / Not Found ────────────────────────────────── */
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Loading...</p>
    </div>
  );
  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-6xl mb-4">404</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Business not found</h1>
      <p className="text-gray-500">We could not find a business called &ldquo;{businessSlug}&rdquo;.</p>
    </div>
  );

  const isGroupService       = !!selectedService?.is_group_service;
  const serviceStaff         = selectedService ? (staffByService[selectedService.id] ?? []) : [];
  const showStaffStep        = hasStaff && !!selectedService && serviceStaff.length > 0;
  const staffStepComplete    = !showStaffStep || selectedStaff !== null;
  const readyFor1on1Form     = !!(selectedService && !isGroupService && selectedDate && selectedTime && staffStepComplete);
  const readyForGroupForm    = !!(selectedService && isGroupService && selectedSession && staffStepComplete);

  // Step numbering shifts when staff step is shown
  const dateStepNum  = showStaffStep ? 3 : 2;
  const timeStepNum  = showStaffStep ? 4 : 3;
  const formStepNum  = isGroupService ? (showStaffStep ? 3 : 2) : (showStaffStep ? 5 : 4);

  /* ─── Main Booking UI ────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-6 flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-2xl font-bold text-indigo-600">
            {business!.business_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Welcome to {business!.business_name}</h1>
            <p className="text-sm text-gray-500 mt-0.5">Book your appointment below</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {services.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
            This business currently has no services available. Please check back later.
          </div>
        )}
        {services.length > 0 && hours.length === 0 && !isGroupService && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
            Business hours have not been configured yet. Please check back later.
          </div>
        )}

        {/* STEP 1 — Service */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-2">1</span>
            Select a Service
          </h2>
          {services.length === 0
            ? <p className="text-gray-400 text-sm">No services available.</p>
            : <div className="grid gap-3 sm:grid-cols-2">
                {services.map(svc => (
                  <button key={svc.id} onClick={() => handleServiceSelect(svc)}
                    className={`text-left p-4 rounded-xl border-2 transition
                      ${selectedService?.id === svc.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white hover:border-indigo-300"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-gray-800">{svc.name}</p>
                      {svc.is_group_service && (
                        <span className="shrink-0 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Group</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-gray-500">{svc.duration} min</span>
                      <span className="text-sm font-medium text-indigo-600">AED {Number(svc.price).toFixed(2)}</span>
                    </div>
                  </button>
                ))}
              </div>
          }
        </section>

        {/* STEP 1.5 — Staff selection (only if business has staff for this service) */}
        {selectedService && showStaffStep && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-2">2</span>
              Choose a Team Member
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* No preference card — always first */}
              <StaffCard
                member={null}
                selected={selectedStaff === "no-pref"}
                onSelect={() => setSelectedStaff("no-pref")}
              />
              {/* Individual staff cards */}
              {serviceStaff.map(member => (
                <StaffCard
                  key={member.id}
                  member={member}
                  selected={typeof selectedStaff === "object" && selectedStaff !== null && selectedStaff.id === member.id}
                  onSelect={() => setSelectedStaff(member)}
                />
              ))}
            </div>
          </section>
        )}

        {/* GROUP FLOW — session picker */}
        {selectedService && isGroupService && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-2">
                {showStaffStep ? 3 : 2}
              </span>
              Choose a Session
            </h2>
            {loadingSessions ? (
              <p className="text-gray-400 text-sm">Loading sessions...</p>
            ) : groupSessions.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
                No upcoming sessions available for this service. Please check back later.
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
                      className={`w-full text-left p-4 rounded-xl border-2 transition
                        ${isSel ? "border-indigo-500 bg-indigo-50" : isFull ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed" : "border-gray-200 bg-white hover:border-indigo-300"}`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-800">
                            {fmtDate(session.session_date)} &mdash; {fmtTime(session.session_time)}
                          </p>
                          {session.notes && <p className="text-xs text-gray-500 mt-0.5">{session.notes}</p>}
                        </div>
                        <div className="shrink-0 text-right">
                          {isFull ? (
                            <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">Full</span>
                          ) : (
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                              remaining <= 3
                                ? "text-amber-700 bg-amber-50 border-amber-100"
                                : "text-emerald-700 bg-emerald-50 border-emerald-100"
                            }`}>
                              {remaining} spot{remaining !== 1 ? "s" : ""} left
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
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-2">
                  {dateStepNum}
                </span>
                Pick a Date
              </h2>
              <MiniCalendar selected={selectedDate} onSelect={handleDateSelect} minDate={today} maxDate={maxDate} />
            </section>

            {selectedDate && (
              <section>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-2">
                    {timeStepNum}
                  </span>
                  Pick a Time
                </h2>
                {closedDay
                  ? <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
                      This business is closed on this day. Please pick another date.
                    </div>
                  : slots.length === 0
                    ? <p className="text-gray-400 text-sm">No available time slots for this date.</p>
                    : <div className="flex flex-wrap gap-2">
                        {slots.map(slot => (
                          <button key={slot}
                            onClick={() => { setSelectedTime(slot === selectedTime ? null : slot); setFormError(""); }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition
                              ${selectedTime === slot
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:text-indigo-600"}`}
                          >
                            {slot}
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
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-2">
                {formStepNum}
              </span>
              Your Details
            </h2>

            {/* Summary bar */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span><span className="text-gray-500">Service:</span> <strong>{selectedService!.name}</strong></span>
              <span><span className="text-gray-500">Price:</span> <strong className="text-indigo-600">AED {Number(selectedService!.price).toFixed(2)}</strong></span>
              {isGroupService && selectedSession
                ? <>
                    <span><span className="text-gray-500">Date:</span> <strong>{fmtDate(selectedSession.session_date)}</strong></span>
                    <span><span className="text-gray-500">Time:</span> <strong>{fmtTime(selectedSession.session_time)}</strong></span>
                  </>
                : <>
                    <span><span className="text-gray-500">Date:</span> <strong>{fmtDate(selectedDate!)}</strong></span>
                    <span><span className="text-gray-500">Time:</span> <strong>{selectedTime}</strong></span>
                  </>
              }
              {showStaffStep && (
                <span>
                  <span className="text-gray-500">Team member:</span>{" "}
                  <strong>
                    {selectedStaff === "no-pref" || selectedStaff === null
                      ? "No preference"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" value={form.name} onChange={e => handleFieldChange("name", e.target.value)}
                  placeholder="Ahmed Ali" minLength={2} maxLength={80}
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${fieldErrors.name ? "border-red-400 bg-red-50" : "border-gray-300"}`} />
                {fieldErrors.name && <p className="text-red-600 text-xs mt-1">{fieldErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input type="email" value={form.email} onChange={e => handleFieldChange("email", e.target.value)}
                  placeholder="ahmed@example.com"
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${fieldErrors.email ? "border-red-400 bg-red-50" : "border-gray-300"}`} />
                {fieldErrors.email && <p className="text-red-600 text-xs mt-1">{fieldErrors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input type="tel" value={form.phone} onChange={e => handleFieldChange("phone", e.target.value)}
                  placeholder="+971 50 123 4567"
                  className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${fieldErrors.phone ? "border-red-400 bg-red-50" : "border-gray-300"}`} />
                {fieldErrors.phone && <p className="text-red-600 text-xs mt-1">{fieldErrors.phone}</p>}
              </div>

              {/* Custom fields */}
              {customFields.map(cf => (
                <div key={cf.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {cf.label}
                    {cf.is_required
                      ? <span className="text-red-500 ml-0.5">*</span>
                      : <span className="text-gray-400 font-normal ml-1">(optional)</span>}
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
                  Special Requests <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea value={form.note} onChange={e => handleFieldChange("note", e.target.value)}
                  placeholder="Any notes for the business..." rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-60 transition text-base">
                {submitting ? "Booking..." : isGroupService ? "Reserve My Spot" : "Book Now"}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
