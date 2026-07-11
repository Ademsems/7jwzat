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
  title: "7jwzat حجوزات — Online Booking for Salons, Spas & Clinics in Jordan",
  description:
    "Free online booking for salons, spas, and clinics — now launching in Jordan. Free during our launch year: unlimited bookings, no setup fees, no payment processing.",
  openGraph: {
    title: "7jwzat حجوزات — Online Booking, now in Jordan",
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
  // Runs before hydration to set <html> lang/dir from the persisted locale
  // (default "ar"), eliminating the first-paint flash of the wrong direction
  // before useApplyHtmlDir() runs. React remains the ongoing source of truth.
  const noFlashScript = `(function(){try{var l=localStorage.getItem('7jwzat-lang');if(l!=='en'&&l!=='ar')l='ar';var e=document.documentElement;e.lang=l;e.dir=l==='ar'?'rtl':'ltr';}catch(e){}})();`;

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
