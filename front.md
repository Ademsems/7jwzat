# front.md — 7jwzat Marketing Website

> **Scope of this file.** This document covers the **public marketing website only**:
> the landing page, pricing, FAQ, privacy, terms, the hero, the navbar/footer, and
> site-level marketing concerns (localization defaults, geo detection, visual polish).
>
> **This file is owned by the marketing-site work stream.**
> A **separate session maintains [`CLAUDE.md`](CLAUDE.md)**, which documents the **core
> product** (auth, dashboard, booking page, database schema, RLS, API routes, email).
> Do not edit `CLAUDE.md` from marketing work, and do not duplicate core-app details here.
> When in doubt about anything below the marketing surface, read `CLAUDE.md`.

---

## 1. What the marketing site is

7jwzat (Arabic: **حجوزات**) is a multi-tenant SaaS booking system for salons, spas,
clinics, and similar appointment-based businesses. The marketing site is the public
front door: it explains the product, sets expectations about pricing, and drives
sign-ups to `/auth/signup`.

**Positioning:** Jordan-first, Arabic-first, **free during the launch year**.
Target market is Jordan primarily, then the wider MENA region (UAE, Saudi Arabia,
Kuwait, Qatar, Bahrain, Oman, Egypt).

### ⚠️ Rebrand in progress
`CLAUDE.md` records that the product is being renamed from **7jwzat / حجوزات** to
**Sajjel**, migrating to the domain **sajjel.online**. **Marketing copy still uses the
old name throughout** (page copy, i18n dictionaries, metadata, footer, `support@7jwzat.com`).
A future marketing task will be to sweep the rebrand across the site. Coordinate with
the core-app session before doing so — the brand string appears in both areas.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 14 (App Router)**, TypeScript, React 18 |
| Styling | **TailwindCSS v4** (via `@tailwindcss/postcss`) |
| Fonts | `next/font/google` — **Inter** (Latin) + **IBM Plex Sans Arabic** (self-hosted, auto-subset) |
| Animation | **Zero libraries** — CSS keyframes + IntersectionObserver only |
| Hosting | **Vercel**, auto-deploys from `main` |
| Error tracking | Sentry (`@sentry/nextjs`) — configured app-wide, not marketing-specific |

**No animation/UI dependencies were added for the marketing site.** No `framer-motion`,
no component library. All motion is hand-rolled CSS + a small IntersectionObserver hook.
Keep it that way unless there's a strong reason — it's a deliberate performance choice.

Other deps in `package.json` (Supabase, Resend, qrcode) belong to the core app.

---

## 3. File map

### 3.1 Marketing-only files — safe to change from marketing work

| Path | Purpose |
|---|---|
| `app/page.tsx` | **The entire landing page.** Hero, How It Works, Features, Pricing, FAQ, final CTA, footer, and the `FooterGeoSelector` component. |
| `app/privacy/page.tsx` | Privacy policy (bilingual, uses shared `Navbar`) |
| `app/terms/page.tsx` | Terms of service (bilingual, uses shared `Navbar`) |
| `components/Navbar.tsx` | Marketing top nav: logo, anchor links, active-section underline, scroll blur, mobile hamburger, AR/EN toggle |
| `components/RevealOnScroll.tsx` | Scroll-reveal wrapper (fade + translateY, `delay` prop for stagger) |
| `components/AnimatedCounter.tsx` | requestAnimationFrame count-up with easeOut. **Built but not currently used** — the landing page has no numeric stats. Available if stats are added. |
| `hooks/useIntersectionObserver.ts` | Generic IntersectionObserver hook (`threshold`, `rootMargin`, `once`) |
| `lib/marketingMockup.ts` | **Cosmetic only.** Per-currency representative prices + AR/EN price labels for the hero booking mockup. Not real data, not currency conversion. |

### 3.2 Shared foundations — ⚠️ CROSS-CUTTING, changes affect the core app too

These files are used by **both** the marketing site and the core app (dashboard, auth,
booking page). Changing them can break the product. Read `CLAUDE.md` and test both
surfaces before touching:

