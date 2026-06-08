"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

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

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings]       = useState<Booking[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [updatingId, setUpdatingId]   = useState<string | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [answersMap, setAnswersMap]   = useState<AnswersMap>({});
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth/login"); return; }

    const [{ data: profile }, { data: svcRows }, { data: bkRows }, { data: staffRows }] = await Promise.all([
      supabase.from("users").select("business_name").eq("id", session.user.id).single(),
      supabase.from("services").select("id, name"),
      supabase.from("bookings").select("*").order("booking_date", { ascending: false }).order("booking_time", { ascending: false }),
      supabase.from("staff").select("id, name").eq("user_id", session.user.id).eq("is_active", true).order("name"),
    ]);

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
    const { error: upErr } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (upErr) setError(getErr(upErr));
    else setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b));
    setUpdatingId(null);
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

  function staffLabel(b: Booking) {
    if (b.staff_id) {
      return staffOptions.find(s => s.id === b.staff_id)?.name ?? b.staff_preference ?? "—";
    }
    return null; // show "Any" placeholder
  }

  function toggleAnswers(id: string) {
    setExpandedAnswers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  );

  return (
    <main className="flex-1 p-4 sm:p-8 min-w-0">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Your Bookings</h2>
          <p className="text-gray-500 text-sm mt-1">Manage all customer bookings and appointments.</p>
        </div>
        <Link
          href="/dashboard/bookings/new"
          className="shrink-0 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"
        >
          + Add / Block
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {bookings.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm mb-4">No bookings yet.</p>
            {businessName && (
              <Link href={`/book/${encodeURIComponent(businessName)}`} className="text-emerald-600 text-sm hover:underline font-medium">
                Share your booking page &rarr;
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Customer</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Service</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Date &amp; Time</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Staff</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Contact</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.map(b => {
                  const isBlocked = b.booking_type === "blocked";
                  const isManual  = b.booking_type === "manual";
                  const isGroup   = !!b.group_session_id;
                  const sLabel    = staffLabel(b);

                  return (
                    <tr key={b.id} className={`hover:bg-gray-50 transition ${isBlocked ? "opacity-70" : ""}`}>

                      {/* Customer */}
                      <td className="px-6 py-4">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                            &#128683; Blocked
                          </span>
                        ) : (
                          <p className="font-medium text-gray-800">{b.customer_name}</p>
                        )}
                        {isManual && (
                          <span className="inline-flex items-center gap-1 mt-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                            &#128203; Manual
                          </span>
                        )}
                        {isGroup && (
                          <span className="inline-flex items-center gap-1 mt-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                            &#128101; Group
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
                              {expandedAnswers.has(b.id) ? "▾ Hide answers" : "▸ Custom answers"}
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
                        <p className="text-gray-700">{fmtDate(b.booking_date)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtTime(b.booking_time)}</p>
                      </td>

                      {/* Staff */}
                      <td className="px-6 py-4">
                        {isBlocked ? (
                          <span className="text-gray-300 text-xs">—</span>
                        ) : staffOptions.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">No staff</span>
                        ) : (
                          <select
                            value={b.staff_id ?? ""}
                            disabled={updatingId === b.id}
                            onChange={e => handleStaffChange(b.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60 max-w-[130px]"
                          >
                            <option value="">
                              {sLabel === null ? "Any / Unassigned" : "Any / Unassigned"}
                            </option>
                            {staffOptions.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        )}
                        {staffOptions.length > 0 && !b.staff_id && (
                          <p className="text-xs text-gray-400 italic mt-0.5">Any</p>
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
                            Blocked
                          </span>
                        ) : (
                          <select
                            value={b.status}
                            disabled={updatingId === b.id}
                            onChange={e => handleStatusChange(b.id, e.target.value as Status)}
                            className={`text-xs font-semibold px-2 py-1 rounded-full border cursor-pointer focus:outline-none disabled:opacity-60 ${STATUS_STYLES[b.status]}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(b)}
                          disabled={deletingId === b.id}
                          className="text-xs font-medium text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-60 transition"
                        >
                          {deletingId === b.id ? "..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-right">
              <span className="text-xs text-gray-400">{bookings.length} record{bookings.length !== 1 ? "s" : ""} total</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <Link href="/dashboard" className="text-sm text-emerald-600 hover:underline">&larr; Back to Dashboard</Link>
      </div>
    </main>
  );
}
