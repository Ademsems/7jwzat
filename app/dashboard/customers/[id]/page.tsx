"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/components/Toast";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

interface BookingRow {
  id: string;
  booking_date: string;
  booking_time: string;
  status: string;
  service_id: string;
  service_name: string;
  staff_id: string | null;
  staff_name: string | null;
}

type Status = "pending" | "confirmed" | "completed" | "cancelled";

interface CfAnswer { custom_field_id: string; answer: string; label: string; }
type AnswersMap = Record<string, CfAnswer[]>; // bookingId → answers

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100  text-green-800",
  completed: "bg-blue-100   text-blue-800",
  cancelled: "bg-red-100    text-red-800",
};

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-AE", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}
function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function CustomerDetailPage() {
  const router  = useRouter();
  const params  = useParams();
  const id      = params.id as string;

  const [customer, setCustomer]   = useState<Customer | null>(null);
  const [bookings, setBookings]   = useState<BookingRow[]>([]);
  const [notes, setNotes]         = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [answersMap, setAnswersMap]   = useState<AnswersMap>({});
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());

  useEffect(() => { init(); }, [id]);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth/login"); return; }

    const { data: cust } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .eq("user_id", session.user.id)
      .single();

    if (!cust) { setNotFound(true); setLoading(false); return; }
    setCustomer(cust);
    setNotes(cust.notes ?? "");

    // Load bookings for this customer
    const { data: bkData } = await supabase
      .from("bookings")
      .select("id, booking_date, booking_time, status, service_id, staff_id")
      .eq("customer_id", id)
      .order("booking_date", { ascending: false })
      .order("booking_time", { ascending: false });

    if (bkData && bkData.length > 0) {
      const [{ data: svcData }, { data: staffData }] = await Promise.all([
        supabase.from("services").select("id, name"),
        supabase.from("staff").select("id, name"),
      ]);
      const svcMap:   Record<string, string> = {};
      const staffMap: Record<string, string> = {};
      (svcData   ?? []).forEach((s: { id: string; name: string }) => { svcMap[s.id]   = s.name; });
      (staffData ?? []).forEach((s: { id: string; name: string }) => { staffMap[s.id] = s.name; });

      const bookingList = bkData.map((b: {
        id: string; booking_date: string; booking_time: string;
        status: string; service_id: string; staff_id: string | null;
      }) => ({
        ...b,
        service_name: svcMap[b.service_id]  ?? "—",
        staff_name:   b.staff_id ? (staffMap[b.staff_id] ?? "—") : null,
      }));
      setBookings(bookingList);

      // Fetch custom field answers for these bookings
      const bkIds = bookingList.map((b: { id: string }) => b.id);
      if (bkIds.length > 0) {
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
    }

    setLoading(false);
  }

  async function handleNotesSave() {
    if (!customer) return;
    setSavingNotes(true);
    const { error } = await supabase
      .from("customers")
      .update({ notes: notes.trim() || null })
      .eq("id", customer.id);
    if (error) showToast("Failed to save notes.");
    else showToast("Notes saved.");
    setSavingNotes(false);
  }

  function toggleAnswers(bkId: string) {
    setExpandedAnswers(prev => {
      const next = new Set(prev);
      next.has(bkId) ? next.delete(bkId) : next.add(bkId);
      return next;
    });
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  );

  if (notFound) return (
    <main className="flex-1 p-4 sm:p-8">
      <Link href="/dashboard/customers" className="text-sm text-emerald-600 hover:underline">&larr; Back to Customers</Link>
      <p className="text-gray-500 mt-6">Customer not found.</p>
    </main>
  );

  const upcoming = bookings.filter(b => b.booking_date >= new Date().toISOString().slice(0, 10)).length;
  const past     = bookings.length - upcoming;

  return (
    <main className="flex-1 p-4 sm:p-8 max-w-4xl">
      <Link href="/dashboard/customers" className="text-sm text-emerald-600 hover:underline">
        &larr; Back to Customers
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl shadow-sm p-6 mt-6 mb-6">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-xl font-bold text-emerald-600 shrink-0">
            {customer!.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-gray-800">{customer!.name}</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1">
              {customer!.phone && (
                <span className="text-sm text-gray-500">&#128222; {customer!.phone}</span>
              )}
              {customer!.email && (
                <span className="text-sm text-gray-500">&#9993;&#65039; {customer!.email}</span>
              )}
            </div>
          </div>
          <div className="flex gap-4 text-center shrink-0">
            <div className="bg-gray-50 rounded-lg px-4 py-2">
              <p className="text-xl font-bold text-gray-800">{bookings.length}</p>
              <p className="text-xs text-gray-400">Total</p>
            </div>
            <div className="bg-emerald-50 rounded-lg px-4 py-2">
              <p className="text-xl font-bold text-emerald-700">{upcoming}</p>
              <p className="text-xs text-emerald-500">Upcoming</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-2">
              <p className="text-xl font-bold text-gray-800">{past}</p>
              <p className="text-xs text-gray-400">Past</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="font-semibold text-gray-700 mb-1">Notes</h3>
        <p className="text-xs text-gray-400 mb-3">
          Internal notes (e.g. &ldquo;Prefers mornings&rdquo;, &ldquo;Allergic to shellac&rdquo;). Not visible to the customer.
        </p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={handleNotesSave}
          placeholder="Add a note about this customer..."
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">
          {savingNotes ? "Saving..." : "Auto-saves when you click away."}
        </p>
      </div>

      {/* Booking history */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700">Booking History</h3>
          <p className="text-xs text-gray-400 mt-0.5">{bookings.length} booking{bookings.length !== 1 ? "s" : ""}, newest first</p>
        </div>

        {bookings.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">No bookings yet for this customer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Time</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Service</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Staff</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Answers</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50 transition align-top">
                    <td className="px-6 py-3 text-gray-700">{fmtDate(b.booking_date)}</td>
                    <td className="px-6 py-3 text-gray-700">{fmtTime(b.booking_time)}</td>
                    <td className="px-6 py-3 text-gray-700">{b.service_name}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {b.staff_name ?? <span className="text-gray-300 italic text-xs">Any</span>}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize
                        ${STATUS_STYLES[b.status as Status] ?? "bg-gray-100 text-gray-500"}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {answersMap[b.id] && answersMap[b.id].length > 0 ? (
                        <div>
                          <button
                            onClick={() => toggleAnswers(b.id)}
                            className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
                          >
                            {expandedAnswers.has(b.id) ? "▾ Hide" : `▸ View (${answersMap[b.id].length})`}
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
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
