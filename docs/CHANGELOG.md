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

## Expenses became its own page

- **Expenses moved off the bottom of Reports to `/admin/expenses`**, with a
  nav tab of its own. Reasoning: Reports is read once a month, but an
  expense is written down the day it is paid — and reaching the form meant
  scrolling past the headline tiles, the closing-stock table, two charts
  and a day-by-day table first. The two jobs had opposite rhythms sharing
  one screen; only one of them was at the top.
- **The new page is filtered by month, and its table follows that filter.**
  On Reports the by-category card was the chosen month while the table
  below it was the last 50 expenses regardless of month, so the two
  disagreed and the category list could not be checked by reading down the
  table. `getExpenses()` now takes optional `from`/`to` dates and the page
  passes the month on screen to both, so total, breakdown and rows always
  describe the same set. Categories are listed biggest-first — the
  question the breakdown answers is which cost dominates the month.
- **The category totals are summed in the page, not by the report RPC.**
  `get_monthly_report()` computes sales, purchases, stock and profit for
  the whole month; calling it just to get expenses grouped by category
  would be most of a monthly report's work for one small list. The page
  already has the month's rows in hand and reduces over them.
- **The form stays open on the page rather than going behind a dialog** —
  the exception to the rule in `docs/UI_CONVENTIONS.md`, and deliberately.
  A dialog is for what is set up once (an account, a tank); recording an
  expense is the reason this page is opened at all, and the four-column
  table beside it fits the `1fr` track with room to spare. Verified at
  1024/1152/1440px and 400px: no page-level sideways scroll, table
  scrolling inside its own card on a phone as usual.
- **Reports keeps the Expenses total**, since profit is computed from it,
  and the tile now carries a link through to the new page for the month on
  screen. Removing the figure entirely would have left profit with a term
  that appears nowhere on the page.
- **Expenses sits with Banking in the nav, not beside Reports** — both are
  money the owner alone sees, and both are written to as routine work.
  Reports and Settings keep the far-right `edge` group to themselves.

## Lubricants

- **A lubricant shelf was added as its own trade**, not as a third
  `fuel_type`. Petrol and diesel live in two fixed tanks and are sold
  through metered nozzles, so a day's sale is *derived* from meter
  readings; oil is a changing list of products sold one tin at a time, so
  a sale is *typed* as a sale. Reusing the fuel machinery would have meant
  inventing a nozzle per brand and editing an enum every time the owner
  switched supplier. Three tables instead: `lubricants` (the products),
  `lubricant_purchases` (restocking) and `lubricant_sales` (the counter).
- **Everything is measured in litres, packs and loose oil alike.** A pump
  that sells sealed 4 L cartons *and* 250 ml poured from an open drum is
  selling the same stock either way, and one unit is what keeps the stock
  figure honest across both. The product's `pack_size_litres` is therefore
  only a shortcut on the sale form — a button that fills the litres box —
  never a separate kind of entry. Quick amounts of 0.25 / 0.5 / 1 L sit
  beside it for the loose pours that actually happen.
- **The amount is typed and the rate per litre is generated**, the same
  swap migration 023 made for fuel deliveries. It is what lets a 4 L
  carton at Rs 4,500 and a quarter litre at Rs 400 both be recorded
  without anyone dividing by hand — and those two do not imply the same
  rate, which is exactly why the rate could not be the input. The sale
  form prefills the amount from the product's rate and then leaves it
  alone once touched: a carton is usually priced below the sum of its
  litres, and a prefill that overwrote a typed figure would be worse than
  none.
- **Credit goes on the same customer ledger as fuel.** A new
  `ledger_entries.lubricant_sale_id` mirrors `credit_sale_id` — unique, so
  a sale cannot post twice, `on delete set null` so removing a sale
  releases the reference rather than taking the debt with it. The
  append-only trigger gained the column as a third narrow exception, on
  the same terms as the other two. Deleting a sale posts the offsetting
  credit *before* the delete, in one transaction, exactly as
  `delete_reading` does.
- **`fuel_type` is left null on a lubricant debit.** The ledger's own
  check constraint allows it on a debit, and it keeps the customer
  statement's petrol/diesel breakdown describing only fuel while the
  balance still counts everything. The note on the entry carries the
  product name instead.
- **Removing a product means one of two things and the database decides.**
  Never bought and never sold: deleted, since there is nothing to
  preserve. Traded at any point: retired, because deleting it would tear a
  hole in months already reported and exported. `delete_lubricant()`
  returns which of the two happened so the screen can say so rather than
  leaving the owner guessing. The unique index on the name is partial
  (`where is_active`), so retiring a brand releases its name for a
  replacement — which is the thing the owner actually asked for.
- **Purchases became one list rather than two.** Fuel and lubricants are
  different deliveries from different suppliers, but at month end they are
  one question — what went out on stock and how much is still owed — so
  they share a table with an Item column and a colour-coded badge.
  `deletePurchase` and `setPurchasePaymentStatus` take a `kind` field to
  know which table the row came from; it defaults to fuel, so nothing that
  does not send it changed behaviour.
- **Profit now counts both trades**: `fuel sales + lubricant sales − fuel
  bought − lubricants bought − expenses`. A pump selling Rs 200,000 of oil
  a month and reporting none of it is not reporting its profit, so this is
  a correction rather than an addition. The cash-basis caveat is unchanged
  and now covers both, which is why closing stock is reported for the
  shelf as well as the tanks.
- **The charts stayed fuel-only and were relabelled to say so.** Oil is a
  rounding error next to fuel by value, so a stacked lubricant series
  would have been an invisible sliver that cost the chart its legend-free
  simplicity. The day-by-day table carries a Lubricants column instead,
  where the figure can actually be read.
- **`get_sales_trend` had to be dropped and recreated**, not replaced —
  Postgres will not change a set-returning function's output columns in
  place. Its per-day figures now come from lateral aggregates rather than
  one group-by: joining lubricant sales onto the same rows as nozzle
  readings would have multiplied each against the other.
- **The workbook gained a `Lubricants` sheet and two Daily columns.** The
  sheet was created last in `build-report-template.py`, as the file's own
  warning demands, so nothing was renumbered; the Daily columns went on
  the end, after everything the three charts point at by fixed range.
  Lubricant purchases are folded into the existing Purchases sheet so the
  workbook matches the screen. Verified by regenerating the template,
  building a workbook from sample data and reopening it: nine sheets,
  three native charts intact, `Daily!E2:E32` still the sales range.
- **`clear_day` was deliberately left alone.** It exists for the one
  mistake that cannot be unpicked row by row — a whole day of meters
  entered against the wrong date — while deliveries, expenses and now
  lubricant sales are each deleted on their own screen where you can see
  what you are removing. A counter sale is one row, so it belongs in that
  second group. `reset_all_data` *does* clear the trading, and keeps the
  product list with its stock zeroed, on the same reasoning that keeps the
  tanks.
