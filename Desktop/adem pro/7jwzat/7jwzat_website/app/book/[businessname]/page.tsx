"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/* ─── Types ─────────────────────────────────────── */
interface Business {
  id: string;
  business_name: string;
  email: string;
}
interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
}
interface BusinessHour {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

/* ─── Helpers ───────────────────────────────────── */
function generateSlots(start: string, end: string): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur < endMin) {
    const h = String(Math.floor(cur / 60)).padStart(2, "0");
    const m = String(cur % 60).padStart(2, "0");
    slots.push(`${h}:${m}`);
    cur += 30;
  }
  return slots;
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];
const DAY_NAMES = ["Su","Mo","Tu","We","Th","Fr","Sa"];

/* ─── Mini Calendar ─────────────────────────────── */
function MiniCalendar({
  selected, onSelect, minDate, maxDate,
}: {
  selected: string | null;
  onSelect: (d: string) => void;
  minDate: Date;
  maxDate: Date;
}) {
  const today = new Date();
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setView(new Date(year, month - 1, 1));
  const nextMonth = () => setView(new Date(year, month + 1, 1));

  const cells: (number | null)[] = [...Array(firstDay).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition text-lg">&#8249;</button>
        <span className="font-semibold text-gray-800">{MONTH_NAMES[month]} {year}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition text-lg">&#8250;</button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>
      {/* Dates */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const date = new Date(year, month, day);
          const dateStr = isoDate(date);
          const isSelected = selected === dateStr;
          const isToday = isoDate(today) === dateStr;
          const disabled = date < minDate || date > maxDate;
          return (
            <button
              key={i}
              onClick={() => !disabled && onSelect(dateStr)}
              disabled={disabled}
              className={`mx-auto w-8 h-8 rounded-full text-sm flex items-center justify-center transition
                ${isSelected ? "bg-indigo-600 text-white font-semibold" : ""}
                ${isToday && !isSelected ? "border-2 border-indigo-400 text-indigo-600 font-semibold" : ""}
                ${!isSelected && !disabled ? "hover:bg-indigo-50 text-gray-700" : ""}
                ${disabled ? "text-gray-300 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────── */
export default function BookPage({ params }: { params: { businessname: string } }) {
  const businessSlug = decodeURIComponent(params.businessname);

  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours] = useState<BusinessHour[]>([]);

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [closedDay, setClosedDay] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 30);

  useEffect(() => { loadBusiness(); }, []);

  async function loadBusiness() {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, business_name, email")
      .ilike("business_name", businessSlug)
      .limit(1);

    if (error || !users || users.length === 0) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const biz = users[0];
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
    const dow = new Date(dateStr + "T00:00:00").getDay();
    const dayHours = hours.find(h => h.day_of_week === dow);
    if (!dayHours) {
      setClosedDay(true);
      setSlots([]);
    } else {
      setClosedDay(false);
      setSlots(generateSlots(dayHours.start_time, dayHours.end_time));
    }
  }

  /* ─── Render ─────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="text-6xl mb-4">404</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Business not found</h1>
        <p className="text-gray-500">We could not find a business called &ldquo;{businessSlug}&rdquo;.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-2xl font-bold text-indigo-600">
              {business!.business_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Welcome to {business!.business_name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">Book your appointment below</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Step 1: Select Service */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-2">1</span>
            Select a Service
          </h2>
          {services.length === 0 ? (
            <p className="text-gray-400 text-sm">No services available.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map(svc => (
                <button
                  key={svc.id}
                  onClick={() => setSelectedService(svc.id === selectedService?.id ? null : svc)}
                  className={`text-left p-4 rounded-xl border-2 transition ${
                    selectedService?.id === svc.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 bg-white hover:border-indigo-300"
                  }`}
                >
                  <p className="font-semibold text-gray-800">{svc.name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-gray-500">{svc.duration} min</span>
                    <span className="text-sm font-medium text-indigo-600">AED {Number(svc.price).toFixed(2)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Step 2: Pick a Date */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-2">2</span>
            Pick a Date
          </h2>
          <MiniCalendar
            selected={selectedDate}
            onSelect={handleDateSelect}
            minDate={today}
            maxDate={maxDate}
          />
        </section>

        {/* Step 3: Pick a Time */}
        {selectedDate && (
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-sm font-bold mr-2">3</span>
              Pick a Time
            </h2>
            {closedDay ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm">
                This business is closed on this day. Please pick another date.
              </div>
            ) : slots.length === 0 ? (
              <p className="text-gray-400 text-sm">No available slots.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.map(slot => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot === selectedTime ? null : slot)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                      selectedTime === slot
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:text-indigo-600"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Summary */}
        {selectedService && selectedDate && selectedTime && (
          <section className="bg-white border-2 border-indigo-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Booking Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Service</span>
                <span className="font-medium text-gray-800">{selectedService.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="font-medium text-gray-800">{selectedService.duration} minutes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Price</span>
                <span className="font-medium text-indigo-600">AED {Number(selectedService.price).toFixed(2)}</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium text-gray-800">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-AE", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric"
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Time</span>
                <span className="font-medium text-gray-800">{selectedTime}</span>
              </div>
            </div>
            <button
              disabled
              className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold opacity-60 cursor-not-allowed"
            >
              Confirm Booking (coming in next step)
            </button>
          </section>
        )}
      </div>
    </div>
  );
}