# CLAUDE.md — Sajjel (formerly 7jwzat) SaaS Booking System

> **Rebrand in progress:** the product is being renamed from "7jwzat / حجوزات" to **Sajjel**
> and will migrate to the domain **sajjel.online**. Code, metadata, and marketing copy still
> use the old name in most places. Update this file when the migration lands.

---

## 1. Project Overview

**Sajjel** is a multi-tenant SaaS booking system for salons, spas, physiotherapy clinics,
and similar appointment-based businesses in Jordan and the broader MENA region.

Key characteristics:
- **Arabic-default, RTL-first.** The default locale is `ar`; English can be toggled.
  Both locales are served from the same Next.js app with client-side string switching.
- **Jordan-first.** Default currency JOD, work week Sunday–Thursday, dates via `ar-JO`.
- **Free during launch year.** No payments or subscriptions yet; all features unlimited.
- **Multi-tenant by `user_id`.** Every tenant (business) owns its own rows; Supabase RLS
  enforces isolation at the database layer.
- **Public booking page.** Each business gets a shareable URL at `/book/<slug>` where
  customers book appointments without logging in.

Target market: Jordan (primary), then UAE, Saudi Arabia, Kuwait, Qatar, Bahrain, Oman, Egypt.

---

## 2. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | `app/` directory; React Server Components where possible |
| Database + Auth | Supabase (Postgres + GoTrue) | RLS enforces tenant isolation |
| Styling | TailwindCSS v4 | Logical CSS properties (`ps-`, `pe-`, `ms-`, `me-`) for RTL |
| Email | Resend | Bilingual HTML emails; sandbox until domain verified |
| Error tracking | Sentry (`@sentry/nextjs` v10) | client + server + edge configs, Session Replay |
| Fonts | Inter + IBM Plex Sans Arabic | Self-hosted via `next/font/google` |
| QR codes | `qrcode` npm package | Rendered client-side on dashboard |
| Deploy | Vercel | Auto-deploys from `main` only |

### Supabase client usage — CRITICAL SPLIT

