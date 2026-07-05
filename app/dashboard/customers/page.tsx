"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
}

interface CustomerRow extends Customer {
  booking_count: number;
  last_visit: string | null;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-AE", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// created_at is a full timestamp — parse directly and guard invalid values
function fmtSince(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-AE", { month: "short", year: "numeric" });
}

export default function CustomersPage() {
  const router = useRouter();
  const [rows, setRows]       = useState<CustomerRow[]>([]);
  const [filtered, setFiltered] = useState<CustomerRow[]>([]);
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth/login"); return; }

    const [{ data: custData }, { data: bkData }] = await Promise.all([
      supabase
        .from("customers")
        .select("id, name, phone, email, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("bookings")
        .select("customer_id, booking_date")
        .eq("user_id", session.user.id)
        .not("customer_id", "is", null),
    ]);

    // Build count + last-visit maps from bookings
    const countMap: Record<string, number>  = {};
    const lastMap:  Record<string, string>  = {};
    (bkData ?? []).forEach((b: { customer_id: string; booking_date: string }) => {
      const cid = b.customer_id;
      countMap[cid] = (countMap[cid] ?? 0) + 1;
      if (!lastMap[cid] || b.booking_date > lastMap[cid]) lastMap[cid] = b.booking_date;
    });

    const combined: CustomerRow[] = (custData ?? []).map((c: Customer) => ({
      ...c,
      booking_count: countMap[c.id] ?? 0,
      last_visit:    lastMap[c.id]  ?? null,
    }));

    setRows(combined);
    setFiltered(combined);
    setLoading(false);
  }

  function handleSearch(val: string) {
    setSearch(val);
    const q = val.toLowerCase().trim();
    if (!q) { setFiltered(rows); return; }
    setFiltered(rows.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q)
    ));
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  );

  return (
    <main className="flex-1 p-4 sm:p-8 min-w-0">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Customers</h2>
          <p className="text-gray-500 text-sm mt-1">
            {rows.length} customer{rows.length !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>

      {/* Search */}
      {rows.length > 0 && (
        <div className="mb-6">
          <input
            type="search"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full sm:max-w-sm border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">&#128100;</p>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              No customers yet. Customers appear here automatically after their first booking.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">No customers match &ldquo;{search}&rdquo;.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Phone</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Email</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Bookings</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Last Visit</th>
                  <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">{c.name}</p>
                      {fmtSince(c.created_at) && (
                        <p className="text-xs text-gray-400 mt-0.5">Since {fmtSince(c.created_at)}</p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{c.phone ?? <span className="text-gray-300 italic">—</span>}</td>
                    <td className="px-6 py-4 text-gray-600">{c.email ?? <span className="text-gray-300 italic">—</span>}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold
                        ${c.booking_count > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
                        {c.booking_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm">
                      {c.last_visit ? fmtDate(c.last_visit) : <span className="text-gray-300 italic">—</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/customers/${c.id}`}
                        className="text-xs font-semibold text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition"
                      >
                        View &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-right">
              <span className="text-xs text-gray-400">
                {filtered.length} of {rows.length} customer{rows.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
