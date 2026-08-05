# Working in this repo

Daily management software for a petrol pump: nozzle readings, fuel purchases,
stock gain/loss, customer credit, banking, and monthly profit. Next.js (App
Router, plain JavaScript), Tailwind CSS v4, Supabase (Postgres + RLS + Auth).
One real user: the owner, and the staff he creates logins for.

Read these before making changes, in this order:

1. **`README.md`** — the business logic. Roles, the daily routine, what the
   database enforces and why, how stock is calculated, project layout,
   migrations. This is the ground truth for *what the app does*.
2. **`docs/UI_CONVENTIONS.md`** — the design system and recurring patterns
   (dialogs, tables, forms, colors, layout grids) established over many
   rounds of UI work. Follow these rather than inventing new ones; a new
   pattern should be a deliberate choice, not an accident of not knowing the
   existing one.
3. **`docs/CHANGELOG.md`** — what has been built and changed, in order, with
   the reasoning behind each change. Read this to understand *why* the
   current UI looks the way it does before changing it again — several
   things here look like they could be simplified and were already tried
   that way and reverted for a reason written down at the time.

## Ground rules specific to this project

- **The database is the source of truth for correctness.** Money and stock
  rules (balanced days, append-only ledger, no negative accounts, tank
  capacity) are enforced by Postgres triggers and RLS, not just application
  code. If the app and the database ever disagree, the database is right —
  see "What the database will not let you do" in `README.md`. Don't
  re-implement these checks in the UI as the only guard; the UI check is a
  courtesy, the database constraint is the rule.
- **Every page under `/admin` goes through `requirePageRole()`** and every
  Server Action through `requireRole()` (`app/_lib/helpers.js`,
  `app/_lib/actions.js`). Hiding a nav link is cosmetic only — never rely on
  it as the actual access control.
- **The business day is pinned to `Asia/Karachi`**, not the server's clock.
  See `app/_lib/date-helpers.js` before touching anything date-related.
- **Business name and logo are data, not code.** `app/_lib/brand.js` and
  `public/logo.png` — see `README.md`.

## Verifying UI changes

This app is read by someone on a cheap tablet, in poor light, checking
numbers against cash in a drawer. A change that looks right in the DOM but
wraps a number across two lines, or reintroduces a scrollbar at a common
laptop width, is a real regression even though nothing "broke".

- **Never trust a DOM measurement alone.** A boolean like `hasScroll: false`
  can be numerically true while a screenshot shows the fix cost you cramped,
  wrapped text somewhere else. This has happened in this repo — see the
  Purchases-table entries in `docs/CHANGELOG.md`. Always render the change
  with realistic (not lorem-ipsum-short) data and look at it.
- **Playwright is set up and the browser is pre-installed** — do not run
  `playwright install`. Launch with an explicit `executablePath`; the browser
  lives under `/opt/pw-browsers/` (the versioned folder, e.g.
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, is what actually
  resolves — check the directory rather than assuming the unversioned path). Screenshot at more than one viewport width when a
  change touches layout (at minimum a small-laptop width like 1024–1152px
  and a phone width around 400px); several bugs in this app's history only
  showed up at the narrow end.
- **A disposable `app/devcheck/page.js` route** is the established way to
  render a component or page layout with realistic fixture data for
  screenshotting, when logging in as a real user through Playwright is more
  friction than the check is worth. **Never commit this file or directory.**
  Delete it before every commit, and confirm with `git status --short` that
  it's gone before staging.
- Run `npm run build` before committing — it also runs the TypeScript check
  even though the app is plain JavaScript (JSDoc-driven checks in a few
  places), and it's the fastest way to catch a typo'd import.

## Docs stay current

If a change introduces a new recurring pattern (a new shared component, a
new layout convention, a new class in `globals.css`), add it to
`docs/UI_CONVENTIONS.md` in the same commit. If it's a notable feature or a
non-obvious fix future work should know about, add an entry to
`docs/CHANGELOG.md`. A future session reads these instead of re-deriving
context from scratch — keep them worth reading.
