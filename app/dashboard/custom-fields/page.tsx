"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { showToast } from "@/components/Toast";

/* ─── Types ──────────────────────────────────────────────── */
interface Service { id: string; name: string; }

interface CustomField {
  id: string;
  label: string;
  placeholder: string | null;
  is_required: boolean;
  apply_to_all: boolean;
  service_ids: string[];   // populated client-side from custom_field_services
}

const EMPTY_FORM = {
  label: "",
  placeholder: "",
  is_required: false,
  apply_to_all: true,
  service_ids: [] as string[],
};

/* ─── Page ───────────────────────────────────────────────── */
export default function CustomFieldsPage() {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement>(null);

  const [services, setServices]       = useState<Service[]>([]);
  const [fields, setFields]           = useState<CustomField[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [formError, setFormError]     = useState("");
  const [userId, setUserId]           = useState<string>("");

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth/login"); return; }
    setUserId(session.user.id);

    const [{ data: svcData }, { data: cfData }, { data: cfsData }] = await Promise.all([
      supabase.from("services").select("id, name").eq("user_id", session.user.id).order("created_at"),
      supabase.from("custom_fields").select("*").eq("user_id", session.user.id).order("created_at"),
      supabase.from("custom_field_services").select("custom_field_id, service_id"),
    ]);

    setServices(svcData ?? []);

    // Build service_ids map per field
    const svcMap: Record<string, string[]> = {};
    (cfsData ?? []).forEach((row: { custom_field_id: string; service_id: string }) => {
      if (!svcMap[row.custom_field_id]) svcMap[row.custom_field_id] = [];
      svcMap[row.custom_field_id].push(row.service_id);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setFields((cfData ?? []).map((f: any) => ({
      ...f,
      service_ids: svcMap[f.id] ?? [],
    })));

    setLoading(false);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
  }

  function startEdit(field: CustomField) {
    setForm({
      label:       field.label,
      placeholder: field.placeholder ?? "",
      is_required: field.is_required,
      apply_to_all: field.apply_to_all,
      service_ids: field.service_ids,
    });
    setEditingId(field.id);
    setFormError("");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function toggleService(id: string) {
    setForm(f => ({
      ...f,
      service_ids: f.service_ids.includes(id)
        ? f.service_ids.filter(s => s !== id)
        : [...f.service_ids, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!form.label.trim()) { setFormError("Label is required."); return; }
    if (!form.apply_to_all && form.service_ids.length === 0) {
      setFormError("Select at least one service, or switch to Apply to All Services."); return;
    }

    setSaving(true);

    if (editingId) {
      // ── Update existing field ────────────────────────────────
      const { error: upErr } = await supabase
        .from("custom_fields")
        .update({
          label:        form.label.trim(),
          placeholder:  form.placeholder.trim() || null,
          is_required:  form.is_required,
          apply_to_all: form.apply_to_all,
        })
        .eq("id", editingId);

      if (upErr) { setFormError(upErr.message); setSaving(false); return; }

      // Sync custom_field_services
      await supabase.from("custom_field_services").delete().eq("custom_field_id", editingId);
      if (!form.apply_to_all && form.service_ids.length > 0) {
        await supabase.from("custom_field_services").insert(
          form.service_ids.map(sid => ({ custom_field_id: editingId, service_id: sid }))
        );
      }

      setFields(prev => prev.map(f => f.id === editingId
        ? { ...f, label: form.label.trim(), placeholder: form.placeholder.trim() || null,
            is_required: form.is_required, apply_to_all: form.apply_to_all,
            service_ids: form.apply_to_all ? [] : form.service_ids }
        : f
      ));
      showToast("Custom field updated.");

    } else {
      // ── Insert new field ─────────────────────────────────────
      const { data: newField, error: insErr } = await supabase
        .from("custom_fields")
        .insert({
          user_id:      userId,
          label:        form.label.trim(),
          placeholder:  form.placeholder.trim() || null,
          is_required:  form.is_required,
          apply_to_all: form.apply_to_all,
        })
        .select("*")
        .single();

      if (insErr || !newField) { setFormError(insErr?.message ?? "Insert failed."); setSaving(false); return; }

      if (!form.apply_to_all && form.service_ids.length > 0) {
        await supabase.from("custom_field_services").insert(
          form.service_ids.map(sid => ({ custom_field_id: newField.id, service_id: sid }))
        );
      }

      setFields(prev => [
        ...prev,
        { ...newField, service_ids: form.apply_to_all ? [] : form.service_ids },
      ]);
      showToast("Custom field created.");
    }

    resetForm();
    setSaving(false);
  }

  async function handleDelete(field: CustomField) {
    if (!window.confirm(`Delete field "${field.label}"? This cannot be undone.`)) return;
    setDeletingId(field.id);
    const { error } = await supabase.from("custom_fields").delete().eq("id", field.id);
    if (error) { showToast("Failed to delete field."); }
    else {
      setFields(prev => prev.filter(f => f.id !== field.id));
      if (editingId === field.id) resetForm();
      showToast("Field deleted.");
    }
    setDeletingId(null);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  );

  return (
    <main className="flex-1 p-4 sm:p-8 max-w-3xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Custom Fields</h2>
      <p className="text-gray-500 text-sm mb-8">
        Add extra questions to your booking form — shown to customers before they confirm.
      </p>

      {/* ── Form ──────────────────────────────────────────────────── */}
      <div ref={formRef} className="bg-white rounded-xl shadow-sm p-6 mb-8">
        <h3 className="font-semibold text-gray-700 mb-1">
          {editingId ? "Edit Field" : "Add a New Field"}
        </h3>
        <p className="text-xs text-gray-400 mb-5">
          {editingId ? "Update the field details below." : "This field will appear in the booking form."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {formError}
            </div>
          )}

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder='e.g. "Any allergies?" or "Your preferred color"'
              maxLength={120}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Placeholder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Placeholder <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.placeholder}
              onChange={e => setForm(f => ({ ...f, placeholder: e.target.value }))}
              placeholder='e.g. "e.g. Nuts, Shellac" or "Leave blank if none"'
              maxLength={160}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Required toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, is_required: !f.is_required }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1
                ${form.is_required ? "bg-emerald-600" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
                ${form.is_required ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className="text-sm text-gray-700">
              {form.is_required ? "Required" : "Optional"} — customers{" "}
              {form.is_required ? "must" : "don't have to"} fill this in
            </span>
          </div>

          {/* Apply-to-all toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, apply_to_all: !f.apply_to_all, service_ids: [] }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1
                ${form.apply_to_all ? "bg-emerald-600" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
                ${form.apply_to_all ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className="text-sm text-gray-700">
              Apply to <strong>{form.apply_to_all ? "all services" : "specific services"}</strong>
            </span>
          </div>

          {/* Service checklist (only when apply_to_all = false) */}
          {!form.apply_to_all && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Select services:</p>
              {services.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No services found. Add services first.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {services.map(svc => (
                    <label
                      key={svc.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition
                        ${form.service_ids.includes(svc.id)
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 hover:border-emerald-300"}`}
                    >
                      <input
                        type="checkbox"
                        checked={form.service_ids.includes(svc.id)}
                        onChange={() => toggleService(svc.id)}
                        className="accent-emerald-600 w-4 h-4 shrink-0"
                      />
                      <span className="text-sm text-gray-700">{svc.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Field"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ── Field list ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700">Your Custom Fields</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {fields.length} field{fields.length !== 1 ? "s" : ""}
          </p>
        </div>

        {fields.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-3xl mb-3">📝</p>
            <p className="text-gray-500 text-sm max-w-xs mx-auto">
              No custom fields yet. Use the form above to add your first field.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {fields.map(field => {
              const serviceNames = field.apply_to_all
                ? null
                : field.service_ids
                    .map(sid => services.find(s => s.id === sid)?.name)
                    .filter(Boolean)
                    .join(", ");

              return (
                <li key={field.id} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-medium text-gray-800 text-sm">{field.label}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        field.is_required
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {field.is_required ? "Required" : "Optional"}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        field.apply_to_all
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {field.apply_to_all ? "All services" : "Specific"}
                      </span>
                    </div>
                    {field.placeholder && (
                      <p className="text-xs text-gray-400 italic">Placeholder: {field.placeholder}</p>
                    )}
                    {!field.apply_to_all && serviceNames && (
                      <p className="text-xs text-gray-400 mt-0.5">Services: {serviceNames}</p>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => startEdit(field)}
                      className="text-xs font-semibold text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(field)}
                      disabled={deletingId === field.id}
                      className="text-xs font-medium text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-60 transition"
                    >
                      {deletingId === field.id ? "..." : "Delete"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