| Path | Shared by | Notes |
|---|---|---|
| **`lib/i18n/en.ts`** | Marketing + dashboard + auth + booking page | One flat key→value map for the whole app. Marketing keys are namespaced **`m.*`** (plus `brand.logo`). ~114 `m.*` keys. |
| **`lib/i18n/ar.ts`** | Same | Arabic mirror of `en.ts`. **Placeholder MSA — see §4.4.** |
| **`lib/i18n/LanguageProvider.tsx`** | Everything | `locale`/`setLocale`/`t()` **plus** marketing's `country`/`currency`/`setCountry`/`setCurrency`. Also exports `useApplyHtmlDir()` and `LanguageToggle`. Marketing extended this — additions were made backward-compatible; don't remove existing fields. |
| **`lib/i18n/format.ts`** | Everything | `Locale` type, locale-aware date/time formatting (Western digits) |
| **`lib/currency.ts`** | Core app (per-business currency) + marketing (geo defaults) | `COUNTRIES`, `currencyForCountry()`, `formatPrice()`, `DEFAULT_COUNTRY`/`DEFAULT_CURRENCY`. Marketing **reads** this; the core app also **writes** business currency at signup. |
| **`app/layout.tsx`** | Everything | Root layout: fonts, `LanguageProvider`, `ToastProvider`, **the pre-hydration language script** (§4.2) |
| **`app/globals.css`** | Everything | Tailwind import, font-family rules, **and all marketing animation keyframes/classes** (§5) |
| **`middleware.ts`** | Marketing (geo cookie) + core app (dashboard auth guard) | Single middleware handles both. See §4.3. |
| `next.config.js`, `postcss.config.js`, `tsconfig.json` | Everything | Global build config |

### 3.3 Core-app files — do not modify from marketing work

`app/dashboard/**`, `app/auth/**`, `app/book/**`, `app/api/**`, `lib/supabase.ts`,
`lib/email.ts`, `lib/slug.ts`, `components/DashboardNav.tsx`, `components/Toast.tsx`,
`components/QRCodeCard.tsx`, `components/InfoTooltip.tsx`, Sentry configs.
These are documented in `CLAUDE.md`.

---

## 4. Localization

The single most important thing to understand about this site.

### 4.1 Arabic-default + RTL

- **Default locale is Arabic (`ar`) with `dir="rtl"`.** English is the toggle-away option.
- Locale persists to **`localStorage["7jwzat-lang"]`**.
- `useApplyHtmlDir()` (from `LanguageProvider`) syncs `<html lang>` / `<html dir>` to the
  active locale while a localized surface is mounted. The landing, privacy, and terms
  pages all call it.
