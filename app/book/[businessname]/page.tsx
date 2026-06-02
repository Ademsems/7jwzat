"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { slugifyBusinessName } from "@/lib/slug";

/* ─── Types ─────────────────────────────────────── */
interface Business { id: string; business_name: string; email: string; }
interface Service  { id: string; name: string; duration: number; price: number; }
interface BusinessHour { day_of_week: number; start_time: string; end_time: string; }

/* ─── Helpers ───────────────────────────────────── */
function generateSlots(start: string, end: string): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur < endMin) {
    slots.push(`${String(Math.floor(cur / 60)).padStart(2,"0")}:${String(cur % 60).padStart(2,"0")}`);
    cur += 30;
  }
  return slots;
}

function isoDate(d: Date) {
  // Use local date parts to avoid UTC midnight shifting the date
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-AE", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}
function getErr(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) return String((err as {message:unknown}).message);
  return "Something went wrong.";
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DNAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

/* ─── Mini Calendar ─────────────────────────────── */
function MiniCalendar({ selected, onSelect, minDate, maxDate }:
  { selected: string|null; onSelect:(d:string)=>void; minDate:Date; maxDate:Date }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const year = view.getFullYear(), month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number|null)[] = [...Array(firstDay).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 select-none">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setView(new Date(year, month-1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 text-lg">&#8249;</button>
        <span className="font-semibold text-gray-800">{MONTHS[month]} {year}</span>
        <button onClick={() => setView(new Date(year, month+1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 text-lg">&#8250;</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DNAMES.map(d => <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const date = new Date(year, month, day);
          const dateStr = isoDate(date);
          const isSelected = selected === dateStr;
          const isToday = isoDate(today) === dateStr;
          const disabled = date < minDate || date > maxDate;
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

/* ─── Main Page ─────────────────────────────────── */
const EMPTY_FORM = { name: "", email: "", phone: "", note: "" };
const EMPTY_ERRORS = { name: "", email: "", phone: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BookPage({ params }: { params: { businessname: string } }) {
  // Normalise the URL param — handles both "malak-salon" and "malak%20salon"
  const businessSlug = slugifyBusinessName(decodeURIComponent(params.businessname));

  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business|null>(null);
  const [notFound, setNotFound] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours] = useState<BusinessHour[]>([]);

  const [selectedService, setSelectedService] = useState<Service|null>(null);
  const [selectedDate, setSelectedDate] = useState<string|null>(null);
  const [selectedTime, setSelectedTime] = useState<string|null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [closedDay, setClosedDay] = useState(false);

  // Booking form
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState(EMPTY_ERRORS);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedData, setConfirmedData] = useState<{service:Service;date:string;time:string;name:string;email:string}|null>(null);

  const today = new Date(); today.setHours(0,0,0,0);
  const maxDate = new Date(today); maxDate.setDate(today.getDate() + 30);

  useEffect(() => { loadBusiness(); }, []);

  async function loadBusiness() {
    // Fetch all businesses and find the one whose slug matches the URL param
    const { data: users, error } = await supabase
      .from("users").select("id,business_name,email");
    if (error || !users) { setNotFound(true); setLoading(false); return; }
    const biz = users.find(u => slugifyBusinessName(u.business_name) === businessSlug);
    if (!biz) { setNotFound(true); setLoading(false); return; }
    setBusiness(biz);
    const [svcRes, hrRes] = await Promise.all([
      supabase.from("services").select("*").eq("user_id", biz.id).order("created_at"),
      supabase.from("business_hours").select("*").eq("user_id", biz.id),
    ]);
    if (svcRes.data) setServices(svcRes.data);
    if (hrRes.data) setHours(hrRes.data);
    setLoading(false);
  }

  function handleDateSelect(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedTime(null);
    setFormError("");
    const dow = new Date(dateStr + "T00:00:00").getDay();
    const dayHours = hours.find(h => h.day_of_week === dow);
    if (!dayHours) { setClosedDay(true); setSlots([]); }
    else { setClosedDay(false); setSlots(generateSlots(dayHours.start_time, dayHours.end_time)); }
  }

  function validateForm(): boolean {
    const errs = { name: "", email: "", phone: "" };
    if (!form.name.trim() || form.name.trim().length < 2) errs.name = "Full name required (min 2 characters).";
    if (!EMAIL_RE.test(form.email.trim())) errs.email = "Please enter a valid email address.";
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 10) errs.phone = "Phone must have at least 10 digits.";
    setFieldErrors(errs);
    return !errs.name && !errs.email && !errs.phone;
  }
  function handleFieldChange(field: "name"|"email"|"phone"|"note", val: string) {
    setForm(f => ({...f, [field]: val}));
    if (field === "name") setFieldErrors(e => ({...e, name: val.trim().length >= 2 ? "" : "Full name required (min 2 characters)."}));
    if (field === "email") setFieldErrors(e => ({...e, email: EMAIL_RE.test(val.trim()) ? "" : "Please enter a valid email address."}));
    if (field === "phone") {
      const d = val.replace(/\D/g, "");
      setFieldErrors(e => ({...e, phone: d.length >= 10 ? "" : "Phone must have at least 10 digits."}));
    }
  }

  async function handleBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!business || !selectedService || !selectedDate || !selectedTime) return;
    if (!validateForm()) return;
    setFormError("");
    setSubmitting(true);

    try {
      // Double-booking check
      const { data: existing } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("user_id", business.id)
        .eq("service_id", selectedService.id)
        .eq("booking_date", selectedDate)
        .eq("booking_time", selectedTime)
        .neq("status", "cancelled");

      if (existing && existing.length > 0) {
        setFormError("This time slot is already booked. Please choose another time.");
        setSubmitting(false);
        return;
      }

      // Insert booking
      const { error: insErr } = await supabase.from("bookings").insert({
        user_id: business.id,
        service_id: selectedService.id,
        customer_name: form.name.trim(),
        customer_email: form.email.trim(),
        customer_phone: form.phone.trim(),
        notes: form.note.trim() || null,
        booking_date: selectedDate,
        booking_time: selectedTime,
        status: "pending",
      });

      if (insErr) throw insErr;

      // Fire emails non-blocking (don't await, don't fail booking)
      fetch("/api/send-booking-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.name.trim(),
          customerEmail: form.email.trim(),
          customerPhone: form.phone.trim(),
          notes: form.note.trim() || null,
          serviceName: selectedService!.name,
          duration: selectedService!.duration,
          price: Number(selectedService!.price),
          bookingDate: selectedDate,
          bookingTime: selectedTime,
          businessName: business!.business_name,
          ownerEmail: business!.email,
        }),
      }).catch(e => console.error("Email dispatch failed:", e));

      setConfirmedData({
        service: selectedService,
        date: selectedDate,
        time: selectedTime,
        name: form.name.trim(),
        email: form.email.trim(),
      });
      setConfirmed(true);
    } catch (err) {
      setFormError(getErr(err));
    } finally {
      setSubmitting(false);
    }
  }

  /* ─── Confirmation Screen ────────────────────── */
  if (confirmed && confirmedData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Booking Confirmed!</h1>
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
              <span className="font-semibold text-gray-800">{confirmedData.time}</span>
            </div>
            <div className="border-t border-indigo-100 pt-3 flex justify-between text-sm">
              <span className="text-gray-500">Name</span>
              <span className="font-semibold text-gray-800">{confirmedData.name}</span>
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-6">
            A confirmation will be sent to <span className="font-medium text-gray-600">{confirmedData.email}</span>
          </p>

          <a href="/"
            className="block w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition text-center">
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  /* ─── Loading / Not Found ───────────────────── */
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

  const readyForForm = !!(selectedService && selectedDate && selectedTime);

  /* ─── Main Booking UI ───────────────────────── */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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

        {/* Edge-case banners */}
        {!loading && services.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm mb-6">
            This business currently has no services available. Please check back later.
          </div>
        )}
        {!loading && hours.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm mb-6">
            Business hours have not been configured yet. Please check back later.
          </div>
        )}

        {/* Step 1: Service */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-2">1</span>
            Select a Service
          </h2>
          {services.length === 0
            ? <p className="text-gray-400 text-sm">No services available. Please check back later.</p>
            : <div className="grid gap-3 sm:grid-cols-2">
                {services.map(svc => (
                  <button key={svc.id} onClick={() => { setSelectedService(svc.id === selectedService?.id ? null : svc); setFormError(""); }}
                    className={`text-left p-4 rounded-xl border-2 transition
                      ${selectedService?.id === svc.id ? "border-indigo-500 bg-indigo-50" : "border-gray-200 bg-white hover:border-indigo-300"}`}>
                    <p className="font-semibold text-gray-800">{svc.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-gray-500">{svc.duration} min</span>
                      <span className="text-sm font-medium text-indigo-600">AED {Number(svc.price).toFixed(2)}</span>
                    </div>
                  </button>
                ))}
              </div>
          }
        </section>

        {/* Step 2: Date */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-2">2</span>
            Pick a Date
          </h2>
          <MiniCalendar selected={selectedDate} onSelect={handleDateSelect} minDate={today} maxDate={maxDate} />
        </section>

        {/* Step 3: Time */}
        {selectedDate && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-2">3</span>
              Pick a Time
            </h2>
            {closedDay
              ? <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">This business is closed on this day. Please pick another date.</div>
              : slots.length === 0
                ? <p className="text-gray-400 text-sm">No available slots.</p>
                : <div className="flex flex-wrap gap-2">
                    {slots.map(slot => (
                      <button key={slot} onClick={() => { setSelectedTime(slot === selectedTime ? null : slot); setFormError(""); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition
                          ${selectedTime === slot ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:text-indigo-600"}`}>
                        {slot}
                      </button>
                    ))}
                  </div>
            }
          </section>
        )}

        {/* Step 4: Your Details (form) */}
        {readyForForm && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-2">4</span>
              Your Details
            </h2>

            {/* Summary bar */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span><span className="text-gray-500">Service:</span> <strong>{selectedService!.name}</strong></span>
              <span><span className="text-gray-500">Price:</span> <strong className="text-indigo-600">AED {Number(selectedService!.price).toFixed(2)}</strong></span>
              <span><span className="text-gray-500">Date:</span> <strong>{fmtDate(selectedDate!)}</strong></span>
              <span><span className="text-gray-500">Time:</span> <strong>{selectedTime}</strong></span>
            </div>

            <form onSubmit={handleBooking} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea value={form.note} onChange={e => handleFieldChange("note", e.target.value)}
                  placeholder="Any notes for the business..." rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-60 transition text-base">
                {submitting ? "Booking..." : "Book Now"}
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}