import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Link href="/" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium mb-8 inline-block">
          ← Back to home
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Terms of Service</h1>
        <p className="text-slate-500 mb-8">Last updated: January 2026</p>
        <div className="text-slate-700 space-y-4 text-sm leading-relaxed">
          <p>By using 7jwzat, you agree to use the service lawfully and in accordance with these terms.</p>
          <p>7jwzat provides a software platform for appointment booking. We are not responsible for the quality of services provided by businesses listed on the platform, or for disputes between businesses and their customers.</p>
          <p>Paid subscriptions are billed monthly. You may cancel at any time; cancellation takes effect at the end of your current billing period.</p>
          <p>We reserve the right to suspend accounts that violate these terms or engage in abusive behavior.</p>
          <p>For questions, contact us at <a href="mailto:support@7jwzat.com" className="text-emerald-600 hover:underline">support@7jwzat.com</a>.</p>
        </div>
      </div>
    </main>
  );
}
