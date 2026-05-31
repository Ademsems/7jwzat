import type { Metadata } from "next";
import "./globals.css";

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
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
