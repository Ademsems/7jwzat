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
  title: "7jwzat - Online Booking for Salons, Spas & Clinics",
  description:
    "Free online booking system for small businesses in UAE, Saudi Arabia, and Jordan. No setup fees, no payment processing. Get your first booking today.",
  openGraph: {
    title: "7jwzat - Online Booking for Salons, Spas & Clinics",
    description:
      "Simple booking system for salons, spas, and clinics in the Middle East. Share a link, customers book online.",
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
  return (
    <html lang="en" dir="ltr" className={`${inter.variable} ${arabic.variable}`}>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <LanguageProvider>
          {children}
          <ToastProvider />
        </LanguageProvider>
      </body>
    </html>
  );
}