- **Layout is written with CSS logical properties** so RTL mirrors for free:
  use `ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `text-start`/`text-end` —
  **not** `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`/`text-left`.
  Directional arrows flip with Tailwind's `rtl:` variant (e.g. `rtl:-scale-x-100`).
- Scroll-reveal animations use **translateY only** (no translateX), so they are
  direction-agnostic and behave correctly in both LTR and RTL.
- Arabic headlines get slightly looser line-height (`leading-[1.35]`) so the hero reads
  as designed rather than as a translation.

### 4.2 Pre-hydration language script (no flash)

`app/layout.tsx` injects a small inline `<script>` in `<head>` that runs **before React
hydrates** and sets `<html lang>`/`<html dir>` immediately. This eliminates the
first-paint flash of the wrong language/direction.

**Resolution order (implemented identically in the inline script AND in `LanguageProvider`
— if you change one, change both, or you'll get a hydration mismatch):**

1. `localStorage["7jwzat-lang"]` — an explicit user choice **always wins**.
2. Else geo default: country from `localStorage["7jwzat-geo-country"]` (manual footer
   choice) → else the `7jwzat-geo-country` **cookie** (set by middleware) →
   **`AE` ⇒ English, everything else / unknown ⇒ Arabic**.
3. Else Arabic.

The root `<html>` is server-rendered as `lang="ar" dir="rtl"` (matching the default), and
carries **`suppressHydrationWarning`** because the script intentionally mutates those
attributes before hydration for English visitors. This is the standard next-themes pattern.

### 4.3 Geolocation defaults (Vercel header → cookie)

**Principle: geolocation sets DEFAULTS ONLY.** IP detection is unreliable (VPNs, travel,
proxies). Manual selectors are always visible, a manual choice always wins, and choices
persist. Never trap a visitor in a guessed language or currency.

**How it works:** `middleware.ts` reads Vercel's **`x-vercel-ip-country`** request header
and writes it to a **non-httpOnly** cookie **`7jwzat-geo-country`** (180 days), so the
pre-hydration inline script can read it via `document.cookie`.

**Why cookie + middleware rather than `headers()` in the layout:** reading `headers()` in
the root layout would opt the marketing pages out of **static rendering**. The cookie
approach keeps `/`, `/privacy`, `/terms` statically prerendered while still giving the
pre-paint script the country. The middleware `matcher` is
`["/", "/privacy", "/terms", "/dashboard/:path*"]` — the marketing routes for the geo
cookie, plus the existing dashboard auth guard (which is gated to `/dashboard` paths only).

**Locally there is no `x-vercel-ip-country` header**, so the cookie is never set and the
site falls back to Jordan / Arabic / JOD. To simulate a country in dev:

```js
// in the browser console, then reload
document.cookie = "7jwzat-geo-country=AE; path=/";
```

**Geo → defaults:**

| Detected country | Language | Mockup currency |
|---|---|---|
| `AE` (UAE) | English | AED |
| `JO`, `SA`, `KW`, `QA`, `BH`, `OM`, `EG` | Arabic | JOD / SAR / KWD / QAR / BHD / OMR / EGP |
| Unknown, unrecognized, or absent | Arabic | JOD |

An unrecognized geo country normalizes to **Jordan** (not "Other"), so the footer
selector always has a matching option. "Other" (→ USD) is only reachable as an
explicit manual selection.

### 4.4 ⚠️ Arabic copy is placeholder — do not rewrite

`lib/i18n/ar.ts` opens with:

```
// PLACEHOLDER ARABIC — pending founder review
```

All Arabic strings are **placeholder Modern Standard Arabic**, written in a warm,
professional register aimed at Jordanian small-business owners. They are awaiting
review by the founder (a native speaker).

**Do not alter existing Arabic strings unless explicitly instructed.** If you add a new
key, add it to **both** `en.ts` and `ar.ts` in the same commit and keep the placeholder
marker at the top of `ar.ts`. Use Western digits (0–9), never Eastern Arabic numerals.

### 4.5 Language / country / currency controls

- **Navbar AR/EN pill** — the quick switch (desktop + inside the mobile hamburger menu).
- **Footer `FooterGeoSelector`** — the fuller control: **Language** pill +
  **Country/Region** dropdown (9 options) + **Currency** dropdown (9 codes).
  - Changing **Country** updates the currency to that country's default, persists both,
    and follows the country's default language **only if the user hasn't already locked a
    language** via the AR/EN toggle.
  - **Currency** is also independently selectable (e.g. SAR while in Jordan).
- **Persistence keys:** `7jwzat-lang`, `7jwzat-geo-country`, `7jwzat-currency`.
  All three win over geo detection on the next visit.

---

## 5. Visual design & animation

Design target: premium and intentional (Stripe / Linear / Vercel feel), not trendy.
Palette is **dark navy (`slate-900`) + emerald green**. All animation is CSS keyframes
or IntersectionObserver — **no animation libraries**.

Animation classes live in **`app/globals.css`** (shared file — see §3.2):

| Feature | Implementation |
|---|---|
| Page entrance | `.page-enter` — 450ms fade-in on the whole page |
| Hero background | `.hero-bg` — 10s looping 4-stop gradient shift between dark navy/green tones |
| Floating orbs | `@keyframes orb1–orb4` — 4 large blurred emerald circles drifting on independent 12–22s cycles, positioned with `insetInlineStart/End` so they mirror in RTL |
| Cursor glow | `onMouseMove` on the hero → a 600px radial emerald gradient follows the cursor in real time, clipped by `overflow-hidden` |
| Hero text entrance | `.hero-badge` / `.hero-line-1` / `.hero-line-2` / `.hero-sub` / `.hero-cta` / `.hero-proof` / `.hero-mock` — staggered fade-up, 0ms → 850ms |
| Scroll reveals | `RevealOnScroll` + `useIntersectionObserver` (threshold ~0.12) — fade + 28px rise; cards stagger 0/100/200ms |
| Button shimmer | `.btn-shimmer` — `::after` white sheen sweeps across on hover + `scale(1.025)` |
| Feature card hover | `.feature-card` — lift 5px, emerald glow ring + shadow, subtle emerald tint |
| Pricing card hover | `.pricing-card` / `.pricing-card-pro` — `scale(1.025)`, deeper shadow, emerald border glow |
| Step card hover | `.step-card` — lift 4px + shadow |
| FAQ | `.faq-row` hover tint; accordion opens via animated `max-height` + opacity |
| Mobile menu | `.mobile-menu-enter` slide-down; hamburger bars morph into an X via CSS transforms |
| Navbar | Backdrop blur intensifies past 60px scroll; active section gets an animated emerald underline (IntersectionObserver per section) |

**Performance posture:** fonts self-hosted via `next/font` (no render-blocking Google
Fonts `<link>`); marketing pages contain **zero raster images** — all graphics are inline
SVG + emoji, so `next/image` isn't needed. Marketing routes stay **statically prerendered**.

---

## 6. Pricing & messaging rules

These are **content rules**, not just implementation details. Violating them makes the
site dishonest. Read before touching any pricing or claim copy.

1. **One pricing card only: "Free during our launch year" / "مجاني خلال سنة الإطلاق".**
   Six bullets: unlimited bookings, unlimited services, staff management, group sessions,
   QR code + booking link, WhatsApp contact button.
2. **No real prices anywhere on the marketing site.** No monthly figures, no tiers,
   no "Starter/Pro", no "14-day trial", no "30 bookings/month" caps. All of these were
   deliberately removed. If you reintroduce a number, it must be a decision the founder
   actually made.
3. **Founding-business framing** is the answer to "will it stay free?":
   *"Founding businesses get special lifetime pricing when paid plans arrive."*
   / *"الأعمال المؤسِّسة تحصل على تسعير خاص مدى الحياة."*
4. **No unverifiable social proof.** The site previously claimed "Used by businesses in
   UAE, Saudi Arabia & Jordan" — replaced with the honest
   **"Now launching in Jordan 🇯🇴" / "نطلق الآن في الأردن 🇯🇴"**.
   Don't add customer counts, logos, or testimonials that don't exist.
5. **One story across the whole site.** Pricing card, FAQ answers, Terms, and footer must
   agree. The Terms billing clause was rewritten to launch-year framing for exactly this
   reason. If you change the pricing model, grep the FAQ and Terms too.
6. **Tone:** benefits-focused and plain. No hype ("revolutionary", "game-changing",
   "#1"), no fake urgency, no invented scarcity.
7. **Hero mockup prices are cosmetic marketing only** (`lib/marketingMockup.ts`) —
   representative round numbers per market (JOD 15 / AED 80 / SAR 80 for the haircut
   line). Not conversions, and unrelated to the product's real per-business currency logic.

---

## 7. Landing page structure (`app/page.tsx`)

Top to bottom:

1. **Navbar** (shared component) — sticky, blur on scroll, active-section underline
2. **Hero** — badge, two-line headline, subhead, primary CTA + "see how it works",
   launch proof line, animated booking mockup (currency-aware)
3. **How It Works** (`#how-it-works`) — 3 steps (Sign up → Add services & hours →
   Share your link) + CTA
