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
├── cancel/page.tsx             PUBLIC cancel-booking page (no auth). Reads ?token=, calls
│                               GET /api/cancel-booking for a preview, POST on confirm.
│                               Defaults to the business's own language (derived from
│                               `country`, same rule as LanguageProvider) unless the visitor
│                               already made an explicit language choice. See §9 changelog.
│
└── dashboard/
    ├── layout.tsx              Wraps all dashboard pages with DashboardNav sidebar
    ├── page.tsx                Home: stats, booking link, `Calendar` block (week view), quick links
    ├── analytics/              BI dashboard w/ global date-range filter (see §3 API Routes,
    │                           /api/analytics). Sections: Revenue, Bookings, Customers,
    │                           Days & Timings, Services, Staff.
    ├── bookings/page.tsx       Table/Calendar toggle (defaults to Calendar — see `components/Calendar.tsx`);
    │                           table view unchanged (status management, staff assign, delete)
    ├── bookings/new/page.tsx   Manual booking or blocked-time entry
    ├── services/page.tsx       CRUD for services (name, duration, price, group flag)
    ├── custom-fields/page.tsx  Tenant-defined booking form fields
    ├── sessions/page.tsx       Group session scheduling (date/time/capacity)
    ├── staff/page.tsx          Staff CRUD + service assignment
    ├── customers/page.tsx      Customer list (aggregated from bookings), tag pills + tag filter
    ├── customers/[id]/page.tsx Customer detail + booking history + tag editor (immediate save)
    ├── customers/tags/page.tsx Tag management: create/rename/recolor/delete, per-tag customer count
    ├── business-hours/page.tsx Per-weekday open/close times (Sun–Sat stored, Sun–Thu used)
    └── settings/page.tsx       Business profile, country, currency, WhatsApp, address
```

### API Routes (`app/api/`)

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/booking-page-data` | GET | Service-role (public) | Returns all data for the booking page in one call: business, services, hours, existing bookings (next 30 days), staff-by-service map, custom fields, day notes/blocks (next 30 days) |
| `/api/business-lookup` | GET | Service-role (public) | Slug → business `{id, business_name, email, phone_number}`; used by booking page for legacy compatibility |
| `/api/create-booking` | POST | Service-role (public) | Upserts customer profile, re-checks the request against `day_notes` (the real block-enforcement boundary — see §9), checks for conflicts, inserts booking, saves custom field answers |
| `/api/day-notes` | GET / POST / DELETE | **Authenticated** (anon key + session cookies, same pattern as `/api/analytics`) | Owner-only CRUD for `day_notes` (per-day notes + block-outs). GET accepts optional `start`/`end`; POST upserts one row per `business_id`+`date` (`onConflict`), and deletes the row outright if both note and block are cleared; DELETE clears by `date`. RLS (`business_id = auth.uid()`) is the tenant-isolation boundary. |
| `/api/group-sessions` | GET | Service-role (public) | Returns upcoming group sessions with live booked-count for a service |
| `/api/send-booking-emails` | POST | None (called server-side) | Fires customer confirmation + owner notification emails via Resend; accepts an optional `cancelUrl`, forwarded to `sendCustomerEmail` only, never `sendOwnerEmail` |
| `/api/cancel-booking` | GET / POST | Service-role (public) | Powers `app/cancel/page.tsx`. GET re-validates a `?token=` and returns a booking preview + a country-derived `defaultLocale`; POST re-validates again, atomically marks the token used (`used_at IS NULL` guard), sets the booking `status` to `cancelled`, and fires an owner cancellation email. Service-role is used for both verbs — not just the writes — because the preview needs owner-scoped `bookings`/`services`/`users` rows an anon client can't read, and because `booking_cancel_tokens` writes are service-role-only by design (see §4). |
| `/api/analytics` | GET | **Authenticated** (anon key + session cookies, NOT service-role) | Tenant-scoped analytics data layer. Auth via `@supabase/ssr` reading the caller's session cookies (same pattern as `middleware.ts`); every query runs through the anon-key client so RLS enforces tenant isolation even if a `.eq("user_id", …)` filter were ever dropped. Query params `start`/`end`/`prevStart`/`prevEnd` (all `YYYY-MM-DD`); returns raw, unaggregated rows (bookings, services, staff, customers, all-time booking history) so new dashboard sections can derive their own breakdowns without a route change. |

### Key Library Modules (`lib/`)

