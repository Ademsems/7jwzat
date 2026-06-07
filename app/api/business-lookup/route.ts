import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { slugifyBusinessName } from "@/lib/slug";

/**
 * GET /api/business-lookup?slug=<slug>
 *
 * Looks up a business by its URL slug using the service-role key so that
 * Supabase RLS (which restricts the anon key to only the authenticated user's
 * own row) does not block public booking-page visitors.
 *
 * Returns: { id, business_name, email, phone_number } | { error }
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all users and match by slug client-side.
  // This is safe behind the service-role key (server-only route).
  const { data, error } = await supabase
    .from("users")
    .select("id, business_name, email, phone_number");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const match = (data ?? []).find(
    (u: { business_name: string }) => slugifyBusinessName(u.business_name) === slug
  );

  if (!match) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(match);
}