4. **Features** (`#features`) — 6 cards
5. **Pricing** (`#pricing`) — the single launch-year card + founding-business line
6. **FAQ** (`#faq`) — 8 accordion questions
7. **Final CTA** (`#contact`) — headline, sign-up CTA, client-side email capture with
   inline validation (UI feedback only, **no backend**), direct email link
8. **Footer** — brand, tagline, legal/contact links, and the `FooterGeoSelector`

All sign-up CTAs link to **`/auth/signup`**. Section `id`s are what the navbar anchors
and the active-underline IntersectionObserver depend on — **don't rename them casually.**

---

## 8. Deployment

- **Vercel, auto-deploys from `main` only.** Pushing any other branch does not deploy.
- Always run **`npm run build`** locally before pushing — Next.js statically prerenders
  these pages at build time, so a runtime error in a page breaks the deploy.
- After pushing, confirm the commit actually landed:
  ```bash
  git log origin/main --oneline -5
  ```
- Marketing routes (`/`, `/privacy`, `/terms`) must stay **statically prerendered** (`○`
  in build output). If a change flips them to dynamic (`ƒ`), you've likely introduced
  `headers()`/`cookies()` in a server component — reconsider (see §4.3).
- Env vars are documented in `CLAUDE.md`; the marketing pages themselves need none.

