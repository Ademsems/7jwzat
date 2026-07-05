"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";
import { slugifyBusinessName } from "@/lib/slug";

/**
 * Reusable QR code card for a business's public booking URL.
 *
 * - Renders a ~220px QR into a <canvas> (dark modules on white, small margin)
 * - "Download PNG" exports a separate high-res (~1024px) image
 * - "Print" opens a minimal print window with just the QR + business name
 */
export function QRCodeCard({ url, businessName }: { url: string; businessName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !url) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 220,
      margin: 2,
      color: { dark: "#111827", light: "#ffffff" },
    }).catch((e: unknown) => console.error("QR render failed:", e));
  }, [url]);

  async function handleDownload() {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 1024,
        margin: 4,
        color: { dark: "#111827", light: "#ffffff" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${slugifyBusinessName(businessName)}-booking-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("QR download failed:", e);
    }
  }

  async function handlePrint() {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 512,
        margin: 4,
        color: { dark: "#111827", light: "#ffffff" },
      });
      const win = window.open("", "_blank", "width=600,height=700");
      if (!win) return;
      win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Booking QR — ${businessName.replace(/</g, "&lt;")}</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; flex-direction: column;
           align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    img  { width: 320px; height: 320px; }
    h1   { font-size: 22px; margin: 16px 0 4px; }
    p    { font-size: 12px; color: #6b7280; margin: 0; word-break: break-all; text-align: center; padding: 0 24px; }
  </style>
</head>
<body>
  <img src="${dataUrl}" alt="Booking QR code" />
  <h1>${businessName.replace(/</g, "&lt;")}</h1>
  <p>${url.replace(/</g, "&lt;")}</p>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`);
      win.document.close();
    } catch (e) {
      console.error("QR print failed:", e);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 flex flex-col items-center text-center">
      <canvas ref={canvasRef} className="rounded-lg" width={220} height={220} />
      <p className="text-sm font-bold text-gray-800 mt-3">{businessName}</p>
      <p className="text-[11px] text-gray-400 mt-0.5 break-all">{url}</p>
      <div className="flex flex-wrap justify-center gap-3 mt-4">
        <button
          onClick={handleDownload}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition"
        >
          Download PNG
        </button>
        <button
          onClick={handlePrint}
          className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
        >
          Print
        </button>
      </div>
    </div>
  );
}
