"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/components/Toast";

interface GroupService { id: string; name: string; }
interface GroupSession {
  id: string;
  service_id: string;
  service_name: string;
  session_date: string;
  session_time: string;
  capacity: number;
  notes: string | null;
  booked_count: number;
}

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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-AE", {
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

export default function SessionsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [groupServices, setGroupServices] = useState<GroupService[]>([]);
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [fServiceId, setFServiceId] = useState("");
  const [fDate, setFDate] = useState(todayStr());
  const [fTime, setFTime] = useState("09:00");
  const [fCapacity, setFCapacity] = useState(10);
  const [fNotes, setFNotes] = useState("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth/login"); return; }
    setUserId(session.user.id);
    await loadData(session.user.id);
    setLoading(false);
  }

  async function loadData(uid: string) {
    // Load group-enabled services
    const { data: svcs } = await supabase
      .from("services")
      .select("id, name")
      .eq("user_id", uid)
      .eq("is_group_service", true)
      .order("created_at");

    setGroupServices(svcs ?? []);
    if (svcs && svcs.length > 0 && !fServiceId) setFServiceId(svcs[0].id);

    // Load upcoming sessions
    const { data: sesRows } = await supabase
      .from("group_sessions")
      .select("*")
      .eq("user_id", uid)
      .gte("session_date", todayStr())
      .order("session_date", { ascending: true })
      .order("session_time", { ascending: true });

    if (!sesRows || sesRows.length === 0) { setSessions([]); return; }

    // Fetch booked counts for each session
    const sessionIds = sesRows.map((s: { id: string }) => s.id);
    const { data: bookingRows } = await supabase
      .from("bookings")
      .select("group_session_id")
      .in("group_session_id", sessionIds)
      .neq("status", "cancelled");

    const countMap: Record<string, number> = {};
    (bookingRows ?? []).forEach((b: { group_session_id: string }) => {
      countMap[b.group_session_id] = (countMap[b.group_session_id] ?? 0) + 1;
    });

    const svcMap: Record<string, string> = {};
    (svcs ?? []).forEach((s: GroupService) => { svcMap[s.id] = s.name; });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSessions(sesRows.map((s: any) => ({
      id: s.id,
      service_id: s.service_id,
      service_name: svcMap[s.service_id] ?? "Unknown Service",
      session_date: s.session_date,
      session_time: s.session_time,
      capacity: s.capacity,
      notes: s.notes,
      booked_count: countMap[s.id] ?? 0,
    })));
  }

  async function handleAddSession(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !fServiceId) return;
    if (fCapacity < 1 || fCapacity > 500) { showToast("Capacity must be between 1 and 500.", "error"); return; }

    setSaving(true);
    const { error } = await supabase.from("group_sessions").insert({
      user_id: userId,
      service_id: fServiceId,
      session_date: fDate,
      session_time: fTime,
      capacity: fCapacity,
      notes: fNotes.trim() || null,
    });
    if (error) { showToast(getErr(error), "error"); }
    else {
      showToast("Session added successfully.");
      setFNotes("");
      setFCapacity(10);
      setShowForm(false);
      await loadData(userId);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this session? Any bookings for it will be unlinked.")) return;
    setDeletingId(id);
    const { error } = await supabase.from("group_sessions").delete().eq("id", id);
    if (error) showToast(getErr(error), "error");
    else { showToast("Session deleted."); setSessions(prev => prev.filter(s => s.id !== id)); }
    setDeletingId(null);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  );

  return (
    <main className="flex-1 p-4 sm:p-8 max-w-3xl">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Group Sessions</h2>
          <p className="text-gray-500 text-sm mt-1">Schedule sessions that multiple customers can book.</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="shrink-0 bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition"
        >
          {showForm ? "Cancel" : "+ Add Session"}
        </button>
      </div>

      {/* No group services notice */}
      {groupServices.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 text-sm mb-6">
          You have no group services yet. Go to <strong>Services</strong> and toggle a service to &ldquo;Group session&rdquo; to get started.
        </div>
      )}

      {/* Add session form */}
      {showForm && groupServices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-gray-700 mb-5">New Group Session</h3>
          <form onSubmit={handleAddSession} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
              <select
                value={fServiceId}
                onChange={e => setFServiceId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {groupServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={fDate}
                  min={todayStr()}
                  onChange={e => setFDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <select
                  value={fTime}
                  onChange={e => setFTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (max spots)</label>
              <input
                type="number"
                value={fCapacity}
                min={1}
                max={500}
                onChange={e => setFCapacity(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-400 font-normal">(optional — shown to customers)</span>
              </label>
              <input
                type="text"
                value={fNotes}
                onChange={e => setFNotes(e.target.value)}
                placeholder="e.g. Bring your mat, Beginners welcome"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              {saving ? "Saving..." : "Add Session"}
            </button>
          </form>
        </div>
      )}

      {/* Sessions list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-700">Upcoming Sessions</h3>
        </div>
        {sessions.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">No upcoming sessions. Add one above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Service</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Date &amp; Time</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Booked</th>
                  <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Remaining</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sessions.map(s => {
                  const remaining = s.capacity - s.booked_count;
                  const isFull = remaining <= 0;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-800">{s.service_name}</p>
                        {s.notes && <p className="text-xs text-gray-400 mt-0.5">{s.notes}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-gray-700">{fmtDate(s.session_date)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtTime(s.session_time)}</p>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-700">{s.booked_count} / {s.capacity}</td>
                      <td className="px-6 py-4 text-center">
                        {isFull ? (
                          <span className="text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100">Full</span>
                        ) : (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            remaining <= 3
                              ? "text-amber-700 bg-amber-50 border-amber-100"
                              : "text-emerald-700 bg-emerald-50 border-emerald-100"
                          }`}>
                            {remaining} left
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id}
                          className="text-xs font-medium text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-60 transition"
                        >
                          {deletingId === s.id ? "..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
