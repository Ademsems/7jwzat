"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Status = "pending" | "confirmed" | "completed" | "cancelled";

interface Booking {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  booking_date: string;
  booking_time: string;
  status: Status;
  service_id: string;
  service_name: string;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-AE", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}
function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2,"0")}:${String(m).padStart(2,"0")} ${ampm}`;
}
function getErr(e: unknown) {
  return e && typeof e === "object" && "message" in e ? String((e as {message:unknown}).message) : "Something went wrong.";
}

const STATUS_STYLES: Record<Status, string> = {
  pending:   "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100  text-green-800  border-green-200",
  completed: "bg-blue-100   text-blue-800   border-blue-200",
  cancelled: "bg-red-100    text-red-800    border-red-200",
};

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth/login"); return; }
    const { data: profile } = await supabase
      .from("users").select("business_name").eq("id", session.user.id).single();
    if (profile) setBusinessName(profile.business_name);
    await loadBookings();
    setLoading(false);
  }

  async function loadBookings() {
    const { data: bookingRows, error: bErr } = await supabase
      .from("bookings")
      .select("*")
      .order("booking_date", { ascending: false })
      .order("booking_time", { ascending: false });

    if (bErr) { setError(getErr(bErr)); return; }

    const { data: svcRows } = await supabase.from("services").select("id, name");
    const svcMap: Record<string, string> = {};
    (svcRows ?? []).forEach((s: { id: string; name: string }) => { svcMap[s.id] = s.name; });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setBookings((bookingRows ?? []).map((b: any) => ({
      ...b,
      service_name: svcMap[b.service_id as string] ?? "Unknown Service",
    })));
  }

  async function handleStatusChange(id: string, status: Status) {
    setUpdatingId(id);
    const { error: upErr } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (upErr) { setError(getErr(upErr)); }
    else { setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b)); }
    setUpdatingId(null);
  }

  async function handleDelete(booking: Booking) {
    if (!window.confirm(`Delete booking for ${booking.customer_name}?`)) return;
    setDeletingId(booking.id);
    const { error: delErr } = await supabase.from("bookings").delete().eq("id", booking.id);
    if (delErr) { setError(getErr(delErr)); }
    else { setBookings(prev => prev.filter(b => b.id !== booking.id)); }
    setDeletingId(null);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  );

  return (
    <main className="flex-1 p-8 min-w-0">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Your Bookings</h2>
        <p className="text-gray-500 text-sm mt-1">Manage all customer bookings and appointments.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {bookings.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm mb-4">No bookings yet.</p>
            {businessName && (
              <Link
                href={`/book/${encodeURIComponent(businessName)}`}
                className="text-emerald-600 text-sm hover:underline font-medium">
                Share your booking page →
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
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Date & Time</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Contact</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Status</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">{b.customer_name}</p>
                      {b.notes && (
                        <p className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate" title={b.notes}>
                          📝 {b.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{b.service_name}</td>
                    <td className="px-6 py-4">
                      <p className="text-gray-700">{fmtDate(b.booking_date)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{fmtTime(b.booking_time)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-700">{b.customer_email}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{b.customer_phone}</p>
                    </td>
                    <td className="px-6 py-4">
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
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(b)}
                        disabled={deletingId === b.id}
                        className="text-xs font-medium text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-60 transition">
                        {deletingId === b.id ? "Deleting..." : "🗑️ Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-right">
              <span className="text-xs text-gray-400">{bookings.length} booking{bookings.length !== 1 ? "s" : ""} total</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6">
        <Link href="/dashboard" className="text-sm text-emerald-600 hover:underline">← Back to Dashboard</Link>
      </div>
    </main>
  );
}
