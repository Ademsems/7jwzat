import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/booking-page-data?slug=<slug>
 *
 * Returns ALL data the public booking page needs in one call:
 *   business, services, hours, existingBookings (next 30 days)
 *
 * Uses the service-role key so Supabase RLS does not block the
 * anonymous public visitor.  The anon key would return empty arrays
 * for users / services / business_hours (user-only RLS policies).
 *
 * The slug is matched client-side via the same slugify function used
 * by bookingUrl(). We inline it here to avoid any import-resolution
 * issues inside the Next.js API route runtime.
 */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[''`]/g, "")            // remove apostrophes
    .replace(/[^a-z0-9\s-]/g, "")    // keep only safe chars
    .trim()
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-");            // collapse repeated hyphens
}

function localDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // DIAGNOSTIC — visible in Vercel function logs
  console.log("[booking-page-data] incoming slug:", slug);
  console.log("[booking-page-data] SUPABASE_URL set:", !!supabaseUrl);
  console.log("[booking-page-data] SERVICE_ROLE_KEY set:", !!serviceKey);
  console.log("[booking-page-data] SERVICE_ROLE_KEY first 12 chars:", serviceKey ? serviceKey.slice(0, 12) : "MISSING");

  if (!supabaseUrl || !serviceKey) {
    console.error("[booking-page-data] FATAL: missing env vars — add SUPABASE_SERVICE_ROLE_KEY to Vercel env");
    return NextResponse.json({ error: "Server configuration error — missing env vars" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ── 1. Find business by slug ──────────────────────────────────────────────
  const { data: users, error: userErr } = await supabase
    .from("users")
    .select("id, business_name, email, phone_number");

  if (userErr) {
    console.error("booking-page-data: users error:", userErr.message);
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  const business = (users ?? []).find(
    (u: { business_name: string }) => slugify(u.business_name) === slug
  );

  if (!business) {
    console.log(`booking-page-data: no match for slug="${slug}". Businesses in DB:`,
      (users ?? []).map((u: { business_name: string }) => ({
        name: u.business_name,
        slug: slugify(u.business_name),
      }))
    );
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // ── 2. Fetch services, hours, existing bookings in parallel ───────────────
  const today   = localDateStr(0);
  const maxDate = localDateStr(30);

  const [svcRes, hrRes, bkRes] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration, price, is_group_service")
      .eq("user_id", business.id)
      .order("created_at"),
    supabase
      .from("business_hours")
      .select("day_of_week, start_time, end_time")
      .eq("user_id", business.id),
    supabase
      .from("bookings")
      .select("booking_date, booking_time")
      .eq("user_id", business.id)
      .gte("booking_date", today)
      .lte("booking_date", maxDate)
      .neq("status", "cancelled"),
  ]);

  if (svcRes.error)  console.error("booking-page-data: services error:",  svcRes.error.message);
  if (hrRes.error)   console.error("booking-page-data: hours error:",     hrRes.error.message);
  if (bkRes.error)   console.error("booking-page-data: bookings error:",  bkRes.error.message);

  return NextResponse.json({
    business,
    services:        svcRes.data ?? [],
    hours:           hrRes.data  ?? [],
    existingBookings: bkRes.data ?? [],
  });
}
