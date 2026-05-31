import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Link href="/" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium mb-8 inline-block">
          ← Back to home
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Privacy Policy</h1>
        <p className="text-slate-500 mb-8">Last updated: January 2026</p>
        <div className="prose prose-slate text-slate-700 space-y-4 text-sm leading-relaxed">
          <p>7jwzat collects only the information necessary to run the booking service: business owner email, business name, and customer booking details (name, email, phone, appointment info).</p>
          <p>Customer data is used only to facilitate bookings and send confirmation emails. We do not sell or share your data with third parties beyond what is needed to operate the service (e.g., email delivery via Resend).</p>
          <p>Business owners can delete their account and all associated data at any time by contacting support@7jwzat.com.</p>
          <p>For questions, contact us at <a href="mailto:support@7jwzat.com" className="text-emerald-600 hover:underline">support@7jwzat.com</a>.</p>
        </div>
      </div>
    </main>
  );
}
