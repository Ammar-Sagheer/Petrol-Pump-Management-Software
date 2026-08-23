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

## Backups and restoring (live work, August 2026)

The books can be taken out of Supabase and put back: **Settings → Backup →
Download backup** writes the whole database as one JSON file, and
`scripts/restore-backup.mjs` plus `restore_everything()` (migration 051) load
one into an empty project. `README.md` → "Backups, and restoring from one" is
the procedure; `docs/CHANGELOG.md` → "Where the restore stands" is what has and
has not been proved.

**The state of it, so you do not re-derive this:** the whole round trip is
tested against a local Postgres with all 51 migrations applied and comes back
byte-identical on every count, total, balance and stock figure. It has **not**
yet been rehearsed against a real Supabase project — the owner is doing that
from a cloned repo and a new Supabase account. If a rehearsal turns something
up, fix it in migration 051 and record it in the changelog rather than working
around it in the script.

**The offline build tracks this repo**, and its catch-up list for this round is
`docs/CHANGELOG.md` → "Porting the Treasury → Backup rounds to the offline
(Electron) build" — migrations 044–051, the new files, the shared files that
reach every page, and the two things in 044 that only Postgres provides.

Two things about the schema that make a naive reload wrong, and are the reason
the loading lives in Postgres rather than in JavaScript: a credit slip
auto-posts its own ledger entry (reload both and every customer's balance
doubles), and a freshly migrated project is **not** empty — 004/012/013 seed the
tanks and nozzles, and 045 seeds 36 real treasury movements.

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

## The shared pieces to reach for first

Most of the app's look comes from a handful of shared things. Check these
before writing a new component or a new class:

- **`StatTile` / `StatGrid`** (`_components/admin/AdminStats.js`) — the
  headline figures on nine pages. Takes an optional `spark` + `sparkTips`
  (sparkline), `delta` (percent badge) and `sub`.
- **`Sparkline`** (`_components/ui/Sparkline.js`) — decoration with a shape,
  never a figure to read. Its `tips` are formatted by the CALLER, on the
  server.
- **`DeltaBadge`** (`_components/ui/DeltaBadge.js`) — arrow is direction,
  colour is whether it is good news. Pass `higherIsBetter: false` where a rise
  is bad.
- **`.card`, `.fuel-band`, `.unit-card`** in `globals.css`.
- **`fuel-colors.js`** owns every fuel hue, including `tint` (background only)
  and `solid` (the band the Stock page and the Readings unit header share).

**`StatTile` and `.card` are the app-wide blast radius** — a change to either
lands on nearly every page, so render more than the page you are working on.

## Docs stay current

If a change introduces a new recurring pattern (a new shared component, a
new layout convention, a new class in `globals.css`), add it to
`docs/UI_CONVENTIONS.md` in the same commit. If it's a notable feature or a
non-obvious fix future work should know about, add an entry to
`docs/CHANGELOG.md`. A future session reads these instead of re-deriving
context from scratch — keep them worth reading.

## The skill in this repo

`.claude/skills/small-business-ledger-app/` is a project-scoped skill and
loads automatically for work on this app. It holds the parts that are about
*how to work on a money app* rather than about this app specifically:
investigating live data before changing it, testing a trigger without writing
a row, the design language, and the type and colour floors for the person
reading a figure off a tablet.

Two things it does that this file does not:

- **It asks who the app is for before designing anything** (`SKILL.md` §0).
  The disciplines are constant; the type scale and density are not, and the
  answer for a 60-year-old is not the answer for a 25-year-old.
- **`references/ui-patterns.md` is the design language with its reasoning** —
  the shorter, rule-shaped companion to `docs/UI_CONVENTIONS.md`, which
  records what happened in *this* codebase.

Keep them in step. A new convention goes in `docs/UI_CONVENTIONS.md` with the
story; if it is general enough to apply to the next ledger app, it goes in the
skill as a rule too.