### Local testing checklist for marketing changes

1. `npm run build` — clean, all pages generated, marketing routes still `○`.
2. Arabic RTL loads by default; toggle to EN → LTR; choice persists across reload.
3. No flash of the wrong language/direction on hard reload in either language.
4. Simulate geo via the cookie (§4.3): `AE` → English + AED; `JO` → Arabic + JOD;
   `SA` → Arabic + SAR; no cookie → Arabic + JOD.
5. Manual override wins: lock AR while "in" UAE → stays AR on reload.
6. Footer selector updates the hero mockup live and persists.
7. No horizontal overflow at **375px** in both RTL and LTR; check desktop too.
8. No console errors and no hydration warnings.
   *Tip: the browser console buffer can retain stale warnings across reloads — verify in
   a fresh tab before concluding a warning is live.*

---

## 9. Known gaps / deferred

| Item | Status |
|---|---|
| **Rebrand to Sajjel / sajjel.online** | Not started on the marketing site. Copy, metadata, footer, and `support@7jwzat.com` all still say 7jwzat. Coordinate with the core-app session. |
| **Arabic copy review** | All `ar.ts` strings are placeholder MSA pending founder review. |
| **Lighthouse baseline** | Never captured — the CLI isn't installed locally and a valid mobile audit needs headless Chrome against a production server. Run PageSpeed Insights against the deployed URL to establish a real baseline. |
| **Contact form** | Client-side validation + confirmation message only. Submissions go nowhere — no backend, no storage, no email. Wire it up before relying on it. |
| **`AnimatedCounter`** | Built and working but unused (no numeric stats on the page yet). |
| **Marketing analytics** | None. No GA/Plausible/PostHog on the marketing site. |
| **SEO** | Basic metadata + OpenGraph only. No `sitemap.xml`, `robots.txt`, JSON-LD, or OG image asset. |
| **Blog / content pages** | None. |

---

## 10. Conventions

- **Conventional Commits** — `type(scope): imperative summary`. See `CONTRIBUTING.md`.
- **One logical change per commit.** Don't mix marketing copy with shared-infrastructure
  changes without saying so in the message.
- **All work must land on `main`** and be confirmed on `origin/main` before it's "done".
- **Adding an i18n key:** add to **both** `en.ts` and `ar.ts` in the same commit,
  namespaced `m.*` for marketing.
- **Append to the Change Log below** — never rewrite existing entries.

---

## Change Log

Append new dated entries at the **bottom**. Do not edit or delete past entries.

### 2026-07-22 — Documentation created
- Added `front.md` as the marketing-site handoff document. No application code changed.
- Captured state as of commit `cfee09f` (marketing) on `main`.

### Earlier work in this stream (retroactively recorded, in order)

**Marketing landing page — initial build**
- Replaced the placeholder home page with a full landing page: hero, How It Works,
  Features, Pricing, FAQ, final CTA, footer. Added `/privacy` and `/terms`.
- Multiple sign-up CTAs, all → `/auth/signup`. Responsive, mobile-first.

**Frontend fixes (8 issues)**
- Auth pages recolored from indigo → emerald brand palette; logo to `slate-900`.
- Extracted the dashboard sidebar into a shared `DashboardNav` (5 items, icons, active
  state) and removed duplicated inline sidebars — *core-app surface, done from this stream.*
- Extracted `components/Navbar.tsx` and added it to `/privacy` and `/terms`.
- Pricing corrected from "30 bookings/month" → unlimited; contact form given inline
  email validation; signup form `autoComplete` hardened.

