"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/components/Toast";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { TAG_COLOR_PALETTE, type CustomerTag } from "@/components/TagPill";

interface TagRow extends CustomerTag { customerCount: number; }

function getErr(e: unknown): string {
  return e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Something went wrong.";
}

export default function ManageTagsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [userId, setUserId] = useState<string | null>(null);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLOR_PALETTE[0]);
  const [creating, setCreating] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth/login"); return; }
    setUserId(session.user.id);
    await loadTags(session.user.id);
    setLoading(false);
  }

  async function loadTags(uid: string) {
    const [{ data: tagRows }, { data: assignRows }] = await Promise.all([
      supabase.from("customer_tags").select("id, name, color").eq("business_id", uid).order("created_at"),
      supabase.from("customer_tag_assignments").select("tag_id").eq("business_id", uid),
    ]);
    const countByTag: Record<string, number> = {};
    (assignRows ?? []).forEach((r: { tag_id: string }) => { countByTag[r.tag_id] = (countByTag[r.tag_id] ?? 0) + 1; });
    setTags((tagRows ?? []).map((tg: CustomerTag) => ({ ...tg, customerCount: countByTag[tg.id] ?? 0 })));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !newName.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("customer_tags").insert({
      business_id: userId, name: newName.trim(), color: newColor,
    });
    if (error) showToast(getErr(error), "error");
    else {
      showToast(t("tags.created"));
      setNewName("");
      setNewColor(TAG_COLOR_PALETTE[0]);
      await loadTags(userId);
    }
    setCreating(false);
  }

  function startRename(tag: TagRow) {
    setEditingId(tag.id);
    setEditingName(tag.name);
  }

  async function saveRename(tagId: string) {
    const name = editingName.trim();
    setEditingId(null);
    if (!name) return;
    const prev = tags.find(tg => tg.id === tagId);
    if (!prev || prev.name === name) return;
    const { error } = await supabase.from("customer_tags").update({ name }).eq("id", tagId);
    if (error) showToast(getErr(error), "error");
    else {
      showToast(t("tags.updated"));
      setTags(ts => ts.map(tg => tg.id === tagId ? { ...tg, name } : tg));
    }
  }

  async function handleRecolor(tagId: string, color: string) {
    const { error } = await supabase.from("customer_tags").update({ color }).eq("id", tagId);
    if (error) showToast(getErr(error), "error");
    else setTags(ts => ts.map(tg => tg.id === tagId ? { ...tg, color } : tg));
  }

  async function handleDelete(tag: TagRow) {
    if (!window.confirm(t("tags.deleteConfirm"))) return;
    // Explicit two-step delete — correct regardless of whether the FK has
    // ON DELETE CASCADE configured, since we don't control that DDL here.
    const { error: assignErr } = await supabase.from("customer_tag_assignments").delete().eq("tag_id", tag.id);
    if (assignErr) { showToast(getErr(assignErr), "error"); return; }
    const { error } = await supabase.from("customer_tags").delete().eq("id", tag.id);
    if (error) showToast(getErr(error), "error");
    else { showToast(t("tags.deleted")); setTags(ts => ts.filter(tg => tg.id !== tag.id)); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">{t("d.loading")}</p>
    </div>
  );

  return (
    <main className="flex-1 p-4 sm:p-8 max-w-2xl">
      <Link href="/dashboard/customers" className="text-sm text-emerald-600 hover:underline">{t("cust.back")}</Link>

      <h2 className="text-2xl font-bold text-gray-800 mt-4 mb-1">{t("tags.title")}</h2>
      <p className="text-gray-500 text-sm mb-6">{t("tags.subtitle")}</p>

      {/* New tag form */}
      <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm p-5 mb-6 space-y-3">
        <h3 className="font-semibold text-gray-700 text-sm">{t("tags.newTag")}</h3>
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder={t("tags.namePlaceholder")}
          maxLength={30}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div>
          <p className="text-xs text-gray-500 mb-1.5">{t("tags.colorLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {TAG_COLOR_PALETTE.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                aria-label={c}
                className={`w-7 h-7 rounded-full transition ${newColor === c ? "ring-2 ring-offset-2 ring-gray-400" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition"
        >
          {creating ? t("d.saving") : t("tags.create")}
        </button>
      </form>

      {/* Existing tags */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {tags.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-400 text-sm">{t("tags.empty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tags.map(tag => (
              <div key={tag.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex flex-wrap gap-1 shrink-0">
                  {TAG_COLOR_PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleRecolor(tag.id, c)}
                      aria-label={c}
                      className={`w-4 h-4 rounded-full ${tag.color === c ? "ring-2 ring-offset-1 ring-gray-400" : ""}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  {editingId === tag.id ? (
                    <input
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={() => saveRename(tag.id)}
                      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingId(null); }}
                      maxLength={30}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => startRename(tag)}
                      aria-label={t("tags.editName")}
                      className="text-sm font-medium text-gray-800 hover:underline text-start"
                    >
                      {tag.name}
                    </button>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {tag.customerCount} {tag.customerCount === 1 ? t("tags.customerCount") : t("tags.customersCount")}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(tag)}
                  className="text-xs font-medium text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition shrink-0"
                >
                  {t("d.delete")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
