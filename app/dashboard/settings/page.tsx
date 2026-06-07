"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { bookingUrl } from "@/lib/slug";
import { showToast } from "@/components/Toast";

interface Profile { email: string; business_name: string; phone_number?: string | null; created_at?: string; }

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 py-4 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 sm:w-40 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth/login"); return; }
      const { data } = await supabase.from("users").select("*").eq("id", session.user.id).single();
      setProfile(data ?? { email: session.user.email ?? "", business_name: "My Business" });
      setLoading(false);
    }
    load();
  }, [router]);

  async function copyLink() {
    if (!profile) return;
    await navigator.clipboard.writeText(bookingUrl(profile.business_name));
    setCopied(true);
    showToast("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></div>;

  const link = profile ? bookingUrl(profile.business_name) : "";
  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-AE", { year: "numeric", month: "long" }) : "—";

  return (
    <main className="flex-1 p-4 sm:p-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">Settings</h2>
      <p className="text-gray-500 text-sm mb-8">Your account and business details.</p>

      {/* Business Info */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="font-semibold text-gray-700 mb-1">Business Details</h3>
        <p className="text-xs text-gray-400 mb-4">Your public-facing business information.</p>
        <Row label="Business Name" value={profile?.business_name} />
        <Row label="Email" value={profile?.email} />
        <Row label="Phone" value={profile?.phone_number || <span className="text-gray-400 italic">Not set</span>} />
        <Row label="Member Since" value={memberSince} />
      </div>

      {/* Booking Link */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 className="font-semibold text-gray-700 mb-1">Your Booking Link</h3>
        <p className="text-xs text-gray-400 mb-4">Share this link with customers to accept online bookings.</p>
        <div className="flex gap-3 items-center">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-700 truncate">
            {link}
          </div>
          <button onClick={copyLink}
            className={`shrink-0 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              copied ? "bg-green-600 text-white" : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}>
            {copied ? "✓ Copied!" : "Copy"}
          </button>
        </div>
        <div className="mt-3">
          <Link href={link} target="_blank" className="text-xs text-emerald-600 hover:underline">
            Open your booking page →
          </Link>
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-1">Subscription</h3>
        <p className="text-xs text-gray-400 mb-4">Your current plan details.</p>
        <Row label="Plan" value={<span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">✨ Free Plan</span>} />
        <Row label="Bookings" value="Unlimited" />
        <Row label="Services" value="Unlimited" />
        <Row label="Next Billing" value={<span className="text-gray-400 italic">No billing — free forever</span>} />
      </div>
    </main>
  );
}