**Visual overhaul — premium feel** (`3ae7e07` lineage)
- Added `hooks/useIntersectionObserver.ts`, `components/RevealOnScroll.tsx`,
  `components/AnimatedCounter.tsx`.
- Hero: animated gradient background, 4 drifting blurred orbs, cursor-following radial
  glow, line-by-line staggered text entrance.
- Hover systems: feature-card lift + emerald glow, pricing-card scale, step-card lift,
  FAQ row tint, `.btn-shimmer` sweep on all primary CTAs.
- Navbar: scroll-triggered blur, IntersectionObserver active-section underline,
  animated hamburger → X. Page-load fade-in. **No libraries added.**

**Arabic-first RTL + honest launch-year copy** (`2eac9b2`)
- Extended `lib/i18n/en.ts` + `ar.ts` with ~114 `m.*` marketing keys; Arabic marked
  `PLACEHOLDER ARABIC — pending founder review`.
- Marketing pages converted to `t()` + `useApplyHtmlDir()`; directional Tailwind classes
  converted to logical properties; back-arrows flip via `rtl:-scale-x-100`.
- AR/EN toggle added to navbar (desktop + mobile) and footer.
- Hero mockup translated; prices moved from AED → JOD.
- **Pricing replaced with the single launch-year card**; removed all prices, trial
  language, and tier names. "Used by businesses in UAE, KSA & Jordan" →
  "Now launching in Jordan 🇯🇴". FAQ and Terms rewritten to match one story.

**Pre-hydration language/direction fix** (`3ae7e07`)
- Added the inline `<head>` script that sets `<html lang/dir>` before first paint,
  eliminating the LTR/English flash. Root `<html>` defaults to `ar`/`rtl` with
  `suppressHydrationWarning` for the intentional English-visitor mismatch.

**Location-aware defaults + footer selector** (`cfee09f`)
- `middleware.ts` reads `x-vercel-ip-country` → writes the `7jwzat-geo-country` cookie;
  matcher expanded to `/`, `/privacy`, `/terms` while keeping the dashboard auth guard
  gated to `/dashboard`. Chosen over `headers()` to preserve static rendering.
- Language default: `AE` → English, everything else/unknown → Arabic. Resolution
  implemented identically in the inline script and `LanguageProvider`.
- Hero mockup currency now follows the detected/selected country via
  `lib/marketingMockup.ts` (cosmetic representative prices per market).
- Footer `FooterGeoSelector`: Language + Country + Currency, all persisted and winning
  over geo on the next visit.
- Verified: `AE`→English+AED, `JO`→Arabic+JOD, `SA`→Arabic+SAR, no header→Arabic+JOD;
  manual overrides win; no overflow at 375px RTL/LTR; no console or hydration errors.

### 2026-07-22 — Rebrand: 7jwzat → Sajjel (marketing scope + shared i18n/layout)

