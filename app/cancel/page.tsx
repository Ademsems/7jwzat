"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLanguage, useApplyHtmlDir } from "@/lib/i18n/LanguageProvider";
import { formatDateLocale, formatTimeLocale } from "@/lib/i18n/format";

/**
 * Public cancel-booking page (customer-facing, no auth). Reads ?token=,
 * validates it against GET /api/cancel-booking, shows the booking details,
 * and — on confirmation — calls POST /api/cancel-booking. Both endpoints
 * re-validate the token server-side; this page never decides on its own
 * whether a cancellation is allowed, only reflects what the API says.
 */

interface PreviewBooking {
  customerName: string;
  bookingDate: string;
  bookingTime: string;
  serviceName: string;
  businessName: string;
  whatsappNumber: string | null;
}

type Reason = "not_found" | "expired" | "used" | "already_cancelled" | "already_completed";
type PageState = "loading" | "invalid" | "ready" | "cancelling" | "done";

const REASON_KEY: Record<Reason, string> = {
  not_found: "cancel.invalidToken",
  expired: "cancel.expiredToken",
  used: "cancel.usedToken",
  already_cancelled: "cancel.alreadyCancelled",
  already_completed: "cancel.alreadyCompleted",
};

const LANG_STORAGE_KEY = "7jwzat-lang"; // same key LanguageProvider.tsx uses

function waLink(number: string, text: string) {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function WhatsAppButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition w-full py-3 text-sm"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.489-.917zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
      </svg>
      {label}
    </a>
  );
}

function CancelPageInner() {
  const { t, locale, setLocale } = useLanguage();
  useApplyHtmlDir();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [state, setState] = useState<PageState>("loading");
  const [reason, setReason] = useState<Reason>("not_found");
  const [booking, setBooking] = useState<PreviewBooking | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setReason("not_found"); setState("invalid"); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/cancel-booking?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.valid) {
          setBooking(data.booking);
          setState("ready");
          // Default to the business's own language unless the visitor already
          // made an explicit choice on this device (same priority order as
          // LanguageProvider itself: explicit choice always wins).
          if (data.defaultLocale === "ar" || data.defaultLocale === "en") {
            let explicit: string | null = null;
            try { explicit = localStorage.getItem(LANG_STORAGE_KEY); } catch { /* ignore */ }
            if (explicit !== "en" && explicit !== "ar") setLocale(data.defaultLocale);
          }
        } else {
          setReason((data.reason as Reason) ?? "not_found");
          setState("invalid");
        }
      } catch {
        if (!cancelled) { setReason("not_found"); setState("invalid"); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleConfirm() {
    if (!token) return;
    setState("cancelling");
    setError("");
    try {
      const res = await fetch("/api/cancel-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setState("done");
      } else {
        setReason((data.error as Reason) ?? "not_found");
        setState("invalid");
      }
    } catch {
      setError(t("book.err.generic"));
      setState("ready");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">

          {state === "loading" && (
            <p className="text-center text-gray-400 text-sm py-6">{t("d.loading")}</p>
          )}

          {state === "invalid" && (
            <div className="text-center py-2">
              <div className="text-5xl mb-4">&#9888;&#65039;</div>
              <p className="text-gray-700 text-sm">{t(REASON_KEY[reason])}</p>
            </div>
          )}

          {(state === "ready" || state === "cancelling") && booking && (
            <>
              <h1 className="text-xl font-bold text-gray-800 mb-1 text-center">{t("cancel.pageTitle")}</h1>
              <p className="text-sm text-gray-500 mb-6 text-center">{booking.businessName}</p>
              <div className="bg-indigo-50 rounded-xl p-5 text-start space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t("book.confirm.name")}</span>
                  <span className="font-semibold text-gray-800">{booking.customerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t("book.confirm.service")}</span>
                  <span className="font-semibold text-gray-800">{booking.serviceName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t("book.confirm.date")}</span>
                  <span className="font-semibold text-gray-800">{formatDateLocale(booking.bookingDate, locale)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t("book.confirm.time")}</span>
                  <span className="font-semibold text-gray-800">{formatTimeLocale(booking.bookingTime, locale)}</span>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">{error}</div>
              )}
              <button
                onClick={handleConfirm}
                disabled={state === "cancelling"}
                className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-60 transition"
              >
                {state === "cancelling" ? t("cancel.confirming") : t("cancel.confirmButton")}
              </button>
            </>
          )}

          {state === "done" && booking && (
            <div className="text-center py-2">
              <div className="text-5xl mb-4">&#9989;</div>
              <h1 className="text-xl font-bold text-gray-800 mb-2">{t("cancel.cancelledTitle")}</h1>
              <p className="text-sm text-gray-500 mb-6">{t("cancel.cancelledBody")}</p>
              {booking.whatsappNumber && (
                <div className="mb-3">
                  <WhatsAppButton
                    href={waLink(
                      booking.whatsappNumber,
                      locale === "ar" ? "مرحباً، أود إعادة الحجز" : "Hello, I'd like to book again"
                    )}
                    label={t("book.confirm.whatsapp")}
                  />
                </div>
              )}
              <a href="/" className="block w-full text-indigo-600 text-sm font-medium hover:underline">
                {t("common.backToHome")}
              </a>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// useSearchParams() requires a Suspense boundary in Next.js 14 App Router
// (same pattern as app/auth/login/page.tsx).
export default function CancelPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <CancelPageInner />
    </Suspense>
  );
}
