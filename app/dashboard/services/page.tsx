"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/components/Toast";
import { formatPrice, DEFAULT_CURRENCY } from "@/lib/currency";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

interface Service { id: string; name: string; duration: number; price: number; is_group_service: boolean; }
const EMPTY = { name: "", duration: "", price: "", isGroup: false };

function getErr(e: unknown) {
  return e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Something went wrong.";
}

export default function ServicesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [userId, setUserId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; duration?: string; price?: string }>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth/login"); return; }
    setUserId(session.user.id);
    const { data: profile } = await supabase.from("users").select("currency").eq("id", session.user.id).single();
    if (profile?.currency) setCurrency(profile.currency);
    await fetchServices();
    setLoading(false);
  }

  async function fetchServices() {
    const { data, error } = await supabase.from("services").select("*").order("created_at", { ascending: true });
    if (error) showToast(getErr(error), "error");
    else if (data) setServices(data);
  }

  function validateField(field: string, val: string) {
    if (field === "name") {
      if (!val.trim()) return "Service name is required.";
      if (val.trim().length < 2) return "Name must be at least 2 characters.";
      if (val.trim().length > 50) return "Name must be 50 characters or less.";
    }
    if (field === "duration") {
      const n = Number(val);
      if (!val || isNaN(n)) return "Duration is required.";
      if (n < 15) return "Minimum duration is 15 minutes.";
      if (n > 480) return "Maximum duration is 480 minutes (8 hours).";
    }
    if (field === "price") {
      const n = Number(val);
      if (!val || isNaN(n)) return "Price is required.";
      if (n < 0) return "Price cannot be negative.";
      if (!/^\d+(\.\d{1,2})?$/.test(val)) return "Max 2 decimal places.";
    }
    return undefined;
  }

  function handleChange(field: "name" | "duration" | "price", val: string) {
    setForm(f => ({ ...f, [field]: val }));
    const err = validateField(field, val);
    setFieldErrors(e => ({ ...e, [field]: err }));
  }

  function validateAll() {
    const errs = {
      name:     validateField("name",     form.name),
      duration: validateField("duration", form.duration),
      price:    validateField("price",    form.price),
    };
    setFieldErrors(errs);
    return !errs.name && !errs.duration && !errs.price;
  }

  const isFormValid =
    !fieldErrors.name && !fieldErrors.duration && !fieldErrors.price &&
    !!form.name.trim() && !!form.duration && !!form.price;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateAll() || !userId) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      duration: Number(form.duration),
      price: Number(form.price),
      is_group_service: form.isGroup,
      user_id: userId,
    };
    if (editingId) {
      const { error } = await supabase.from("services")
        .update({ name: payload.name, duration: payload.duration, price: payload.price, is_group_service: payload.is_group_service })
        .eq("id", editingId);
      if (error) showToast(getErr(error), "error");
      else { showToast(t("services.updated")); setForm(EMPTY); setEditingId(null); await fetchServices(); }
    } else {
      const { error } = await supabase.from("services").insert(payload);
      if (error) showToast(getErr(error), "error");
      else { showToast(t("services.added")); setForm(EMPTY); await fetchServices(); }
    }
    setSaving(false);
  }

  function startEdit(svc: Service) {
    setEditingId(svc.id);
    setForm({ name: svc.name, duration: String(svc.duration), price: String(svc.price), isGroup: svc.is_group_service });
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() { setEditingId(null); setForm(EMPTY); setFieldErrors({}); }

  async function handleDelete(svc: Service) {
    if (!window.confirm(`Delete "${svc.name}"?`)) return;
    setDeletingId(svc.id);
    const { error } = await supabase.from("services").delete().eq("id", svc.id);
    if (error) showToast(getErr(error), "error");
    else { showToast(`"${svc.name}" deleted.`); await fetchServices(); }
    setDeletingId(null);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">{t("d.loading")}</p></div>;

  return (
    <main className="flex-1 p-4 sm:p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-8">{t("services.title")}</h2>

      {/* Form */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <h3 className="font-semibold text-gray-700 mb-5">{editingId ? t("services.edit") : t("services.addNew")}</h3>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("services.name")}</label>
            <input
              type="text"
              value={form.name}
              onChange={e => handleChange("name", e.target.value)}
              placeholder="e.g. Haircut"
              maxLength={50}
              className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${fieldErrors.name ? "border-red-400 bg-red-50" : "border-gray-300"}`}
            />
            {fieldErrors.name && <p className="text-red-600 text-xs mt-1">{fieldErrors.name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("services.duration")}</label>
              <input
                type="number"
                value={form.duration}
                onChange={e => handleChange("duration", e.target.value)}
                placeholder="e.g. 30"
                min={15}
                max={480}
                step={15}
                className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${fieldErrors.duration ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {fieldErrors.duration && <p className="text-red-600 text-xs mt-1">{fieldErrors.duration}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("services.price")} ({currency})</label>
              <input
                type="number"
                value={form.price}
                onChange={e => handleChange("price", e.target.value)}
                placeholder="e.g. 25.99"
                min={0}
                step={0.01}
                className={`w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${fieldErrors.price ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              {fieldErrors.price && <p className="text-red-600 text-xs mt-1">{fieldErrors.price}</p>}
            </div>
          </div>

          {/* Session type toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t("services.sessionType")}</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden w-fit text-sm">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, isGroup: false }))}
                className={`px-5 py-2 font-medium transition ${!form.isGroup ? "bg-emerald-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                {t("services.oneOnOne")}
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, isGroup: true }))}
                className={`px-5 py-2 font-medium transition ${form.isGroup ? "bg-emerald-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                {t("services.group")}
              </button>
            </div>
            {form.isGroup && (
              <p className="text-xs text-emerald-700 mt-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                &#128101; {t("services.groupNote")}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !isFormValid}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? t("d.saving") : editingId ? t("services.update") : t("services.add")}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="border border-gray-300 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
              >
                {t("d.cancel")}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-5">{t("services.yours")}</h3>
        {services.length === 0 ? (
          <p className="text-sm text-gray-400">{t("services.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-start text-gray-500 font-medium pb-3 pr-4">{t("services.colService")}</th>
                  <th className="text-start text-gray-500 font-medium pb-3 pr-4">{t("services.colDuration")}</th>
                  <th className="text-start text-gray-500 font-medium pb-3 pr-4">{t("services.colPrice")}</th>
                  <th className="text-start text-gray-500 font-medium pb-3 pr-4">{t("services.colType")}</th>
                  <th className="text-end text-gray-500 font-medium pb-3">{t("d.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {services.map(svc => (
                  <tr key={svc.id} className="hover:bg-gray-50 transition">
                    <td className="py-3 pr-4 font-medium text-gray-800">{svc.name}</td>
                    <td className="py-3 pr-4 text-gray-600">{svc.duration} {t("book.minutesShort")}</td>
                    <td className="py-3 pr-4 text-gray-600">{formatPrice(svc.price, currency)}</td>
                    <td className="py-3 pr-4">
                      {svc.is_group_service ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full font-medium">
                          &#128101; {t("bk.group")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium">
                          {t("services.oneOnOne")}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-end space-x-2">
                      <button
                        onClick={() => startEdit(svc)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition"
                      >
                        &#9999;&#65039; {t("d.edit")}
                      </button>
                      <button
                        onClick={() => handleDelete(svc)}
                        disabled={deletingId === svc.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60 transition"
                      >
                        {deletingId === svc.id ? "..." : <>&#128465;&#65039; {t("d.delete")}</>}
                      </button>
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