Executed the marketing-side portion of the 7jwzat → Sajjel rebrand. Core-app-only files
(`lib/email.ts`, `components/DashboardNav.tsx`, `app/auth/**`, `app/dashboard/**`,
`app/api/**`, `CLAUDE.md`) were left untouched — the core-app session owns those.
Storage/cookie key strings (`7jwzat-lang`, `7jwzat-geo-country`, `7jwzat-currency` in
`app/layout.tsx`'s pre-hydration script, `LanguageProvider.tsx`, `middleware.ts`) were
also left as-is — they are internal identifiers, invisible to users, and renaming them
would be a breaking change for existing visitors' persisted choices.

**Latin "7jwzat" → "Sajjel":**
- `components/Navbar.tsx` — Arabic-view Latin subtext next to the wordmark; updated
  the adjacent code comment for accuracy.
- `app/page.tsx` — footer Latin subtext next to the wordmark; footer `support@7jwzat.com`
  mailto (both instances) → `support@sajjel.online`.
- `app/privacy/page.tsx`, `app/terms/page.tsx` — `support@7jwzat.com` → `support@sajjel.online`.
- `app/layout.tsx` — `<title>` and OpenGraph `title` ("7jwzat حجوزات" → "Sajjel سجّل").
- `lib/i18n/en.ts` — `brand.logo`, plus every English `m.*` string that named the brand
  or the support email (`m.faq.a1`, `m.faq.a5`, `m.faq.a8`, `m.cta.sub`,
  `m.footer.rights`, `m.privacy.p1`, `m.privacy.p3`, `m.terms.p1`, `m.terms.p2`,
  `m.terms.p3`).
- `package.json` — `name` field, `"7jwzat"` → `"sajjel"` (cosmetic, optional per scope).

**Arabic brand word "حجوزات" → "سجّل" — brand-name instances only** (full list, for
founder review; placeholder-MSA rule otherwise unchanged — no other Arabic copy was
reworded):
- `lib/i18n/ar.ts` `brand.logo`: `"حجوزات"` → `"سجّل"`
- `lib/i18n/ar.ts` `m.faq.a1`: "نعم. حجوزات مجاني بالكامل..." → "نعم. سجّل مجاني بالكامل..."
- `lib/i18n/ar.ts` `m.faq.a5`: "نعم — حجوزات عربي أولاً..." → "نعم — سجّل عربي أولاً..."
- `lib/i18n/ar.ts` `m.cta.sub`: "...التي تبدأ مع حجوزات." → "...التي تبدأ مع سجّل."
- `lib/i18n/ar.ts` `m.footer.rights`: "© 2026 حجوزات." → "© 2026 سجّل."
- `lib/i18n/ar.ts` `m.privacy.p1`: first occurrence only — "لا يجمع حجوزات سوى..." →
  "لا يجمع سجّل سوى..." — the second occurrence in the same string ("وتفاصيل حجوزات
  الزبائن" = "customer bookings") is the generic noun and was deliberately left unchanged.
- `lib/i18n/ar.ts` `m.terms.p1`: "باستخدامك حجوزات، فإنك..." → "باستخدامك سجّل، فإنك..."
- `lib/i18n/ar.ts` `m.terms.p2`: "يوفّر حجوزات منصّة برمجية..." → "يوفّر سجّل منصّة برمجية..."
- `lib/i18n/ar.ts` `m.terms.p3`: "حجوزات مجاني خلال سنة الإطلاق." → "سجّل مجاني خلال سنة الإطلاق."
- `components/Navbar.tsx` Arabic-view Latin subtext (not Arabic script, listed above under
  Latin swaps): the wordmark itself renders via `brand.logo` (now "سجّل") with "Sajjel"
  alongside for recognition, matching the pre-existing bilingual pattern.

**Explicitly left as the generic noun "bookings," not touched** (verified by grep after
the edit — none of these read as the brand name in context): `m.hero.title1`, `m.hero.sub`,
`m.how.title`, `m.feat.1.title`, `m.feat.5.desc`, `m.feat.6.desc`, `m.price.f1`,
`m.faq.q4`/`m.faq.a4`, `m.privacy.p1`'s second occurrence, `m.privacy.p2`, plus all
non-marketing dashboard strings (`nav.bookings`, `dash.*`, `bk.*`, `cust.*`, `an.*`,
`tip.*`, etc.) which are core-app scope and were not touched.

**Support email:** `support@7jwzat.com` → `support@sajjel.online` everywhere in marketing
copy. This is a placeholder address — Resend domain verification for `sajjel.online` is
still pending per §9/`CLAUDE.md` §5.9; the inbox itself is not yet configured. The address
now reads correctly on the site; actual mail delivery is a separate, deferred concern.

**Verified locally:** `npx tsc --noEmit` clean; dev server compiled with no errors;
homepage (AR default and EN toggle), `/privacy`, and `/terms` all render the new brand
correctly in both locales; generic "bookings" Arabic copy unchanged and reads correctly;
no console errors; no RTL/hydration flash observed.

**Not changed / flagged for follow-up:**
- `next.config.js` Sentry `org: "7jwzat"` — left alone; this is a live Sentry org slug,
  not display copy, and changing it without renaming the actual Sentry org first would
  break source-map uploads. Core-app/shared-config concern.
- No `sitemap.xml`, `robots.txt`, canonical URL, or `metadataBase` exist yet (per §9
  "SEO" gap) — none were introduced by this task.
