"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { bookingUrl } from "@/lib/slug";
import { showToast } from "@/components/Toast";
import { QRCodeCard } from "@/components/QRCodeCard";
import { COUNTRIES, DEFAULT_COUNTRY, DEFAULT_CURRENCY } from "@/lib/currency";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { InfoTooltip } from "@/components/InfoTooltip";

interface Profile {
  id?: string;
  email: string;
  business_name: string;
  phone_number?: string | null;
  created_at?: string;
  country?: string | null;
  currency?: string | null;
  whatsapp_number?: string | null;
  address?: string | null;
}

// Unique currency options (from the country map).
const CURRENCIES = Array.from(new Set(COUNTRIES.map(c => c.currency)));

/** Store digits only (no +, no spaces/dashes). */
function normalizeWhatsapp(raw: string): string {
  return raw.replace(/[^\d]/g, "").replace(/^0+/, "");
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-4 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 sm:w-40 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

const PW_EMPTY = { current: "", next: "", confirm: "" };

export default function SettingsPage() {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const [profile, setProfile]     = useState<Profile | null>(null);
  const [loading, setLoading]     = useState(true);
  const [copied, setCopied]       = useState(false);

  // Change password
  const [pw, setPw]               = useState(PW_EMPTY);
  const [pwError, setPwError]     = useState("");
  const [pwSaving, setPwSaving]   = useState(false);

  // Localization & contact editing
  const [editingBiz, setEditingBiz] = useState(false);
  const [bizForm, setBizForm]       = useState({ country: DEFAULT_COUNTRY, currency: DEFAULT_CURRENCY, whatsapp: "", address: "" });
  const [bizSaving, setBizSaving]   = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth/login"); return; }
      const { data } = await supabase.from("users").select("*").eq("id", session.user.id).single();
      const prof = data ?? { email: session.user.email ?? "", business_name: "My Business" };
      setProfile(prof);
      setBizForm({
        country:  prof.country  ?? DEFAULT_COUNTRY,
        currency: prof.currency ?? DEFAULT_CURRENCY,
        whatsapp: prof.whatsapp_number ?? "",
        address:  prof.address ?? "",
      });
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleBizSave() {
    if (!profile?.id) return;
    setBizSaving(true);
    const whatsapp = normalizeWhatsapp(bizForm.whatsapp);
    // Changing country does NOT auto-change currency (currency edited independently).
    const address = bizForm.address.trim() || null;
    const { error } = await supabase
      .from("users")
      .update({ country: bizForm.country, currency: bizForm.currency, whatsapp_number: whatsapp || null, address })
      .eq("id", profile.id);
    if (error) {
      showToast(error.message);
    } else {
      setProfile(p => p ? { ...p, country: bizForm.country, currency: bizForm.currency, whatsapp_number: whatsapp || null, address } : p);
      setBizForm(f => ({ ...f, whatsapp, address: address ?? "" }));
      setEditingBiz(false);
      showToast(t("settings.saved"));
    }
    setBizSaving(false);
  }

  async function copyLink() {
    if (!profile) return;
    await navigator.clipboard.writeText(bookingUrl(profile.business_name));
    setCopied(true);
    showToast(t("dash.linkCopied"));
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");

    if (pw.next.length < 8) {
      setPwError(t("settings.pwTooShort"));
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwError(t("settings.pwMismatch"));
      return;
    }

    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw.next });
    if (error) {
      setPwError(error.message);
      showToast(error.message);
    } else {
      showToast(t("settings.pwUpdated"));
      setPw(PW_EMPTY);
    }
    setPwSaving(false);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">{t("d.loading")}</p></div>;

  const link = profile ? bookingUrl(profile.business_name) : "";
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(locale === "ar" ? "ar-JO" : "en-GB", { year: "numeric", month: "long", numberingSystem: "latn" })
    : "—";

  return (
    <main className="flex-1 p-4 sm:p-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1 inline-flex items-center gap-2">
        {t("settings.title")}
        <InfoTooltip textKey="tip.page.settings" />
      </h2>
      <p className="text-gray-500 text-sm mb-8">{t("settings.subtitle")}</p>

      {/* Business Info */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="font-semibold text-gray-700 mb-1">{t("settings.bizDetails")}</h3>
        <p className="text-xs text-gray-400 mb-4">{t("settings.bizDetailsDesc")}</p>
        <Row label={t("settings.businessName")} value={profile?.business_name} />
        <Row label={t("settings.email")}        value={profile?.email} />
        <Row label={t("settings.memberSince")}  value={memberSince} />
      </div>

      {/* Localization & Contact (editable) */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between gap-4 mb-1">
          <h3 className="font-semibold text-gray-700">{t("settings.localization")}</h3>
          {!editingBiz && (
            <button
              onClick={() => setEditingBiz(true)}
              className="text-xs font-semibold text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition"
            >
              {t("d.edit")}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">{t("settings.localizationDesc")}</p>

        {!editingBiz ? (
          <>
            <Row label={t("settings.country")}  value={COUNTRIES.find(c => c.code === (profile?.country ?? DEFAULT_COUNTRY))?.label ?? "—"} />
            <Row label={t("settings.currency")} value={profile?.currency ?? DEFAULT_CURRENCY} />
            <Row
              label={t("settings.whatsapp")}
              value={profile?.whatsapp_number
                ? <span dir="ltr">+{profile.whatsapp_number}</span>
                : <span className="text-gray-300 italic">{t("settings.notSet")}</span>}
            />
            <Row
              label={t("settings.address")}
              value={profile?.address
                ? <span className="whitespace-pre-line">{profile.address}</span>
                : <span className="text-gray-300 italic">{t("settings.notSet")}</span>}
            />
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
                {t("settings.country")} <InfoTooltip textKey="tip.settings.country" />
              </label>
              <select
                value={bizForm.country}
                onChange={e => setBizForm(f => ({ ...f, country: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
                {t("settings.currency")} <InfoTooltip textKey="tip.settings.currency" />
              </label>
              <select
                value={bizForm.currency}
                onChange={e => setBizForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">{t("settings.currencyHint")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
                {t("settings.whatsappNumber")} <InfoTooltip textKey="tip.settings.whatsapp" />
              </label>
              <input
                type="tel"
                dir="ltr"
                value={bizForm.whatsapp}
                onChange={e => setBizForm(f => ({ ...f, whatsapp: e.target.value }))}
                placeholder="+9627XXXXXXXX"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-xs text-gray-400 mt-1">{t("settings.whatsappHint")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
                {t("settings.address")} <span className="text-gray-400 font-normal text-xs">{t("d.optional")}</span>
                <InfoTooltip textKey="tip.settings.address" />
              </label>
              <textarea
                rows={3}
                value={bizForm.address}
                onChange={e => setBizForm(f => ({ ...f, address: e.target.value }))}
                placeholder={t("settings.addressPlaceholder")}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
              <p className="text-xs text-gray-400 mt-1">{t("settings.addressHint")}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleBizSave}
                disabled={bizSaving}
                className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition"
              >
                {bizSaving ? t("d.saving") : t("d.save")}
              </button>
              <button
                onClick={() => {
                  setEditingBiz(false);
                  setBizForm({
                    country:  profile?.country  ?? DEFAULT_COUNTRY,
                    currency: profile?.currency ?? DEFAULT_CURRENCY,
                    whatsapp: profile?.whatsapp_number ?? "",
                    address:  profile?.address ?? "",
                  });
                }}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50 transition"
              >
                {t("d.cancel")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Booking Link */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="font-semibold text-gray-700 mb-1">{t("settings.bookingLink")}</h3>
        <p className="text-xs text-gray-400 mb-4">{t("settings.bookingLinkDesc")}</p>
        <div className="flex gap-3 items-center">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-700 truncate">
            {link}
          </div>
          <button
            onClick={copyLink}
            className={`shrink-0 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              copied ? "bg-green-600 text-white" : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {copied ? `✓ ${t("dash.copied")}` : t("settings.copy")}
          </button>
        </div>
        <div className="mt-3">
          <Link href={link} target="_blank" className="text-xs text-emerald-600 hover:underline">
            {t("settings.openPage")}
          </Link>
        </div>
      </div>

      {/* QR Code */}
      {profile && (
        <div className="mb-6">
          <QRCodeCard url={link} businessName={profile.business_name} />
        </div>
      )}

      {/* Subscription */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="font-semibold text-gray-700 mb-1">Subscription</h3>
        <p className="text-xs text-gray-400 mb-4">Your current plan details.</p>
        <Row label="Plan"         value={<span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">&#10024; Free Plan</span>} />
        <Row label="Bookings"     value="Unlimited" />
        <Row label="Services"     value="Unlimited" />
        <Row label="Next Billing" value={<span className="text-gray-400 italic">No billing — free forever</span>} />
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-1">{t("settings.changePassword")}</h3>
        <p className="text-xs text-gray-400 mb-5">{t("settings.changePasswordDesc")}</p>

        <form onSubmit={handleChangePassword} className="space-y-4">
          {pwError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {pwError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("settings.currentPassword")}</label>
            <input
              type="password"
              value={pw.current}
              onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("settings.newPassword")}</label>
            <input
              type="password"
              value={pw.next}
              onChange={e => setPw(p => ({ ...p, next: e.target.value }))}
              autoComplete="new-password"
              minLength={8}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("settings.confirmPassword")}</label>
            <input
              type="password"
              value={pw.confirm}
              onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
              autoComplete="new-password"
              minLength={8}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={pwSaving || !pw.next || !pw.confirm}
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition"
          >
            {pwSaving ? t("d.updating") : t("settings.updatePassword")}
          </button>
        </form>
      </div>
    </main>
  );
}
