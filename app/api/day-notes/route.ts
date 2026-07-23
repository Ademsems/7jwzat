import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * /api/day-notes — authenticated, tenant-scoped CRUD for the day_notes
 * table (per-day owner notes + booking block-outs). Same auth pattern as
 * app/api/analytics/route.ts: session cookies via @supabase/ssr, queries run
 * through the anon-key client so RLS (business_id = auth.uid()) is the real
 * tenant-isolation boundary — never the service-role key.
 *
 *   GET    ?start=&end=   list day notes (both optional — omit for all)
 *   POST   { date, note, block_type, block_start_time, block_end_time }
 *          upsert (one row per business+date — see day_notes' UNIQUE constraint)
 *   DELETE ?date=         clear a day note/block
 */

function isDateStr(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
const VALID_BLOCK_TYPES = new Set(["none", "walk_ins_only", "fully_blocked"]);
const DAY_NOTE_COLUMNS = "id, date, note, block_type, block_start_time, block_end_time";

function getAuthClient(req: NextRequest, cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet) => { cookiesToSet.push(...toSet); },
    },
  });
}

export async function GET(req: NextRequest) {
  const start = req.nextUrl.searchParams.get("start");
  const end = req.nextUrl.searchParams.get("end");
  if ((start && !isDateStr(start)) || (end && !isDateStr(end))) {
    return NextResponse.json({ error: "Invalid start/end" }, { status: 400 });
  }

  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];
  const authClient = getAuthClient(req, cookiesToSet);
  if (!authClient) {
    console.error("[day-notes] FATAL: missing Supabase public env vars");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  function withCookies(res: NextResponse): NextResponse {
    cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  }

  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) return withCookies(NextResponse.json({ error: "Not authenticated" }, { status: 401 }));

  let query = authClient.from("day_notes").select(DAY_NOTE_COLUMNS).eq("business_id", user.id);
  if (start) query = query.gte("date", start);
  if (end) query = query.lte("date", end);
  const { data, error } = await query;

  if (error) {
    console.error("[day-notes] GET error:", error.message);
    return withCookies(NextResponse.json({ error: "Failed to load day notes" }, { status: 500 }));
  }
  return withCookies(NextResponse.json({ dayNotes: data ?? [] }));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !isDateStr(body.date)) {
    return NextResponse.json({ error: "Missing or invalid date" }, { status: 400 });
  }
  const blockType = body.block_type ?? "none";
  if (!VALID_BLOCK_TYPES.has(blockType)) {
    return NextResponse.json({ error: "Invalid block_type" }, { status: 400 });
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  const blockStart = blockType !== "none" && typeof body.block_start_time === "string" && body.block_start_time
    ? body.block_start_time : null;
  const blockEnd = blockType !== "none" && typeof body.block_end_time === "string" && body.block_end_time
    ? body.block_end_time : null;

  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];
  const authClient = getAuthClient(req, cookiesToSet);
  if (!authClient) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  function withCookies(res: NextResponse): NextResponse {
    cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  }

  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) return withCookies(NextResponse.json({ error: "Not authenticated" }, { status: 401 }));

  // If both the note and the block are cleared, delete the row outright
  // instead of leaving an empty placeholder — keeps "has a note" checks
  // (indicators, block enforcement) simple existence checks.
  if (!note && blockType === "none") {
    const { error } = await authClient.from("day_notes").delete().eq("business_id", user.id).eq("date", body.date);
    if (error) {
      console.error("[day-notes] POST (clear) error:", error.message);
      return withCookies(NextResponse.json({ error: "Failed to save day note" }, { status: 500 }));
    }
    return withCookies(NextResponse.json({ dayNote: null }));
  }

  const { data, error } = await authClient
    .from("day_notes")
    .upsert(
      { business_id: user.id, date: body.date, note, block_type: blockType, block_start_time: blockStart, block_end_time: blockEnd },
      { onConflict: "business_id,date" }
    )
    .select(DAY_NOTE_COLUMNS)
    .single();

  if (error) {
    console.error("[day-notes] POST error:", error.message);
    return withCookies(NextResponse.json({ error: "Failed to save day note" }, { status: 500 }));
  }
  return withCookies(NextResponse.json({ dayNote: data }));
}

export async function DELETE(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!isDateStr(date)) return NextResponse.json({ error: "Missing or invalid date" }, { status: 400 });

  const cookiesToSet: { name: string; value: string; options: CookieOptions }[] = [];
  const authClient = getAuthClient(req, cookiesToSet);
  if (!authClient) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  function withCookies(res: NextResponse): NextResponse {
    cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  }

  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) return withCookies(NextResponse.json({ error: "Not authenticated" }, { status: 401 }));

  const { error } = await authClient.from("day_notes").delete().eq("business_id", user.id).eq("date", date);
  if (error) {
    console.error("[day-notes] DELETE error:", error.message);
    return withCookies(NextResponse.json({ error: "Failed to delete day note" }, { status: 500 }));
  }
  return withCookies(NextResponse.json({ success: true }));
}
