# Contributing to Sajjel

This document covers commit conventions, branch rules, and the mandatory deployment
verification step. These rules apply to all contributors, including Claude Code sessions.

---

## Commit Message Format

Use **Conventional Commits**:

```
type(scope): imperative summary (max 72 chars)

Optional body — explain WHAT changed and WHY (not how). Wrap at 72 chars.
Reference any relevant context, tradeoffs, or linked issues.
```

### Types

| Type | Use for |
|---|---|
| `feat` | New user-visible feature |
| `fix` | Bug fix |
| `docs` | Documentation only (CLAUDE.md, CONTRIBUTING.md, comments) |
| `refactor` | Code restructuring with no behavior change |
| `chore` | Tooling, deps, config, CI — no production code change |
| `style` | Formatting, whitespace — no logic change |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |

### Rules

- **Imperative mood:** "add feature" not "added feature" or "adds feature".
- **No period at the end of the summary line.**
- **One logical change per commit.** A DB migration and its UI changes can be one commit
  if inseparable; unrelated changes must always be split.
- **Body is required** when the change is non-trivial — explain why, not just what.

### Real examples from this repo

```
feat: optional pricing, InfoTooltip, business address on booking page

services.price is now nullable (NULL → "Price on request" everywhere).
InfoTooltip component added to all dashboard headings and field labels.
users.address textarea in Settings; shown on booking page with Maps link.
```

```
fix: replace broken sentry-test API route with client-side button

The API route threw at Next.js build-time prerendering (not runtime),
breaking the Vercel deploy. Replaced with an onClick button on /dashboard
that only throws at runtime. Adds global-error.tsx for React render errors.
```

```
feat: grouped collapsible sidebar nav with localStorage persistence

Reorganizes the flat 10-item nav into labelled groups (Calendar &
Availability, Setup, Insights). Collapse state persists per group in
localStorage. Groups auto-expand when the active route lives inside them.
```

```
chore: remove temporary Sentry test button from dashboard

Sentry confirmed working in production. Test trigger no longer needed;
all Sentry config files and global-error handler remain in place.
```

---

## Branch Rules

### All work must land on `main`

Vercel deploys **only from `main`**. A feature committed to any other branch is
effectively unshipped.

**After every session, before reporting done:**

```bash
# 1. Check current branch
git rev-parse --abbrev-ref HEAD

# 2. If not on main, merge and push
git checkout main
git merge <your-branch>   # or cherry-pick
git push origin main

# 3. Confirm commits are present on origin
git log origin/main --oneline -5
```

Do not report a task complete until you can paste `git log origin/main --oneline -5`
showing the work commit on `origin/main`.

### Why this rule exists (past failure)

Claude Code sessions run in git worktrees on session branches like
`claude/festive-lalande-e53724`. In July 2026, multiple sessions committed all their
work to these branches and never pushed to `origin`. `main` went weeks without updates;
Vercel saw none of the work. The fix required manual tracing of uncommitted changes
across several worktrees. This convention prevents that from happening again.

---

## When to Update CLAUDE.md

Update `CLAUDE.md` whenever you:
- Add or remove a Supabase table or column
- Add or rename an API route
- Add or remove an environment variable
- Change how authentication or RLS works
- Add a new major feature or architectural pattern
- Rename the product or change the deployment target

Commit CLAUDE.md updates together with the code change they document, in the same commit.

---

## Local Build Before Push

Always run a production build locally before pushing to `main`:

```bash
npm run build
```

Next.js statically prerenders all non-dynamic pages at build time. Any error thrown at
module evaluation time or during prerendering will break the Vercel deploy. A passing
local build is the minimum bar for pushing.
