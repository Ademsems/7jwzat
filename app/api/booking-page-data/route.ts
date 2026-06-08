import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/booking-page-data?slug=<slug>
 *
 * Returns ALL data the public booking page needs in one call:
 *   business, services, hours, existingBookings (next 30 days),
 *   staff (active staff per service), has_staff flag
 */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
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
  const slug      = req.nextUrl.searchParams.get("slug");
  const serviceId = req.nextUrl.searchParams.get("serviceId"); // optional
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("[booking-page-data] incoming slug:", slug);
  console.log("[booking-page-data] SERVICE_ROLE_KEY set:", !!serviceKey);

  if (!supabaseUrl || !serviceKey) {
    console.error("[booking-page-data] FATAL: missing env vars");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // ── 1. Find business by slug ───────────────────────────────────────────────
  const { data: users, error: userErr } = await supabase
    .from("users")
    .select("id, business_name, email");

  if (userErr) {
    console.error("booking-page-data: users error:", userErr.message);
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  const business = (users ?? []).find(
    (u: { business_name: string }) => slugify(u.business_name) === slug
  );

  if (!business) {
    console.log(
      `booking-page-data: no match for slug="${slug}". Businesses in DB:`,
      (users ?? []).map((u: { business_name: string }) => ({
        name: u.business_name,
        slug: slugify(u.business_name),
      }))
    );
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // ── 2. Fetch services, hours, bookings, staff, and custom fields in parallel ─
  const today   = localDateStr(0);
  const maxDate = localDateStr(30);

  const [svcRes, hrRes, bkRes, staffRes, ssRes, cfRes, cfsRes] = await Promise.all([
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
    // Active staff members for this business
    supabase
      .from("staff")
      .select("id, name, role, bio")
      .eq("user_id", business.id)
      .eq("is_active", true)
      .order("created_at"),
    // Staff ↔ service assignments
    supabase
      .from("staff_services")
      .select("staff_id, service_id"),
    // Custom fields: apply_to_all=true for this business
    supabase
      .from("custom_fields")
      .select("id, label, placeholder, is_required")
      .eq("user_id", business.id)
      .eq("apply_to_all", true),
    // Service-specific custom fields (only when serviceId provided)
    serviceId
      ? supabase
          .from("custom_field_services")
          .select("custom_field_id")
          .eq("service_id", serviceId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (svcRes.error)   console.error("booking-page-data: services error:",      svcRes.error.message);
  if (hrRes.error)    console.error("booking-page-data: hours error:",         hrRes.error.message);
  if (bkRes.error)    console.error("booking-page-data: bookings error:",      bkRes.error.message);
  if (staffRes.error) console.error("booking-page-data: staff error:",         staffRes.error.message);
  if (cfRes.error)    console.error("booking-page-data: custom_fields error:", cfRes.error.message);

  // Build staffByService map: { [serviceId]: StaffMember[] }
  const allStaff = staffRes.data ?? [];
  const staffMap: Record<string, { id: string; name: string; role: string | null; bio: string | null }[]> = {};
  const ssRows = ssRes.data ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ssRows.forEach((row: any) => {
    const member = allStaff.find((s: { id: string }) => s.id === row.staff_id);
    if (!member) return;
    if (!staffMap[row.service_id]) staffMap[row.service_id] = [];
    staffMap[row.service_id].push(member);
  });

  // Build custom fields list:
  //   - all apply_to_all=true fields
  //   - plus any service-specific fields (when serviceId provided)
  let customFields: { id: string; label: string; placeholder: string | null; is_required: boolean }[] =
    cfRes.data ?? [];

  if (serviceId && cfsRes.data && cfsRes.data.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const specificFieldIds = (cfsRes.data as any[]).map((r: { custom_field_id: string }) => r.custom_field_id);
    if (specificFieldIds.length > 0) {
      const { data: specificFields } = await supabase
        .from("custom_fields")
        .select("id, label, placeholder, is_required")
        .in("id", specificFieldIds);

      // Merge, dedup by id
      const seen = new Set(customFields.map((f) => f.id));
      for (const f of (specificFields ?? [])) {
        if (!seen.has(f.id)) { customFields.push(f); seen.add(f.id); }
      }
    }
  }

  return NextResponse.json({
    business,
    services:         svcRes.data ?? [],
    hours:            hrRes.data  ?? [],
    existingBookings: bkRes.data  ?? [],
    staffByService:   staffMap,
    has_staff:        allStaff.length > 0,
    customFields,
  });
}
