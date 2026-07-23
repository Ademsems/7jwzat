import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOwnerCancellationEmail } from "@/lib/email";

/**
 * GET/POST /api/cancel-booking — public, no auth. Powers app/cancel/page.tsx.
 *
 * Uses the service-role key exclusively, because:
 *   - booking_cancel_tokens RLS allows anonymous SELECT (the token is the
 *     secret) but insert/update are service-role only.
 *   - The booking/service/business details needed for the preview live in
 *     owner-scoped tables (bookings/services/users) that an anonymous client
 *     cannot read at all, so a service-role lookup is required regardless.
 *
 * Both GET (preview) and POST (execute) independently re-validate the token
 * server-side — the client's own state is never trusted, per the task.
 *
 *   GET  ?token=       → { valid: true, booking, defaultLocale } | { valid: false, reason }
 *   POST { token }     → { success: true } | { error: reason }, status 409 on any invalid state
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type Reason = "not_found" | "expired" | "used" | "already_cancelled" | "already_completed";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ValidationResult = { ok: true; tokenId: string; booking: any } | { ok: false; reason: Reason };

async function validateToken(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  token: string
): Promise<ValidationResult> {
  const { data: tokenRow } = await supabase
    .from("booking_cancel_tokens")
    .select("id, booking_id, used_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!tokenRow) return { ok: false, reason: "not_found" };
  if (tokenRow.used_at) return { ok: false, reason: "used" };
  if (new Date(tokenRow.expires_at) < new Date()) return { ok: false, reason: "expired" };

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, service_id, customer_name, booking_date, booking_time, status")
    .eq("id", tokenRow.booking_id)
    .maybeSingle();

  if (!booking) return { ok: false, reason: "not_found" };
  // The token can still be valid/unused even if the booking was already
  // cancelled or completed through another path (dashboard, no-show, etc.).
  if (booking.status === "cancelled") return { ok: false, reason: "already_cancelled" };
  if (booking.status === "completed") return { ok: false, reason: "already_completed" };

  return { ok: true, tokenId: tokenRow.id, booking };
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false, reason: "not_found" satisfies Reason }, { status: 400 });

  const supabase = getSupabase();
  const result = await validateToken(supabase, token);
  if (!result.ok) return NextResponse.json({ valid: false, reason: result.reason });

  const [{ data: service }, { data: business }] = await Promise.all([
    supabase.from("services").select("name").eq("id", result.booking.service_id).maybeSingle(),
    supabase.from("users").select("business_name, whatsapp_number, country").eq("id", result.booking.user_id).maybeSingle(),
  ]);

  // No stored per-business language preference exists — approximate it with
  // the same country-based default used elsewhere in the app (AE → English,
  // everything else → Arabic; see lib/i18n/LanguageProvider.tsx).
  const defaultLocale = business?.country === "AE" ? "en" : "ar";

  return NextResponse.json({
    valid: true,
    booking: {
      customerName: result.booking.customer_name,
      bookingDate: result.booking.booking_date,
      bookingTime: result.booking.booking_time,
      serviceName: service?.name ?? "—",
      businessName: business?.business_name ?? "",
      whatsappNumber: business?.whatsapp_number ?? null,
    },
    defaultLocale,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = body?.token;
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "not_found" satisfies Reason }, { status: 400 });
  }

  const supabase = getSupabase();
  const result = await validateToken(supabase, token);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  // Mark the token used with an atomic guard (`used_at IS NULL`) so two
  // concurrent requests for the same token can't both "win" — whichever
  // update actually matches a row proceeds; the other gets `used`.
  const { data: updatedToken, error: tokenErr } = await supabase
    .from("booking_cancel_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", result.tokenId)
    .is("used_at", null)
    .select("id")
    .maybeSingle();

  if (tokenErr) {
    console.error("cancel-booking: token update failed:", tokenErr.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  if (!updatedToken) {
    return NextResponse.json({ error: "used" satisfies Reason }, { status: 409 });
  }

  const { error: bookingErr } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", result.booking.id);

  if (bookingErr) {
    console.error("cancel-booking: booking status update failed:", bookingErr.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // Notify the owner — non-blocking, never fail the cancellation over email.
  try {
    const [{ data: service }, { data: business }] = await Promise.all([
      supabase.from("services").select("name").eq("id", result.booking.service_id).maybeSingle(),
      supabase.from("users").select("business_name, email, country").eq("id", result.booking.user_id).maybeSingle(),
    ]);
    if (business?.email) {
      await sendOwnerCancellationEmail({
        ownerEmail: business.email,
        customerName: result.booking.customer_name,
        serviceName: service?.name ?? "—",
        bookingDate: result.booking.booking_date,
        bookingTime: result.booking.booking_time,
        businessName: business.business_name,
        locale: business.country === "AE" ? "en" : "ar",
      });
    }
  } catch (emailErr) {
    console.error("cancel-booking: owner notification email failed (non-fatal):", emailErr);
  }

  return NextResponse.json({ success: true });
}
