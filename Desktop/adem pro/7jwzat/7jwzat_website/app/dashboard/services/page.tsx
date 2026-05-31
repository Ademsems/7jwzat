"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
}

const EMPTY_FORM = { name: "", duration: "", price: "" };

export default function ServicesPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  async function checkAuthAndLoad() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.replace("/auth/login"); return; }
    await fetchServices();
    setLoading(false);
  }

  async function fetchServices() {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data) setServices(data);
  }

  function validate() {
    if (!form.name.trim()) return "Service name is required.";
    const dur = Number(form.duration);
    if (!form.duration || isNaN(dur) || dur <= 0) return "Duration must be greater than 0.";
    const price = Number(form.price);
    if (!form.price || isNaN(price) || price <= 0) return "Price must be greater than 0.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setMessage({ type: "error", text: err }); return; }
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        name: form.name.trim(),
        duration: Number(form.duration),
        price: Number(form.price),
      };
      if (editingId) {
        const { error } = await supabase.from("services").update(payload).eq("id", editingId);
        if (error) throw error;
        setMessage({ type: "success", text: "Service updated successfully." });
      } else {
        const { error } = await supabase.from("services").insert(payload);
        if (error) throw error;
        setMessage({ type: "success", text: "Service added successfully." });
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await fetchServices();
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  function startEdit(service: Service) {
    setEditingId(service.id);
    setForm({ name: service.name, duration: String(service.duration), price: String(service.price) });
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMessage(null);
  }

  async function handleDelete(service: Service) {
    if (!window.confirm(`Are you sure you want to delete "${service.name}"?`)) return;
    setDeletingId(service.id);
    const { error } = await supabase.from("services").delete().eq("id", service.id);
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: `"${service.name}" deleted.` });
      await fetchServices();
    }
    setDeletingId(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-md flex flex-col shrink-0">
        <div className="px-6 py-6 border-b">
          <h1 className="text-2xl font-bold text-indigo-700">7jwzat</h1>
          <p className="text-xs text-gray-400 mt-0.5">Booking System</p>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Services", href: "/dashboard/services" },
            { label: "Business Hours", href: "/dashboard/hours" },
            { label: "Bookings", href: "/dashboard/bookings" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                item.href === "/dashboard/services"
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-indigo-50 hover:text-indigo-700"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-4 py-4 border-t">
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/"); }}
            className="w-full text-left px-4 py-2.5 rounded-lg text-red-600 hover:bg-red-50 transition text-sm font-medium"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8 max-w-3xl">
        <h2 className="text-2xl font-bold text-gray-800 mb-8">Services</h2>

        {/* Message */}
        {message && (
          <div className={`rounded-lg px-4 py-3 mb-6 text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}>
            {message.text}
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
          <h3 className="font-semibold text-gray-700 mb-5">
            {editingId ? "Edit Service" : "Add New Service"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Haircut"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  placeholder="e.g. 30"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (AED)</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="e.g. 25.99"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition"
              >
                {saving ? "Saving..." : editingId ? "Update Service" : "Add Service"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="border border-gray-300 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Services list */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-5">Your Services</h3>
          {services.length === 0 ? (
            <p className="text-sm text-gray-400">No services yet. Add your first service above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-gray-500 font-medium pb-3 pr-4">Service</th>
                    <th className="text-left text-gray-500 font-medium pb-3 pr-4">Duration</th>
                    <th className="text-left text-gray-500 font-medium pb-3 pr-4">Price</th>
                    <th className="text-right text-gray-500 font-medium pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {services.map((svc) => (
                    <tr key={svc.id} className="hover:bg-gray-50 transition">
                      <td className="py-3 pr-4 font-medium text-gray-800">{svc.name}</td>
                      <td className="py-3 pr-4 text-gray-600">{svc.duration} min</td>
                      <td className="py-3 pr-4 text-gray-600">AED {Number(svc.price).toFixed(2)}</td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => startEdit(svc)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(svc)}
                          disabled={deletingId === svc.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60 transition"
                        >
                          🗑️ Delete
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
    </div>
  );
}