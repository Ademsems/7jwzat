"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { COUNTRIES, DEFAULT_COUNTRY, currencyForCountry } from "@/lib/currency";

type BusinessType =
  | "hair_beauty"
  | "spa_wellness"
  | "clinic_healthcare"
  | "mental_health"
  | "fitness_movement"
  | "other";

const BUSINESS_TYPES: { value: BusinessType; label: string; icon: string; desc: string }[] = [
  { value: "hair_beauty",        label: "Hair & Beauty",          icon: "\u{1F487}", desc: "Salons, barbers, nail studios, PMU" },
  { value: "spa_wellness",       label: "Spa & Wellness",         icon: "\u{1F9D6}", desc: "Massages, body treatments, hammam" },
  { value: "clinic_healthcare",  label: "Clinic & Healthcare",    icon: "\u{1F3E5}", desc: "Doctors, dentists, physiotherapists" },
  { value: "mental_health",      label: "Mental Health",          icon: "\u{1F9E0}", desc: "Therapists, counselors, psychologists" },
  { value: "fitness_movement",   label: "Fitness & Movement",     icon: "\u{1F3CB}️", desc: "Gyms, yoga, personal trainers, dance" },
  { value: "other",              label: "Other Services",         icon: "\u{1F4CB}", desc: "Any other appointment-based business" },
];

export default function SignupPage() {
  const router = useRouter();

  // Step 1 = business type selection, Step 2 = account details
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    country: DEFAULT_COUNTRY,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function validate() {
    if (!form.email.includes("@")) return "Please enter a valid email address.";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword) return "Passwords do not match.";
    if (!form.businessName.trim()) return "Business name is required.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (signUpError) throw signUpError;
      if (data.user) {
        const { error: profileError } = await supabase.from("users").insert({
          id: data.user.id,
          email: form.email,
          business_name: form.businessName.trim(),
          business_type: selectedType ?? "other",
          country: form.country,
          currency: currencyForCountry(form.country),
        });
        if (profileError) throw profileError;

        // Pre-populate default business hours (Sun–Thu 09:00–17:00, Fri/Sat
        // closed) so new businesses avoid the "hours not configured" dead-end.
        // Non-fatal: never block signup on this.
        try {
          const defaultHours = [0, 1, 2, 3, 4].map(dow => ({
            user_id: data.user!.id,
            day_of_week: dow,
            start_time: "09:00",
            end_time: "17:00",
          }));
          await supabase.from("business_hours").insert(defaultHours);
        } catch (hoursErr) {
          console.error("signup: default hours insert failed (non-fatal):", hoursErr);
        }

        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ── Step 1: Business type ─────────────────────────────── */
  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-lg">
          <div className="text-center mb-6">
            <Link href="/" className="text-3xl font-bold text-slate-900">7jwzat</Link>
            <p className="text-gray-500 mt-1 text-sm">Step 1 of 2 — What type of business do you run?</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {BUSINESS_TYPES.map(bt => {
              const selected = selectedType === bt.value;
              return (
                <button
                  key={bt.value}
                  onClick={() => setSelectedType(bt.value)}
                  className={`relative p-4 rounded-xl border-2 text-left transition flex flex-col gap-1 ${
                    selected
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 hover:border-emerald-300 bg-white"
                  }`}
                >
                  {selected && (
                    <span className="absolute top-2 right-2 text-emerald-600 text-sm font-bold">&#10003;</span>
                  )}
                  <span className="text-2xl">{bt.icon}</span>
                  <span className="text-sm font-semibold text-gray-800 leading-tight">{bt.label}</span>
                  <span className="text-xs text-gray-400 leading-tight">{bt.desc}</span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!selectedType}
            className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Continue &rarr;
          </button>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-emerald-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  /* ── Step 2: Account details ───────────────────────────── */
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="text-3xl font-bold text-slate-900">7jwzat</Link>
          <p className="text-gray-500 mt-1 text-sm">Step 2 of 2 — Your account details</p>
        </div>

        {/* Selected type pill */}
        {selectedType && (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mb-5 text-sm">
            <span className="text-emerald-700 font-medium">
              {BUSINESS_TYPES.find(bt => bt.value === selectedType)?.icon}{" "}
              {BUSINESS_TYPES.find(bt => bt.value === selectedType)?.label}
            </span>
            <button
              onClick={() => setStep(1)}
              className="text-emerald-600 hover:underline text-xs font-medium"
            >
              Change
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
            <select
              value={form.country}
              onChange={e => setForm({ ...form, country: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>{c.label} ({c.currency})</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Sets your default currency. You can change it later in Settings.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
            <input
              type="text"
              required
              autoComplete="off"
              value={form.businessName}
              onChange={e => setForm({ ...form, businessName: e.target.value })}
              placeholder="e.g. Al Noor Salon"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              autoComplete="off"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="Min. 8 characters"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
              placeholder="Repeat your password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
            >
              &larr; Back
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-emerald-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