| Location | Client | Key used | Purpose |
|---|---|---|---|
| Dashboard pages (browser) | `lib/supabase.ts` (browser singleton via `@supabase/ssr`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Authenticated tenant reads/writes; RLS enforces owner scope |
| API routes (`app/api/`) | `createClient()` inline | `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS for public-facing reads (booking page, business lookup) |
| Middleware | `createServerClient()` from `@supabase/ssr` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Auth session check for `/dashboard` route guard |

**The service-role key MUST NEVER be imported or used in any client component or `lib/supabase.ts`.**
It lives only inside `app/api/*/route.ts` files which run exclusively on the server.

---

## 3. Architecture Map

### Pages (`app/`)

```
app/
├── layout.tsx                  Root layout: fonts, LanguageProvider, ToastProvider,
│                               pre-hydration inline script (sets <html> lang/dir before
│                               first paint to eliminate RTL/LTR flash)
├── page.tsx                    Marketing homepage
├── privacy/page.tsx            Privacy policy (bilingual)
├── terms/page.tsx              Terms of service (bilingual)
├── global-error.tsx            React render error boundary → Sentry.captureException
│
├── auth/
│   ├── login/page.tsx          Supabase email/password login
│   ├── signup/page.tsx         New account creation (sets country/currency on users row)
│   ├── forgot-password/        Email reset request
│   └── reset-password/         Token-gated password update
│
├── book/[businessname]/page.tsx   PUBLIC booking page. Slug-matched via /api/booking-page-data.
│                                  Steps: select service → choose staff (optional) → pick
│                                  date/time → fill custom fields → confirm. Calls
│                                  /api/create-booking then /api/send-booking-emails.
│
└── dashboard/
    ├── layout.tsx              Wraps all dashboard pages with DashboardNav sidebar
    ├── page.tsx                Home: today's stats, booking link, quick links
    ├── analytics/              8-section analytics: revenue, bookings, customers, etc.
    ├── bookings/page.tsx       Booking list with status management
    ├── bookings/new/page.tsx   Manual booking or blocked-time entry
    ├── services/page.tsx       CRUD for services (name, duration, price, group flag)
    ├── custom-fields/page.tsx  Tenant-defined booking form fields
    ├── sessions/page.tsx       Group session scheduling (date/time/capacity)
    ├── staff/page.tsx          Staff CRUD + service assignment
    ├── customers/page.tsx      Customer list (aggregated from bookings)
    ├── customers/[id]/page.tsx Customer detail + booking history
    ├── business-hours/page.tsx Per-weekday open/close times (Sun–Sat stored, Sun–Thu used)
    └── settings/page.tsx       Business profile, country, currency, WhatsApp, address
```

### API Routes (`app/api/`)

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/booking-page-data` | GET | Service-role (public) | Returns all data for the booking page in one call: business, services, hours, existing bookings (next 30 days), staff-by-service map, custom fields |
| `/api/business-lookup` | GET | Service-role (public) | Slug → business `{id, business_name, email, phone_number}`; used by booking page for legacy compatibility |
| `/api/create-booking` | POST | Service-role (public) | Upserts customer profile, checks for conflicts, inserts booking, saves custom field answers |
| `/api/group-sessions` | GET | Service-role (public) | Returns upcoming group sessions with live booked-count for a service |
| `/api/send-booking-emails` | POST | None (called server-side) | Fires customer confirmation + owner notification emails via Resend |

### Key Library Modules (`lib/`)

| Module | Purpose |
|---|---|
| `lib/supabase.ts` | Lazy-initialized browser Supabase singleton (Proxy pattern to avoid build-time crash when env vars absent) |
| `lib/email.ts` | `sendCustomerEmail` + `sendOwnerEmail` via Resend. Bilingual (Arabic primary, English secondary). Lazily constructs Resend client to avoid build failures. |
| `lib/currency.ts` | `COUNTRIES` list (Jordan first), `formatPrice(amount, currency)`, `DEFAULT_CURRENCY = "JOD"`, `currencyForCountry()` |
| `lib/slug.ts` | `slugifyBusinessName()` + `bookingUrl()` — deterministic slug from business name |
| `lib/i18n/en.ts` | All English UI strings (flat key→value) |
| `lib/i18n/ar.ts` | All Arabic UI strings — **PLACEHOLDER MSA pending founder review** |
| `lib/i18n/LanguageProvider.tsx` | React context: `locale`, `t()`, `country`, `currency`, geo detection from Vercel `x-vercel-ip-country` header via cookie |
| `lib/i18n/format.ts` | `formatDateLocale()` + `formatTimeLocale()` — locale-aware, always Western digits (`numberingSystem: "latn"`) |
| `lib/marketingMockup.ts` | Static mock data for marketing page previews (no DB calls) |

### Shared Components (`components/`)

| Component | Purpose |
|---|---|
| `DashboardNav.tsx` | Grouped collapsible sidebar (desktop) + hamburger (mobile). Groups: Calendar & Availability, Setup, Insights. Collapse state in `localStorage`. |
| `InfoTooltip.tsx` | Click-to-open ⓘ popover. Module-level singleton (`closeActive`) ensures only one open at a time. RTL-aware positioning via `getBoundingClientRect`. |
| `Toast.tsx` | `showToast(message, type)` imperative API + `ToastProvider` context |
| `QRCodeCard.tsx` | Renders QR code for booking URL; Download PNG + Print buttons |
| `Navbar.tsx` | Marketing site top navigation |
| `AnimatedCounter.tsx` | CSS counter animation for marketing page stats |
| `RevealOnScroll.tsx` | Intersection Observer scroll-reveal for marketing page |

### Middleware (`middleware.ts`)

Runs on `/`, `/privacy`, `/terms`, `/dashboard/:path*`:
1. **Geo cookie:** reads `x-vercel-ip-country` header → sets `7jwzat-geo-country` cookie (non-httpOnly, 180 days) so pre-hydration script can pick default locale before React mounts.
2. **Auth guard:** for `/dashboard/*` only — if no Supabase session, redirects to `/auth/login`.

---

## 4. Data Model

All tables are in the Supabase public schema. Column lists are inferred from TypeScript
interfaces and query `.select()` calls; mark any uncertainty explicitly below.

### `users` (one row per tenant/business)
```
id                uuid  PK (Supabase auth.uid())
business_name     text
email             text
country           text  (e.g. "JO", "AE")
currency          text  (e.g. "JOD", "AED")
whatsapp_number   text  nullable
address           text  nullable  ← added for booking-page location display
phone_number      text  nullable  (assumed — verify; referenced in business-lookup)
business_type     text  nullable  (assumed — verify; referenced in dashboard welcome tag)
created_at        timestamptz
```
RLS intent: owner-scoped (`auth.uid() = id`). Public reads go via service-role API routes.

### `services`
```
id                uuid  PK
user_id           uuid  FK → users.id
name              text
duration          int   (minutes)
price             numeric  NULLABLE — NULL means "Price on request"
is_group_service  bool
created_at        timestamptz
```
RLS: owner-scoped writes; public reads via service-role API.

### `business_hours`
```
user_id           uuid  FK → users.id
day_of_week       int   (0=Sunday … 6=Saturday)
start_time        time
end_time          time
```
RLS: owner-scoped. Public reads via service-role API.

### `bookings`
```
id                uuid  PK
user_id           uuid  FK → users.id
service_id        uuid  FK → services.id
customer_id       uuid  FK → customers.id  nullable
group_session_id  uuid  FK → group_sessions.id  nullable
staff_id          uuid  FK → staff.id  nullable
customer_name     text
customer_email    text
customer_phone    text
notes             text  nullable
internal_note     text  nullable
booking_date      date
booking_time      time
status            text  ("pending" | "confirmed" | "completed" | "cancelled")
booking_type      text  nullable  ("customer" | "blocked" | "manual")
staff_preference  text  nullable
created_at        timestamptz
```
RLS: owner-scoped. Written by service-role API (`/api/create-booking`).

### `customers`
```
id          uuid  PK
user_id     uuid  FK → users.id
name        text
phone       text
email       text  nullable
notes       text  nullable  (assumed — verify; referenced in customer detail page)
created_at  timestamptz
```
RLS: owner-scoped. Upserted by `/api/create-booking` and `/dashboard/bookings/new`.

### `staff`
```
id          uuid  PK
user_id     uuid  FK → users.id
name        text
role        text  nullable
bio         text  nullable
is_active   bool
created_at  timestamptz
```
RLS: owner-scoped.

### `staff_services` (junction)
```
staff_id    uuid  FK → staff.id
service_id  uuid  FK → services.id
```
RLS: owner-scoped (via staff.user_id join — assumed; verify RLS policy).

### `group_sessions`
```
id            uuid  PK
user_id       uuid  FK → users.id
service_id    uuid  FK → services.id
session_date  date
session_time  time
capacity      int
notes         text  nullable
created_at    timestamptz
```
RLS: owner-scoped. Public reads via service-role API.

### `custom_fields`
```
id           uuid  PK
user_id      uuid  FK → users.id
label        text
placeholder  text  nullable
is_required  bool
apply_to_all bool  (if true, shown for every service; if false, per service_ids)
created_at   timestamptz
```
RLS: owner-scoped.

### `custom_field_services` (junction)
```
custom_field_id  uuid  FK → custom_fields.id
service_id       uuid  FK → services.id
```
RLS: owner-scoped (assumed — verify).

### `custom_field_answers`
```
id               uuid  PK (assumed)
booking_id       uuid  FK → bookings.id
custom_field_id  uuid  FK → custom_fields.id
answer           text
```
RLS: assumed owner-scoped via booking.user_id join — **verify this policy exists**.

---

## 5. Critical Conventions and Gotchas

### 5.1 Service-role key — server-only, never client

All public-facing data access (booking page, business lookup, group sessions) goes through
`app/api/*/route.ts` using `createClient(url, SUPABASE_SERVICE_ROLE_KEY)`. This bypasses RLS
and is safe only because these routes run on the server.

**NEVER import `SUPABASE_SERVICE_ROLE_KEY` in a file that can be bundled for the browser.**
The `lib/supabase.ts` singleton uses the anon key only and is safe to import in client components.

### 5.2 RLS must remain owner-scoped

Every tenant table must have RLS policies like:
```sql
using (auth.uid() = user_id)
```
**Never add `using (true)` SELECT policies on tenant tables** — this would expose all tenants'
data to any authenticated user. Public reads must always go through the service-role API routes.

### 5.3 Supabase schema cache — reload after DDL

After any `ALTER TABLE`, `ADD COLUMN`, or other DDL, PostgREST's schema cache must be reloaded
or the browser client will return "column not found in schema cache" errors:

```sql
NOTIFY pgrst, 'reload schema';
```

Or restart the Supabase project from the dashboard. Always verify new columns via:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'your_table';
```

Example: adding `users.address` caused a 500 error until the schema cache was reloaded.

### 5.4 i18n — every user-facing string in the dictionary

- All strings live in `lib/i18n/en.ts` and `lib/i18n/ar.ts` as flat key→value maps.
- Use `const { t } = useLanguage()` in client components; pass `locale` to server functions.
- **Arabic strings are placeholder MSA** — pending founder review before launch.
- Dates: use `formatDateLocale(dateStr, locale)` — renders `ar-JO` for Arabic with Western digits.
- Times: use `formatTimeLocale(timeStr, locale)` — renders Arabic AM/PM suffixes.
- Numbers: always `numberingSystem: "latn"` (Western digits, never Eastern Arabic numerals).
- Adding new keys: add to BOTH `en.ts` and `ar.ts` in the same commit; mark Arabic as
  `// PLACEHOLDER ARABIC — pending founder review`.

### 5.5 Nullable price — "Price on request"

`services.price` is nullable. A `NULL` price must display as:
- English: `"Price on request"`
- Arabic: `"السعر عند الطلب"`

Never call `formatPrice(null, currency)` directly — use the `fmtPrice` helper pattern or check
for null first. Analytics must coerce null to 0 for revenue math.

### 5.6 Jordan work week and locale defaults

- Work week: **Sunday–Thursday** (`day_of_week` 0–4 are typical open days).
- Default country: Jordan (`JO`), default currency: `JOD`.
- Geo detection: UAE (`AE`) defaults to English; all other detected countries default to Arabic.
- The geo country is set by Vercel's `x-vercel-ip-country` header → middleware cookie →
  pre-hydration script. Local dev has no geo header so defaults to Jordan/Arabic.

### 5.7 Pre-hydration lang/dir script

`app/layout.tsx` injects an inline `<script>` before React hydration that reads
`localStorage["7jwzat-lang"]` and the geo cookie to set `<html lang>` and `<html dir>`
before the first paint. This prevents the RTL/LTR flash. The logic must stay in sync
with `LanguageProvider.tsx`'s locale resolution order.

### 5.8 Slug matching is client-side in API routes

`/api/booking-page-data` fetches ALL users and matches by slug client-side (in the
Node.js runtime). This is safe with the service-role key but will not scale past ~10,000
tenants. A `slug` column with a unique index on `users` is the correct long-term fix.

### 5.9 Email is in sandbox

Resend is configured but outbound emails only reliably reach verified addresses until the
sending domain (`sajjel.online` or equivalent) is verified with Resend. Check Resend
dashboard for delivery status.

### 5.10 Build-time safety

Several modules are lazily initialized to prevent crashes when env vars are absent during
Vercel's build phase:
- `lib/supabase.ts` — Proxy singleton, only calls `createBrowserClient()` on first access.
- `lib/email.ts` — `getResend()` factory called inside each function, not at module level.
- API routes using service-role key — always check `if (!serviceKey)` before using.

**Never throw unconditionally at module evaluation time in a file imported during build.**

---

## 6. Environment Variables

Listed by name only. Never commit values. Set in `.env.local` for local dev and in
Vercel project settings for production.

| Variable | Used in | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts`, all API routes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts`, `middleware.ts` | Public anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | `app/api/*/route.ts` only | Service-role key — server-only, bypasses RLS |
| `RESEND_API_KEY` | `lib/email.ts` | Resend API key for transactional email |
| `RESEND_FROM_EMAIL` | `lib/email.ts` | Sender address (e.g. `noreply@sajjel.online`) |
| `NEXT_PUBLIC_APP_URL` | `lib/slug.ts` | Base URL for booking links (e.g. `https://sajjel.online`) |
| `NEXT_RUNTIME` | `instrumentation.ts` | Set by Next.js — used to conditionally load Sentry server/edge config |

Sentry DSN is hardcoded in `sentry.client.config.ts`, `sentry.server.config.ts`, and
`sentry.edge.config.ts`. To rotate it, update those three files. A `SENTRY_AUTH_TOKEN`
env var in Vercel is recommended for source map uploads (enables readable stack traces in
Sentry); without it, errors still arrive but stack frames are minified.

Variables seen in dependency internals (not app-authored, do not set):
`BOOK_LANG`, `DEBUG`, `DOTENV_KEY`, `GOOGLE_GENAI_API_KEY`, `HOST`, `ICEBERG_TOKEN`,
`NODE_DISABLE_COLORS`, `NODE_UNIQUE_ID`, `OTEL_SEMCONV_STABILITY_OPT_IN`.

---

## 7. Local Dev, Build, and Deploy

### Local development

```bash
# Install dependencies
npm install

# Create .env.local with the required env vars (copy from Vercel or ask the founder)
cp .env.local.example .env.local   # if this file exists; otherwise create manually

# Start dev server
npm run dev                         # http://localhost:3000

# Type check
npx tsc --noEmit

# Production build (catches prerendering issues, runs before any push)
npm run build
```

**Note:** Local dev has no Vercel geo header, so the app defaults to Jordan/Arabic.
The booking page (`/book/<slug>`) requires the Supabase service-role key to work locally.

### Deployment

- Vercel auto-deploys **only from `main`**. Pushing to any other branch does NOT deploy.
- Before every push, run `npm run build` locally to catch prerendering errors (Next.js
  statically renders all non-dynamic pages at build time; any thrown error there breaks
  the deploy).
- After pushing, verify the commit is on `origin/main`:
  ```bash
  git log origin/main --oneline -5
  ```

### Branch hygiene — MANDATORY

All work must land on `main`. Claude Code sessions run in git worktrees on session branches.
After every session:
1. `git rev-parse --abbrev-ref HEAD` — confirm current branch.
2. If not on `main`: merge/cherry-pick to `main` and `git push origin main`.
3. Confirm with `git log origin/main --oneline -3`.

**Past failure pattern:** multiple sessions committed work to `claude/festive-lalande-e53724`
and similar worktree branches that were never pushed to `origin`. `main` stayed weeks behind.
Vercel saw none of the work until a manual merge. This must not repeat.

---

## 8. Known Issues / Deferred

| Issue | Status |
|---|---|
| **Rebrand:** "7jwzat" → "Sajjel" | In progress. Marketing site, shared i18n, and core-app dashboard/auth/email brand text updated. Sentry org slug in `next.config.js` and `7jwzat-*` storage/cookie keys intentionally left as-is. Domain migration to `sajjel.online` pending. |
| **Email sandbox:** Resend outbound delivery unreliable until sending domain verified. | Deferred until domain confirmed. |
| **Supabase address column schema cache** | Saving `users.address` from Settings page fails with "column not found in schema cache" until PostgREST schema is reloaded in Supabase dashboard. |
| **Slug column:** Business lookup does full-table scan + client-side slug match. | Deferred. Add `slug` unique column to `users` for scale. |
| **Admin panel / Metabase:** No internal analytics or tenant management UI. | Deferred. |
| **Payments / subscriptions:** No payment integration. Free during launch year. | Deferred. |
| **Arabic strings:** All `ar.ts` values are placeholder MSA. | Pending founder review. |
| **`feature/booking-usage-limit` branch:** Monthly booking limit feature committed to a local worktree branch, never merged. | Check before discarding — may be recoverable. |
| **Sentry source maps:** Stack traces in Sentry are minified without `SENTRY_AUTH_TOKEN` in Vercel. | Add auth token to Vercel env vars. |

---

## 9. Feature Changelog (high-level)

| Shipped | Description |
|---|---|
| Initial launch | Multi-tenant booking system: auth, services, business hours, public booking page, confirmation emails |
| Analytics dashboard | 8-section dashboard: revenue, bookings by day/service, customer stats. Pure CSS charts, no chart libraries. |
| Staff management | Staff CRUD, per-service assignment, staff selection on booking page |
| Customer profiles | Automatic customer record creation from bookings; customer detail page with booking history |
| Change password | Self-service password update in Settings |
| Custom booking form fields | Tenant-defined extra fields on booking form (required/optional, per-service or global) |
| Group sessions | Group service type + session scheduling with capacity tracking |
| Bug fixes (b5e86be) | Customer backfill for manual bookings, Invalid Date guards, analytics revenue zeros, group session gating, friendly error messages, QR code generation |
| Full localization | Arabic-default RTL, EN toggle, bilingual emails, locale-aware date/time formatting, `ar-JO` locale, Western digits |
| Marketing site | Arabic-first landing page with animated stats, RTL layout, geo-aware language defaults |
| Language/direction flash fix | Pre-hydration inline script sets `<html lang/dir>` before React mounts |
| Geo-aware defaults | Vercel `x-vercel-ip-country` → language/currency defaults for marketing page |
| Optional service pricing | `services.price` nullable; NULL renders as "Price on request" everywhere |
| InfoTooltip | ⓘ click-to-open popovers on all dashboard headings and key field labels |
| Business address | `users.address` field in Settings; shown on public booking page with Google Maps link |
| Grouped sidebar nav | Collapsible nav groups (Calendar & Availability, Setup, Insights) with localStorage persistence |
| Sentry error tracking | `@sentry/nextjs` with client/server/edge configs, Session Replay, `global-error.tsx` boundary |
| 2026-07-22 — Core-app rebrand (7jwzat → Sajjel) | Latin brand text "7jwzat" → "Sajjel" in `DashboardNav.tsx` sidebar logo (desktop + mobile), the logo link on all four `app/auth/*/page.tsx` pages (login, signup ×2, reset-password, forgot-password), and the "Powered by" line in both `lib/email.ts` templates. `7jwzat-nav-*` localStorage keys and the Sentry org slug in `next.config.js` intentionally left unchanged. No hardcoded Arabic "حجوزات" brand text found in core-app files (verified via repo-wide search) — Arabic brand copy lives in `lib/i18n/ar.ts`, owned by the marketing/front session. |

---

## 10. Development & Commit Conventions

See `CONTRIBUTING.md` for the full guide. Summary:

- **Conventional Commits:** `type(scope): imperative summary` — never past tense.
- **Types:** `feat`, `fix`, `docs`, `refactor`, `chore`, `style`, `perf`, `test`.
- **One logical change per commit.** Never mix UI changes with schema migrations.
- **All work must land on `main` before a task is considered done.**
- **Update this file** whenever architecture, schema, env vars, or conventions change.

---

*Last updated: 2026-07-22. Reflects codebase at commit `d4c7ad2`.*
