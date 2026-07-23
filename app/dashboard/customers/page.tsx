"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { InfoTooltip } from "@/components/InfoTooltip";
import { TagPill, type CustomerTag } from "@/components/TagPill";

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
  tags: CustomerTag[];
}

/** Multi-select tag-filter dropdown — same click-outside pattern as the
 *  bookings page's status filter. */
function TagMultiSelect({ allTags, selected, onChange }: { allTags: CustomerTag[]; selected: Set<string>; onChange: (next: Set<string>) => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  }

  const label = selected.size === 0 ? t("flt.all") : `${selected.size} ${t("flt.selected")}`;

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs text-gray-500 mb-1">{t("tags.filterLabel")}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white text-start min-w-[130px] focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        {label}
      </button>
      {open && (
        <div className="absolute start-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1.5 min-w-[180px] max-h-64 overflow-y-auto">
          {allTags.map(tag => (
            <label key={tag.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selected.has(tag.id)} onChange={() => toggle(tag.id)} className="accent-emerald-600" />
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
              {tag.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
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

const MAX_VISIBLE_PILLS = 2; // beyond 3 total tags, show 2 pills + "+N more"

export default function CustomersPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [rows, setRows]       = useState<CustomerRow[]>([]);
  const [allTags, setAllTags] = useState<CustomerTag[]>([]);
  const [search, setSearch]   = useState("");
  const [tagFilter, setTagFilter] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth/login"); return; }
    const uid = session.user.id;

    const [{ data: custData }, { data: bkData }, { data: tagRows }, { data: assignRows }] = await Promise.all([
      supabase
        .from("customers")
        .select("id, name, phone, email, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
      supabase
        .from("bookings")
        .select("customer_id, booking_date")
        .eq("user_id", uid)
        .not("customer_id", "is", null),
      supabase.from("customer_tags").select("id, name, color").eq("business_id", uid).order("created_at"),
      supabase.from("customer_tag_assignments").select("customer_id, tag_id").eq("business_id", uid),
    ]);

    // Build count + last-visit maps from bookings
    const countMap: Record<string, number>  = {};
    const lastMap:  Record<string, string>  = {};
    (bkData ?? []).forEach((b: { customer_id: string; booking_date: string }) => {
      const cid = b.customer_id;
      countMap[cid] = (countMap[cid] ?? 0) + 1;
      if (!lastMap[cid] || b.booking_date > lastMap[cid]) lastMap[cid] = b.booking_date;
    });

    const tagById: Record<string, CustomerTag> = {};
    (tagRows ?? []).forEach((tg: CustomerTag) => { tagById[tg.id] = tg; });
    const tagsByCustomer: Record<string, CustomerTag[]> = {};
    (assignRows ?? []).forEach((r: { customer_id: string; tag_id: string }) => {
      const tag = tagById[r.tag_id];
      if (!tag) return;
      (tagsByCustomer[r.customer_id] ??= []).push(tag);
    });

    const combined: CustomerRow[] = (custData ?? []).map((c: Customer) => ({
      ...c,
      booking_count: countMap[c.id] ?? 0,
      last_visit:    lastMap[c.id]  ?? null,
      tags:          tagsByCustomer[c.id] ?? [],
    }));

    setAllTags(tagRows ?? []);
    setRows(combined);
    setLoading(false);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">{t("d.loading")}</p>
    </div>
  );

  const q = search.toLowerCase().trim();
  const filtered = rows.filter(c => {
    if (q && !c.name.toLowerCase().includes(q) && !(c.phone ?? "").includes(q)) return false;
    if (tagFilter.size > 0) {
      const customerTagIds = new Set(c.tags.map(tg => tg.id));
      for (const tagId of tagFilter) { if (!customerTagIds.has(tagId)) return false; }
    }
    return true;
  });
  const filtersActive = q.length > 0 || tagFilter.size > 0;

  function clearFilters() {
    setSearch("");
    setTagFilter(new Set());
  }

  return (
    <main className="flex-1 p-4 sm:p-8 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 inline-flex items-center gap-2">{t("cust.title")} <InfoTooltip textKey="tip.page.customers" /></h2>
          <p className="text-gray-500 text-sm mt-1">
            {rows.length} {t("cust.total")}
          </p>
        </div>
        <Link href="/dashboard/customers/tags" className="text-sm text-emerald-600 hover:underline font-medium shrink-0">
          {t("tags.manage")}
        </Link>
      </div>

      {/* Filters */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t("cust.search")}</label>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("cust.search")}
              className="w-full sm:w-64 border border-gray-300 rounded-lg px-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {allTags.length > 0 && (
            <TagMultiSelect allTags={allTags} selected={tagFilter} onChange={setTagFilter} />
          )}
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="text-sm text-emerald-600 hover:underline font-medium">
              {t("flt.clearFilters")}
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">&#128100;</p>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              {t("cust.empty")}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm mb-3">{t("cust.noMatch")}</p>
            {filtersActive && (
              <button type="button" onClick={clearFilters} className="text-emerald-600 text-sm hover:underline font-medium">
                {t("flt.clearFilters")}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">{t("cust.colName")}</th>
                  <th className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">{t("cust.colPhone")}</th>
                  <th className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">{t("cust.colEmail")}</th>
                  <th className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">{t("cust.colBookings")}</th>
                  <th className="text-start text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">{t("cust.colLastVisit")}</th>
                  <th className="text-end text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c => {
                  const visiblePills = c.tags.length > 3 ? c.tags.slice(0, MAX_VISIBLE_PILLS) : c.tags;
                  const extraCount = c.tags.length > 3 ? c.tags.length - MAX_VISIBLE_PILLS : 0;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-800">{c.name}</p>
                        {fmtSince(c.created_at) && (
                          <p className="text-xs text-gray-400 mt-0.5">{t("cust.since")} {fmtSince(c.created_at)}</p>
                        )}
                        {c.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            {visiblePills.map(tag => <TagPill key={tag.id} tag={tag} compact />)}
                            {extraCount > 0 && (
                              <span className="text-[10px] text-gray-400 font-medium">{t("tags.moreCount").replace("{n}", String(extraCount))}</span>
                            )}
                          </div>
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
                      <td className="px-6 py-4 text-end">
                        <Link
                          href={`/dashboard/customers/${c.id}`}
                          className="text-xs font-semibold text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition"
                        >
                          {t("cust.view")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-end">
              <span className="text-xs text-gray-400">
                {filtered.length} / {rows.length}
              </span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
