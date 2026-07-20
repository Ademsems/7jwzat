"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/components/Toast";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { InfoTooltip } from "@/components/InfoTooltip";

interface Service { id: string; name: string; }

type Mode = "blocked" | "manual";

// 30-min time slots from 05:00 to 23:30
function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 5; h < 24; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) continue;
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}
const TIME_SLOTS = buildTimeSlots();

const DURATIONS = [
  { label: "30 min",  value: 30  },
  { label: "1 hr",    value: 60  },
  { label: "1.5 hr",  value: 90  },
  { label: "2 hr",    value: 120 },
  { label: "3 hr",    value: 180 },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getErr(e: unknown) {
  return e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Something went wrong.";
}

export default function NewBookingPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [userId, setUserId] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [mode, setMode] = useState<Mode>("blocked");
  const [saving, setSaving] = useState(false);

  // Shared fields
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [internalNote, setInternalNote] = useState("");

  // Manual-only fields
  const [serviceId, setServiceId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth/login"); return; }
      setUserId(session.user.id);
      const { data } = await supabase.from("services").select("id, name").eq("user_id", session.user.id).order("created_at");
      setServices(data ?? []);
      if (data && data.length > 0) setServiceId(data[0].id);
    }
    init();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    if (mode === "manual") {
      if (!customerName.trim()) { showToast(t("nb.nameRequired"), "error"); return; }
      if (!customerPhone.trim()) { showToast(t("nb.phoneRequired"), "error"); return; }
      if (!serviceId) { showToast(t("nb.serviceRequired"), "error"); return; }
    }

    setSaving(true);
    try {
      // Manual bookings create-or-link a customer profile, same as the
      // public API. Blocked slots never do. A profile failure must not
      // block saving the booking.
      let customerId: string | null = null;
      if (mode === "manual") {
        try {
          const phone = customerPhone.trim();
          const { data: existing } = await supabase
            .from("customers")
            .select("id, name, email")
            .eq("user_id", userId)
            .eq("phone", phone)
            .maybeSingle();

          if (existing) {
            customerId = existing.id;
            const updates: Record<string, string> = {};
            if (existing.name !== customerName.trim()) updates.name = customerName.trim();
            if (customerEmail.trim() && existing.email !== customerEmail.trim()) updates.email = customerEmail.trim();
            if (Object.keys(updates).length > 0) {
              await supabase.from("customers").update(updates).eq("id", existing.id);
            }
          } else {
            const { data: newCust } = await supabase
              .from("customers")
              .insert({
                user_id: userId,
                name:    customerName.trim(),
                email:   customerEmail.trim() || null,
                phone,
              })
              .select("id")
              .single();
            customerId = newCust?.id ?? null;
          }
        } catch (profileErr) {
          console.error("manual booking: customer profile upsert failed (non-fatal):", profileErr);
        }
      }

      const payload =
        mode === "blocked"
          ? {
              user_id: userId,
              service_id: services[0]?.id ?? null, // minimal FK requirement
              customer_name: "BLOCKED",
              customer_email: "blocked@internal",
              customer_phone: "0000000000",
              booking_date: date,
              booking_time: startTime,
              status: "confirmed",
              booking_type: "blocked",
              internal_note: internalNote.trim() || null,
            }
          : {
              user_id: userId,
              service_id: serviceId,
              customer_id: customerId,
              customer_name: customerName.trim(),
              customer_email: customerEmail.trim() || "noemail@internal",
              customer_phone: customerPhone.trim(),
              booking_date: date,
              booking_time: startTime,
              status: "confirmed",
              booking_type: "manual",
              internal_note: internalNote.trim() || null,
            };

      const { error } = await supabase.from("bookings").insert(payload);
      if (error) throw error;

      showToast(mode === "blocked" ? t("nb.blockedOk") : t("nb.manualOk"));
      router.push("/dashboard/bookings");
    } catch (err) {
      showToast(getErr(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex-1 p-4 sm:p-8 max-w-xl">
      <div className="mb-6">
        <Link href="/dashboard/bookings" className="text-sm text-emerald-600 hover:underline">{t("nb.back")}</Link>
        <h2 className="text-2xl font-bold text-gray-800 mt-2 inline-flex items-center gap-2">{t("nb.title")} <InfoTooltip textKey="tip.page.bookings" /></h2>
        <p className="text-gray-500 text-sm mt-1">{t("nb.subtitle")}</p>
      </div>

      {/* Mode switcher */}
      <div className="flex items-center gap-2 mb-6">
      <div className="flex rounded-xl border border-gray-200 overflow-hidden flex-1 bg-gray-50">
        <button
          type="button"
          onClick={() => setMode("blocked")}
          className={`flex-1 py-2.5 text-sm font-semibold transition ${
            mode === "blocked" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          &#128683; {t("nb.blockTime")}
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex-1 py-2.5 text-sm font-semibold transition ${
            mode === "manual" ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          &#128203; {t("nb.addManual")}
        </button>
      </div>
      <InfoTooltip textKey="tip.nb.blockVsManual" />
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("nb.date")}</label>
          <input
            type="date"
            value={date}
            min={todayStr()}
            onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Start Time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("nb.startTime")}</label>
          <select
            value={startTime}
            onChange={e => setStartTime(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {TIME_SLOTS.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t("nb.duration")}</label>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDuration(d.value)}
                className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition ${
                  duration === d.value
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "border-gray-200 text-gray-700 hover:border-emerald-400"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Manual-only: Service + Customer fields */}
        {mode === "manual" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("nb.service")}</label>
              <select
                value={serviceId}
                onChange={e => setServiceId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {services.length === 0 && <option value="">{t("nb.noServices")}</option>}
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("nb.customerName")} *</label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="Ahmed Ali"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("nb.customerPhone")} *</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="+962 7X XXX XXXX"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("nb.customerEmail")} <span className="text-gray-400 font-normal">{t("d.optional")}</span>
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={e => setCustomerEmail(e.target.value)}
                placeholder="ahmed@example.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </>
        )}

        {/* Internal note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
            {mode === "blocked" ? t("nb.reasonLabel") : t("nb.howMadeLabel")}
            <InfoTooltip textKey="tip.nb.internalNote" />
          </label>
          <input
            type="text"
            value={internalNote}
            onChange={e => setInternalNote(e.target.value)}
            placeholder={mode === "blocked" ? t("nb.reasonPlaceholder") : t("nb.howMadePlaceholder")}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-60 transition"
        >
          {saving
            ? t("d.saving")
            : mode === "blocked"
            ? t("nb.blockBtn")
            : t("nb.addBtn")}
        </button>
      </form>
    </main>
  );
}
