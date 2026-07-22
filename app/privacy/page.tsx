"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { useLanguage, useApplyHtmlDir } from "@/lib/i18n/LanguageProvider";

export default function PrivacyPage() {
  useApplyHtmlDir();
  const { t } = useLanguage();
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white">
        <div className="max-w-2xl mx-auto px-4 py-16">
          <Link href="/" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium mb-8 inline-flex items-center gap-1">
            <span className="inline-block rtl:-scale-x-100">←</span> {t("m.privacy.back")}
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">{t("m.privacy.title")}</h1>
          <p className="text-slate-500 mb-8">{t("m.privacy.updated")}</p>
          <div className="text-slate-700 space-y-4 text-sm leading-relaxed">
            <p>{t("m.privacy.p1")}</p>
            <p>{t("m.privacy.p2")}</p>
            <p>{t("m.privacy.p3")}</p>
            <p>{t("m.legal.contactPrefix")}{" "}
              <a href="mailto:support@sajjel.online" className="text-emerald-600 hover:underline">support@sajjel.online</a>.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
