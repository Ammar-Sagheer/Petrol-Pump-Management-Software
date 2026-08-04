# Changelog

A narrative history of what has been built and why, for a new session to
read instead of re-deriving context from the diff alone. Entries are
grouped by theme and roughly chronological within each group. Full detail
for any of these lives in the actual commit messages (`git log`) — this is
the summary, not a replacement for them.

For the underlying business rules (roles, what the database enforces, how
stock is calculated) see `README.md`. For the reusable patterns these
entries establish (dialogs, table layout, buttons) see
`docs/UI_CONVENTIONS.md`.

## Foundation

- Next.js App Router app scaffolded: auth flow (Supabase, no public
  signup — accounts are created by the owner or by hand once), the daily
  reading entry screen, then purchases, stock checks, the customer ledger,
  dashboard, reports and settings.
- Postgres schema, RLS policies and reporting RPCs — see `README.md` →
  "Database migrations" and "What the database will not let you do" for
  the enforced rules (balanced days, append-only ledger, no meter running
  backwards, tank stock recalculated from history rather than
  incremented).
- The business day pinned to `Asia/Karachi` regardless of server clock —
  the app and the database were fixed to agree on "today" independently,
  since a Vercel server in UTC and a browser in Pakistan disagree between
  midnight and 5am otherwise.
- Early correctness fixes: readings form not submitting its closing value,
  payment status displaying a value the database never actually saved,
  a nested-aggregate bug in the Excel export RPC.
- Monthly Excel export added, with native charts, built from
  `scripts/build-report-template.py` (openpyxl). **Sheets must be created
  last** in that script — the app addresses them by file name
  (`sheet1.xml`, …) and openpyxl numbers them in creation order, so
  inserting one anywhere but the end silently renumbers everything after
  it.

## Banking

- Bank accounts, deposits and payments added: each account tracks a
  running balance from an owner-entered opening balance.
- **No account may go below zero** — enforced by a database trigger, per
  account, not across the total.
- **A payment larger than one account can be split across several** —
  the owner ticks which accounts cover the rest, drawn down in the order
  ticked. Written as one Postgres RPC (`record_bank_payment()`) rather
  than a loop of inserts in the app, because several rows that are really
  one payment must land together or not at all, and only the database can
  promise that. The split shown while typing is computed client-side only
  to preview it — the real allocation is computed by the RPC from live
  balances, never trusted from what the browser posted.
- Bank transaction confirmation moved from a message left sitting in the
  form to a `<Toast>` — a success message is only worth reading once, and
  one left in the form is still there, describing something unrelated,
  by the time the next transaction is typed.
- "Add a bank account" moved from a form permanently open on the page into
  a `<Dialog>` — the first use of what became the dialog-form pattern
  documented in `docs/UI_CONVENTIONS.md`. Reasoning: an account is added
  twice, ever; a transaction is recorded every week. The permanent
  four-field form for the rare job was crowding out the frequent one.
- 60-transaction-per-account retention: older rows are pruned
  automatically, but the **balance is never wrong** — each pruned amount
  folds into `pruned_deposits` / `pruned_payments` on the account before
  the row goes. What's lost is itemised history; the monthly Excel export
  is the durable backup for that detail, not a convenience copy.

## Branding

- Business name and logo made data-driven: `BUSINESS_NAME` in
  `app/_lib/brand.js`, logo at `public/logo.png` (falls back to an
  initials tile if absent). Renamed to "Mubeen Petroleum Service".
- Browser tab icon (favicon) generated from the logo through several
  iterations: first attempts left it unreadable at 16px or cropped on a
  non-square canvas; settled on isolating just the flower mark (the full
  lockup doesn't read at favicon size), squaring the canvas, and packing a
  real multi-size `.ico` rather than a single PNG masquerading as one.

## Settings, Account and navigation restructuring

A connected sequence of changes reorganizing where things live, driven by
"how often is this looked at vs. how often is it acted on":

1. **Nozzle wiring and staff-login creation moved behind dialogs** on the
   Settings page, same reasoning as the bank account dialog: both are
   forms for a job done once when the pump is set up and almost never
   again, and were sitting open on the page as if they were daily work.
   The nozzle dialog uses `<Dialog size="lg">` (a new prop added for this)
   since its six-row table needs more than the default 32rem.
2. **Staff logins moved from Settings to the Account page** — Settings is
   prices and hardware; Account is where an owner already looks at their
   own login, and reads everyone else's in the same glance far more often
   than as a separate tab click away. Owner-only, same as before.
3. **Account itself moved out of the tab row**, next to Sign out instead —
   it was never a working section the way Readings/Purchases/etc. are;
   nobody finishes a nozzle reading and reaches for Account next. Grouped
   with Sign out under "about you" rather than "a section of the app".
4. **Change password collapsed behind a click** on the Account page
   (closed by default, CSS grid-rows `0fr → 1fr` animation, no
   ResizeObserver needed) — three password boxes standing open by default
   read as an unfinished task rather than an available option. Stays open
   after a successful change so the confirmation is readable.
5. **Nav tabs split into two visually separated groups** — the six worked
   in all day (Dashboard–Banking) left-packed with breathing room, Reports
   and Settings (checked occasionally) pinned to the far right via
   `ml-auto`. An intermediate version made every tab share the row equally
   before landing on this grouped layout. Below `lg` there's no spare
   width for any of this and it falls back to natural left-to-right order.
6. **Account page gained a two-column layout at `lg`+**
   (`grid-cols-[22rem_1fr]`, the same split Settings' fuel-price section
   uses) so Staff logins fills the space beside the owner's own account
   card instead of sitting empty below it. Single column on narrower
   screens, same order as before (own account, then Staff logins).

## Purchases page

- **Table width vs. form width conflict.** The Purchases table has seven
  columns (adds a delete action for the owner) and needs close to 850px to
  render without cramping, more than any other table in the app — but it
  shared a `22rem_1fr` grid with the delivery form, leaving only ~740px
  and forcing an internal horizontal scrollbar.
  - First fix attempted: shrink padding and column minimums to force the
    table into the available space. **Rejected after a screenshot** (not
    just a `hasScroll` measurement) showed the Supplier column wrapping a
    real name across three lines — the scrollbar symptom went away, but a
    worse regression replaced it. This is the canonical example, referenced
    in `docs/UI_CONVENTIONS.md`, of why a layout fix must be verified with
    a screenshot and realistic data, not a boolean alone.
  - Second attempt: a `position:relative; left:50%; transform` "breakout"
    to widen just this page past the shared `max-w-6xl` cap. Worked above
    ~1280px viewport width, but leaked a page-level horizontal scrollbar at
    common laptop widths (1024–1152px) — abandoned as too fragile.
  - Landed fix: stack the form above the table (later: behind a dialog —
    see below) instead of beside it, so the table gets the page's full
    ~1120px width with room to spare. Verified with Playwright screenshots
    from 1024px to 1920px: no internal scrollbar, no page-level overflow,
    no cramped text.
- **"Record a delivery" moved into a `<Dialog>`**, following
  `docs/UI_CONVENTIONS.md`'s dialog pattern exactly (same close-on-success
  effect and Toast as `BankAccountForm`). The intermediate "form stacked
  above the table" state left its own `max-w-md` column mostly empty
  whitespace once the table below filled the page — putting the form
  behind a button in the page header, like every other rarely-used setup
  form in this app, uses that space properly instead of just relocating
  the emptiness.
- **Sign out button** given `.btn-danger` styling (red, matching the
  Account button's size) to read as a distinct, deliberate action rather
  than blending in with neighbouring buttons.
