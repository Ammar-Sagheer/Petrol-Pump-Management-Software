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

## Date navigation, rates and deliveries

- **The date box navigates on pick; the Go button is gone.** Choosing a date
  IS the instruction - having to press something else afterwards was a step
  people forgot. Lives in `DateJump.js` because it needs to be a Client
  Component; the rest of `DateNav` stays on the server. Two details worth
  keeping: a native date box fires `change` while the year is still being
  typed (0006-08-06 on the way to 2026-08-06), so only a complete, plausible
  date navigates; and clicking anywhere on the box opens the calendar via
  `showPicker()`, rather than only the small icon at its right edge.
- **Per-litre rates show their paisa.** `formatPKR` rounds to whole rupees,
  which turned a Rs 339.48 pump price into "Rs 339" on Settings, Purchases
  and the readings rows. `formatRate` in the new `app/_lib/format-helpers.js`
  handles anything per-litre - see `docs/UI_CONVENTIONS.md`.
- **A fuel rate can be removed.** A fuel and a date carry one rate, enforced
  by a unique constraint, so a mistyped rate could not be corrected by saving
  again over the top - the wrong price simply stood for the whole day. Note
  what removing one does NOT do: readings already saved keep the rate they
  were sold at (a copy lives on the reading row), so those days still have to
  be cleared and re-entered. The confirmation says so.
- **Nozzle wiring saves once, not six times.** Describing how the pump is
  plumbed is one job done once in its life, so the dialog now has one Save
  rather than a button per row. One button also means one write:
  `set_nozzle_wiring()` (migration 022) does all six in a single UPDATE,
  because six separate statements can fail after the third and leave half the
  nozzles pointing at the new tanks and half at the old - and `tank_id`
  decides which tank a sale draws down.
- **A delivery is recorded by its invoice total, not its rate per litre**
  (migration 023). The delivery note states litres and an amount payable;
  that amount is what leaves the bank and what profit is computed from, so it
  is the fact and the rate is arithmetic on it. `total_cost` and `rate` swapped
  roles in the schema - `total_cost` is now stored and `rate` generated from
  it. The old way could not represent an invoice exactly: `rate` was
  `numeric(10,2)`, so on a 20,000 litre load every storable total was a
  multiple of Rs 200, and an invoice of Rs 4,800,010 was silently kept as
  Rs 4,800,000. Existing rows converted exactly, since `total_cost` already
  held `round(litres x rate, 2)`.
  - The derived rate keeps 4 decimals in the database but is displayed to 2,
    so a table row can read 20,000 L at Rs 240.00 totalling Rs 4,800,010 -
    which does not multiply out. The total is the recorded figure; the rate is
    labelled as derived.