| Module | Purpose |
|---|---|
| `lib/supabase.ts` | Lazy-initialized browser Supabase singleton (Proxy pattern to avoid build-time crash when env vars absent) |
| `lib/email.ts` | `sendCustomerEmail` + `sendOwnerEmail` via Resend. Bilingual (Arabic primary, English secondary). Lazily constructs Resend client to avoid build failures. `sendCustomerEmail` takes an optional `cancelUrl` — when present, renders a "Cancel this booking" button + 7-day-expiry note; when absent, the button is omitted entirely rather than shown broken. `sendOwnerCancellationEmail` (separate function) notifies the owner when a customer self-cancels via `/cancel`. |
| `lib/currency.ts` | `COUNTRIES` list (Jordan first), `formatPrice(amount, currency)`, `DEFAULT_CURRENCY = "JOD"`, `currencyForCountry()` |
| `lib/slug.ts` | `slugifyBusinessName()` + `bookingUrl()` — deterministic slug from business name |
| `lib/analyticsRange.ts` | `computeRange(key, customStart?, customEnd?)` — timezone-safe date-range + comparison-period math for the analytics page (`this-week` / `this-month` / `last-30` / `last-90` / `custom`). Builds dates from local `Date` field getters only, never `toISOString()`, and range ends are always the true end of the period (not "today") so later-dated bookings already on the books aren't dropped. |
| `lib/bookingActions.ts` | `updateBookingStatus(id, status)` — the single place that writes a booking's `status` column. Both the bookings-table page and the Calendar side panel call this; neither duplicates the Supabase call. |
| `lib/dayNoteActions.ts` | `saveDayNote()`/`deleteDayNote()` — the only place that calls `/api/day-notes`. Also exports `isDayNoteWholeDayBlocked()`/`isTimeBlockedByDayNote()`, pure functions shared by the public booking page (client, decides what's shown) and `/api/create-booking` (server, the real enforcement) so the two checks can't drift apart. |
| `lib/i18n/en.ts` | All English UI strings (flat key→value) |
| `lib/i18n/ar.ts` | All Arabic UI strings — **PLACEHOLDER MSA pending founder review** |
| `lib/i18n/LanguageProvider.tsx` | React context: `locale`, `t()`, `country`, `currency`, geo detection from Vercel `x-vercel-ip-country` header via cookie |
| `lib/i18n/format.ts` | `formatDateLocale()` + `formatTimeLocale()` — locale-aware, always Western digits (`numberingSystem: "latn"`) |
| `lib/marketingMockup.ts` | Static mock data for marketing page previews (no DB calls) |

### Shared Components (`components/`)

| Component | Purpose |
|---|---|
| `DashboardNav.tsx` | Grouped collapsible sidebar (desktop) + hamburger (mobile). Groups: Calendar & Availability, Setup, Insights. Collapse state in `localStorage`. |
| `Calendar.tsx` | Reusable week/month booking calendar, used on the bookings page and the dashboard. Props-in, no internal data fetching (mirrors `QRCodeCard.tsx`'s convention) — the parent page fetches bookings/services/staff/business_hours and merges names client-side before passing them down. Owns one internal `CalendarSidePanel` instance. See §9 changelog for full details and localStorage keys. |
| `CalendarSidePanel.tsx` | Slide-in detail panel used by `Calendar.tsx` in both views. Also exports the shared `CalendarBooking`/`CfAnswer` types and the `CalendarCard` mini-card used in both the week grid and the panel's day-list. |
| `TagPill.tsx` | Small colored customer-tag pill (`TAG_COLOR_PALETTE`, 10 fixed hex colors, no free-form input) + the `CustomerTag` type. Used on the customers list, the customer detail page's tag editor, and the tag management page. |
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

### `booking_cancel_tokens`
```
id          uuid  PK
booking_id  uuid  FK → bookings.id
token       text  UNIQUE  DEFAULT encode(gen_random_bytes(32), 'hex')
used_at     timestamptz  nullable  (set once, atomically guarded — see /api/cancel-booking)
expires_at  timestamptz  DEFAULT now() + interval '7 days'
created_at  timestamptz
```
RLS: anonymous SELECT allowed (the token itself is the secret — this is what lets
`/api/cancel-booking` validate by token alone), but INSERT/UPDATE are service-role only.
Verified directly via anon-key curl: SELECT → 200, INSERT → 401 row-level security violation.
Written by `/api/create-booking` (non-fatal — if token creation fails, the booking still
succeeds and the confirmation email is simply sent without a cancel button) and by
`/api/cancel-booking` (marks `used_at`). Table created directly in Supabase by the project
owner — Claude sessions never had DDL access here.

### `day_notes`
```
id                uuid  PK
business_id       uuid  FK → users.id  (named business_id, not user_id — deliberate, see §9 changelog)
date              date  NOT NULL
note              text  nullable
block_type        text  NOT NULL DEFAULT 'none'  ("none" | "walk_ins_only" | "fully_blocked")
block_start_time  time  nullable  (null = all day)
block_end_time    time  nullable  (null = all day)
created_at        timestamptz
UNIQUE (business_id, date)  — one row per business per date, upserted via onConflict
```
RLS: owner-scoped, `business_id = auth.uid()` on all four policies (select/insert/update/delete).
Confirmed applied 2026-07-23 (`block_type` ended up as a native Postgres enum, `public.day_block_type`,
rather than the text+CHECK this doc originally specified — functionally identical over PostgREST).

### `customer_tags`
```
id           uuid  PK
business_id  uuid  FK → users.id
name         text
color        text  DEFAULT '#6B7280'  — one of a fixed 10-color palette (components/TagPill.tsx),
                                        never free-form hex from the UI
created_at   timestamptz
```
RLS: owner-scoped, `business_id = auth.uid()`. Verified directly: a cross-tenant insert (a real
session, a fabricated `business_id`) was rejected with 403 `row-level security policy` violation,
and reading another business's tags by explicit `business_id` filter returned `[]`, not their data.
Table created directly in Supabase by the project owner — Claude sessions never had DDL access here.

### `customer_tag_assignments`
```
id           uuid  PK
business_id  uuid
customer_id  uuid  FK → customers.id
tag_id       uuid  FK → customer_tags.id
created_at   timestamptz
```
Many-to-many between `customers` and `customer_tags`. RLS: owner-scoped, `business_id = auth.uid()`.
No unique constraint observed on `(customer_id, tag_id)` — the app guards against duplicate
assignment client-side (checks the customer's current tag list before inserting) rather than
relying on a DB-level constraint.

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
| **Supabase address column schema cache** | Historical issue — saving `users.address` from Settings once failed with "column not found in schema cache" until PostgREST schema was reloaded. Resolved: confirmed 2026-07-24 that `users.address` reads/writes cleanly from both Settings and the new signup flow with no schema-cache error. |
| **Slug column:** Business lookup does full-table scan + client-side slug match. | Deferred. Add `slug` unique column to `users` for scale. |
| **Admin panel / Metabase:** No internal analytics or tenant management UI. | Deferred. |
| **Payments / subscriptions:** No payment integration. Free during launch year. | Deferred. |
| **Arabic strings:** All `ar.ts` values are placeholder MSA. | Pending founder review. |
| **`feature/booking-usage-limit` branch:** Monthly booking limit feature committed to a local worktree branch, never merged. | Check before discarding — may be recoverable. |
| **Sentry source maps:** Stack traces in Sentry are minified without `SENTRY_AUTH_TOKEN` in Vercel. | Add auth token to Vercel env vars. |
| **Vercel does not auto-deploy on push, despite §7's documented setup.** Confirmed directly: after two consecutive pushes to `main` (staff-view-selector, day-notes), the live site at the project's custom domain still served the pre-push build with no new deployment. | A manual deploy trigger in the Vercel dashboard is required after every push until this is investigated. Do not assume a push is live. |

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
| 2026-07-22 — Analytics rebuild, prompt 1/2 (data layer + Revenue/Bookings/Customers) | Full rebuild of the analytics page as a real business-intelligence view, replacing the old shallow-stats version. **Data layer:** new `app/api/analytics/route.ts` — the first *authenticated* (non-public) API route in the app; auth via `@supabase/ssr` reading session cookies (`middleware.ts` pattern), queries run through the anon-key client so RLS is the real tenant-isolation boundary (verified directly: the exact query with no `user_id` filter, run as an authenticated test tenant, returned only that tenant's own rows). Returns raw unaggregated rows (bookings/services/staff/customers/all-time history), not pre-aggregated per-section, so prompt 2 (Days & Timings, Services, Staff) can extend the same endpoint. New `lib/analyticsRange.ts` provides the `this-week` / `this-month` / `last-30` / `last-90` / `custom` range math plus matching previous-period bounds for comparisons, built entirely from local `Date` getters (never `toISOString()`) with range ends always the true end of the period. **Sections shipped:** Revenue Overview (total/pending/lost revenue, avg booking value, "price on request" bookings excluded from revenue math with a visible count — verified against a real service with `price: null`), Bookings (5-way status split incl. blocked, cancellation/completion rate, online vs manual vs blocked source split, average lead time, individual vs group), Customers (unique/new/returning, repeat rate, avg bookings/customer, lapsed-60-days count, top 10 by visits and by spend — blocked entries excluded via `customer_id`/`booking_type` checks, matching the existing `customers/page.tsx` convention). Every section has an explicit empty/low-data state (no NaN or division-by-zero) gated on real-booking and unique-customer counts. All new UI strings added as `an2.*` keys to both `lib/i18n/en.ts` and `ar.ts` (existing `an.*` keys untouched, some reused as-is). Old sections (revenue-over-time chart, top services, team performance, busiest days/times, new-vs-returning callout) were removed from this page; prompt 2 re-adds the days/timings/services/staff views on the same data layer. |
| 2026-07-22 — Analytics rebuild, prompt 2/2 (Days & Timings, Services, Staff) | Adds the three remaining sections on top of prompt 1's foundation. **Neither `app/api/analytics/route.ts` nor `lib/analyticsRange.ts` were touched** — all three sections aggregate client-side from the same raw payload the route already returns. **Days & Timings:** busiest days (Sun–Sat bar chart, Jordan week order), busiest hours (ranked list), a week×hour density heatmap (columns auto-scoped to the hour range actually observed in the data, not a fixed 0–23), quietest day/quietest hour callouts, and a daily booking-volume trend bar chart over the selected range. **Services:** all services ranked by booking count, revenue per service (same price-on-request exclusion as the Revenue section), average price computed from priced-completed bookings (not just read off the service record), per-service repeat-visit rate (customers with >1 booking of that service *within the selected period* — all-time isn't derivable without extending the API), and a distinct "not booked this period" callout for zero-booking services. **Staff:** bookings/revenue/cancellation-rate/peak-hour per staff member, plus an always-rendered "No Staff Assigned" bucket row so unassigned bookings never disappear from totals (verified: bucketed row counts always sum to the period's real-booking count, checked against three real businesses). "Specifically requested vs no preference" is derived from `staff_id` presence on online bookings alone — traced the booking-creation and staff-reassignment code paths and confirmed `staff_id` and the unused `staff_preference` column are always set in lockstep in every current code path, so `staff_id` alone is a fully accurate proxy without needing a route change. Empty states: no services configured, no staff configured, and the shared "not enough data" state all render distinctly. All new strings added as `an2.*` keys (day/hour labels reuse `formatTimeLocale`/`Intl.DateTimeFormat` instead of new dictionary keys, so they're correct in both locales for free); zero existing keys modified. Verified by tracing the exact aggregation logic against real DB rows for three businesses covering sparse/empty edge cases (zero staff, zero bookings for a price-on-request service, a single-hour heatmap) — could not verify in-browser as a logged-in user (credential-entry is off-limits regardless of who supplies the password), so the rendered/RTL check is still pending a manual look. |
| 2026-07-23 — Calendar feature (week/month views, side panel, dashboard block) | New reusable `components/Calendar.tsx` + `components/CalendarSidePanel.tsx`, plus `lib/bookingActions.ts` (`updateBookingStatus()` — the single place the `status` column is written; the bookings-table dropdown was refactored to call it instead of inlining its own Supabase update, so nothing duplicates it). **Week view:** 7 day columns, hour rows scoped to the business's own `business_hours` (union across configured days, falling back to 9–5 only when nothing is configured) and additionally widened to cover any booking in the visible week that falls outside those hours (manual/blocked entries aren't constrained to business hours, so this prevents a booking from silently never rendering). Cards colored pending=amber, confirmed=blue, completed=green, cancelled=grey, blocked/manual=slate. **Month view:** standard 6-week grid, up to 4 status dots + a count per day, muted (not hidden) styling for zero-booking and out-of-month days. **Side panel:** one component, slide-in from the logical end (`end-0`, so it sits correctly on either side under RTL), used identically in both views and both pages — week-card click opens booking detail directly, month day-click opens a day list (reusing the same `CalendarCard` used in the week grid) whose items expand into the same detail view with a back control. Status changes (pending→confirmed→completed, any→cancelled; blocked bookings excluded, matching the existing table's behavior) call `updateBookingStatus()` then bubble a state-only update up to the parent page, so both the panel and the grid card recolor immediately with no refetch and no page reload. Escape closes the panel (same pattern as `InfoTooltip.tsx`); full width on mobile. **Bookings page:** new Table/Calendar toggle, `localStorage["7jwzat-bookings-viewmode"]`, **defaults to Calendar** per the task (table view itself is untouched). **Dashboard:** new "This Week's Bookings" block between the stats grid and the quick-links grid, `compact` mode (tighter row/cell heights), its own week/month toggle state at `localStorage["7jwzat-calendar-view-dashboard"]` (separate from the bookings page's `localStorage["7jwzat-calendar-view-bookings"]`) seeded to week view. Both pages now fetch `business_hours` and merge `staff_name`/`service_name` onto each booking client-side before handing them to `Calendar`, mirroring the existing merge-client-side convention (`booking-page-data`, the old analytics page). RTL: the week/month grids are **not** forced `dir="ltr"` (unlike the analytics charts) — Sunday is first in DOM order and CSS Grid mirrors it automatically under `dir="rtl"`, so Sunday renders on the right in Arabic, per the task's explicit requirement. Day/month names use `Intl.DateTimeFormat` with `ar-JO` (Levantine), not the hand-authored MSA `day.0`..`day.6` dictionary keys. Mobile week view shows a 3-day tap-paginated window instead of squeezing all 7 columns. All new strings added as `cal.*`/two `bk.*` keys; zero existing keys modified. Verified: `tsc --noEmit` clean, dev server compiles with no console/server errors, and the operating-hours/cell-bucketing logic traced by hand against real `business_hours` + `bookings` rows (Stitch In Time, 9am–9pm Mon–Fri) confirmed correct. **Not verified in-browser as a logged-in user** — could not log in (credential-entry is off-limits regardless of who supplies the password), so the rendered week/month grids, side-panel interaction, live status-color update, RTL layout, and the mobile 3-day view still need a manual look. |
| 2026-07-23 — Bookings filter bar (Table + Calendar share one filter state) | Filter bar added above the Table/Calendar toggle on `app/dashboard/bookings/page.tsx`, filtering both views from one shared `bookings.filter(matchesFilters)` predicate — `filteredBookings` is what's passed to both `<Calendar>` and the table, so there's exactly one filtering implementation, not two. Four filters, all AND-combined: **Status** (multi-select checkbox dropdown — Pending/Confirmed/Completed/Cancelled/Blocked, "Blocked" meaning `booking_type === "blocked"` rather than the `status` column, matching how the calendar already treats it); **Date range** (This Week/This Month/Last 30 Days/Custom — reuses `computeRange()` from `lib/analyticsRange.ts` rather than reimplementing range math; defaults to This Week when the page's initial view is Calendar, This Month when it's Table, decided once at mount from the already-resolved `localStorage` view preference, not reset on every Table↔Calendar toggle); **Booking type** (All/Individual/Group/Manual+Blocked); **Staff** (All/Unassigned/each staff member — the `<select>` is omitted entirely, not just disabled, when the business has zero staff configured). Filter state is plain `useState`, intentionally not persisted (resets on reload, per the task). A "Clear filters" control appears only when at least one filter differs from its default. Verified the exact filter predicate against real DB rows (a business with 2 staff, one blocked slot, and mixed statuses) for eight individual and combined-filter cases, including an AND combination (`status=completed AND staff=unassigned`) — all matched hand-computed expectations exactly. **Calendar component change:** confirmed `Calendar.tsx` already received `bookings` purely as a prop from the previous prompt (no internal fetching to refactor); added one new optional `emptyStateMessage` prop so the calendar can show "No bookings match these filters" instead of its default "no bookings this week/month" text when a filter — not genuinely empty data — is why nothing is showing; the table view gets the equivalent distinct empty state with an inline "Clear filters" action. New strings added as `flt.*` keys plus one `bk.*` key; everything else (range labels, individual/group labels, apply/date-picker labels) reuses existing `an.*`/`an2.*` keys from the analytics work rather than duplicating them. Zero existing i18n keys modified. |
| 2026-07-23 — Staff view selector (per-staff calendar perspective) | Adds a "whose calendar am I looking at" switch on `app/dashboard/bookings/page.tsx`, deliberately separate from the existing Staff filter dropdown in the filter bar (the task specified both must exist and compose via AND — selecting a staff view AND a contradictory staff filter, e.g. view=Mahmoud + filter=Unassigned, correctly yields zero results rather than one silently overriding the other). Pill-button row: "All Staff" (default) + one pill per configured staff member, hidden entirely (not shown empty/disabled) when the business has none. Selecting a person filters both the table and the calendar to their bookings only; unassigned bookings (`staff_id IS NULL`) match no specific person by construction, so they only ever appear in "All Staff" — verified against a real 2-staff business (one booking each, one unassigned): "All Staff" → 3, per-staff views → 1 each, unassigned never appears in either. A "Viewing: {name}'s calendar" label appears below the pills when a person is selected, built from one `flt.viewingLabel` template key with a `{name}` placeholder so each language keeps its own grammar (English suffix possessive vs. Arabic `تقويم {name}` construct-state prefix) without branching in code. **Color accents:** `components/CalendarSidePanel.tsx`'s `CalendarCard` gained an optional `staffColor` prop (small dot before the customer name, `aria-hidden`) — status color via the existing `cls` background/border remains the primary signal, per the task's explicit "accent only" requirement. `Calendar.tsx` gained an optional `staffColors: Record<staffId, hex>` prop, threaded through to both the week-grid cards and the side panel's day-list cards (`CalendarSidePanel` → `DayListPanel`). Fixed 8-color palette (`STAFF_ACCENT_COLORS` in the bookings page), deliberately disjoint from the status palette (amber/blue/green/gray/slate) so a staff dot is never mistaken for a status: `#6366f1 #06b6d4 #ec4899 #14b8a6 #8b5cf6 #f43f5e #84cc16 #d946ef`. Assignment cycles in staff **creation order** (`staff.created_at`, fetched alongside `id`/`name` for this purpose only), which is independent of the alphabetical order the dropdowns/pills display staff in — confirmed against real data where creation order (Mahmoud, Canaan) differs from display order (Canaan, Mahmoud). The bookings page passes `staffColors` to `<Calendar>` only when `staffView === "all"`; passing `undefined` when a specific person is selected turns accents off with no extra logic inside `Calendar.tsx`. **Dashboard untouched** — `app/dashboard/page.tsx` was not modified in this change at all; its `<Calendar>` call never passes `staffColors` and has no selector, so it stays "All Staff" with no accents by construction, satisfying the "dashboard is not a staff management surface" requirement without any conditional code. New strings: `flt.staffViewLabel`, `flt.allStaff`, `flt.viewingLabel` (template). No existing keys modified. |
| 2026-07-24 — Day notes & block-outs | New `day_notes` table (see §4) — **confirmed applied to the live database 2026-07-23** (SQL below, run by the project owner in the Supabase SQL editor). Adds two related capabilities: an internal per-day note (owner-only) and a block-out (`walk_ins_only` / `fully_blocked`, optionally scoped to a `block_start_time`–`block_end_time` sub-range instead of the whole day). **API:** new `/api/day-notes` (GET/POST/DELETE) follows the `/api/analytics` auth pattern exactly — session cookies, anon-key client, RLS as the real boundary; one upsert per `business_id`+`date` (`onConflict`), and clearing both the note and the block deletes the row outright rather than leaving an empty placeholder. `/api/booking-page-data` (public, service-role) now also returns `dayNotes` for the same 30-day window as `existingBookings`. **Calendar UI:** week-view day headers and month-view day cells are now clickable (previously only month cells were) and show a small unobtrusive colored dot when a note/block exists — red for fully blocked, amber for walk-ins-only, indigo for a note with no block — with a `title` tooltip, no text label, per the task's "don't clutter" instruction. Editing lives at the bottom of the side panel's existing day-list view (below the bookings for that day): a note textarea, a block-type `<select>`, and start/end `<input type="time">` fields that only appear once a block type is chosen. Save/Clear call the new `lib/dayNoteActions.ts` (`saveDayNote`/`deleteDayNote`) directly from the panel — same "panel calls the shared action, then bubbles a state-only update to the parent" pattern as booking-status changes — so the indicator updates immediately with no refetch. **Enforcement — the actual point of the feature:** `isTimeBlockedByDayNote()`/`isDayNoteWholeDayBlocked()` in `lib/dayNoteActions.ts` are pure functions imported by *both* the public booking page (decides which slots to show, and shows `dn.dayBlockedMessage`/`dn.walkInsOnlyMessage` instead of the slot grid for a whole-day block) *and* `/api/create-booking` (re-runs the identical check server-side before inserting, for both 1-on-1 and group bookings — both send `bookingDate`/`bookingTime` regardless of flow) — sharing one implementation means the UI hint and the real enforcement boundary can never silently drift apart, satisfying the task's explicit "not a UI-only hide" requirement. Verified with a standalone unit test of the shared functions against whole-day/partial/none/no-note cases (all matched expected output) and by confirming both `/api/day-notes` and the extended `/api/booking-page-data` degrade gracefully (log-and-continue, never crash the response) when queried against the not-yet-created table. New strings: `dn.*` (14 keys). No existing keys modified. Dashboard's `<Calendar>` call is untouched — day notes only wired into the bookings page. |

**SQL that was run** (Supabase SQL editor, by the project owner):
```sql
CREATE TABLE public.day_notes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date              date NOT NULL,
  note              text,
  block_type        text NOT NULL DEFAULT 'none'
                       CHECK (block_type IN ('none', 'walk_ins_only', 'fully_blocked')),
  block_start_time  time,
  block_end_time    time,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, date)
);

ALTER TABLE public.day_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "day_notes_select_own" ON public.day_notes
  FOR SELECT USING (business_id = auth.uid());
CREATE POLICY "day_notes_insert_own" ON public.day_notes
  FOR INSERT WITH CHECK (business_id = auth.uid());
CREATE POLICY "day_notes_update_own" ON public.day_notes
  FOR UPDATE USING (business_id = auth.uid()) WITH CHECK (business_id = auth.uid());
CREATE POLICY "day_notes_delete_own" ON public.day_notes
  FOR DELETE USING (business_id = auth.uid());

NOTIFY pgrst, 'reload schema';
```

| 2026-07-24 — Customer CRM tags | `customer_tags` (id, business_id, name, color, created_at) and `customer_tag_assignments` (id, business_id, customer_id, tag_id, created_at) — both created directly by the project owner in Supabase; Claude sessions never had DDL access to these either. Followed the simpler, more common pattern for owner-scoped CRUD already used by `services`/`staff`/`customers` (direct Supabase calls with RLS as the boundary), not the newer authenticated-API-route pattern (`/api/analytics`, `/api/day-notes`) — there's no public-facing or cross-context need here, unlike those two. **Management** lives at `app/dashboard/customers/tags/page.tsx`, linked from a "Manage Tags" link on the customers list header (not added to `DashboardNav.tsx` — reachable "from the customer section" per the task, not promoted to a top-level nav item): create (name + one of 10 fixed palette colors, `TAG_COLOR_PALETTE` in `components/TagPill.tsx`, no free-form hex), inline click-to-rename (same pattern as the day-note editor's textarea — click text → input → save on blur/Enter), click-a-swatch recolor, delete with a confirm dialog, and a live per-tag customer count. Delete is an explicit two-step delete (assignments for that `tag_id`, then the tag row) rather than relying on an assumed `ON DELETE CASCADE`, since that DDL wasn't written by this session — verified directly against real data that both steps fire correctly and a customer's *other* tag is left untouched. **Assignment** happens on the customer detail page: pills with a `✕` remove button, plus a `<select>` of not-yet-assigned tags that inserts immediately on choose (no save button, per the task) — the dropdown is hidden and replaced with "all tags assigned" text once every tag is applied, and with a link to the management page if the business has no tags at all yet. **List + filter**: the customers list now fetches all tags/assignments alongside its existing customers/bookings queries, shows up to 3 pills inline (2 + a "+N more" count above that, via one `tags.moreCount` template key), and gained a tag multi-select filter (same click-outside dropdown component as the bookings page's status filter) that's AND-combined with the existing name/phone search — a customer must carry *every* selected tag, verified directly: two real customers, one carrying both test tags and one carrying only one, filtering by both tags matched only the first. A single "Clear filters" control covers both search and tag filters. **Seeding**: `app/auth/signup/page.tsx` inserts "VIP" (`#F59E0B`) and "Problematic" (`#EF4444`) right after the existing default-business-hours insert, same non-fatal try/catch pattern — new businesses only, by construction (nothing retroactively touches existing tenants). Tag names are literal, untranslated starter data the owner can rename freely, matching the existing "custom field labels are owner-authored, never translated" convention. **Verified**: RLS confirmed directly — a cross-tenant insert (real session, fabricated `business_id`) was rejected 403, and reading another business's tags by explicit `business_id` filter returned `[]`. New strings: `tags.*` (16 keys) + one `cust.noMatch` key. No existing keys modified. |
| 2026-07-24 — Mandatory business address at signup | Businesses previously only set `users.address` (see §4 — this column already existed, added earlier for the booking-page location display; no new column was created) from Settings, after signup, leaving new businesses with no address until they visited Settings themselves. `app/auth/signup/page.tsx` step 2 now has a required "Business Address" text field, positioned directly after Business Name (before Email/Password), with native HTML `required` plus a `validate()` check (`signup.addressRequired`) as a second guard; the field submits via the same `users` insert the rest of signup already does, no new API route needed. **Settings page** (`app/dashboard/settings/page.tsx`) already had an editable address field (shipped with the original booking-page-address feature) — confirmed still correct and left as-is, except adding `dir="ltr"` to its textarea to match the new signup input (addresses are Latin/numeric even in the Arabic interface, so both inputs now stay LTR inside the RTL page layout without affecting surrounding text direction). **Booking page** required zero changes — `/api/booking-page-data` already selects `address` and `app/book/[businessname]/page.tsx` already renders the location block + Google Maps link whenever `address` is non-empty; verified end-to-end with a real signup (not just traced): submitted signup without an address and confirmed the browser blocked it (no `auth.signUp` network call fired), then completed signup with `"123 Rainbow Street, Amman"`, confirmed via a direct service-role read that `users.address` held the exact value, confirmed the public booking page rendered the address and a correctly-encoded `https://www.google.com/maps/search/?api=1&query=...` link, and confirmed Settings showed the same value pre-filled in the (now `dir="ltr"`) textarea. Also verified RTL: on the Arabic-default signup form the page stayed `dir="rtl"` throughout while the address `<input>` alone carried `dir="ltr"`. Zero console/server errors throughout. Test business, its default hours/tags, and its auth user were all deleted after verification. New strings: `signup.address`, `signup.addressPlaceholder`, `signup.addressRequired`. No existing keys modified. |
| 2026-07-23 — Secure cancel-booking link in confirmation email | `booking_cancel_tokens` (id, booking_id, token, used_at, expires_at, created_at — see §4) created directly by the project owner in Supabase; anonymous SELECT is allowed by RLS (the token is the secret) but INSERT/UPDATE are service-role only, confirmed directly via anon-key curl (SELECT → 200, INSERT → 401 RLS violation). **Token creation**: `/api/create-booking` now captures the new row's id via `.select("id").single()` on insert (also let the custom-field-answers step reuse that id directly instead of its old separate lookup-by-date/time/email query) and, as a non-blocking final step, inserts a `booking_cancel_tokens` row; any failure is logged and swallowed — the booking always succeeds regardless, per the task, just without a cancel button in that one email. **Email**: `sendCustomerEmail` gained an optional `cancelUrl` that renders a "Cancel this booking" button + a 7-day-expiry note when present, and is omitted (not shown broken) when absent; `cancelUrl` is threaded through `/api/send-booking-emails` into `sendCustomerEmail` only, never into `sendOwnerEmail` — the owner email is unchanged. **Cancel flow**: new `GET/POST /api/cancel-booking` (service-role, public, no auth) and public `app/cancel/page.tsx` (`?token=`, wrapped in `<Suspense>` per the `useSearchParams()` requirement, same pattern as `app/auth/login/page.tsx`). **Design deviation from the literal task wording**: the task described the preview fetch as using "the anon client," but `bookings`/`services`/`users` are owner-scoped tables an anonymous client cannot read at all — so `GET /api/cancel-booking` does the validation *and* the joined-preview fetch server-side with the service-role key instead, returning only the display fields the page needs (customer name, service, date/time, business name, WhatsApp number), never raw booking/business rows. Both GET and POST independently re-validate the token from scratch (existence → not used → not expired → booking not already cancelled/completed) — the client's own state is never trusted. POST marks the token used via an atomic guarded update (`.eq("id", tokenId).is("used_at", null)`), so two near-simultaneous cancellation attempts on the same link can't both succeed; only the request that flips `used_at` proceeds to update the booking status and notify the owner (new `sendOwnerCancellationEmail`, mirroring `sendOwnerEmail`'s bilingual red-themed styling), the other gets the "already used" state. **Locale default**: `GET` derives `defaultLocale` from `business.country` using the same AE→English/else→Arabic rule as `LanguageProvider.tsx`, applied client-side only if the visitor has no explicit `localStorage["7jwzat-lang"]` choice already — explicit choice always wins, matching `LanguageProvider`'s own priority order. **Verified end-to-end against the live local dev server and a real test booking** (not just traced): submitted a real booking through `/book/salon-test`, confirmed the `booking_cancel_tokens` row was created with a 7-day `expires_at`; opened the real `/cancel?token=…` link and confirmed the preview rendered correct booking details in both the visitor's already-chosen language (EN, explicit-choice-wins case) and, after clearing that choice, the business's own default (AR/RTL, `dir="rtl"` confirmed via the live DOM); clicked through to cancellation and confirmed via a direct service-role read that `bookings.status` became `"cancelled"` and the token's `used_at` was set; re-opened the same link and got the "already cancelled" friendly error; opened a fabricated token and got the "invalid" friendly error; created and expired a second real token and got the "expired" friendly error; confirmed zero console/server errors throughout. The WhatsApp button correctly did not render for the "salon test" business, which has no `whatsapp_number` set. All test bookings/customers/tokens created for verification were deleted afterward via service-role calls. New strings: `cancel.*` (11 keys). No existing keys modified. |

---

## 10. Development & Commit Conventions

See `CONTRIBUTING.md` for the full guide. Summary:

- **Conventional Commits:** `type(scope): imperative summary` — never past tense.
- **Types:** `feat`, `fix`, `docs`, `refactor`, `chore`, `style`, `perf`, `test`.
- **One logical change per commit.** Never mix UI changes with schema migrations.
- **All work must land on `main` before a task is considered done.**
- **Update this file** whenever architecture, schema, env vars, or conventions change.

---

*Last updated: 2026-07-24. Reflects codebase at commit `ce4038a` plus the mandatory-signup-address feature (uncommitted at time of writing).*
