import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/create-booking
 *
 * Server-side booking creation. Uses the service-role key to:
 *   1. Check for double-booking (1-on-1) or capacity (group)
 *   2. Insert the booking
 *   3. Fire confirmation emails (non-blocking)
 *
 * All reads/writes go through the service role so RLS does not
 * interfere with the anonymous public visitor flow.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    businessId,
    serviceId,
    groupSessionId,
    customerName,
    customerEmail,
    customerPhone,
    notes,
    bookingDate,
    bookingTime,
    // Email fields
    serviceName,
    duration,
    price,
    businessName,
    ownerEmail,
  } = body;

  if (!businessId || !serviceId || !customerName || !customerEmail || !customerPhone) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (groupSessionId) {
    // ── Group session: check capacity ──────────────────────────────────────
    const [{ count }, { data: session }] = await Promise.all([
      supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("group_session_id", groupSessionId)
        .neq("status", "cancelled"),
      supabase
        .from("group_sessions")
        .select("capacity, session_date, session_time")
        .eq("id", groupSessionId)
        .single(),
    ]);

    if (session && (count ?? 0) >= session.capacity) {
      return NextResponse.json(
        { error: "Sorry, this session is now fully booked." },
        { status: 409 }
      );
    }
  } else {
    // ── 1-on-1: check for double booking ──────────────────────────────────
    if (!bookingDate || !bookingTime) {
      return NextResponse.json({ error: "Missing date/time" }, { status: 400 });
    }
    const { data: existing } = await supabase
      .from("bookings")
      .select("id")
      .eq("user_id", businessId)
      .eq("booking_date", bookingDate)
      .eq("booking_time", bookingTime)
      .neq("status", "cancelled");

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "This time slot is no longer available. Please choose another time." },
        { status: 409 }
      );
    }
  }

  // ── Insert booking ─────────────────────────────────────────────────────────
  const { error: insErr } = await supabase.from("bookings").insert({
    user_id:          businessId,
    service_id:       serviceId,
    group_session_id: groupSessionId ?? null,
    customer_name:    customerName,
    customer_email:   customerEmail,
    customer_phone:   customerPhone,
    notes:            notes || null,
    booking_date:     bookingDate,
    booking_time:     bookingTime,
    status:           "pending",
    booking_type:     "customer",
  });

  if (insErr) {
    console.error("create-booking insert error:", insErr.message);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // ── Fire confirmation emails (non-blocking) ───────────────────────────────
  const origin = new URL(req.url).origin;
  fetch(`${origin}/api/send-booking-emails`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName,
      customerEmail,
      customerPhone,
      notes,
      serviceName,
      duration,
      price,
      bookingDate,
      bookingTime,
      businessName,
      ownerEmail,
    }),
  }).catch(e => console.error("Email dispatch failed:", e));

  return NextResponse.json({ success: true });
}
