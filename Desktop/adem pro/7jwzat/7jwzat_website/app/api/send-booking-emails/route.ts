import { NextRequest, NextResponse } from "next/server";
import { sendCustomerEmail, sendOwnerEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerName, customerEmail, customerPhone, notes,
      serviceName, duration, price,
      bookingDate, bookingTime,
      businessName, ownerEmail,
    } = body;

    // Fire both emails in parallel — don't let failures block response
    const results = await Promise.allSettled([
      sendCustomerEmail({
        customerName, customerEmail, serviceName,
        duration, price, bookingDate, bookingTime, businessName,
      }),
      sendOwnerEmail({
        ownerEmail, customerName, customerEmail, customerPhone, notes,
        serviceName, bookingDate, bookingTime, businessName,
      }),
    ]);

    const errors = results
      .filter(r => r.status === "rejected")
      .map(r => (r as PromiseRejectedResult).reason?.message ?? "unknown error");

    if (errors.length > 0) {
      console.error("Email errors:", errors);
      return NextResponse.json({ ok: false, errors }, { status: 207 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to send emails";
    console.error("Email route error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}