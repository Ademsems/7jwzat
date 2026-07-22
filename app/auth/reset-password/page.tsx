"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { useLanguage, useApplyHtmlDir, LanguageToggle } from "@/lib/i18n/LanguageProvider";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useLanguage();
  useApplyHtmlDir();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase handles the token from the URL hash automatically
    supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) { setError(t("settings.pwTooShort")); return; }
    if (form.password !== form.confirm) { setError(t("settings.pwMismatch")); return; }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: form.password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    await supabase.auth.signOut();
    router.push("/auth/login?reset=success");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="flex justify-end mb-2"><LanguageToggle /></div>
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-slate-900">Sajjel</Link>
          <p className="text-gray-500 mt-1">{t("rp.title")}</p>
        </div>

        {!sessionReady ? (
          <p className="text-center text-sm text-gray-500">{t("d.loading")}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("rp.newPassword")}</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder={t("signup.passwordPlaceholder")}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("rp.confirmPassword")}</label>
              <input
                type="password"
                required
                value={form.confirm}
                onChange={e => setForm({ ...form, confirm: e.target.value })}
                placeholder={t("signup.confirmPlaceholder")}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 text-white py-3 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              {loading ? t("rp.updating") : t("rp.update")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}