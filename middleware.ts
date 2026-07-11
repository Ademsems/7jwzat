import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const GEO_COOKIE = "7jwzat-geo-country";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // ── Geo default (marketing) ──────────────────────────────────────────────
  // Persist Vercel's detected country to a NON-httpOnly cookie so the
  // pre-hydration inline script in app/layout.tsx can read it via
  // document.cookie and pick the default language before first paint.
  // Absent locally (no header) → leave unset → defaults stay Jordan / Arabic.
  // DEFAULTS ONLY: a stored manual choice (localStorage) always wins client-side.
  const country = req.headers.get("x-vercel-ip-country");
  if (country) {
    const existing = req.cookies.get(GEO_COOKIE)?.value;
    if (existing !== country) {
      res.cookies.set(GEO_COOKIE, country, {
        path: "/",
        maxAge: 60 * 60 * 24 * 180, // 180 days
        sameSite: "lax",
        httpOnly: false,
      });
    }
  }

  // ── Auth guard (dashboard only) ──────────────────────────────────────────
  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              res.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
  }

  return res;
}

export const config = {
  // Marketing routes (for geo cookie) + dashboard (for auth guard).
  matcher: ["/", "/privacy", "/terms", "/dashboard/:path*"],
};
