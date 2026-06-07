import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/group-sessions?businessId=<id>&serviceId=<id>
 *
 * Returns upcoming group sessions for a service with live booked-count.
 * Uses service-role key to bypass RLS.
 */

function localDateStr(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get("businessId");
  const serviceId  = req.nextUrl.searchParams.get("serviceId");

  if (!businessId || !serviceId) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = localDateStr();

  const { data: sesRows, error } = await supabase
    .from("group_sessions")
    .select("*")
    .eq("user_id", businessId)
    .eq("service_id", serviceId)
    .gte("session_date", today)
    .order("session_date", { ascending: true })
    .order("session_time", { ascending: true });

  if (error) {
    console.error("group-sessions error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!sesRows || sesRows.length === 0) {
    return NextResponse.json({ sessions: [] });
  }

  // Count non-cancelled bookings per session
  const sessionIds = sesRows.map((s: { id: string }) => s.id);
  const { data: bkRows } = await supabase
    .from("bookings")
    .select("group_session_id")
    .in("group_session_id", sessionIds)
    .neq("status", "cancelled");

  const countMap: Record<string, number> = {};
  (bkRows ?? []).forEach((b: { group_session_id: string }) => {
    countMap[b.group_session_id] = (countMap[b.group_session_id] ?? 0) + 1;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions = sesRows.map((s: any) => ({
    id:           s.id,
    service_id:   s.service_id,
    session_date: s.session_date,
    session_time: s.session_time,
    capacity:     s.capacity,
    notes:        s.notes,
    booked_count: countMap[s.id] ?? 0,
  }));

  return NextResponse.json({ sessions });
}
