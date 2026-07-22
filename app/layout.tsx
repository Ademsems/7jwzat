import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";

// Self-hosted, auto-subset fonts (replaces any render-blocking Google Fonts link).
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sajjel سجّل — Online Booking for Salons, Spas & Clinics in Jordan",
  description:
    "Free online booking for salons, spas, and clinics — now launching in Jordan. Free during our launch year: unlimited bookings, no setup fees, no payment processing.",
  openGraph: {
    title: "Sajjel سجّل — Online Booking, now in Jordan",
    description:
      "Arabic-first booking system for salons, spas, and clinics. Free during our launch year. Share a link, customers book online.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Global default stays LTR/English (marketing + untranslated dashboard).
  // Localized surfaces (booking page now; dashboard in Part B) flip <html>
  // dir/lang to the active locale while they are mounted via useApplyHtmlDir().
  // Runs before hydration to set <html> lang/dir with NO first-paint flash.
  // Resolution (must match LanguageProvider):
  //   1. localStorage "7jwzat-lang" (explicit user choice) always wins.
  //   2. else geo default: country from localStorage "7jwzat-geo-country"
  //      (manual footer choice) else the "7jwzat-geo-country" cookie (Vercel geo,
  //      set by middleware). AE → "en"; everything else / unknown → "ar".
  //   3. else "ar".
  const noFlashScript = `(function(){try{var e=document.documentElement;var l=localStorage.getItem('7jwzat-lang');if(l!=='en'&&l!=='ar'){var c=localStorage.getItem('7jwzat-geo-country');if(!c){var m=document.cookie.match(/(?:^|; )7jwzat-geo-country=([^;]+)/);c=m?decodeURIComponent(m[1]):'';}l=(c==='AE')?'en':'ar';}e.lang=l;e.dir=l==='ar'?'rtl':'ltr';}catch(e){}})();`;

  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning className={`${inter.variable} ${arabic.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <LanguageProvider>
          {children}
          <ToastProvider />
        </LanguageProvider>
      </body>
    </html>
  );
}
