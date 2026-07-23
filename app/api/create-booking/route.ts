import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isTimeBlockedByDayNote } from "@/lib/dayNoteActions";

/**
 * POST /api/create-booking
 *
 * Server-side booking creation. Uses the service-role key to:
 *   1. Upsert customer profile (Task 2A) — wrapped in try/catch so a
 *      profile failure never blocks the booking itself.
 *   2. Reject the request if the date/time falls inside an owner day-block
 *      (day_notes) — the real enforcement boundary, not just a UI hide.
 *   3. Check for double-booking (1-on-1) or capacity (group)
 *   4. Insert the booking with customer_id, staff_id, staff_preference
 *   5. Fire confirmation emails (non-blocking)
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
    // Staff (Task 3)
    staffId,
    staffPreference,
    // Custom field answers — array of {customFieldId, answer}
    customFieldAnswers,
    // Email fields
    serviceName,
    duration,
    price,
    businessName,
    ownerEmail,
    currency,
    locale,
  } = body;

  if (!businessId || !serviceId || !customerName || !customerEmail || !customerPhone) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── 1. Upsert customer profile ─────────────────────────────────────────────
  // Wrapped in try/catch — a profile issue must never block the booking.
  let customerId: string | null = null;
  try {
    // Only track customers who have a real phone (blocked/manual use sentinels)
    const realPhone = customerPhone && customerPhone !== "0000000000" ? customerPhone.trim() : null;

    if (realPhone) {
      // Try to find existing customer for this business + phone
      const { data: existing } = await supabase
        .from("customers")
        .select("id, name, email")
        .eq("user_id", businessId)
        .eq("phone", realPhone)
        .maybeSingle();

      if (existing) {
        customerId = existing.id;
        // Update name/email if they've changed
        const updates: Record<string, string> = {};
        if (existing.name  !== customerName.trim())  updates.name  = customerName.trim();
        if (customerEmail && existing.email !== customerEmail.trim()) updates.email = customerEmail.trim();
        if (Object.keys(updates).length > 0) {
          await supabase.from("customers").update(updates).eq("id", existing.id);
        }
      } else {
        // Insert new customer record
        const { data: newCust } = await supabase
          .from("customers")
          .insert({
            user_id: businessId,
            name:    customerName.trim(),
            email:   customerEmail.trim() || null,
            phone:   realPhone,
          })
          .select("id")
          .single();
        customerId = newCust?.id ?? null;
      }
    }
  } catch (profileErr) {
    // Log but do NOT return an error — booking proceeds without customer_id
    console.error("create-booking: customer profile upsert failed (non-fatal):", profileErr);
  }

  // ── 2. Day-block enforcement ────────────────────────────────────────────────
  // The real enforcement boundary — the booking page's own slot list is only
  // a UI convenience; a customer bypassing it and posting directly here must
  // still be rejected. Applies to both 1-on-1 and group bookings (both send
  // bookingDate/bookingTime — see app/book/[businessname]/page.tsx).
  if (bookingDate) {
    const { data: dayNote } = await supabase
      .from("day_notes")
      .select("block_type, block_start_time, block_end_time")
      .eq("business_id", businessId)
      .eq("date", bookingDate)
      .maybeSingle();

    if (isTimeBlockedByDayNote(dayNote, bookingTime ?? null)) {
      return NextResponse.json(
        { error: "This time is not available for online booking. Please contact the business directly." },
        { status: 409 }
      );
    }
  }

  // ── 3. Conflict check ──────────────────────────────────────────────────────
  if (groupSessionId) {
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

  // ── 4. Insert booking ──────────────────────────────────────────────────────
  const { error: insErr } = await supabase.from("bookings").insert({
    user_id:          businessId,
    service_id:       serviceId,
    group_session_id: groupSessionId ?? null,
    customer_id:      customerId,
    customer_name:    customerName,
    customer_email:   customerEmail,
    customer_phone:   customerPhone,
    notes:            notes || null,
    booking_date:     bookingDate,
    booking_time:     bookingTime,
    status:           "pending",
    booking_type:     "customer",
    staff_id:         staffId   ?? null,
    staff_preference: staffPreference ?? "any",
  });

  if (insErr) {
    console.error("create-booking insert error:", insErr.message);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // ── 5. Save custom field answers (non-blocking — never block booking) ────────
  try {
    if (
      customFieldAnswers &&
      Array.isArray(customFieldAnswers) &&
      customFieldAnswers.length > 0
    ) {
      // Get the id of the booking we just inserted
      const { data: newBooking } = await supabase
        .from("bookings")
        .select("id")
        .eq("user_id", businessId)
        .eq("booking_date", bookingDate ?? null)
        .eq("booking_time", bookingTime ?? null)
        .eq("customer_email", customerEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (newBooking?.id) {
        const rows = (customFieldAnswers as { customFieldId: string; answer: string }[])
          .filter(a => a.answer && a.answer.trim())
          .map(a => ({
            booking_id:      newBooking.id,
            custom_field_id: a.customFieldId,
            answer:          a.answer.trim(),
          }));
        if (rows.length > 0) {
          await supabase.from("custom_field_answers").insert(rows);
        }
      }
    }
  } catch (cfErr) {
    console.error("create-booking: custom field answers save failed (non-fatal):", cfErr);
  }

  // ── 6. Fire confirmation emails (non-blocking) ─────────────────────────────
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
      currency,
      locale,
    }),
  }).catch(e => console.error("Email dispatch failed:", e));

  return NextResponse.json({ success: true });
}
