import { NextResponse } from "next/server";

// Temporary route to verify Sentry error reporting. Remove after confirming
// an event appears in the Sentry dashboard.
export async function GET() {
  throw new Error("Sentry test error — 7jwzat setup verification");
  return NextResponse.json({ ok: true });
}
