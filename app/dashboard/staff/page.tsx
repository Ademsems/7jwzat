"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { InfoTooltip } from "@/components/InfoTooltip";

interface Service   { id: string; name: string; }
interface StaffMember {
  id: string;
  name: string;
  role: string | null;
  bio: string | null;
  is_active: boolean;
  services: Service[];
}

const EMPTY_FORM = { name: "", role: "", bio: "", serviceIds: [] as string[] };

function getErr(e: unknown) {
  return e && typeof e === "object" && "message" in e
    ? String((e as { message: unknown }).message)
    : "Something went wrong.";
}

export default function StaffPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [userId, setUserId]   = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff]     = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [editId, setEditId]   = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const formRef               = useRef<HTMLDivElement>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth/login"); return; }
    setUserId(session.user.id);

    const { data: svcData } = await supabase
      .from("services")
      .select("id, name")
      .eq("user_id", session.user.id)
      .order("created_at");

    setServices(svcData ?? []);
    setStaff(await fetchStaff(session.user.id));
    setLoading(false);
  }

  async function fetchStaff(uid: string): Promise<StaffMember[]> {
    const { data: rows } = await supabase
      .from("staff")
      .select("id, name, role, bio, is_active")
      .eq("user_id", uid)
      .order("created_at");

    if (!rows || rows.length === 0) return [];

    const { data: ssRows } = await supabase
      .from("staff_services")
      .select("staff_id, service_id, services(id, name)")
      .in("staff_id", rows.map((s: { id: string }) => s.id));

    const svcMap: Record<string, Service[]> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (ssRows ?? []).forEach((row: any) => {
      if (!svcMap[row.staff_id]) svcMap[row.staff_id] = [];
      if (row.services) svcMap[row.staff_id].push(row.services as Service);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((s: any) => ({ ...s, services: svcMap[s.id] ?? [] }));
  }

  async function reload() {
    if (userId) setStaff(await fetchStaff(userId));
  }

  function startEdit(member: StaffMember) {
    setEditId(member.id);
    setForm({
      name:       member.name,
      role:       member.role ?? "",
      bio:        member.bio ?? "",
      serviceIds: member.services.map(s => s.id),
    });
    setError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEdit() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  function toggleService(id: string) {
    setForm(f => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter(sid => sid !== id)
        : [...f.serviceIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError(t("staff.nameRequired")); return; }
    setSaving(true);
    setError("");

    try {
      if (editId) {
        const { error: upErr } = await supabase
          .from("staff")
          .update({ name: form.name.trim(), role: form.role.trim() || null, bio: form.bio.trim() || null })
          .eq("id", editId);
        if (upErr) throw upErr;

        await supabase.from("staff_services").delete().eq("staff_id", editId);
        if (form.serviceIds.length > 0) {
          const { error: ssErr } = await supabase.from("staff_services").insert(
            form.serviceIds.map(sid => ({ staff_id: editId, service_id: sid }))
          );
          if (ssErr) throw ssErr;
        }
      } else {
        const { data: newRow, error: insErr } = await supabase
          .from("staff")
          .insert({ user_id: userId, name: form.name.trim(), role: form.role.trim() || null, bio: form.bio.trim() || null, is_active: true })
          .select("id")
          .single();
        if (insErr || !newRow) throw insErr ?? new Error("Insert failed");

        if (form.serviceIds.length > 0) {
          const { error: ssErr } = await supabase.from("staff_services").insert(
            form.serviceIds.map(sid => ({ staff_id: newRow.id, service_id: sid }))
          );
          if (ssErr) throw ssErr;
        }
      }

      setForm(EMPTY_FORM);
      setEditId(null);
      await reload();
    } catch (err) {
      setError(getErr(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(member: StaffMember) {
    await supabase.from("staff").update({ is_active: !member.is_active }).eq("id", member.id);
    setStaff(prev => prev.map(s => s.id === member.id ? { ...s, is_active: !s.is_active } : s));
  }

  async function handleDelete(member: StaffMember) {
    if (!window.confirm(`Delete ${member.name}? This cannot be undone.`)) return;
    const { error: delErr } = await supabase.from("staff").delete().eq("id", member.id);
    if (delErr) { setError(getErr(delErr)); return; }
    setStaff(prev => prev.filter(s => s.id !== member.id));
    if (editId === member.id) cancelEdit();
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">{t("d.loading")}</p>
    </div>
  );

  return (
    <main className="flex-1 p-4 sm:p-8 max-w-4xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1 inline-flex items-center gap-2">{t("staff.title")} <InfoTooltip textKey="tip.page.staff" /></h2>
      <p className="text-gray-500 text-sm mb-8">{t("staff.subtitle")}</p>

      {/* ── Add / Edit form ───────────────────────────────────── */}
      <div ref={formRef} className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <h3 className="font-semibold text-gray-700 mb-4">
          {editId ? t("staff.editMember") : t("staff.addMember")}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("staff.name")} *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder={t("staff.namePlaceholder")}
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("staff.role")} <span className="text-gray-400 font-normal">{t("d.optional")}</span>
              </label>
              <input
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                placeholder={t("staff.rolePlaceholder")}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("staff.bio")} <span className="text-gray-400 font-normal">{t("staff.bioHint")}</span>
            </label>
            <textarea
              value={form.bio}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder={t("staff.bioPlaceholder")}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {services.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 inline-flex items-center gap-1">
                {t("staff.canPerform")} <InfoTooltip textKey="tip.staff.canPerform" />
              </label>
              <div className="flex flex-wrap gap-2">
                {services.map(svc => {
                  const on = form.serviceIds.includes(svc.id);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleService(svc.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm border font-medium transition
                        ${on
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-gray-600 border-gray-300 hover:border-emerald-400 hover:text-emerald-700"
                        }`}
                    >
                      {on && <span className="me-1">&#10003;</span>}{svc.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              {saving ? t("d.saving") : editId ? t("staff.updateMember") : t("staff.addMember")}
            </button>
            {editId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
              >
                {t("d.cancel")}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Staff list ────────────────────────────────────────── */}
      {staff.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">&#128101;</p>
          <p className="text-gray-500 text-sm">{t("staff.empty")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {staff.map(member => (
            <div
              key={member.id}
              className={`bg-white rounded-xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-start gap-4 transition
                ${!member.is_active ? "opacity-60" : ""}`}
            >
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800 text-base">{member.name}</span>
                  {member.role && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">{member.role}</span>
                  )}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border
                    ${member.is_active
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-gray-100 text-gray-500 border-gray-200"}`}>
                    {member.is_active ? t("staff.active") : t("staff.inactive")}
                  </span>
                  <InfoTooltip textKey="tip.staff.active" />
                </div>

                {member.bio && (
                  <p className="text-sm text-gray-500 truncate mb-2">{member.bio}</p>
                )}

                <div className="flex flex-wrap gap-1.5 mt-1">
                  {member.services.length > 0
                    ? member.services.map(s => (
                        <span key={s.id} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                          {s.name}
                        </span>
                      ))
                    : <span className="text-xs text-gray-400 italic">{t("staff.noServices")}</span>
                  }
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => handleToggleActive(member)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition font-medium"
                >
                  {member.is_active ? t("staff.deactivate") : t("staff.activate")}
                </button>
                <button
                  onClick={() => startEdit(member)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition font-medium"
                >
                  {t("d.edit")}
                </button>
                <button
                  onClick={() => handleDelete(member)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition font-medium"
                >
                  {t("d.delete")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
