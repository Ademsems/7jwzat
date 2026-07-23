import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * GET /api/analytics?start=YYYY-MM-DD&end=YYYY-MM-DD&prevStart=YYYY-MM-DD&prevEnd=YYYY-MM-DD
 *
 * Authenticated, tenant-scoped analytics data for the dashboard. Unlike the
 * other app/api/* routes, this is NOT public — it never uses the service-role
 * key. It authenticates the caller from their Supabase session cookies (same
 * pattern as middleware.ts) and queries with the anon key, so Postgres RLS
 * (auth.uid() = user_id) enforces tenant isolation as the real guard; the
 * .eq("user_id", uid) filters below are query-shape, not the security boundary.
 *
 * Returns raw, lightly-shaped rows (not pre-aggregated per section) so future
 * sections (services, staff, days/timings) can derive their own breakdowns
 * from this same payload without a new endpoint or route change.
 */

function isDateStr(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  const prevStart = req.nextUrl.searchParams.get("prevStart");
  const prevEnd = req.nextUrl.searchParams.get("prevEnd");

  if (!isDateStr(start) || !isDateStr(end) || !isDateStr(prevStart) || !isDateStr(prevEnd)) {
    return NextResponse.json({ error: "Missing or invalid start/end/prevStart/prevEnd" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    console.error("[analytics] FATAL: missing Supabase public env vars");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  // Collect any cookie writes (e.g. a refreshed access token) and apply them
  // to the response we actually return, mirroring middleware.ts.
  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];
  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => { cookiesToSet.push(...toSet); },
    },
  });

  function withCookies(res: NextResponse): NextResponse {
    cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  }

  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) {
    return withCookies(NextResponse.json({ error: "Not authenticated" }, { status: 401 }));
  }

  const uid = user.id;
  // Fetch both windows (current + comparison) in one range query.
  const rangeFloor = prevStart < start ? prevStart : start;

  const [profileRes, bookingsRes, servicesRes, staffRes, customersRes, historyRes] = await Promise.all([
    authClient.from("users").select("currency").eq("id", uid).single(),
    authClient
      .from("bookings")
      .select("id, booking_date, booking_time, status, booking_type, service_id, staff_id, customer_id, group_session_id, created_at")
      .eq("user_id", uid)
      .gte("booking_date", rangeFloor)
      .lte("booking_date", end),
    authClient.from("services").select("id, name, price, is_group_service").eq("user_id", uid),
    authClient.from("staff").select("id, name, is_active").eq("user_id", uid),
    authClient.from("customers").select("id, name, created_at").eq("user_id", uid),
    // Full history (lightweight, all-time) for new/returning, repeat-rate, and
    // lapsed-customer calculations, which need data outside the selected window.
    authClient
      .from("bookings")
      .select("customer_id, booking_date, booking_type")
      .eq("user_id", uid)
      .not("customer_id", "is", null),
  ]);

  const errors = [profileRes, bookingsRes, servicesRes, staffRes, customersRes, historyRes]
    .map((r) => r.error)
    .filter((e): e is NonNullable<typeof e> => !!e);

  if (errors.length > 0) {
    console.error("[analytics] query error(s):", errors.map((e) => e.message));
    return withCookies(NextResponse.json({ error: "Failed to load analytics data" }, { status: 500 }));
  }

  return withCookies(
    NextResponse.json({
      currency: profileRes.data?.currency ?? "JOD",
      range: { start, end, prevStart, prevEnd },
      bookings: bookingsRes.data ?? [],
      services: servicesRes.data ?? [],
      staff: staffRes.data ?? [],
      customers: customersRes.data ?? [],
      history: historyRes.data ?? [],
    })
  );
}
