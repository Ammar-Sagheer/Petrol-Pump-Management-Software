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

## Where things stand

A short orientation, so a new session does not have to read the whole file to
know what the app is today. Everything below this section is the narrative, in
theme order; the last block of work is at the bottom.

**The shape of it.** Next.js App Router (plain JavaScript) on Vercel in
`sin1`, Supabase Postgres in `ap-southeast-1`. One owner, a couple of staff
logins, one pump. Migrations run to **051**.

**What was added most recently**, newest last, all of it detailed further down:

| Area             | What changed                                                                                                                                                                                                                                                                                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loose oil        | A drum bought from a supplier and sold by the rupee, not the litre. Its own page under Lubricants, litres derived server-side from a rate, sale litres widened to 3 dp. Migrations 028–030.                                                                                                                                                                             |
| Tables that grow | `<Pager>` on Purchases, Banking, Stock checks, the customer ledger and both sales tables — and the removal of `.limit()` caps that were silently truncating a money total.                                                                                                                                                                                              |
| Dashboard        | An oil-sales chart beside the fuel ones (`get_lubricant_trend`, 029).                                                                                                                                                                                                                                                                                                   |
| Customers        | Removing one (delete if never traded, retire if it did), deleting one for good, an opening balance created with the account, and editable details. Migrations 031, 033, 034.                                                                                                                                                                                            |
| Money precision  | The ledger moved to **whole rupees**, storage as well as display — there is no coin below one rupee. Migration 032.                                                                                                                                                                                                                                                     |
| Speed            | Functions moved to Singapore beside the database; the Guide is prefetched.                                                                                                                                                                                                                                                                                              |
| Feedback         | Every destructive submit shows a pending state; delete triggers are a trash icon.                                                                                                                                                                                                                                                                                       |
| Guide            | Location chips, bold rule titles and a folded setup section — a fifth shorter than before, and scannable.                                                                                                                                                                                                                                                               |
| Settings         | The rate panel previews five changes (rounded up to a whole date) instead of seven days, so it no longer scrolls inside itself.                                                                                                                                                                                                                                         |
| Dashboard        | The charts take a 7 / 14 / 30 / 90-day window (`<TrendRange>`), carried through the day arrows by `<DateNav extraParams>`.                                                                                                                                                                                                                                              |
| Dashboard        | The fuel-sales chart toggles Rupees / Litres, split by fuel, so it no longer duplicates the cash-vs-credit chart beside it.                                                                                                                                                                                                                                             |
| All fuel rates   | Eight rows a page instead of 25, and the 70vh height cap dropped, so nothing scrolls inside the card.                                                                                                                                                                                                                                                                   |
| Activity         | An audit trail: a trigger on sixteen tables writes who changed what into an append-only `activity_log`, read at `/admin/activity` by the owner. Migration 035.                                                                                                                                                                                                          |
| Lubricants       | Packed and loose sales merged into one filtered table (the drum's route is now a redirect), the day's totals split and labelled, low-stock badges, and the Urdu register words بنام / جمع on the balance cards.                                                                                                                                                         |
| Company Assets   | A new owner-only page for what the pump has bought and kept — vehicles, machinery, property, electronics. Card grid, icon-tile category picker, figures from a summary RPC. Migration 036.                                                                                                                                                                              |
| Readings         | A warning naming the missing day, and a checkbox that must be ticked to save a reading when the day before it was never entered. A day-completion strip was tried three ways alongside it and removed — migrations 037 and 038 add and then drop its RPC.                                                                                                               |
| Stock            | **A dip taken in the morning closes yesterday.** The maths assumed the opposite and reported a whole day's sales as a loss, every day. `taken` + generated `books_date`; `expected_stock` recalculated from history rather than frozen at insert; the dashboard's tank card stopped ignoring the date on screen; and the owner can clear a mistyped dip. Migration 039. |
| Treasury         | **The cash in the safe on site** — the owner's "Tajori" sheet, owner-only, seeded with his real 36 movements. A page is a DAY, not 25 rows, addressed by date and skipping days with nothing on them. The safe may never hold less than nothing, judged over the whole chain. Migrations 044–048. |
| Profit           | **It was counting stock BOUGHT, not stock SOLD.** August 2026 showed a Rs 1,464,581 loss for a month that made Rs 566,307, because 10,000 L of petrol arrived six days before month end. Now `sales − cost of goods sold − expenses`, with stock valued at the cost of the deliveries it is made of. One function, all three reporting RPCs. Migration 049. |
| Activity         | The owner may clear the OLD end of the log — whole retention periods only, cutoff computed in Postgres, recent month never touched, the trim logged into the log it trimmed. Append-only intact: no line editable, no single line removable. Migration 050. And the open section in the sidebar now ends with a dark bar, because the tint alone washes out in daylight. |
| Backups          | **The books can now leave Supabase and come back.** Reports → Download backup writes the whole book as one JSON file; `scripts/restore-backup.mjs` loads it into a fresh project with the triggers off, remapping each entry's author onto the new logins, then recomputes counts and money totals and compares them against the file. Migration 051. |

**If you are porting this to Electron or another shell**, read
`README.md` → "If you are porting this off Supabase" first. The short version:
almost none of the important logic is in the JavaScript. Fifty-one
migrations of triggers and constraints hold the money rules, and the hardest
single thing to reproduce is the activity log (035) — one PL/pgSQL trigger on
eighteen tables that diffs `jsonb` and writes an English sentence. Decide
early whether a single-user offline build needs it at all.

**Six things that are load-bearing and easy to break:**

1. **The database enforces the money rules, not the app.** Balanced days,
   append-only ledger, no overlapping meter readings, stock recalculated from
   history. `README.md` → "What the database will not let you do" is the list.
   **Anything derived is recalculated, never written once** — tank stock and,
   since 039, a dip's `expected_stock`. A figure stored at insert and never
   revisited will be wrong the moment anything behind it is back-dated, and
   nothing on screen will say so.
2. **Whole rupees on the ledger, two decimals on the meter.** Different
   rounding for different reasons, and three places must agree — see
   `docs/UI_CONVENTIONS.md`.
3. **A dip is a moment, not a day.** It is checked against `books_date` —
   the trading day it _closes_ — not the day it was taken. This pump dips in
   the morning, so those differ by one. See `README.md` → "A dip belongs to the
   day it closes".
4. **The business day is `Asia/Karachi`**, never the server clock. The activity
   log is the one place a _time of day_ is shown, and it is pinned the same way
   — rendered on a UTC server without pinning, an evening entry prints as an
   afternoon one.
5. **`activity_log` is written only by trigger and can never be edited.** If a
   future change adds a table that holds money, attach the trigger to it in the
   same migration; if one is renamed, the log line degrades rather than
   breaking, so nothing will tell you.
6. **Profit subtracts the cost of stock SOLD, never stock BOUGHT** — since 049.
   `cost_of_goods_sold()` is the only place that arithmetic lives and all three
   reporting RPCs call it. Reimplementing `sales − purchases − expenses`
   anywhere reintroduces a bug that showed a Rs 1.46m loss in a profitable
   month, and it reads perfectly reasonable while doing it. Anything that
   derives a per-day or per-week profit has to spread the cost of goods sold,
   not the purchases.

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
  through metered nozzles, so a day's sale is _derived_ from meter
  readings; oil is a changing list of products sold one tin at a time, so
  a sale is _typed_ as a sale. Reusing the fuel machinery would have meant
  inventing a nozzle per brand and editing an enum every time the owner
  switched supplier. Three tables instead: `lubricants` (the products),
  `lubricant_purchases` (restocking) and `lubricant_sales` (the counter).
- **Everything is measured in litres, packs and loose oil alike.** A pump
  that sells sealed 4 L cartons _and_ 250 ml poured from an open drum is
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
  credit _before_ the delete, in one transaction, exactly as
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
  second group. `reset_all_data` _does_ clear the trading, and keeps the
  product list with its stock zeroed, on the same reasoning that keeps the
  tanks.

### Lubricants: two layout fixes after first use

- **The Lubricants header jumped a row when the date changed.** Its
  `<DateNav>` carried both page actions as children, and "Back to today"
  only renders when the date is not today — so today fit on one line with
  the title and yesterday wrapped underneath it. Stepping back a day moved
  every control. The date controls and the actions now share a row of their
  own below the header, which cannot wrap against the title at all.
  Screenshotted at 1440/1152/1024 and 400px on both today and an older
  date: identical placement in every pair, no page-level sideways scroll.
- **A lubricant's name sat under its badge in the Purchases table**, which
  made those rows taller than the fuel rows around them and left the brand
  looking secondary — when the brand is the whole content of that cell for
  a lubricant. Badge and name are inline now, with a `min-w-[13rem]` on the
  cell so an ordinary name ("Carient 20W-50") stays on one line at 1024px.
  A very long name still wraps, deliberately: forcing it onto one line
  would put a horizontal scrollbar on the table at laptop widths, which is
  the worse trade and one this repo has already made once.
- **Readings got the same header treatment**, on the same reasoning rather
  than because it had visibly broken: it carries "Clear this day" beside
  the same conditional "Back to today", so it was one wide button or one
  narrow screen away from the identical jump. It is also the screen worked
  through every evening, which makes it the last place a control should
  move between one day and the next. Checked as owner and as staff, on
  today and an older date, at 1440/1152/1024 and 400px.

### A readability pass, for an owner moving off a spreadsheet

The app was built text-first and measured badly for the person who actually
uses it — an owner in his fifties reading a tablet in a pump office. Measured
before the change, on the Readings screen: nozzle figures 14px, their
captions **10.4px** uppercase grey at 4.76:1, table cells 14px, nav 14px —
while the page heading that tells the reader nothing was 24px. The data was
smaller than the chrome around it.

What changed:

- **Type scale**, mostly through `globals.css` so it stays fixable in one
  place: body and table cells to 16px, nozzle figures to 18px, stat values to
  24px, captions to a 12px floor, buttons and tabs to `py-3` (~48px targets).
- **`figure-label` / `figure-value`** — the caption-over-figure pairing that
  had been hand-rolled at 25 sites and had drifted to 10.4px in the worst of
  them, now one class each.
- **Contrast floor of `ink-600`** for anything meant to be read; `ink-400`
  (2.6:1) is now only disabled and placeholder text. 57 secondary captions
  and 10 "(optional)" hints moved up.
- **Icons** (`ui/Icon.js`), drawn inline rather than added as a dependency —
  on every nav tab, and on the Entered/Enter status, which had been two words
  two letters apart distinguished mainly by amber vs green.
- **The written date is now the loudest thing in `DateNav`.** A native date
  box is drawn in the _browser's_ locale, so on an en-US browser the 7th of
  August renders "08/07/2026" — the 8th of July to anyone reading day-first.
  Markup cannot change that, so the box was demoted to a jump control and the
  spelled-out date carries which day is on screen.

Two things this pass broke and then fixed, both worth knowing about:

- **The nav no longer fits on one line and now wraps.** Icons plus 16px
  labels need 1347px against a 1152px container, so Reports and Settings sat
  off the right edge on every laptop. The `lg:ml-auto` pinning that used to
  hold those two apart had to go with it: inside a wrapping row it threw them
  onto a line of their own, making the header three rows at 1024px. They are
  still last in reading order. Below `sm` the row still scrolls rather than
  wrapping — ten tabs stacked four deep would push the day's work off screen
  — and now has a measured fade on whichever edge still has tabs behind it.
- **"Rs 336.34 / litre" started truncating** in a nozzle row on a phone at
  the larger size. Fixed by moving "/ litre" into the caption rather than by
  shrinking the figure back down. Same story on the dashboard tiles, where
  "Rs 4,386,211" was breaking after the "Rs": those are `whitespace-nowrap`
  now, and the grid drops to one column below 380px so the number has room..

Checked by rendering a full six-nozzle sheet with realistic figures at 1440,
1152, 1024, 820, 400, 360 and 320px, scripted to report any element whose
text is clipped by its own box: nothing is, at any width, apart from the
`sr-only` "Actions" heading and the navbar's business name, both of which
truncate by design.

### Navigation moved to a sidebar, and the dashboard tidied

The top tab row had become the weakest part of the app: ten sections that,
once they carried icons and readable labels, needed about 1350px against a
1152px page. It had already been forced to wrap onto two rows, which ate the
top of every screen and still looked like a compromise.

- **`AdminSidebar` replaces `AdminNavbar`.** A fixed 240px column from `lg`
  up; below that a burger opening a drawer. All ten sections are visible at
  once either way, each with a full-width band to hit rather than a word.
  Account and Sign out sit at the bottom, apart from the sections.
- **The drawer is a native `<dialog>` opened with `showModal()`** — focus
  trapping, Escape and an inert page behind it come from the browser. It
  closes when the pathname changes rather than on the click, so it does not
  pull away while the next page is still loading.
- **The dashboard** picked up what the readability pass had missed: section
  headings and card titles were still `text-sm`, the three-up figure blocks
  inside the fuel, tank and lubricant cards were still 12px with `ink-500`
  captions. Those now use `figure-label` like everywhere else. Its date
  controls also moved to their own row, as on Readings, Lubricants and Stock.

Two consequences worth knowing about:

- **The Purchases table now scrolls inside its card at 1024px.** 240px of
  sidebar is 240px the content does not have, and that table needs 896px for
  its eight columns. It scrolls in the card rather than moving the page, and
  it already behaved this way on anything narrower. That is the trade for a
  nav that is always visible.
- **Viewport breakpoints stopped meaning content width.** At a 1024px window
  a page now has ~768px, so `lg:grid-cols-4` on the stat tiles gave each one
  192px and the big figures ran into their dividers. `StatGrid` measures
  itself with `@container` instead. While fixing it, the three hand-rolled
  copies of that strip (Readings, Lubricants, Customers) were replaced with
  the shared component — all three had the same latent bug.

The pump's own name was also being truncated to "Mubeen Petr..." in the
240px column. In the sidebar the logo, name and person now stack, each with
the full width; the phone's top bar keeps the inline, truncating layout,
where wrapping would push the day's work further down.

### Fuel rates: seven days on Settings, the rest on their own page

The rate moves most days and both fuels change together, so that table grew
by about sixty rows a month. Left unbounded it had become the tallest thing
on Settings and the part of the page nobody read.

- Settings shows the last **seven days** of changes and links to the rest.
  Counted in days rather than rows on purpose: a row limit cuts a day in
  half and shows diesel's new rate without petrol's, and the two are read as
  a pair.
- `/admin/settings/fuel-prices` is the full history, 25 to a page, newest
  first. The page number is a query string so Back works through it and a
  page can be linked to. Paged rather than capped, because an old rate is
  what a disputed reading gets checked against — there is no date past which
  it stops mattering.
- The table itself moved into `FuelPriceTable` and is shared by both. Its
  rows carry a delete confirmation that names the rate and the date, and
  that sentence drifting between two copies is how someone removes a rate
  they meant to keep.

### getSessionProfile is deduped per request

Every admin navigation was paying for the session lookup twice — the layout
asks who is signed in to draw the sidebar, then the page asks again through
`requirePageRole()`. Each ask is a claims check plus a select on `profiles`,
so two round trips to Supabase completed before a page began fetching what it
actually wanted to show. It is wrapped in React's `cache()` now, so the second
caller gets the first one's answer.

Worth being precise about what this is **not**: it is a per-request memo, not
a cache across requests, and it cannot serve a stale answer. A new request
does the lookup again — which is what keeps a deactivated staff account
locked out on their very next navigation.

### The middleware stopped calling Supabase on every request

`proxy.js` ran `supabase.auth.getClaims()` on every request the app served.
Measured with a mocked fetch against a valid, unexpired session cookie:

    getSession()  -> signed in: true | network calls: 0
    getClaims()   -> sub: 1111...  | network calls: 1  (/auth/v1/user)

So every navigation, and every prefetch, waited on a Supabase round trip
before Next.js began rendering. Both key types pay it, for different reasons:
on the legacy shared JWT secret the middleware cannot check an HS256
signature itself and auth-js falls back to `/auth/v1/user`; on asymmetric
signing keys it verifies locally but needs the JWKS, and that cache lives on
the client _instance_ — middleware builds a fresh client per request, so it
refetches `/.well-known/jwks.json` instead.

It uses `getSession()` now, which reads the cookie and only talks to Supabase
when the token is inside the refresh margin. Verified that the refresh — the
middleware's other job, and the reason Server Components can rely on the
cookie being current — still happens:

    token valid for another hour:  network: none        cookies rewritten: false
    token 10s from expiry:         network: /auth/v1/token  cookies rewritten: true

**Why dropping verification here is safe.** This gate decides one thing:
whether to redirect to the login page. It is not what protects the data and
never was. A forged cookie that gets past it reaches a page calling
`requirePageRole()`, which uses `getClaims()` and does verify, and behind that
every query runs under RLS. The worst it buys is being redirected to login a
moment later. Note the code reads `data.session` and never `session.user` —
auth-js wraps that user object in a proxy that warns on property access,
precisely because it comes from an unverified token.

Together with the `cache()` on `getSessionProfile`, an admin navigation went
from four Supabase round trips before its own data (middleware verify, then
the layout's claims + profile, then the page's claims + profile) to one
claims verification and one profile read.

### Daily sales got its own paged page, and section headings got their spacing back

- **`/admin/reports/daily`** shows every day the pump has traded, newest
  first, 25 days to a page. Reports keeps the same table collapsed under
  "Show these days as a table" for the month on screen and links across.
  The table moved into `DailySalesTable` so the two cannot drift apart.
- **Paged by date window, not by row.** `get_sales_trend` fills in every day
  between two bounds, including days with no trade, so a page is 25 _days_:
  page 1 is the last 25, page 2 the 25 before that. There is no row count to
  fetch — the page count falls out of the distance between the first trading
  day and today, which is what `getFirstTradingDay()` is for. Days with
  nothing entered show as zero rather than being skipped, so a gap in the
  book is visible instead of silently closing up.
- **`.section-heading`** replaces the hand-written heading classes. They had
  drifted: nineteen of them, nine with a top margin and ten without, so
  "Previous checks" on the Stock page sat flush against the card above it.
  `first:mt-0` in the class covers the headings that open a column or a
  section, which genuinely want no gap — so one class is correct in both
  places and cannot drift again.

### A Guide section, in English and Urdu

New nav entry and route (`/admin/guide`), open to **staff as well as the
owner** — the person most likely to need it is a new attendant on their first
evening, not the man who commissioned the app. It does not hide the
owner-only sections either; it labels them, because knowing Reports exists
and is not yours to open beats not knowing.

It is written for someone who has run this pump on paper for years and has
never opened the app: what to do, in the order you do it, naming the real
buttons. Contents: the whole app as three stages (set up once → enter the day
every evening → read the report monthly), the one-time setup in dependency
order, the evening routine as six numbered steps, a card per section saying
when you would open it, the rules the database enforces and what a refused
save means, how to fix a day entered against the wrong date, and who can see
what.

- **Both languages come from one source.** `_lib/guide-content.js` holds the
  text against the same keys in `en` and `ur`; the page renders that shape
  once. Two hand-written pages would drift the first time one was corrected.
- **The language is a query string** (`?lang=ur`), like the month filters —
  so the Urdu guide is a link that can be sent to someone and opens in Urdu.
- **The diagrams are boxes and borders, not images**: sharp at any size, they
  re-flow on a phone, the text stays real text, and the same markup renders
  right-to-left without being redrawn. `GuideFlow.js` documents the rule that
  makes that work — nothing inside may hard-code a left or a right.

Checked both languages at 1152 and 400px: `dir` flips, the stage arrows point
the other way, the step numbers move to the right-hand side, and neither
language overflows the page.

### "Check" was showing on every nozzle of every past day

The red Check badge on a nozzle row was driven by:

    Boolean(row.later_date) || openingDoesNotMatchPreviousClosing

`later_date` only means "a reading exists on some later date", which is true
of every nozzle on every past day the moment entry continues. So opening any
earlier date painted Check on all six rows at once — and a warning that is
always on is a warning nobody reads, including on the row where it mattered.

Checked against the real 04 Aug 2026 sheet: all six nozzles flagged, and the
data was clean — every opening equalled the previous closing, and every
05 Aug opening equalled the 04 Aug closing. Except one: Unit 2 · Nozzle B has
no reading on 04 Aug, and 05 Aug opens at 18,967.53 where 03 Aug closed at
18,882.18. Entering 04 Aug there really would double-count.

A meter is continuous, so the chain is intact when each reading opens exactly
where the one before it closed. The badge now means one of three things:

1. this day's opening is not the previous day's closing;
2. this day is saved but the next reading does not open where this one closed
   — the two overlap or leave a hole;
3. this day is not saved and a later reading already exists, so saving here
   back-fills underneath it.

A later reading that opens exactly where this day closes is the chain
working, which is the case that used to shout. Re-run over the same six rows:
one flagged instead of six, and it is Unit 2 · Nozzle B.

The same false positive was in the dialog's `ReadingChainWarning`, which told
you "a reading already exists for 05 Aug" on days where 05 Aug continued from
this one perfectly. Narrowed the same way.

### Overlapping readings are now refused, not warned about

On 07 Aug 2026 a day's six readings were entered at 13:15 dated the 7th, and
the same meter figures were entered again at 17:35 dated the 6th. Nothing
removed the first set, so one movement of the meters became two days:

    06 Aug   1,677.82 L   Rs 577,260   entered 07 Aug 17:35-17:39
    07 Aug   1,677.78 L   Rs 577,245   entered 07 Aug 13:15-13:17

The dialog did warn at the time — "the reading already saved for 07 Aug opens
at the same place this day starts, so it already includes these litres" — and
the warning was correct. It was also ignorable, and it was sitting under six
red Check badges that were firing on every row of every past day.

Migration 026 makes it a rule in the database. Two readings for one nozzle
overlap when the later one starts before the earlier one finishes, and that
is now refused with a message naming the other date, the two figures and how
many litres would be duplicated — the message is the instruction, since
`describe()` passes database errors straight to the user.

**A gap is still allowed.** A later reading starting _after_ an earlier one
finished means litres are missing, not duplicated — a skipped day or a
replaced meter — and blocking it would trap someone with no way forward.
Those stay warnings, as they were. Only overlap, which cannot be honest, is
refused.

`ReadingForm` also disables Save and explains the clash while the closing
reading is still on screen. That is the courtesy layer; the trigger is the
rule.

Checked against live data before applying: exactly the six 06/07 Aug pairs
overlap and nothing else in the history does. The trigger was then exercised
against the real 06 Aug row inside a block that deliberately aborts, so the
attempt rolled back — it returned the intended message and no row changed.

### Meter decimals, and a warning that knows which day it is on

Two small things spotted in the entry dialog on the duplicated 06 Aug day.

- **`1,987,128.8` beside `1,987,279.95`.** The opening had dropped its
  trailing zero, so two figures that describe the same dial rendered at
  different widths in a tabular font. Meter readings now use a `meterFormat`
  fixed at two decimals; litres sold keep the ordinary format, being
  quantities rather than dial positions.
- **The overlap warning was written for a day not yet entered** — "saving
  here will count them twice" — and was showing on a day already saved, where
  there is nothing to save and the double count has already happened. It
  reads as a prediction about a button that is not on screen. A saved day now
  gets the true statement instead: "this day and 07 Aug 2026 both cover the
  same 151.15 litres … one of the two has to be cleared: whichever date the
  meter was not read on." The unentered wording also now says the save _will
  be refused_, which since migration 026 it will be.

A third case fell out of separating the two: a saved day whose next reading
starts _above_ where it closed is a gap, not an overlap, and now says so —
"05 Aug 2026 opens at 18,967.53 but this day closes at 18,900.00 … 67.53
litres are on neither day."

### The selected day is now unmissable, and back-filling under a skipped day is refused

**The day banner.** The owner lost track of which date he was entering, which
is how a day's readings ended up on 07 Aug instead of 06 Aug. The date had
been said three times on the same screen in three different formats — the
page description, the browser-drawn date box, and a small grey caption — none
of them dominant. `DateNav` now opens with one tinted banner above the
controls: the relative label, the weekday and the written date. The weekday
is the part that matters; it is checkable against the day someone has
actually lived, where a row of digits is not. Grey for a past day, amber for
a future one, green for today, and "Past day" now appears where previously an
ordinary past date carried no label at all. The descriptions on Readings,
Lubricants, Stock and the Dashboard no longer repeat the date.

**Migration 027.** Migration 026 refused readings that overlap the next one,
but left a gap: when the next reading opens exactly where this day starts,
the only figure 026 still accepted was the opening itself — a nought-litre
day. That is a lie rather than a duplicate: it records "nothing sold" for a
day that traded, with the litres sitting on the later date, and nothing flags
it afterwards. Now refused outright.

It is deliberately _not_ a ban on back-filling, because the honest repair
looks almost identical and is needed — Unit 2 · Nozzle B had no 04 Aug
reading and 05 Aug opened 85.35 L above where 03 Aug closed. The test is
whether the later reading **left room**:

    room = next reading's opening − this reading's opening
    room > 0    a genuine gap; this day may be entered, up to that figure
    room <= 0   the next day already covers this one; nothing to record

Both paths were exercised against the live database inside blocks that
deliberately abort, so both rolled back:

    back-fill under a skipped-ahead day  >> BLOCKED, naming the day to clear
    back-fill into a genuine 85.35 L gap >> ALLOWED, as it must be

### The nozzle rows had no room to breathe

Six cards at `space-y-2` with `px-4 py-3` padding and the figures only 8px
under the nozzle's name — the whole evening screen read as one dense block,
and the name of the nozzle ran into the numbers belonging to it.

- Gap between cards 8px → 12px, so each one is visibly its own thing.
- Card padding to `py-4` on a phone and `p-5` from `sm` up.
- The figures now sit under a hairline with 12px either side of it, the same
  separation the dashboard cards use. A row carries two different kinds of
  thing — which nozzle this is, and what it did — and they were running
  together.

Structure is untouched: still one row per nozzle opening a dialog, still a
labelled figure per number. Those were deliberate and are documented; only
the spacing changed. Rendered with a full six-nozzle sheet — entered rows,
unentered rows, one with no rate — at 1440/1152/1024 and 400px.

### Nozzles grouped under their unit

A unit is a physical thing standing on the forecourt with two nozzles on it,
and the flat list gave no sign of that. Six evenly spaced cards read as six
unrelated pumps — "Unit 1 · Nozzle A" and "Unit 1 · Nozzle B" only announced
their relationship in words the reader had to compare.

- The sheet is grouped by unit, with a **Unit N** heading and a
  **"1 of 2 entered"** badge that turns green when the unit is finished, so a
  done pump can be skipped without reading both its rows.
- 32px between units, 12px between the nozzles inside one. The spacing does
  the grouping; the heading only names it.
- The card title drops to **"Nozzle A"**, since the unit is stated right
  above it. The DIALOG keeps the full "Unit 1 · Nozzle A" — it opens over the
  whole page with the heading out of sight, and it is the one place where
  being sure which nozzle you are typing into actually matters.

`get_reading_sheet` already returns rows ordered by unit then nozzle, so the
grouping walks that order rather than sorting again — a unit's nozzles are
adjacent by construction.

Unexpected benefit on a phone: dropping "Unit 1 · " freed enough width that
the fuel badge and the Entered/Enter status now sit on one line with the
name, where before the badge wrapped underneath.

### Docs caught up with the code

An audit of every markdown file after the last few sessions. What had gone
stale:

- **README's migration table stopped at 025.** 026 (readings may not overlap)
  and 027 (no back-fill where the next reading left no room) were applied and
  committed but not listed.
- **README's rules section had 026 but not 027**, and said nothing about the
  consequence that matters daily: enter days oldest first, and if one is
  missed, clear everything after it and re-enter forwards.
- **README's project layout** was missing `reports/daily/` and
  `settings/fuel-prices/`.
- **`public/README.md` still described a navbar** and a 36px logo. It is a
  sidebar now, and the mark is drawn at 64px on login, 48px in the sidebar,
  40px in the phone's top bar.
- **UI_CONVENTIONS' size-override example** pointed at "the compact navbar
  buttons", which no longer exist — the technique does, on the staff list, so
  the example moved there rather than being deleted.
- Added the **grouping principle** to UI_CONVENTIONS: let the gap carry the
  grouping, drop the repetition it makes redundant, and shorten a label only
  where the context replacing it is on screen.

`CLAUDE.md` needed nothing — its pointers to the three docs, the devcheck
route, the Playwright path and `npm run build` are all still accurate.

### Dialogs no longer close on a click outside

The owner reported a form vanishing when a drag that started inside the
panel ended just outside it. The cause is not obvious from reading the
handler: a `click` event is dispatched on the nearest common ancestor of
`mousedown` and `mouseup`, so pressing inside a text field and releasing a
few pixels past the panel edge fires `click` with `event.target` set to the
`<dialog>` element itself — indistinguishable from a real backdrop click.
The half-typed entry went with it.

Backdrop-close was removed from `ui/Dialog.js` outright rather than made
drag-aware by tracking the `mousedown` target. Every dialog in this app is
a form holding data someone is part-way through typing, the ways out are
already obvious (Escape, the header `✕`, a Cancel button on each form), and
nothing here benefits from dismiss-by-tapping-away enough to justify a
close path that can be triggered by accident.

The nav drawer in `AdminSidebar.js` keeps its backdrop-close deliberately.
It is a menu, it holds no input, and closing it by tapping the page is what
people expect — noted in `docs/UI_CONVENTIONS.md` so the two are not
"fixed" into agreement later.

## Loose oil

### The drum, sold by the rupee

The owner buys loose oil as a 200 litre drum — one supplier, one invoice, no
brand on it, bought the way a tanker of diesel is — and sells it across the
counter in rupees: "Rs 20 of oil", "Rs 30". Nobody measures the pour. The
money is the fact; the litres are arithmetic.

The existing lubricant form asked for litres and prefilled the amount, which
meant dividing 20 by 580 in your head at the counter, several times a day.

**Modelled as a flag on the product, not a new table.** `lubricants.sold_loose`
(migration 028). A drum _is_ a lubricant — bought in litres from a supplier,
sold over the counter, taken on credit onto the same ledger, counted in the
same monthly report — so a second table would have meant a second copy of the
stock triggers, the ledger posting, the delete-and-reverse RPC, the report
block and the export sheet. The only real difference is which number gets
typed, so that is the only thing the flag changes:

- `sold_loose = false` — the shelf. Type litres, amount prefills from the rate.
- `sold_loose = true` — the drum. Type rupees, litres come from the rate.

**The litres are derived on the server, never taken from the browser.** Sending
them would let a hand-edited form record Rs 500 of oil against a teaspoon of
stock. Deriving them also means the drum's book level can only disagree with
the real drum for one reason — the rate is wrong — which is one thing to check
rather than two. A loose product is therefore required to have a rate, by check
constraint as well as by the form.

**Litres went from two decimals to three.** Rs 20 out of a drum at Rs 580 a
litre is 0.0345 L; stored at two decimals that is 0.03, losing a tenth of every
pour, always in the same direction, on the kind of sale that happens dozens of
times a day. Done while `lubricant_sales` was still empty — a month later it
would have been a data migration. Two things had to come apart first and go
back unchanged: `rate_per_litre` is generated _from_ `litres`, and
`recalc_lubricant_after_product_update` names `opening_stock_litres` in its
`update of` list, and Postgres will not retype a column either depends on.

`formatLitresFine` (3 dp) sits beside `formatLitres` (2 dp) rather than
replacing it. "4 L" and "0.25 L" are right for a shelf; only the drum needs
millilitres, and "1.000 L" everywhere would be noise.

### Its own page under Lubricants

`/admin/lubricants/loose`. Tried mentally as one combined table first and it
does not work: most rows read "Loose Oil … 0.034 L" and bury the four carton
sales that actually need reading. The split is by product, so a sale can only
ever belong to one of the two pages, and the shelf table at the bottom of
Lubricants deliberately keeps **both** — that one is stock on hand, and someone
checking what is in the building wants the whole answer in one place.

Lubricants carries a summary card for the drum's day with a link through, so a
day is visibly not finished until both halves are in. A pump that keeps only a
drum lands on that link rather than on "no lubricants yet".

The sale dialog asks for rupees with Rs 20/30/50/100 shortcuts, states the
consequence underneath ("At Rs 580.00 a litre, Rs 30 is 0.052 L off the drum")
and names what is left in the drum. The rate is shown _before_ an amount is
typed, because a wrong rate is the one thing that can make every loose sale
wrong at once. With one drum the product select is not rendered at all.

Purchases gets a separate **Record a loose oil purchase** button rather than
one more entry in the lubricant dropdown — a drum arrives from a different
supplier with no brand, so splitting the button is what lets each form say the
right thing instead of hedging. It warns if the drum's buying rate has caught
up with its selling rate.

### Everywhere else

Reports splits "of which loose oil" out of the lubricant line and badges the
drum in the per-product table — it is most of the sale _count_ and a small
share of the money, so one combined figure flatters neither. The workbook gains
the same split on Summary and a **Kind** column on the Lubricants sheet, so
"just the drum for August" is a filter rather than trusting a spelling. The
dashboard gains an **Oil sales — packed and loose** chart, stacked, in rupees
(litres would render the drum as a flat line beside the shelf, and the drum's
litres are the softer figure anyway).

## Paging, and a cap that was corrupting a total

Asked for after noticing Purchases would grow unreadable after a year. Doing it
turned up a worse bug than the one being fixed.

**`.limit()` defaults were silently truncating figures.** `getPurchases`
stopped at 100 rows — but the Purchases page totals _what is still owed to
suppliers across every row_, so the hundred-and-first delivery pushed the
oldest unpaid ones out of the sum and the pump under-reported its own debt,
with nothing on screen to say so. `getStockChecks` capped at 60 had the same
shape: the page looks up the check belonging to the date on screen, so stepping
back far enough made it believe an old day had never been dipped and offer to
record it again. Both caps removed. **A cap on a list you are going to total is
a cap on the total.**

`<Pager>` was lifted out of the fuel-prices page, which had it inline, and is
now used by Purchases, Banking, Stock checks, the customer ledger, and both
sales tables. It takes `hrefFor(page)` rather than a base path so the date,
month or customer id already in the query string survives.

Where the slice happens is deliberate and differs by page — the reasoning is in
`docs/UI_CONVENTIONS.md`, but briefly: page in the database only when the list
is _only_ a list (the customer ledger, whose balance comes from an RPC that
sums over everything), and fetch-then-slice wherever the page derives a figure
from the whole set.

The two sales tables are day-scoped and so cannot grow without bound, but they
are paged anyway at 20: a busy Saturday of loose sales pushed the stock table
below them off the bottom of the screen.

### Verified

Rendered with realistic fixtures — the smallest possible sale, a part-credit
sale to a long customer name, a multi-line note — at 1440/1152/1024/400/360/320
and with the dialog open at 1152 and 400.

One real bug came out of it that no measurement would have shown: at 400px the
free-text note pulled the Amount column narrow enough that **"Rs 1,160" broke
after the "Rs"**, which reads for a moment as two separate figures. Fixed with
`whitespace-nowrap` on the figure — the column may widen and the table may
scroll, the number may not break.

The workbook was built from a fixture and unzipped to confirm the Kind column
is populated, the Summary carries the loose split, and the three-decimal litres
survive into the cells.

## Removing a customer

Asked for after a name was added wrongly and there was no way to take it off.

Built as the same **delete-or-retire** shape as `delete_lubricant`: an account
that never traded is deleted outright, one with credit or payments behind it is
retired, and the database decides which because the row on screen does not say.
The button is therefore **Remove**, not Delete — "Delete" would be a lie half
the time — and the confirmation reports what actually happened.

**The guard that this pattern needed and the lubricant one did not.** A retired
customer drops out of `get_customer_balances`, which is exactly what the
Customers page totals "total outstanding" from. Retire someone owing Rs 50,000
and the pump's own record of what it is owed falls by Rs 50,000 with nothing on
screen to explain it. So removal is refused while the balance is non-zero — and
in **both** directions, not just a debt:

- they owe the pump → removing writes the debt off by accident
- the pump owes them → they have paid ahead, or a payment landed on the wrong
  name. Hiding that loses money belonging to a customer, which is worse

The exception names the customer, the figure, and the next step, and it reaches
the owner more or less verbatim. The row also states the same thing before the
click, as a courtesy — the database is still the rule.

A **Removed** section under the main table lists retired accounts with a
**Bring back** button, so "removed" is never indistinguishable from "lost".
Both are owner-only; staff do not fetch the retired list at all.

Tested against the live database inside a block that deliberately aborts, so
all three attempts rolled back:

    overpaid account (pump owes Rs 4,999.72)  >> BLOCKED, naming the figure
    credits but no debits (Rs 59,186)          >> BLOCKED, naming the figure
    never traded                               >> deleted, removed: true

The role gate had to be stubbed for that run or `is_super_admin()` would have
masked every result; the stub is DDL and rolled back with everything else,
which was checked afterwards rather than assumed.

### Guide

Both languages gained the loose oil drum (setup, and the rupees-first daily
step), the new refusals — enter days oldest first, loose oil needs a rate, a
customer with a balance cannot be removed — and a line about Remove under
Customers. The two languages were diffed by shape afterwards, not by eye: same
number of stages, setup steps, daily steps, occasional items, rules and role
rows, and the same icon keys in the same order. That check is the point of
keeping the guide as data.

## The ledger works in whole rupees

The owner pointed at a customer page showing "Rs -4,999.72" and said the paisa
were useless — there is no coin below one rupee in Pakistan. He was right, and
the display was the smaller half of the problem.

**Where the paisa came from.** A credit slip's amount is litres × rate, so 11 L
at Rs 339.48 posted a debit of Rs 3,734.28. The customer paid the Rs 3,734 he
was asked for, and 28 paisa stayed on his account — not as a debt, because
nobody can hand over 28 paisa, but as arithmetic no payment will ever clear.
The page then contradicted itself: the headline read "Rs -5,000" through
`formatPKR` while the table under it read "Rs -4,999.72" through a
`formatPKRExact` added specifically so "every paisa should show".

**Fixed at the write, not just the render.** `roundRupees` now applies to every
value that becomes a customer debt or a payment — credit slips, payments,
adjustments, and lubricant sale amounts and their credit. `formatPKRExact` was
deleted; the ledger uses `formatPKR` like everything else.

Rounding only the display would have been the worse half of the fix: three
hidden 0.28s make a rupee, and the running balance drifts away from the rows
printed above it. The stored value and the shown value have to agree.

**What deliberately keeps its paisa.** The meter arithmetic.
`nozzle_readings.sale_amount` is litres × rate and genuinely carries them;
rounding it would put a day's takings out of step with the litres that produced
them. Where a whole-rupee credit comes out of a fractional sale the difference
lands on the **cash** side, which is where it belongs — cash is the residual,
and it is counted in notes. A survey before changing anything showed why this
distinction matters: 41 of 42 readings carried paisa, but only 1 credit slip
and 1 ledger entry did. The problem was never widespread, it was just in the
one place that hurt.

**The guard had to move with it.** `delete_customer` refused removal unless the
balance was exactly zero. Once the ledger displays whole rupees, a legacy
28-paisa residue reads as "Rs 0", still refuses, and explains itself by quoting
a figure the owner has no way to pay — an account that looks settled and cannot
be closed. So the guard rounds too (migration 032). It forgives at most 49
paisa, less than the smallest coin in circulation; anything a customer could
actually be asked for still blocks removal and is still named.

Verified on a fixture built and rolled back inside one aborted transaction, so
the boundary could be walked exactly rather than depending on live rows:

    0.28 residue   >> removed (treated as square)
    0.60 residue   >> BLOCKED, "still owes Rs 1"
    Rs 4,500 owed  >> BLOCKED, "still owes Rs 4500"

Then rendered: the legacy ledger's rows now read 3,734 → 0 → −5,000 and agree
with the −5,000 headline above them.

**One live account still carries the old residue.** Usama Bahawalpur is at
−4,999.72. Nothing was written to fix it — it now reads as Rs 0 against the
rupee and no longer blocks anything, and the ledger is append-only, so if it is
ever to be squared exactly that is an adjustment for the owner to post.

### The warning that disagreed with the column

Reported straight after the whole-rupee change: an account showing **Rs 0**
still warned "This account is not settled" when Remove was pressed.

Both halves of the fix had been written, but only one had been applied.
`delete_customer` was moved to whole rupees in migration 032; the browser-side
courtesy check in `RemoveCustomerButton` was left on its original `0.01`
threshold. So a 28-paisa residue displayed as Rs 0, warned that it was not
settled, and would then have been removed perfectly happily by the database —
the warning was wrong, not the rule. A courtesy check that contradicts the rule
it is previewing is worse than no check at all.

Checking the boundary properly turned up two more, neither of which the
original report mentioned:

- **`Math.round` is the wrong rounding.** Postgres `round()` and `Intl` both
  send −0.5 to −1, but JavaScript's `Math.round(-0.5)` is `-0` — it rounds half
  toward +Infinity. A balance of −0.50 therefore printed as "Rs -1" in the
  column while the button called it settled. `roundRupees` now rounds half away
  from zero, matching both.
- **`Intl` renders negative zero.** `formatPKR(-0.28)` returned the string
  `"Rs -0"`, so a customer a few paisa the wrong side of zero had a nonsense
  figure in the Owes column. Collapsed in `formatPKR`.

Verified by running the real `formatPKR` and `roundRupees` source over the
boundary and printing what the column shows beside what the button warns, which
is a stronger claim than a screenshot of one row:

    balance   OWES      warns   roundRupees
    0.28      Rs 0      false   0
    -0.28     Rs 0      false   0
    0.49      Rs 0      false   0
    0.5       Rs 1      true    1
    -0.5      Rs -1     true    -1
    4500      Rs 4,500  true    4500

`roundRupees` was checked against Postgres `round()` at each of those points
and agrees. Then rendered, with every confirmation open at once.

### Deleting a customer for good

Remove (031) deletes an account that never traded and retires one that did. The
owner then asked the obvious follow-up: a name added by mistake that somehow
picked up entries is retired for ever and sits in the Removed list looking like
a real customer who left.

**Where the line is drawn, and why there.** A purge is allowed only when the
customer's whole footprint is entries the owner typed himself — payments and
adjustments. No credit slips, no lubricant sales. That is not caution for its
own sake; the two kinds of row are genuinely different:

- a **credit slip** belongs to a nozzle reading. That reading's `credit_amount`
  must equal the sum of its slips, and the litres behind it are part of the
  day's takings and the month's report. Deleting one either breaks the
  constraint or silently rewrites a month already exported.
- a **typed entry** belongs to nobody but the customer. No reading depends on
  it. If the customer was a mistake then so was the entry, and removing both
  leaves every other figure exactly where it was.

So a customer who ever actually traded still cannot be purged, and the refusal
says why and points at clearing the day on Readings, which reverses the slip
properly.

**How it gets past the append-only guard, without weakening it.**
`ledger_entries` has a BEFORE DELETE trigger that refuses everything, service
role included — the most valuable guarantee in the schema. Rather than
disabling it (which would be off for every other session while it was off), the
guard learned one named exception: a delete is permitted only while
`app.purging_customer` holds that customer's id. It is transaction-local and is
set in exactly one place, by `purge_customer()`, after every check has passed.

That was the part worth testing hardest, and it was tested by trying to break
it rather than by trying to use it:

    plain DELETE on ledger_entries  >> refused (guarantee intact)
    plain UPDATE on ledger_entries  >> refused (as always)
    wrong name typed                >> refused
    correct name                    >> purged, 2 entries
    a bystander customer's entries  >> untouched
    plain DELETE after the purge    >> refused (setting did not leak)

And the two refusals against the real accounts:

    Usama (1 credit slip)      >> BLOCKED, pointing at clearing the day
    Abdul Latif (Rs 59,186 out) >> BLOCKED, must be settled first

All inside blocks that abort; the customer count, ledger count, `is_super_admin`
body and the setting itself were re-checked afterwards rather than assumed.

**Typing the name is the confirmation, not a Yes button.** Everything else
destructive here is recoverable — a retired customer comes back, a deleted sale
posts a reversal — and this one is not, so it asks for something a mis-aimed
click cannot produce. Offered only from the Removed list, so reaching it is
two deliberate decisions. Checked in the database as well as the browser.

No tombstone: the owner asked for gone, and a hidden record of the name would
mean it never really left. The record of a purge is this entry and the
migration.

## Why navigation felt slow, and what prefetch actually does

The owner asked why moving to the Guide still shows a loading skeleton, and
whether caching could help without serving stale figures. Worth writing down
because the answer was measured, and two of the measurements contradicted what
seemed obvious.

**Where the time goes.** Every `/admin` page is dynamic, because
`requirePageRole()` reads cookies. Before any HTML exists the server does
`getClaims()` plus a `profiles` SELECT - at least one Supabase round trip. The
Guide's own content is a compile-time constant in `guide-content.js`, so for
that page the round trip _is_ the entire wait, and `loading.js` covers it with
a full-page skeleton that makes 300ms read as a page load.

`proxy.js` and the layout are already clean: the proxy uses `getSession()` (no
round trip unless the token is expiring) and `getSessionProfile` is wrapped in
React `cache()`, so the layout and the page share one lookup.

**A shortcut that does not work.** The Guide is open to both roles, so the role
query looks like waste. It is not: the same query checks `is_active`, which is
what locks out a deactivated staff login on their next navigation. Load-bearing.

**Deleting the skeleton does not work either.** Tested with two throwaway
routes: a child segment with no `loading.js` of its own **inherits the
parent's**. Removing `app/admin/guide/loading.js` would give the Guide the
_dashboard's_ skeleton, which is worse.

**What does work, measured on a production build** (dev mode is not
representative - it showed no benefit at all, which nearly led to the wrong
conclusion):

    default prefetch   skeleton at 65ms, content at 874ms
    prefetch={true}    content at 70ms, no skeleton

And on the staleness question the owner actually asked:

    prefetched copy still reused after 45s   (the window is real, not momentary)
    mutate + revalidatePath, then navigate   -> shows the NEW value, in 70ms

So prefetch and the 81 `revalidatePath` calls already in `actions.js` work
together: fast, and busted the moment anything is saved **in the same
browser**. The residual gap is another person's session - their action cannot
clear this browser's router cache, so a figure could be up to ~45s old until
the next load.

**Applied to the Guide only.** Not for staleness reasons - the Guide has no
data - but for cost. App Router prefetches on viewport entry, and the whole
sidebar is in the viewport on a laptop, so prefetching all eleven links would
run ten extra page renders with their queries on every admin page view. On a
cheap tablet over mobile data those compete with the page actually being waited
for.

**Still open, and both are infrastructure rather than code.** The database is
in `ap-southeast-1` (Singapore) and there is no `vercel.json`, so functions run
in whatever region Vercel chose - often Washington DC. If so, every round trip
crosses the Pacific twice, which would dominate everything above. And the
`profiles` lookup could move into the JWT as a custom claim, removing a round
trip from every page, at the cost of a deactivated login staying valid until
its token refreshes.

### The app was on the wrong side of the Pacific

Following the navigation-speed work above, the Vercel function region turned
out to be `iad1` (Washington DC) while the Supabase project is in
`ap-southeast-1` (Singapore). Every page therefore paid:

- ~230ms getting the request from Pakistan to Virginia, and
- ~230ms **per query**, Virginia to Singapore and back.

`vercel.json` now pins the functions to `sin1`. Both legs improve at once: the
reader's request travels roughly 70ms instead of 230ms, and each database round
trip drops to single-digit milliseconds.

Singapore rather than Mumbai, which is physically closer to the reader: one
navigation makes **one** user round trip but **several** database ones, so
co-locating with the data wins. If the database is ever moved, this moves with
it.

**This also called off the JWT change.** The plan had been to move the role
into the access token to save the `profiles` round trip on every page - the
owner had agreed, on the grounds that staff are rarely deactivated. But that
round trip was only expensive _because_ of the region; once the function sits
beside the database it costs about 2ms. Trading immediate lockout of a
deactivated staff login for 2ms is a bad deal, and it would have stayed in the
codebase long after the reason for it disappeared. Not done.

## Opening balances, and saying which way the money goes

Two requests from the owner, and the second is the one that was quietly
dangerous.

### A customer can now be created with the balance they arrive with

Almost nobody typed into this app is a new customer — they came out of a paper
register, and plenty already owe money on the day the name is entered. The only
route before was: create the customer, then remember to open their page and
post a manual adjustment. The second half is the half that gets forgotten, and
an account silently starting at zero when the man owes Rs 40,000 is a loss
nobody notices until he stops paying.

The New customer form now asks, with "Nothing owed — starting fresh" as the
default so the ordinary case is still one tap.

**Written in one transaction** (`create_customer_with_opening`, migration 034)
rather than two inserts from the action, because two inserts can leave the
customer created and the balance missing — which is exactly the silent zero the
field exists to prevent. The amount is always positive and a separate direction
says which way it goes; a signed figure would let "-500" and "they owe us"
disagree, with nothing to settle the argument.

### "Increases what they owe" was unreadable, and getting it wrong is silent

The manual adjustment offered a dropdown reading _Increases what they owe_ and
_Reduces what they owe_. The owner could not tell them apart at a glance — two
long phrases differing by one word in the middle, both starting the same shape.

This is the worst place in the app for an ambiguous control. Picking the wrong
direction does not fail: both are legal, no constraint can catch it, and the
ledger is append-only, so the mistake is permanent and has to be corrected with
a second entry. The only defence is not making it in the first place.

Two changes, and the second is the one that actually works:

- **Cards in yard language, shared between both forms.** `BalanceDirection`
  gives "They owe more" / "They owe less", each with a line saying _when_ to use
  it — the situation is easier to recognise than the arithmetic. Shared so the
  same two ideas are never described in two vocabularies, which is how the
  confusion started.
- **The resulting balance, shown before saving.**

      Rs -4,999 → Rs -9,998
      The pump would owe them Rs 9,998 after this.

  A label can be misread. A figure going from 4,999 to 9,998 when you meant to
  clear the account cannot. Rendered both directions against a customer owing
  Rs 3,000 and one Rs 4,999 in credit, at 1152 and 400px.

The general rule is now in `docs/UI_CONVENTIONS.md`: **any control where both
choices are valid and only the operator knows which is right should show its
consequence before it is committed.**

### Adding a customer became a dialog, and details became editable

**The New customer page is gone.** Adding a customer is a rare setup act done
from the list and finished by looking at the list — the same argument
`BankAccountForm` and `PurchaseForm` already follow. The old route also cost
two navigations, each paying a round trip, to land on a detail page showing
nothing but what had just been typed. `createCustomer` now returns instead of
redirecting, and the dialog closes over a list that already has the new name on
it. `/admin/customers/new` was deleted rather than left as a second way in.

**Made to fit without scrolling, which took more than tightening.** A form that
arrives already scrolled hides its own Save button. Stacked in the default 32rem
dialog it ran **195px** past a 1024×768 laptop once an opening balance was being
entered. Shrinking the three choice cards would have undone the readability they
were added for a commit earlier, so the dialog went to `size="lg"` with two
columns — contact fields left, opening balance right. Measured after, not
assumed:

    new-1024x768        fits, no scrollbar   (was: scrolls by 35px)
    new-1024x768-owes   fits, no scrollbar   (was: scrolls by 195px)
    new-1440x900-owes   fits, no scrollbar   (was: scrolls by 76px)
    edit-1024x768       fits, no scrollbar

The 400px phone still scrolls and that is correct — the dialog is a full-screen
sheet there and the columns stack.

**Name, phone, vehicle and credit limit are now editable** from the customer's
own page. They were not, so the only way to fix a misspelled name was to add a
second customer and split the history across the two — the worst possible
outcome for a ledger. `updateCustomer` touches details only: the balance lives
in the append-only ledger and still moves solely by payment or adjustment, which
is what makes this safe to leave with staff.

### Both oil sale buttons, in one place, saying which is which

The drum's sale button existed only inside its summary card halfway down the
Lubricants page — the more frequent of the two sales in the harder place to
find. Both now sit in the header, and both say what they record: **Record a
lubricant sale** and **Record a loose oil sale**. "Record a sale" was fine while
it was the only one; beside a second sale button it says nothing.

Both are `.btn-primary`, which is a deliberate departure from one-primary-per-
view: they are peers, and demoting either would point the reader at the wrong
one. Noted in `docs/UI_CONVENTIONS.md` so it is not "corrected" later.

_Process note_: `npx prettier` was run on `CustomerForm.js` without checking the
repo first. There is no prettier config here and the codebase uses single quotes
at a 100 column width, so the default run rewrote the whole file to double
quotes. Re-run as `--single-quote --print-width 100`, which reproduces existing
files byte-for-byte — worth using if prettier is ever run again.

### A bin instead of the word, and feedback on every button that waits

Two reports, and the second turned out to be thirteen bugs rather than one.

**The "Remove" links looked unfinished.** A column of red text down a table
reads as a list of links, not a set of buttons, and the same word repeated on
every row is noise — the row already names what it applies to. Replaced with a
trash `IconButton`, and the same treatment given to the five other delete
triggers (purchases, expenses, bank transactions, fuel rates, lubricant sales)
so the whole app deletes the same way.

**No icon library.** `Icon.js` already explains why — seventeen icons now, all
on one 24px grid at one stroke weight, and adding one is editing a file rather
than taking a dependency and someone else's idea of what a bin looks like. The
trash was drawn to match.

This is the one deliberate exception to "icons never carry meaning alone". That
rule is about icons carrying _information_ — a nozzle's Entered badge, a fuel
type — where colour is the cue that fails in a dim office. A control is
different, and two conditions keep it honest: `label` is mandatory and becomes
both `aria-label` and the hover title, and every one of these confirms **in
words** before anything happens. Text is kept where the words _are_ the
distinction: _Bring back_ beside _Delete for good_ would be a guess as two
icons.

**"Clicking some buttons freezes the UI."** It was not a freeze — it was
**thirteen submit buttons with no pending state**. `SubmitButton` has wrapped
`useFormStatus()` since early on and is used in 25 places, but every
destructive confirm had been written as a plain `<button type="submit">`: Yes,
remove / Yes, delete / Bring back / Sign out. Press one and nothing changes
until the row vanishes, which is indistinguishable from a tap that never
registered — so the natural response is to press again.

All thirteen now use `SubmitButton` with a fitting label — Removing…,
Deleting…, Bringing back…, Signing out… Verified by holding the Server Action
open for 2.5s to stand in for a slow connection, which is when it actually
matters:

    during the action: label "Removing…", disabled=true

Disabled matters as much as the label: it is what stops the impatient second
tap posting the same thing twice.

Left alone deliberately: the month pickers on Expenses and Reports are plain
GET forms in server components, so the navigation brings its own `loading.js`.
`PaymentStatusToggle` already updates optimistically and `StaffList` already
used `SubmitButton`.

### The guide caught up, and the docs learned to brief a stranger

**Guide, both languages.** It had never covered two things the owner uses:
correcting a customer's details, and the manual adjustment — which is the one
control that confused him in the first place, so leaving it undocumented was
the wrong gap to have. Added, along with the whole-rupee rule.

The Customers card then became ten lines covering six different operations,
which is worse for someone learning than the four-line cards beside it. Split
into **Customers** (pay, add, opening balance — the routine) and **Fixing a
customer** (edit details, adjust the balance, remove — rare, owner-only), with
the pencil icon on the second. Both languages checked by shape afterwards:
7 setup steps, 7 daily, 7 occasional, 10 rules, 7 role rows, matching icons.

**Two docs additions aimed at a session that has not been here before**, since
the next piece of work mentioned is an offline Electron build:

- A **"Where things stand"** section at the top of this file. Ten narrative
  entries in theme order is the right shape for _why_, and the wrong shape for
  _what is true today_ — so there is now a table of the recent work and a list
  of the three things that are load-bearing and easy to break.
- A **"If you are porting this off Supabase"** section in `README.md`, because
  the most misleading thing about this codebase is how little of the important
  logic is in the JavaScript. Thirty-four migrations of triggers and
  constraints hold the rules that make the books trustworthy, and swapping
  Postgres for SQLite silently drops all of them — nothing in the UI would
  complain, because the UI check was only ever the courtesy. It also names what
  is genuinely Supabase-shaped (the clients, `proxy.js`, every `.rpc()` call,
  RLS as the real access control) against what ports unchanged (all the
  components, the helpers, the guide content, the Excel export).

### The guide had too much detail to be read

The owner's verdict on the guide, after it had been brought up to date: _"too
much detail... add some visual markers instead, so that it does not become
boring to read."_ It measured **4,603px** — five screens on a laptop — and the
reader it is written for is an attendant who has opened it to find one answer.

Where the height was: setup 1,133px (24%), the evening routine 1,127px (24%),
the rules 779px (17%), the section map 668px (14%), roles 442px (10%).

**Three markers replaced prose, and one section folded away:**

- **Location chips.** Ten steps across the two languages said, in a sentence,
  where to go. They now carry `where: { icon, path }` and render it as a pill
  under the step heading — `Lubricants → Record a lubricant sale`, with the
  _same icon as the sidebar tab_, so it points at something already on screen.
- **Rules lead with the claim.** `rules.items` went from strings to
  `{ title, body }`; the title is bold. Ten rules are now ten scannable lines
  rather than ten paragraphs behind ten identical warning triangles — the
  repeated icon was marking nothing, and the eye had nowhere to land.
- **The one-time setup folds.** The page already tells the reader to skip it,
  so it is now a native `<details>` styled as a card row. No JavaScript, no
  state, still found by the browser's own search.

The chips _raised_ the height first — 4,603 → 4,957px — which is worth
recording, because it is the shape of this kind of change: a marker costs
vertical space and buys scanning speed. Folding the setup is what paid for
them. Final: **3,850px English, 3,718px Urdu**, a fifth shorter than it began
while carrying more signposting than before.

Checked in both languages at 1152px and 400px, and by shape after every edit
(3 stages / 7 setup / 7 daily / 7 occasional / 10 rules / 7 role rows, icons
matching). One measurement worth not repeating: a first pass reported the
phone width scrolling sideways, and the culprit was the **devcheck route, not
the page** — `/devcheck` sits outside `app/admin/layout.js`, so it lacks the
`px-4` that `.table-scroll`'s `-mx-4` is there to cancel, and the roles table
hung 16px off each edge. Wrapping the devcheck page in the same container as
the real layout is now part of using it; without that, every full-bleed table
in the app looks broken at 400px.

### The rate panel on Settings shows five changes, not seven days

_"Show only the recent 5 readings, rest should be visible in view all."_

The slice was seven whole **days**, and the reason it was counted in days
rather than rows is still right: the rate for both fuels usually moves
together, so a plain `limit` shows diesel's new rate with petrol's cut off the
bottom, and the owner reads the two as a pair to check both moved.

But at two fuels a day, seven days is fourteen rows — the panel had grown its
own scrollbar, a small scrolling table inside a page that already scrolls.

`getRecentFuelPrices()` now takes a **row cap that cuts on a date boundary**:
keep rows until there are five, then keep going only while the date has not
changed. Five or six rows, and a day is never half-told. Both properties are
kept; only the thing setting the height changed.

Two things came with it. The query now orders by `fuel_type` after the date,
matching `getFuelPricesPage()`, so a day's pair reads in the same order on the
panel and on the full history instead of in whatever order the rows were saved
— the screenshot that prompted this showed Petrol above Diesel on one day and
below it on the next. And the heading dropped its day count: "The most recent
changes", because a number in that sentence has to be re-checked every time
the cut changes, and it told the reader nothing they wanted.

Rendered at 1440 / 1152 / 1024 / 400 with the owner's own rows as fixtures:
6 rows, no scrollbar inside the panel at any width, no sideways page scroll,
no clipped figures. Edge cases checked against the loop directly — a date
corrected six times over still returns whole (6 rows), fewer rows than the cap
returns all of them, no rows returns none.

### A window on the dashboard charts, and eight rates to a page

Two requests, both about a screen being fixed at a size that no longer suited
it: _"the graphs on dashboard also need date filter"_ and _"this page should
show 8 max and next page the remaining, means the pagination is set at max 8
so scroll bar does not appear."_

**The charts can now be asked for 7, 14, 30 or 90 days.** They were hard-wired
to 14. `<TrendRange>` is four fixed windows rather than a from/to pair,
because the day they _end_ on is already chosen by `<DateNav>` at the top of
the page — the only thing missing was how far back to reach, and asked as a
range that would be two date pickers, four taps, and a window that can be
entered backwards or empty. One tap, no invalid state. 90 is the outer limit
on purpose: at 400px that is a 2px bar, and past it the right answer is a
month-by-month chart, not a longer axis.

The heading now spells out the span underneath — "Last 30 days / 10 Jul 2026
to 08 Aug 2026" — because these charts end on the day the page is showing, and
"Last 30 days" is a lie the moment the reader has stepped back a week.

**`<DateNav>` learned to carry a filter.** Its arrows, its date box and "Back
to today" all rebuild the query string from scratch, so without this, stepping
one day with a 90-day window open would drop back to 14 and the reader would
blame the arrow. `extraParams` threads it through all three, plus the hidden
fields the `noscript` GET form needs. `trendDaysFrom()` validates against the
allowed set rather than `Number() || 14`, so `?days=999` cannot ask Postgres
for three years of daily rows.

**All fuel rates pages by eight instead of 25.** 25 rows overran
`.table-scroll`'s 70vh cap, so the card grew a scrollbar inside a page that
already scrolls and the wheel did one of two things depending on where the
pointer sat. Eight clears the cap everywhere this app is read, and
`FuelPriceTable` now sets `max-h-none` to drop the cap outright — neither
caller can reach it any more, and the sticky heading it existed to support is
no loss when the whole table is visible. Even on purpose, so a day's petrol
and diesel do not straddle the fold.

Verified at 1440 / 1152 / 1024 / 400 across all four windows: 8 rows, no
scrollbar inside the card, no sideways page scroll, no clipped figures. The
query-string carry was checked by reading the rendered hrefs — both arrows,
"Back to today" and the hidden field all hold the window, `?days=999` falls
back to 14, and the current window renders as a `<span>` with no `href`.

**One measurement worth writing down, because it inverts the usual lesson.**
The 90-day chart screenshotted at 400px as a flat line of slivers and looked
like a real bug. It was not: recharts animates 90 bars for longer than
`networkidle` plus 500ms, and the shot caught them mid-grow. Querying the
rendered geometry gave heights of 84–184px, and a re-shot after 2.5s matched.
Screenshots catch what the DOM hides, and this once it was the other way
round — when a chart looks wrong, measure a bar before believing the picture.

### The chart filter was throwing the reader back to the top

Reported the day it went out: _"i deployed, its working, but changing from 7
days to 14 moves the UI to the top."_

A Next.js `<Link>` resets the scroll position, which is right when the whole
page changes and wrong for a filter. The charts are the last thing on the
Dashboard, so picking a different window scrolled back up past the tiles, the
fuel cards and the tanks — to look at a chart the reader was already looking
at. `scroll={false}` on the window links.

Measured both ways rather than assumed, because "it stayed put" is the kind of
result that also happens when the click did nothing: without the flag the page
went from scrollY 1087 to 0 and the control moved from 379px down the viewport
to 1466px off the top of it; with it, 1087 to 1087 and 379 to 379, at 1152px
and 400px, across 7→14 and 14→90.

Deliberately not applied to `<Pager>` or to the `<DateNav>` arrows. Those
change what the whole page is about, and landing at the top of the new content
is the right behaviour there. The rule is narrower than "links should not
scroll": **a control that changes only what sits beside it should not move the
page.**

## An audit trail

### Who did what, written by the database

_"Add trail logs and log the user activity and create a tabular log data in
the navigation menu after guide button."_

The owner has staff logins, and the app deliberately lets a past day be
corrected — necessary, and also the exact shape of a mistake being quietly
tidied away. Nothing recorded who did either. Migration **035** adds
`activity_log` and one trigger across sixteen tables; `/admin/activity` reads
it, owner only, below the Guide in the sidebar.

**It is in the database, not the Server Actions.** An app-level log records
only what went through the app — not a second tab, not the Supabase console,
not a future script, and not whichever action someone forgets to instrument.
The one time an audit trail gets opened is the time something happened that
nobody expected, which is precisely the case an app-level log misses.

**One function serves all sixteen tables** by going through `to_jsonb(NEW)`
rather than naming columns, so a column renamed later degrades to a vaguer log
line instead of breaking the write. Each line is built as a finished English
sentence _at write time_ — "Unit 1 · Nozzle A — 151.15 L, Rs 50,055" — because
half these rows describe something that no longer exists, and a log that joined
back to the row at read time would render a deletion as blanks.

**It can never block a write.** The trigger body ends in `exception when others
then return coalesce(new, old)`. A pump that cannot record its evening because
the logging is broken is worse than a pump with no log. The cost is that a bug
in it is invisible except as a gap, which is why every branch was exercised
before it shipped rather than after.

**Three things it deliberately stays quiet about**, each found by running it:

- _Stock recalculation._ `tanks.current_stock_litres` is recomputed by trigger
  after every reading, so logging it would bury each real event under a line of
  machine bookkeeping. An update whose only changed columns are ignored is not
  logged at all.
- _The ledger row a credit slip posts for itself._ One event, described twice,
  and the slip is the half a person recognises.
- _The cascade under a deleted reading._ Deleting a reading deletes its credit
  slips, and each slip's `on delete set null` then UPDATEs the ledger row it had
  posted. The log said "Charge to a customer changed" underneath the deletion
  that caused it. `credit_sale_id` and `lubricant_sale_id` joined the ignore
  list.

**Append-only, and unforgeable.** No insert policy at all — the only writer is
the security-definer trigger — plus update and delete triggers that raise the
way the ledger's do. Verified in an aborted transaction: the owner sees the
rows and a staff login sees none; anon is refused at the grant; an insert by
hand violates the policy; update and delete match zero rows through the API,
and raise the append-only message even from a role RLS does not filter.

**Testing against a live pump.** Every branch was run against real rows inside
transactions that ended in `raise exception`, so nothing committed. Row counts
were re-checked afterwards — readings 42, customers 6, rates 10, bank
transactions 8, all unchanged — and the log was empty when the migration
landed. Three test attempts failed on generated columns (`litres_sold`,
`gain_loss`, `rate_per_litre` cannot be inserted), which is the schema being
right and the test being wrong.

**One wording bug the screenshots caught.** `entry_date` exists so the page can
say "filed against 07 Aug" when an entry was made against an older day than it
was typed on — the shape of both an honest correction and a dishonest one.
Populating it for a fuel rate printed "filed against 08 Aug 2026" under a line
already reading "from 08 Aug 2026": a repetition, and the wrong word. Rates no
longer set it.

### The log stopped being a table

It was a `<table>` first, like every other list here, and at 400px it measured
clean — nothing clipped, no page scroll — and looked broken: two narrow columns
of timestamps beside acres of white, because the row heights were set by a
700px sentence sitting off the right-hand edge. The app's usual answer, let the
table scroll inside its card, works for Purchases because every cell there is a
short number. Here the column that matters is a paragraph, and scrolling right
to find out what happened defeats the page.

`<ActivityTable>` is now one piece of markup that is four columns above
`@[54rem]` and a stack below, using `@[54rem]:contents` so the when/who/amount
wrapper dissolves into grid cells on a wide screen instead of being written
twice. Full note in `docs/UI_CONVENTIONS.md`.

The column widths were measured rather than guessed, and the first guess was
wrong in the way this project keeps punishing: at a 46rem threshold the columns
cramped at a 1024px window and **"Rs 7,686,000" wrapped onto two lines**. The
DOM had reported no clipping and no overflow both times. 54rem with
12/12/1fr/8rem, `whitespace-nowrap` on the timestamp and the figure but not on
the name — a name may wrap, a number may not.

Screenshotted at 1440 / 1152 / 1024 / 768 / 400 / 360, with the sidebar's 240px
mocked into the devcheck so the container widths matched the real app rather
than the viewport.

## The Lubricants page, made legible

### "It should show sales but it is still unclear which sales"

The owner's report, and it was exactly right. The page counted **packed sales
only** and nothing on it said so: four unqualified tiles (Sales / Litres sold /
Cash / On credit), a heading reading "Sold on 09 Aug", and a description —
"Counter sales. Stock is kept in litres, packs and loose oil alike" — that
described the _stock_ and implied the drum was included in the _sales_.

Two feet below, the shelf table listed the drum with "sold 1 L" against it. So
the screen said "nothing sold today" and "the drum sold a litre" at the same
time. Neither was wrong; they were counting different things and nothing on the
page said which.

**The day leads, then its halves.** The tiles are now `Oil sold today` (both
kinds), `Packed, off the shelf`, `Loose, out of the drum`, `On credit` (the
whole day, because "how much of today's oil is not in the drawer" does not care
which container it came out of). The split that was invisible is now the first
thing on the page.

**The shelf says which span it covers.** _Bought_ and _Sold_ there are running
totals since the pump opened, and that was in 12px grey text at the very bottom.
It is now a line under the heading — "Everything bought and sold up to 09 Aug
2026, not just today" — which is the sentence that resolves the contradiction
above. Packed products sort before the drum, and the drum's selling rate moved
onto this table from its old page, because for a drum the rate is load-bearing:
it is the only thing turning "Rs 20 of oil" into litres off the stock.

**Low stock got a word.** The In stock column was signalling "out of stock" by
printing the number in red and nothing else — colour as the only cue, on a
cheap tablet in a dim office, which is the exact failure this repo's icon and
colour rules exist to prevent. "0 L" and "16 L" are the same shape to a
red-green colourblind reader. There are now `out of stock` and `low` badges.

### The drum came back onto the same page

_"Lube oil sale should also show here instead of a separate page"_ and _"I
don't want this button here, just the loose sales here."_

This reverses the split recorded further up this file, and the original reason
for it was sound: a run of rupee-priced pours buries the four carton sales that
need reading. What changed is the answer, not the problem. A route split makes
the reader work out _where a sale lives_ before they can look for it, and a
day's oil takings were never on one screen.

So: one table, `loose` badge on the pours, and an `All oil / Packed only /
Loose only` chip row above it. The busy-Saturday view that justified the split
is one tap away; the ordinary case is right by default. Litres are formatted
per row — three decimals for a pour, two for a carton — because "0.03 L" at two
decimals rounds most of a rupee's worth away.

`/admin/lubricants/loose` is now a `redirect()` to `?kind=loose`, carrying the
date. Deleting it would 404 the Dashboard's oil card, the owner's bookmark and
any link sent over WhatsApp. The navigation card that used to sit mid-page
pointing at it is gone, which is what was asked for.

### Two smaller things

**A 2px button bug, everywhere in the app.** Reported as "the buttons are a bit
larger than manage lubricant button" — and measurement said the opposite: the
filled `.btn-primary` was **48px** and the outlined `.btn-secondary` **50px**,
because the outlined one carries a 1px border and the filled one did not. Every
pair in the app was two pixels apart and, centred in a flex row, a pixel off
each other's baseline. `.btn-primary` now carries an invisible border in its
own fill colour. All three buttons measure 50px at every width.

**The Urdu word is the label.** The balance-direction cards now read **"They owe
the pump (بنام)"** and **"They have paid ahead (جمع)"**, on both the New
customer form and the manual adjustment, with **(نیا کھاتہ)** on the
nothing-owed option. These are the words a Pakistani shopkeeper's register has
used for a debit and a credit for a century — the owner has been writing them
by hand for years, and no English phrasing was ever going to compete with that.
The English stays as the gloss for staff who may not share the habit.

Wrapped in `<bdi lang="ur" dir="rtl">`: an unmarked right-to-left run inside an
English sentence lets the bidi algorithm drag the brackets around it, stranding
the closing paren on the far side of the phrase. A step larger than the English
beside it, too — Urdu script carries more detail per character and does not
survive 14px.

Rendered at 1440 / 1152 / 1024 / 400 / 360 with a mixed day as fixtures: ten
rows, no clipping, no sideways page scroll, and no money figure or timestamp on
two lines at any width.

### A scrollbar in the nav, and seven delete guards that moved the page

**The sidebar grew a scrollbar the moment Activity was added.** Measured rather
than guessed: the column needed **953px** — identity 180, twelve links 644,
Account/Sign out 129 — against the 945px the owner's screen gives it. Eight
pixels short, and Windows answers that with a permanent 15px grey slab down the
side of the nav.

Trimmed to **808px** and it fits with room over: links from 48px to 44px (still
the app's own minimum target — `IconButton` is `h-11`), gaps from 4px to 2px,
and the identity block from 180px to 131px, since the business name was
wrapping to two lines at `text-base` in a 240px column.

The `overflow-y-auto` **stays**, and so does a scrollbar on genuinely short
windows — Sign out is the last thing in that column, and a list that silently
ends above it leaves the owner unable to sign out with nothing on screen to say
why. What changed is that it is a 6px hairline now (`.nav-scroll`) instead of
the browser default, and it only appears below about 810px of viewport.

**The delete guards became dialogs.** Reported as _"they shift the UI"_, and
that is exactly it: each of the seven replaced its own trash icon with a
question, two buttons and sometimes a paragraph, inside a table cell — so the
row grew, the column widened, and every row below jumped. On the Customers
table the row you were aiming at moved while you were reading the question.

`<ConfirmAction>` is the shared shape now. Verified by watching the row _below_
the one being confirmed: it moves **0px** at 1152 and at 400, where before it
dropped by the height of the expanded block. The dialogs also have room for the
sentence that matters — the fuel-rate one can say in full that readings already
entered keep the rate they were sold at, instead of six words squeezed into a
cell.

Two things kept deliberately: a refusal leaves the dialog **open**, because the
database's explanation is the whole point of the interaction and closing would
throw it away; and `PurgeCustomerButton` keeps its own dialog, because its
trigger must be the words _Delete for good_ beside _Bring back_, and its body
owns the type-the-name field that gates the submit.

### The two dashboard charts were drawing the same picture

_"Both of these graphs shows almost the same thing, configure the left graph
to show sales of petrol and diesel in litres too with a toggle."_

Correct: on a pump paid almost entirely in cash, "total sales" and "the cash
bar" on the chart beside it are the same height every day, so the second chart
told the reader nothing the first one had not already shown.

`<SalesTrendChart>` now toggles between **Rupees** (the original single bar)
and **Litres** — petrol and diesel stacked, in the app's own fuel colours, with
a legend since two series need one. Litres is the view rupees structurally
cannot give: a fuel-rate change does not move the bars, so a quiet day is
visible as a quiet day rather than mistaken for a cheaper one.

No database change — `get_sales_trend` (migration 005) already returns
`petrol_litres` and `diesel_litres` alongside the money; the chart simply
wasn't using them. The toggle is component state, not a query-string filter
like `<TrendRange>` beside it: that control changes the date window and needs a
new query, this one redraws rows already on the page, so a round trip would
buy nothing.

Verified at 1152 and 400px, in both modes, including a round-trip
Rupees→Litres→Rupees to check for leaked state: no clipping, no sideways
scroll, 30 bar paths present after the animation settles either way. One
retest needed — the same recharts-animation trap noted elsewhere in this file:
a screenshot taken immediately after `networkidle` catches the bars mid-grow
and looks like a regression that is not one.

### Company Assets — a private record of what the pump owns

_"I need a page named Company Assets, where I can add all the company assets
with their value at the time of purchase, and edit or delete them. This page
is just for the owner to see what he bought using pump money."_

A new page, `/admin/company-assets`, owner-only in the same way Banking is —
RLS refuses `data_entry` outright, the nav link is hidden for anyone else, and
neither is treated as the real gate. Nothing here touches a sale, an expense,
or the month's profit; it is a separate ledger of things bought and _kept_
(a vehicle, a generator, machinery, property), not things bought and used up.

**Cards, not a table.** Every other list in the app is a table because its
rows are short numbers read in columns. An asset is a name, a category, a
value and an optional note — closer to a small record than a row — so it gets
the same treatment the activity log got when a table stopped fitting it (see
"When a list should stop being a table"). Nine cards a page, three columns
wide on a laptop.

**A new picker shape.** Choosing the category is five icon tiles in a
`role="radiogroup"`, not a `<select>` — see the new UI_CONVENTIONS.md section
"Picking one of a handful of categories" for why this is a different pattern
from `BalanceDirection`, and for the client/server-boundary reason the
category list itself lives in `app/_lib/asset-categories.js` rather than
inside the client form file.

**The four header figures come from a database RPC**
(`get_company_assets_summary`, migration 036), not a sum over the page's nine
rows — the same rule, and the same historical bug it exists to avoid, as
`getPurchases()` earlier in this file: a capped list's total silently
shrinking the moment a second page exists. Total value, asset count, biggest
category by value, and the newest addition all come from the whole table
every time.

Migration 036 also extends the activity-log trigger (035) to `company_assets`,
so adding, editing or removing an asset writes the same kind of audit-trail
line everything else does — reproduced from `pg_get_functiondef` against the
live function rather than retyped, to avoid the trigger silently drifting
from the sixteen tables it already covers.

Verified end-to-end against live data with nothing written: the whole
migration, plus inserts, RLS checks for owner/staff/anon, the summary RPC and
the trigger's output, ran inside a transaction that ends in a forced
`raise exception` so it always rolls back, then a read-only follow-up query
confirmed the table and the activity log were untouched. Only then was the
migration applied for real. The Server Actions were not exercised through the
live authenticated app — that would need the owner's own login — so they rest
on that database-level proof plus a passing build, the same as any other
action shaped like `createExpense`/`updateTank`/`deleteExpense`.

Rendered with fixture data covering the awkward cases — a long wrapping name,
a seven-figure value, a card with no note — at 1440/1152/1024/400/360px: no
clipping, no sideways scroll. The category picker reflows 3 columns to 5 at
`@[26rem]`, and the delete confirmation (`<ConfirmAction>`) was measured
before and after opening to confirm the surrounding card grid does not move,
the same check the guards-that-moved-the-page fix above established.

### A whole day went in at zero, and nothing on screen said so

_"Father came back after 2 days to enter the reading and mistakenly added the
reading in today's section, instead of Sunday, without knowing that he missed
a day."_ Real evening, real numbers: 09 Aug 2026 sat at 0 of 6 nozzles while
10 Aug was entered in full — the meter still balanced (opening carried
straight from 08 Aug's close), so nothing was double-counted, but a whole
day's cash and litres were never recorded as their own day, and nothing told
him that had happened.

**The database already allows this on purpose** (`027_no_backfill_without_room.sql`):
a genuine gap and a day skipped by mistake are the same shape on the wire, so
it cannot be the thing that refuses one and not the other. Only the UI knows
whether a human meant to.

Two things were built. One survived.

- **A day-completion strip was tried three times and removed.** Tiles under
  the controls, then the same tiles inline, then seven small circles centred
  beside the date banner with a pulse on a day nobody had entered. Each was
  lighter than the last and none of them earned the room they took on a screen
  whose job is six nozzles — _"I just needed a visual indication… things did
  not work out."_ Its RPC (`get_reading_completion`, migration 037) went with
  it in **038**. The full account is in docs/UI_CONVENTIONS.md → "A day-completion
  strip on Readings was tried and removed", written down so a fourth attempt
  starts from what already failed rather than from the idea.

- **A checkbox that gates Save**, inside `ReadingForm`'s entry dialog. When a
  nozzle's last reading isn't literally the day before the one being entered,
  a red box names the missing day(s) and what saving now will do to them, and
  the Save button stays disabled until "Yes, \[day\] was missed on purpose —
  save this day anyway" is ticked. Not a second dialog stacked on the one
  already open — see docs/UI_CONVENTIONS.md → "A gap the database allows on
  purpose still wants a checkbox" for why a checkbox was the right shape here
  and `<ConfirmAction>` was not.

Verified with a fixture reproducing the exact scenario — a gap from Saturday
to Monday, and a control nozzle with no gap for contrast — at 1152 and 400px:
the Save button measured disabled before the checkbox was ticked and enabled
after it, at both widths.

## The dip that was measuring the wrong day

Reported as _"the daily stock reading when compared to dips differ by a lot"_.
Two bugs and a third found on the way, all in the same figure.

### The dip is taken before the day starts, and the maths assumed after

The Stock page was reporting a loss of a whole day's fuel, every day. On
11 Aug 2026 petrol showed a **loss of 1,652 L** and diesel a loss of 212 L.
Petrol had sold 1,683 L the day before and diesel 207 L. Not a coincidence:
the books were being asked the wrong question.

The pump dips the tanks **first thing in the morning**, before the pumps are
switched on, and records that dip against the same day — at the same sitting
as yesterday's nozzle readings. So a dip dated the 11th measures the tank at
the **close of the 10th**. `calculate_expected_stock` assumed the opposite, and
subtracted the 11th's sales — nothing yet, the day had barely begun — instead
of the 10th's. Every morning dip was compared against a book figure that still
had yesterday's fuel in it.

Corrected, the two dips whose timing we can actually vouch for read **+31 L**
on petrol and **−5 L** on diesel. The pump had been measuring itself accurately
the whole time.

`check_date` keeps its meaning — the day the rod went in, which is what the
person recording it knows. A new `taken` column ('morning' / 'evening') says
when, and **`books_date` is generated from the two**: the trading day the dip
closes, and what every gain/loss figure is now computed and reported against.
Existing rows default to morning, because that is the pump's routine; nothing
was re-dated. Migration **039**.

A second unique index on `(tank_id, books_date)` was added beside the existing
one on `(tank_id, check_date)`: an evening dip on the 10th and a morning dip on
the 11th are two measurements of one moment, and the monthly report would count
both.

### `expected_stock` was written once and never looked at again

Found while proving the first. The stored figure was a snapshot taken the
moment the dip was saved, and `gain_loss` is a generated column off it — so
anything entered _afterwards_ for an earlier date left it permanently wrong,
with nothing on screen to say so.

It had already happened. The dips for 3–8 Aug were back-filled on the 11th in
**newest-first order**, so every one of them took its baseline from the 2 Aug
dip instead of the day before it, and all six landed on the same phantom "gain
of about 3,300 L". Nothing was wrong with the fuel — the rows were computed
against a baseline that was superseded a minute later.

`expected_stock` is now **recalculated from history by trigger**, exactly as
`tanks.current_stock_litres` already was, and for the same reason. Four
triggers feed it: deliveries and readings are what happen _between_ dips, a dip
is the baseline for the next one, and a tank's opening stock is the baseline for
the first. The dip trigger is deliberately `after update OF` named columns —
the recalc writes `expected_stock`, and an unqualified trigger would call
itself.

Both derived columns joined the activity log's ignored list, so a day's
readings no longer credit whoever typed them with "changing" a dip taken last
week.

### The dashboard's tank stock ignored the date on screen

Reported separately: _"the tank stock on the dashboard is always the same as
today's no matter which day I am visiting"_. True, and unrelated to the above.
The card was rendering `tank.current_stock_litres` — a single cached number
meaning _right now_ — while `get_daily_summary` had always returned a per-date
`expected_stock` right beside it. One word. The tanks were the only block on
that page that ignored the date banner above them.

The "no dip recorded" link now opens the **next** morning's Stock page, since
that is the dip that closes the day being looked at.

### Correcting a dip

There was no way to fix a mistyped rod reading, and a dip is the baseline every
later figure is built on — so a wrong one is wrong for every day after it, not
just its own. The owner now gets **Clear this dip** (`<ConfirmAction>`, trash
icon, same as a purchase) and re-enters it. No edit form: a dip is two figures
and a note, so re-entering is no slower, and it keeps one code path for what a
dip is worth rather than two that could drift.

### How it was verified

The whole migration chain 001→039 was applied to a throwaway local Postgres 16
with a small `auth` shim, then seeded with the pump's real August figures, then
exercised: dips inserted in the scrambled order production really used, a
reading deleted and typed back, a dip deleted, a late delivery added, a
duplicate `books_date` refused. Deleting the 10th's reading reproduced the
**exact −1,652 L** the app was showing, and typing it back returned +31.12 —
which is the bug and its fix in one assertion. The activity log stayed silent
throughout.

### What this did NOT fix, and is data rather than code

Two things surfaced once the arithmetic was honest, both in days back-filled
from paper on the 11th and both for the owner to check against the register:

- **1 Aug looks crossed.** The tank opening stocks are petrol 854 L / diesel
  5,556 L; the dips recorded for 1 Aug are petrol 5,556 / diesel 854. Diesel
  cannot go from 854 to 4,720 overnight with no delivery, so the pair appear to
  have been entered into the wrong tanks.
- **8 Aug repeats 9 Aug exactly** — 5,533 and 2,337 on both days, for both
  tanks — which reads as a copied row rather than two measurements.

**Clear this dip** exists partly so these can be corrected now.

### The first dip was calling a typo a gain

Follow-up, once the timing fix was live: 1 Aug still showed _"Gain of 4,702 L"_
in green on petrol and the same loss on diesel.

The first dip on a tank has no earlier dip behind it, so
`calculate_expected_stock` falls back to the tank's **opening stock** from
Settings. That figure was _typed_, not measured — so a difference between it
and the first rod reading is usually two numbers disagreeing, not fuel that
moved. Rendering it in green as a gain says the opposite.

The first dip per tank is now named as such and coloured amber rather than
green/red, in the tank card and the history table: **"4,702 L away from the
opening stock"** and **"vs opening stock"**, with a note saying the baseline was
typed and to check it before reading the difference as fuel. Derived in the page
from the smallest `books_date` per tank — `getStockChecks()` is already uncapped,
so it needs no query and no column.

The wording deliberately stops short of "this is not a gain". If a pump sets its
opening stock and only dips a week later, real trading sits between the two and
the difference _is_ partly genuine. What is always true is that the baseline was
typed rather than measured, so that is what it says.

And the underlying figure was, in fact, a typo: working back from the 2 Aug dip,
diesel really held ~5,052 L and petrol ~1,408 L at the close of 31 Jul. The
Settings openings (5,556 / 854) are close to both. The dips as entered
(854 / 5,556) are ~4,200 L out on each — **the two tanks' readings had been
entered into each other's cards.**

## Stat tiles became their own raised cards, and customers got avatars

The owner sent screenshots of a MUI dashboard template he liked and asked for
the same feel: individually raised stat cards, a coloured trend pill instead
of plain sub-text, and an initials avatar beside each name in a list. The data
and every server call stayed exactly as they were — this is a rendering pass
on `StatTile`/`StatGrid` and the Customers table only, not a new feature.

**`StatTile` is now its own `.card`.** It used to be a cell inside one shared
card with 1px hairline dividers between tiles (`StatGrid` painted the dividers
by giving the grid a coloured background and gap-px). Four cells fused into one
slab read as a single block; four separately shadowed cards read as four
things to check off one at a time against the drawer, which is closer to how
the page is actually used. `sub` (the small caption under the figure, e.g. "23%
of takings") now renders as a rounded pill tinted by `tone` — brand-green for
`positive`, red for `negative`, grey for `default` — with a small filled
triangle for the two directional tones. This is the same information as the
plain grey line it replaced, just legible at a glance.

**`StatTile` grew an optional `icon` prop.** Passing an icon name (from
`Icon.js`) switches the tile to a horizontal layout — the icon in a tinted
ring at the left, label and figure stacked to its right — the shape the
reference screenshot used for its stat row. Left off, which is every existing
call site except the two on Customers, the tile keeps the plain label-over-
figure stack. This was deliberately opt-in rather than applied everywhere:
half the tiles in this app (litres sold, cash, credit) have no icon that
actually means anything, and forcing one on would be decoration standing in
for a real cue, which `docs/UI_CONVENTIONS.md`'s icon rule already warns
against.

**Customers got an initials avatar**, a coloured circle carrying the first
letter of the name, on both the active and the removed-customers tables.
`app/_lib/customer-avatar.js` picks the colour from a small hash of the
customer's id — not `Math.random()`, which would give a name a new colour on
every reload and read as a bug rather than a feature. Deterministic-per-id is
the "random" that was actually wanted: assigned once, stable forever after,
and one more thing besides the name itself that helps the owner spot a
regular in a long list. (An emoji-face version was tried first per an earlier
version of the same request and replaced with initials once asked for — the
hashing approach carried over unchanged, only the rendered glyph changed.)

**Verified** by rendering both components with realistic fixture data — five
customers with PKR six-figure balances, one over its credit limit, one in
credit — at 1100px and 400px. Screenshotted rather than just measured: the
pill sub-text and the icon ring both had to be checked for wrapping at the
phone width, and the "Rs 4,386,211 never wraps" rule from the type-scale
section applies to the new pill exactly as it did to the plain text it
replaced.

## One Material UI icon, and what it actually cost

Follow-up to the stat-tile restyle above: the owner asked specifically for a
Material UI icon on the Customers "Total outstanding" tile. `StatTile` grew
an `iconNode` prop — a rendered node, sized already — that takes precedence
over the existing `icon` (name-from-`Icon.js`) prop, so this one tile could
differ without teaching the shared icon set about a package the rest of the
app deliberately does not use (see `Icon.js`'s own comment on why there is no
icon library here).

**"Just one icon" turned out to be four packages.** `@mui/icons-material`
icons are components built on `@mui/material`'s `SvgIcon`, and `@mui/material`
itself needs `@emotion/react`/`@emotion/styled` as peer dependencies to
render at all — there is no way to import a single MUI icon without all
three riding along. Confirmed this with the owner before installing rather
than assuming "icons only" was actually one package. No MUI theme or
`ThemeProvider` was set up; the icon is used exactly once, styled with
`sx={{ fontSize: 20 }}` to match the 20px the rest of the icon set already
uses and inheriting `currentColor` from its ring the same way.

## Every icon migrated to Material UI

Follow-up to the single MUI icon above: the owner asked for the whole icon
set to move to Material UI, not just the one Customers tile, plus icon
rings added to the stat tiles across the rest of the app that didn't have
them yet (Dashboard, Readings, Lubricants, Reports, Company Assets).

**`Icon.js` kept its exact public shape.** Every one of the ~30 call sites
across the app (`AdminSidebar`, `DateNav`, `Pager`, `GuideFlow`,
`ReadingForm`, the Guide's bilingual content data, `CompanyAssetForm`'s
category picker, …) still writes `<Icon name="..." className="h-5 w-5" />`
unchanged. What changed is entirely inside `Icon.js`: the old file exported
a `PATHS` map of name → hand-drawn `<path>` JSX rendered inside one shared
`<svg>`; the new one exports a `COMPONENTS` map of the same names → MUI
Outlined icon components. Every existing name kept its old meaning (the
comments explaining _why_ a name looks the way it does — the wrench for
Machinery, the briefcase for Assets — carried over to the new file), so no
caller had to change what name it asks for.

**Sizing needed a wrapper, and this was the one real gotcha.** The old
`<svg className="shrink-0 h-5 w-5">` sized itself directly off the passed
Tailwind classes. MUI's `SvgIcon` sizes itself in `em` via its own
Emotion-generated CSS class, and Emotion injects its `<style>` tags at
runtime — which can land _after_ Tailwind's build-time utilities in the
document, and when two classes of equal specificity disagree, the later one
in the stylesheet wins. In practice this meant `className="h-5 w-5"` on the
icon directly was not a reliable way to size it; some icons could render at
MUI's own default 1em/24px regardless of what was asked for. The fix:
`Icon` now renders `<span className={className}>` (a plain sized box) with
the MUI icon inside stretched to `style={{ width: '100%', height: '100%'
}}` — an inline style, which always wins the cascade regardless of
injection order. Every icon in the app is sized by its wrapper span now,
not by the icon component itself.

**Colour needed no change.** MUI's `SvgIcon` fills with `currentColor` by
default when no `color` prop is passed, the same mechanism the hand-drawn
set used — so every existing `text-*` class already controlling an icon's
colour (the amber warning triangle, the brand-green check, a red delete
icon) kept working without being touched.

**Stat tile icon rings, applied to every existing stat row.** Each icon was
picked for what the figure actually is, not decoration: a fuel pump for
litres sold (Dashboard, Readings), a price tag for Sales, a card for On
credit, a wallet-with-coins for Cash, a delivery truck for Stock bought, a
trending-up arrow for Profit. Company Assets' "Biggest holding" tile reuses
the _same_ per-category icon (`vehicle`/`machinery`/`property`/…) that
`CompanyAssetForm`'s category picker already shows, rather than a new
generic icon, so the tile tells the reader which category actually won
rather than just decorating the word.

**`StatTile`'s icon-ring layout grew a fix while wiring this up.** The
Reports "Profit" tile's `sub` — "sales − stock bought − expenses" — used to
sit in the text column beside the icon ring, and wrapped to three cramped
lines there once the ring took width away from that column. `sub` now
renders on its own row below the icon+figure, spanning the full card width,
so the same text wraps at most once. Caught by rendering the fixture data
and screenshotting, not by a DOM measurement — see the project skill on why
that check matters.

**Verified** the same way as the earlier passes: a disposable devcheck route
(deleted before commit) rendering the full sidebar icon set at 24px, the
chevron rotations used by `Pager`/`DateNav`, and every page's stat row with
its new icon, screenshotted at 1100px and 400px.

## Every MUI icon was hydration-broken, and the fix was one provider

The owner hit a hydration mismatch on `/admin/readings` right after the
Material UI icon migration landed — React's error named `ChevronRightOutlinedIcon`
specifically, but the cause was not specific to that icon at all.

**The actual cause.** MUI's icons render through `SvgIcon`, styled by
Emotion. Emotion normally injects a `<style data-emotion="...">` tag next to
whatever it styles, and on the server that has to be collected and streamed
down as part of the same response — otherwise the server-rendered HTML has
no style tag (styles get generated but never flushed to the response) while
the client's own first render generates and inserts one, and React sees the
mismatch as soon as it tries to reconcile the two. `app/layout.js` had no
such collection in place: the whole MUI migration had been visually
verified by rendering pages and screenshotting them, which caught wrapping
and sizing bugs but not this, because a plain server render followed by a
Playwright screenshot never distinguishes "the server sent the right HTML"
from "the client silently regenerated it after a hydration error" — both
end up looking identical in a screenshot. The bug needed something actually
checking the browser console, which the earlier verification passes had
not done.

**The fix.** `@mui/material-nextjs`'s `AppRouterCacheProvider`
(`v16-appRouter`, matching this app's Next.js version) now wraps `children`
in `app/layout.js`. It runs Emotion's cache through Next's
`useServerInsertedHTML`, so styles generated during the server render are
flushed into the same response instead of appearing only after client-side
hydration. Confirmed both ways: the browser console is silent where it
previously threw a hydration error, and the raw SSR HTML (`curl`) now
contains a `data-emotion="mui ..."` style tag inline, which it did not
before.

**What this means for anything else that reaches for MUI later.** Any MUI
component styled through Emotion needs this provider present, not just
icons — `Icon.js` only surfaced it first because it is the one place MUI
is used today. If a hydration error names a Material UI component,
check `AppRouterCacheProvider` is still wrapping the tree before looking
for a bug in that component itself.

## Banking joined the shared stat tiles, and its account cards separated

The Banking page had been left behind by the stat-tile restyle: its three
headline figures were a private `Stat` component and a hand-rolled
`grid gap-px bg-ink-200` strip - the exact fused-slab shape `StatGrid` had
already moved away from - and its account cards ran name, balance and the
two paid-in/paid-out figures together as one block of text.

- **The three totals now use the shared `StatGrid`/`StatTile`**, with icon
  rings like every other page: a bank for Balance now, cash for Paid in,
  a wallet for Paid out. The page's own `Stat` function is deleted; there
  is no longer a second implementation of a stat strip anywhere in the app,
  which was the whole point of extracting `AdminStats` in the first place.
  `StatGrid` gained a `columns={3}` option for this - it previously
  understood only 2 and 4.
- **Account cards carry the same tinted icon ring as a stat tile**, so a
  card reads as a sibling of the figures above it rather than as an
  unrelated block, and the account name moved up from `text-sm` to
  `text-base` (it is the card's heading; it was the same size as the bank
  name beneath it).
- **Paid in and paid out became tinted panels** rather than two bare figures
  under a hairline rule. They were 12px labels over 12px figures, with the
  green/amber colour doing nearly all the work of telling the two apart -
  now each has its own edge, the figure is `text-base`, and the labels sit
  at the app's 12px floor rather than below it.
- **The In/Out columns in the transactions table gained direction arrows**
  (`moneyIn`/`moneyOut`, an arrow coming in and one going out). Those two
  columns were previously identical in shape and told apart only by which
  one had a figure in it and what colour it was - green against amber,
  which is exactly the colour pair the icons rule in
  `docs/UI_CONVENTIONS.md` says must never be the only cue.

## Colourful stat rings, and every button became Material UI

Two requests together: the icons "look boring", and the buttons should be
Material UI so they look more professional.

### The rings are coloured by meaning, not by tone

Every icon ring was the same grey, which made a row of four tiles read as
four identical objects — the ring was taking up space without doing the one
job it has, which is letting the reader pick out the tile they want without
reading the labels. `RING_COLORS` in `AdminStats.js` now maps each icon name
to a colour: green for cash and profit, amber for credit and expenses, blue
for fuel, violet for oil (already lubricants' badge colour), teal for stock
on the shelf, red for a warning.

**Colour follows what the figure IS, not whether it is good news.** `tone`
already colours the figure and its pill, so a loss shows as a red number
inside a green "profit" ring. Driving both from `tone` was the obvious
alternative and is wrong: it says the same thing twice, and it puts every
tile in a bad month into the same red, which is exactly the sameness the
colour was added to fix. Unlisted icons fall back to neutral slate so a new
one is never accidentally loud.

### Buttons

`app/_components/ui/Button.js` wraps MUI's `Button` and maps the app's three
intents (`primary` / `secondary` / `danger`) onto MUI variants, so call sites
still name an intent rather than a Material recipe. All 79 usages across 35
files were migrated and the `.btn-*` classes deleted from `globals.css` —
leaving them would have meant two button systems, which is what this
replaced.

**The tap targets got smaller, and that was a deliberate, informed choice.**
The old classes were `py-3`, about 50px, chosen because this app is used on a
cheap tablet and pressed with a thumb. MUI's default medium Button is about
36px. The trade was put to the owner explicitly — MUI's default look means
smaller targets, uppercase labels and Material blue instead of the brand
green — and the owner chose MUI's defaults as-is. `size="large"` in
`Button.js` is the one-line reversal if the smaller target turns out to bite
in the yard.

Two hand-rolled buttons folded into the shared component along the way. The
more interesting one is Clear this day, which had written its styles out by
hand *specifically* so that with nothing to clear it went grey rather than a
faded red — "unavailable at a glance, not a warning". MUI's own disabled
state is that grey, so the reason for the special case disappeared with the
migration.

### What the verification caught, and what it nearly missed

`npm run build` passed with a `Button is not defined` bug live in
`Pager.js` — the import pass had run before six files were hand-edited, and
a missing identifier inside a client component is a runtime error, not a
build one. It surfaced only on actually loading the page. Worth remembering
next time a mechanical migration "builds fine": for this class of change the
build is close to no evidence at all.

Verified by rendering the real dialog components (Customer, Asset, Bank
account, Clear day) and clicking each trigger open, plus `/admin/login` as a
real route, checking the browser console was clean at each step. The `+`
glyph in "+ Add an asset" rendering flush against its label — MUI only
spaces its own `startIcon`, not ordinary children — was found this way and
fixed with a `gap` in the wrapper.

## Readings: the card became the unit

The owner's verdict on the entry screen was that it looked "stacked and
boring", which it did, and the screenshot made the reason plain: six
identically-shaped full-width cards down the page, each the same height and
the same weight, with the unit heading a small caption floating above every
pair.

**One card per unit, nozzles as rows inside it.** A unit is a physical pump
standing on the forecourt with two nozzles bolted to it. The flat list gave
that nothing to be — an earlier pass had already tried to carry the grouping
with spacing alone (32px between units, 12px inside one), and spacing turned
out not to be enough against six identical slabs. Making the card *be* the
unit gives the page three objects to work through instead of six, and lets
the rows get shorter, since they no longer each need their own card edge and
shadow.

**The unit header carries a progress bar** beside the existing "1 of 2
entered" chip, green once the pump is finished, so a completed unit is
skipped without reading its rows. The bar and the words say the same thing —
the bar is the glanceable half, not the only carrier, which is the same rule
the tank-fill bars on the Dashboard already follow. It is hand-rolled to
match those rather than pulled from MUI: the visual result is identical and
the app already had the pattern.

**The unentered row is now the tinted one, and this is the real fix.** The
page is opened every evening to answer one question — what is left to enter —
and a finished nozzle looked exactly as loud as one still waiting: same
white, same size, same weight. Rows still to do wear a soft amber wash, the
same amber the Enter chip already wears, so no new colour language was
invented and the remaining work is what the eye lands on.

### The fuel colour nearly disappeared silently

Moving the fuel accent from a rule across the top to one down the left edge
looked correct in the code and rendered as a plain grey edge. `color.accent`
is `border-t-[#38727F]` — a top border *colour*, so pairing it with
`border-l-4` sets a 4px left border in the default grey and paints the fuel
colour on an edge that has no width. The fix is `color.border`, which is the
same hue with no side bound to it. Worth knowing because nothing errors and
the class name reads as if it should work; it only showed up in a screenshot.

## The button migration broke six pages, and the build said nothing

The owner hit *"Functions cannot be passed directly to Client Components"* on
the customer page, and then, separately, *"page not found"* when clicking a
customer from the list. Both were the same bug.

**The cause.** The Material UI button migration rendered a
button-that-navigates as `<Button component={Link} href=...>`. `Button` is a
client component, `Link` is a function, and a function cannot cross the
server/client boundary — so every *server* component doing this throws at
render time. Six did: the customer detail page, the guide, daily sales,
`DateNav`, `Pager`, and the customers list by way of `Pager`. The customer
detail page managed to contain the bug twice, once itself and once through
the `Pager` at the bottom of its ledger.

**Why it presented as a 404.** Clicking a row is a client-side navigation,
which fetches the RSC payload for the target route. That payload failed to
generate, and a failed payload lands on not-found — so the visible symptom
was "page not found" rather than the actual error, and it only happened when
*clicking* rather than loading the URL directly.

**The fix** is to stop passing the component at all. `<Button>` now takes
`href` (a string) and `pending` (a boolean), both of which serialise, and
resolves `Link` or `PendingLink` on the client side of the boundary itself.
`component` is still accepted for the few client-side callers and for
`component="a"` — a string, so it crosses fine — which the Excel download
needs so the browser handles it rather than the client router.

### The verification lesson, for the third time this branch

`npm run build` passed with all six pages broken. The build compiles and
prerenders; it does not execute an auth-gated dynamic route, so the whole
class of "server component hands something unserialisable to a client
component" is invisible to it. The same branch had already shipped a
`Button is not defined` this way.

What actually caught it was a devcheck page deliberately written **without**
`'use client'` — a real server component rendering `Button`, `DateNav` and
`Pager` — and a Playwright run that *clicked* a link rather than loading the
URL, reproducing the client-navigation path. The fix was then confirmed the
only way worth trusting: by reintroducing the bug and checking the test went
red (it did, with the owner's exact error), then removing it again.

## Petrol went blue, diesel went orange

The owner asked for a pair his father cannot mix up. The mistake being
designed out is concrete: a closing reading typed against the wrong nozzle,
which poisons every later day because each opening comes from the day before.

**Blue against orange, dark against light.** The old pair — the owner's own
teal `#54A2B3` and yellow `#FCFC62` — worked, but only just. They sat 2.67x
apart in luminance, and the yellow was near enough to lubricant's gold to blur
a purchase list. The new pair is 4.48x apart, on opposite sides of the colour
wheel, and differs in a third way as well: petrol's fill is dark and carries
WHITE letters, diesel's is light and carries DARK ones. Three independent
cues, so the pair survives a dim office, a failing screen, and colour-vision
deficiency — blue against orange does, where red against green would not.

The module's own rule was the thing to respect here, and it nearly got broken:
the first candidate was a mid blue against a mid orange, which is a fine-
looking pair and 8.3:1 against 7.9:1 — i.e. the same weight, exactly what the
owner rejected once before as "they both look the same, both are dark". The
lightness gap is checked now rather than assumed, and the numbers are written
into `fuel-colors.js`.

**`border` is a step lighter than `onWhite`.** At text-grade darkness the 8px
nozzle rail read as near-black for petrol and as brown — close enough to the
app's red to look like a warning — for diesel. A rule only has to be seen; text
has to be read, so the two jobs take different values of the same hue.

**Two things had to move out of amber**, because diesel now owns orange and two
warm colours competing on one row is exactly the confusion this was meant to
end: the readings "Enter" chip (now neutral slate) and the unit progress bar
(now green whether part-done or complete). The nozzle row's state tint
inverted as a result — a finished row settles into a faint green matching the
check in its unit header, and a row still to enter stays plain white and stands
out against them. The colour budget on that row belongs to the fuel.

**A corner of the app was still on the old colours and nearly stayed there.**
The customer detail page's "Fuel taken in total" tiles hard-coded `bg-sky-50`
and `bg-amber-50` instead of calling `fuelColor()`, so they were invisible to
a change made in the module — the exact drift that caused the module to be
written in the first place. Found by grepping for fuel names next to colour
classes rather than by looking, which is the only reliable way to find this.

**Verified** by rendering all three badges together, the filled bands, the
Stock dip boxes (the other surface where typing into the wrong one costs
something) and the full readings sheet with both fuels interleaved, at 1100px
and 400px.

## The Readings unit header wears its fuel

The header strip had a wide empty middle and said nothing the rows below did
not already say. It now carries the unit's fuel as a filled band - pale while
there is still a nozzle to enter, filled dark once the pump is finished.

**Hue says which fuel, lightness says whether there is work left.** Two
questions on two channels, so neither has to borrow the other's. That needed a
new pair of tokens in `fuel-colors.js` - `soft` (pale tint, own dark text) and
`strong` (dark relative, white text) - because `solid` could not do the job
alone: for diesel `solid` IS the light band, so an emphasised header built
from it would have come out paler than the quiet one.

Everything inside the band takes its colour from the band rather than being
coloured itself - `currentColor` for the icon, white-alpha for the chip and
the progress track - which is what lets one pair of classes serve both a pale
band with dark text and a dark band with white text. The progress fill is the
only exception: green on a pale band, white on a filled one, because green on
dark rust is a third hue fighting for a 6px strip.

**A unit with two different fuels falls back to neutral.** A dispenser is
normally plumbed to one tank and every unit at this pump is single-fuel, but
the schema does not require it, and a unit selling both would be mislabelled
by either colour. Rendered that case deliberately in the check rather than
assuming the real data would never produce it.

## The finished unit's progress bar was reading as a stray white rule

Reported as "the progress bar looks white even when filled". It was: on a
filled dark header a 100% bar is entirely fill, with no empty track left to
contrast against, so it stopped looking like a bar and started looking like a
white line left behind by mistake.

The bar is now only rendered while a unit is unfinished. A finished one is at
100% by definition, so the bar was carrying no information there - the filled
band, the check icon and "2 of 2 entered" already say it three times over. The
general rule, which is worth remembering the next time a progress indicator
goes on a coloured surface: **show a bar only while there is progress left to
show.**

The gap between unit cards also went from 20px to 32px, so the three pumps
read as three separate things to work through rather than one continuous
stack.

## Colour audit: eleven hues down to two palettes

The app had drifted to roughly eleven hues. Counting the Tailwind colour
classes across `app/` found ink 672, brand 144, red 120, amber 104 - a
coherent core - and then sky 17, violet 12, indigo 8, teal 6, cyan 4, rose 2,
orange 1, plus MUI's own blue on every button. The stragglers were the app
looking home-made.

It now has **two vocabularies that never overlap**: chrome (green, amber, red,
slate) for what the app is doing, and the fuels (blue, orange, gold) for which
fuel something is.

### MUI's stock palette could not be used

Its primary is a blue and its warning an orange - exactly the two colours the
fuels had just been given so the owner's father cannot mix up a nozzle. Using
them would have put a blue button beside a blue Petrol badge on the Readings
screen and spent the cue on chrome. So `AppTheme.js` themes MUI to the app's
own palette instead: green primary, red error, amber warning.

That also closed a split the app already had. Buttons were MUI blue while
links, success messages, "Entered" chips and every positive figure were brand
green - two primaries, and the blue one belonged to neither the app nor the
fuels.

**Primary is brand-700, not brand-600.** MUI puts white text on a contained
button, and white on brand-600 (#059669) is 3.77:1, under AA - which the old
`.btn-primary` had been shipping unnoticed since it used the same fill.
brand-700 is 5.48:1. Confirmed against the rendered button rather than the
source: computed style reported `rgb(4, 120, 87)` on white.

### What the decorative hues were actually doing: nothing

Three places used colour only to tell items apart, and all three already had a
stronger cue:

- **Asset categories** had five hues and five distinct icons - a car, a
  wrench, a building, a monitor, a tag. Shape survives poor light and colour
  blindness, which is the argument `Icon.js` already makes for having icons at
  all, so the hue was a weaker copy of what the icon said. Neutral chips now.
- **Customer avatars** had seven hues; the initial is what identifies the
  customer. Four tints of slate and green now, enough to keep a list from
  looking uniform.
- **Stat tile rings** had seven hues, one per KIND of thing - fuel blue, oil
  violet, stock teal, banking indigo. Two of those were the fuels' own colours,
  so a ring on "Litres sold" quietly competed with the badge. They now carry
  meaning only: green money arriving, amber money owed, red look at this,
  slate otherwise.

The rule that came out of it: **colour a thing only when the colour adds
meaning its shape does not.**

### One colour was left alone on purpose

`CashCreditChart` uses green and violet, which looks like exactly the kind of
stray hue this audit was removing, and the obvious fix was to make credit
amber to match the "money owed" ring. The file says not to: that pair was
chosen with a palette validator because green/violet separates for red-green
colour blindness (deutan dE 25.2) where green/amber does not. Consistency does
not outrank being readable. It is now marked as a deliberate exception so the
next audit does not spend the same half hour rediscovering it.

Two stale references also went: a Dashboard comment still describing diesel as
`#FCFC62` yellow, and a chart comment calling the fuel pair "navy/yellow".

## Company Assets reach the monthly workbook

The owner opened the Excel download expecting the month's whole record and
found Company Assets missing - it was the one section of the app with no
column in the export. Three layers had to learn about it: the RPC, the
template, and the writer.

**`040_company_assets_in_the_export.sql`** adds `asset_rows` and an `assets`
summary to `get_month_export`, restated in full because plpgsql cannot replace
part of a function body - the same reason 019 and 030 are full copies.

**The Assets sheet is the only one that ignores the report's month.** It
carries the whole register with an `in_month` flag rather than just that
month's purchases. An asset register answers "what does the business own", and
most months the pump buys nothing at all - a month-scoped sheet would be empty
in those months and read as a bug rather than as a fact. "Bought this month"
is a column instead, so the sheet still filters down to the month when that is
the question. `bank_accounts` already set this precedent by carrying standing
balances beside the month's movements.

**Not counted in profit, and the Summary block says so.** Money spent on a
delivery bike is not a cost of trading the way a fuel delivery is - the pump
still has the bike - and the app has never counted it as one. The figure
without that sentence is one somebody subtracts by hand, so the block carries
"Not counted in profit above" the way the BANK block carries its own note.

### What the readback caught

The sheet was verified by generating a real workbook from fixture data and
reading it back with openpyxl, not by trusting the code. Two things came out
of that which review would not have:

- The Category column was printing the raw Postgres enum (`vehicle`) where the
  app shows `Vehicle`. It now maps through `ASSET_CATEGORIES`, the same list
  the picker and the page use, rather than capitalising by hand.
- Applying that mapping, the edit landed on the **Expenses** sheet instead -
  both had a bare `row.category ?? ''` and the first match won. Expense
  categories are free text and would have been silently mangled by an asset
  enum lookup. Caught only because the readback showed Assets still lowercase.

The renumbering trap in the template was checked rather than assumed: after
regenerating, every existing sheet still maps to its original `sheetN.xml` and
the three chart parts are untouched. Assets is `sheet10.xml`, appended last.

## Reports headings, a shorter note, and the Expenses page

Three things the owner asked for after using the pages for real.

**The section headings were not prominent** - and the reason was that
`.section-heading` and `.figure-label` were nearly the same style. Both small,
uppercase, tracked, ink-600, so "Lubricants" over a row of tiles was set like
the "SOLD" caption inside one of them. A heading typeset as a caption does not
read as a heading. It is now `text-lg font-bold text-ink-900` and NOT
uppercase; dropping the uppercase does most of the work, since that was the
feature the two shared most visibly. Fixed in the shared class rather than on
Reports, so every page gains it.

**The explanatory note under the tiles was four lines and is now one.** It
explained that profit counts stock bought rather than sold, why a late delivery
flatters it downwards, and that both trades are included - all true, and the
verdict was "too long". Only the first clause changes how a figure is read;
"both trades" was already covered by the Sales tile's own sub-line, which
itemises fuel and lubricants. The full reasoning is in the Guide and on the
workbook's Summary sheet, where there is room.

> Read later: that note was rewritten a second time in **049**, because the
> formula it was explaining turned out to be wrong. It no longer apologises for
> the figure; it shows the working. See "Profit was counting stock bought
> instead of stock sold" near the end of this file.

**Expenses** got the shared stat tiles (it was the last page still rendering
its total by hand), and its by-category list became a real breakdown with
share bars and percentages - a column of figures of different digit lengths
does not answer "which costs dominate" without arithmetic.

Two tiles, not three, and both cuts came from rendering it: a "biggest
category" tile arrived truncated to "salary of haseeb…" because StatTile keeps
its value on one line - correct for money, wrong for free text - and a third
tile repeated the month's total under "counted in profit", which is not a
second fact. That link moved into the first tile's sub-line.

### The category box now remembers

The same screenshot showed why the breakdown was worth so little: most of the
month sat under "Other", and one category was the sentence "salary of haseeb
and pump tea and lunch". The form offered seven fixed suggestions and no
memory, so every entry invented its own wording. `getExpenseCategories()` now
returns what has actually been used, most-used first, ahead of the stock list.

The rule this leaves behind: any free-text field whose values are later
grouped, totalled or filtered should offer what has already been used, or the
grouping quietly becomes noise.

### Where MUI earned its place, and where it did not

`CategoryBreakdown` uses MUI's `LinearProgress`; the tank gauges and the unit
progress bar stay hand-rolled. The distinction is the surface: a FILL gauge
sitting inside a coloured band needs its own track and fill colours against
that band, while a share-of-total bar in a plain list is exactly what
`LinearProgress` is. Worth knowing the app now has both, and which to reach
for.

It is also a server component with no `'use client'` - nothing in it is
interactive, and that is what lets it use `formatPKR` from `helpers.js`, which
reads request cookies and cannot enter a browser bundle. Importing MUI's own
client component from a server one is fine; only the props have to serialise.

## The Sale & Stock Register

The owner's own spreadsheet, brought into the app. He keeps a sheet called
*"Fuel - Daily Sale & Stock Register"*: one row per trading day per tank, with
opening stock, receipts, meter sales, the book stock those imply, the dip that
actually measured the tank, and the difference — and then, circled in yellow on
the screenshot he sent, **the sales and the variance accumulated down the
month, and both as a percentage.**

Those cumulative columns are the point of the sheet, and nothing in the app
could produce them. The Stock page answers "how did the tank do yesterday" and
Reports answers "how did the month total up"; neither answers the question in
between, which is the one that catches a problem. A single day's variance is
noise — a rod reading is a person squinting at a wet stick, and ±30 L on a
5,000 L tank is the measurement, not the fuel. A leak or a theft looks like a
**cumulative** variance that walks in one direction and a percentage that will
not come back towards zero.

Live at `/admin/reports/register`, reached from a button on Reports rather than
from the sidebar, with a banner saying it is a preview — it is deliberately not
a fixed part of the app yet. Everything on it is real data through the same RLS
and the same `requirePageRole` as every other page; "for testing" describes the
design, not the numbers.

### Migration 041, and the one thing that had to be checked

Two RPCs, both `super_admin`-gated the same way every other reporting function
is:

- **`get_stock_register(from, to)`** — one row per tank per day, cumulative
  columns included, computed with a window function. Cumulative means
  cumulative *within the range asked for*, which is what the spreadsheet does
  and what makes the figure answerable: "we are 213 L up over these eleven
  days" is a sentence about a period somebody chose.
- **`get_range_summary(from, to)`** — profit over an arbitrary run of days.
  `get_monthly_report` already answers this and *cannot* be reused: it takes a
  year and a month, not two dates, so it can only ever describe a whole
  calendar month. The arithmetic is copied deliberately, and if one changes
  both change or the two pages start disagreeing about the same days.

**The variance is recomputed rather than read off `stock_checks.gain_loss`**,
and that needed proving before it could be trusted. A register is read across,
so a variance column that did not equal the arithmetic of the columns beside it
would be unreadable however right it was — but the app reports gain/loss from
`gain_loss` everywhere else, and two sources for one number is how books start
disagreeing with themselves. So the derivation was run against every dip the
pump has recorded, 1–11 Aug 2026, petrol and diesel: **all 22 rows exact.** If
they ever stop agreeing, `gain_loss` is the one to trust.

**Opening stock is yesterday's dip, falling back to the books.** A measured
number beats a calculated one — the same rule `calculate_expected_stock` uses
to pick its baseline. After a day nobody dipped there is nothing measured to
use, so it falls back to the book value carried forward. And `books_date`
throughout, never `check_date`: this pump dips in the morning, so the rod that
went in on the 11th measures the close of the 10th. Migration 039 is the story
of what getting that wrong costs.

### What the screenshots changed, which was most of the layout

Four rounds, and every one of them found something a DOM measurement had
already called fine.

**The point of the page was off-screen.** With the sidebar, a 1152px window
leaves the table about 880px and a 1024px one about 750px. Ten numeric columns
fit in neither, so it scrolled inside its card — the app's normal answer — and
scrolled to its natural start the columns on screen were *opening stock* and
*receipts*, with the cumulative block off the right-hand edge at every width
including a phone. A table whose point is invisible until you scroll is a table
that will be read wrong.

The fix is **the date column pinned left and the cumulative block pinned
right**, so whichever way it is scrolled the reader can see which day a row is
and where the running totals stand; the working in between is what slides. New
`.pinned` / `.pinned-left` / `.pinned-right` classes in `globals.css` — the
horizontal counterpart of the sticky heading that was already there, and the
first table in the app to need it.

**The z-index had to live in the stylesheet, and that cost a screenshot to
find.** `.table-scroll thead th` gives every header cell `z-index: 10`, and it
outranks anything MUI's `sx` emits — a class plus two elements against one
class. So the pinned headers, carrying `z-index: 2` from `sx`, were painted
*over* by the ordinary headers they were meant to cover: the cumulative block's
figures appeared under a heading reading "Litres, %, %". The numbers were right
and the heading above them was wrong, which is the worst way for a table to
fail, and no measurement would ever have caught it.

**Two columns came out, because a scrollable region clips at its edge.** The
first render clipped straight through a dip reading — `5,219.(` — which reads
as broken data rather than as more table. The day's sale in rupees went (not
part of the stock reconciliation; the fuel cards above carry the same days'
takings) and so did Total Stock (it is opening plus received, the two columns
to its left, and with deliveries a handful a week it was a verbatim copy of
Opening on most rows). At 1152 the clip now lands in the gutter and only whole
columns hide.

**The pinned columns are sized by the phone, not the laptop.** At 400px they
are very nearly the whole table, and at their first widths they overlapped:
the date rendered as `01 Aug 202`, a truncated year, which reads as corrupt
data rather than as a layout problem. 7 + 6 + 5.5 + 4.25 rem fits 400px.

**`.table-scroll`'s phone bleed had to go on a pinned table.** It is
`-mx-4 px-4` below `sm`, and a sticky offset is measured against the
scrollport's *padding* box — so `left: 0` stopped 16px short of the card edge
and left a strip of ordinary scrolling table showing past the pinned column.
Painting over it with an offset box-shadow was tried and did not work;
`.has-pinned-columns` zeroes the padding instead. The bleed still happens — the
negative margin is what does that — and the cells' own padding gives the end
columns their room.

**And the fuel headings were flush against the paragraph above them**, because
each table had been wrapped in a `<section>` and `.section-heading` carries
`first:mt-0`. Every heading had become its container's first child and lost its
margin. A `<Fragment>` instead: the grouping was decorative, the spacing was
not.

### Material UI, at the owner's request, and what that settled

The page is MUI throughout — `Table`, `Paper`, `TextField`, `Alert`, `Chip` —
and almost none of it is a Client Component. MUI's own components carry their
`'use client'`, so a server component may render them freely; only
`RegisterRange` is `'use client'`, because it genuinely has state. That is the
same lesson `CategoryBreakdown` already recorded, applied to a whole page.

`MoneyTile` duplicates `StatTile`'s shape and type sizes on a `Paper` rather
than mixing the app's `.card` into an MUI page. That is a deliberate temporary
state, and it is noted in the file: if the register graduates from a preview,
the right move is to pick one of the two and delete the other, not to keep
both.

**The range picker is a from/to pair, which `<TrendRange>` deliberately is
not**, and the difference is worth stating rather than looking like a lapse.
The Dashboard's charts answer "how are we doing lately" — the end of the window
is always today and "last 30 days" is the whole question. This page answers
"reconcile these particular days": the month so far, the ten days since a
delivery, one week somebody is suspicious about. A fixed window cannot express
any of those. What it does borrow is everything else — the range cannot be
entered backwards (each end drags the other), cannot be empty, is two
`<select>`s of real days rather than free text, is validated again on the
server, and rides in a plain `method="GET"` form so the URL carries it.

### And then the naming, which one question settled

The owner looked at the finished table and asked, of the totals row, **"what is
these days"**. Four words, and the whole verdict on a label: he did not know
whether it was another day, a total, or something else.

That prompted a pass over every word on the table, and it found more than the
one label:

- **The totals row is now two lines - "Summary" over "01–07 Aug"** - because
  one line cannot do both jobs the reader needs: that this is not another day,
  and which days it covers. "Summary" rather than "Total", because two of the
  row's own cells are not totals: opening stock and the closing dip are the two
  ENDS of the range, and summing every day's opening stock would be a figure
  with no meaning. Calling it a total would promise arithmetic it deliberately
  does not do. The dates sit underneath in ordinary case so the pair does not
  read as one shouted phrase, and the month is stated once because the range
  picker cannot span two.
- **"Variance" became "Gain / loss" everywhere**, which is the real fix. That
  word came in from the owner's spreadsheet, but the app's own vocabulary is
  gain/loss and always has been - `stock_checks.gain_loss`, the Stock page's
  own column heading, and the fuel cards at the top of this very page, which
  already read "Stock gain / loss over these days". The register was the only
  surface in the app using a different word for the same number.
- **"Books" became "Should be".** "Books" is bookkeeping's word for it, not the
  owner's, and the column beside it is "Dip" - so the pair now reads "should
  be 5,223.54, dip 5,219.00" and the gain/loss between them explains itself.
- **"Cumulative" became "Running total"**, which says the same thing without
  the Latin.
- The explanatory note under the tables was updated to name the columns exactly
  as the headings now do. It had said "Books" and "variance" while the table
  said something else, which is how a legend stops being read.

One heading also had to be shortened after rendering it: "Gain / loss that
day" wrapped to two lines and then clipped at the pinned block's edge, showing
as "GAIN / LOSS T" over "DAY". It is just "Gain / loss" - paired against
"Running total" beside it, the contrast already says which is which.

## Readings: inline entry built and reverted, and the cash-up bar that stayed

The owner asked for a complete redesign of the daily entry screen. It is the
most-used page in the app, and `docs/UI_CONVENTIONS.md` already records three
separate designs that were built here and reverted — so this started by reading
that history rather than by drawing. Nothing reverted was reintroduced: no
day-completion strip, the unit-as-card grouping kept, the day banner untouched.

**The diagnosis was the flow, not the paint** — and half of it was right.
Each nozzle opened a dialog, so an evening's work — six numbers — cost six open
/ type / save / close round trips, the page covered over each time by the thing
it had just launched. The giveaway was that the dialog had grown its own running
total panel: the page's own figures were unreachable from inside the task.

**The inline rebuild was then reverted at the owner's request** — *"model window
was better"* — and the reasoning is written up in `docs/UI_CONVENTIONS.md` so it
is not attempted a second time. Short version: the round-trip count was a real
cost, but what the dialog buys this particular task is **one nozzle on screen
and nothing else**. A reading typed against the wrong nozzle is the mistake the
entire screen is designed around; expanded in place, the row being typed into
sits in a column of five near-identical siblings. The dialog's cost is
navigation, and its value is that there is nothing else to type into by
mistake.

**The cash-up bar survives the revert and is the part that stayed.** It solves
the same complaint — the page's totals being unreachable from the bottom of a
six-row page — without touching where the entry happens.

What follows describes the inline version as built, in the past tense, kept
because it is the record of what was tried. **None of it is in the app**; the
cash-up bar section after it is.

### The row opened where it stood

Tapping a nozzle expanded it in place. Type the closing reading and the
litres and the value compute under it as you type, exactly as the dialog did,
because it is the same `EntryForm` — none of the hard-won validation moved. All
of it still applies: the overlap check that stops a day being counted twice
(migration 026), the gap checkbox (027), the chain warning, and the refusal when
credit slips exceed what the nozzle sold.

Around it:

- **The chip became the way out** — an open row read "Close" — and the form
  grew a Close beside Save, since in a tall panel the chip has scrolled off.
- **The panel was unmounted when closed, not hidden.** That is what discarded a
  half-typed closing reading rather than letting it reappear against a day the
  reader had since navigated away from.
- **The collapsed row was one line instead of a four-column grid.** It had spent
  two labelled columns on the opening meter and the rate and a third of its
  width on the sentence *"Tap to enter the closing meter reading."* — printed
  six times down a page where every row already carried an Enter chip and a
  chevron saying the same thing. The instruction is gone because the input it
  described was in the row. The labels were not: "Meter starts at
  1,988,061.61" is still a labelled figure. **This came back with the revert** —
  the sentence is defensible again now that tapping really does open something
  else.
- **And that line disappeared when the row opened**, because the form beneath
  stated both figures again with proper labels.

All six nozzles fitted on one screen at a laptop width, where three and a half
do behind the dialog. That was the gain, and it did not outweigh having five
near-identical siblings around the row being typed into.

### A cash-up bar that only appears when it is needed

The four stat tiles stay at the top of the page, at the owner's choice. But the
last nozzle is a long way below them, and the question being answered while
typing into it — *does this match the notes in the drawer* — is a question about
the day's total, asked at the point furthest from where the day's total is.

`ReadingsCashUpBar` is a slim dark strip pinned to the bottom carrying the same
figures, and it shows itself **only once the tiles have scrolled out of view**,
watched with an `IntersectionObserver`. So the totals are on screen exactly once
at any moment — "say it once" honoured rather than broken — and they are
reachable from inside the task without scrolling back up. It stays hidden
entirely until something is entered, since on a fresh day it would be a strip of
"Rs 0" following the reader down a page they have not started.

### What rendering it caught

- The **spacer under the page had to be sized from the phone, not the laptop**.
  The bar is 76px at a laptop width and **100px at 400px**, where it wraps to
  two lines; sized to the laptop, the last nozzle's Save button sat underneath
  the bar on the device the app is actually used on.
- **Litres now drop off the bar at narrow widths.** All four figures wrapped to
  three lines at 400px — about 90px of a short screen, permanently, over the row
  being typed into. Cash and credit answer the drawer question; litres do not.
  A container query rather than `sm:`, since the bar is inset by the sidebar.
- A note for the next person screenshotting this page: **a full-page Playwright
  screenshot renders a `fixed` element at its viewport position**, so the bar
  appears stranded in the middle of the page in every `fullPage: true` capture.
  It is an artefact of the capture, not a bug. Verify a fixed element with a
  normal viewport screenshot plus a computed-style read, which is how the
  show/hide behaviour here was actually confirmed.

## The dashboard, in Argon's clothes — and a money figure that never fitted

_"find me a minimal dashboard, no blacks" → "go ahead, build it with argon
style"._ The owner went looking for a new dashboard design; what came back is
mostly a craft change, plus one real bug that the craft change exposed.

**Where the reference came from, since it is not reproducible from here.**
Behance, Dribbble, Figma and creative-tim.com are all blocked by this
environment's network egress policy. The npm registry is not, and Creative Tim
publish their templates there under MIT, so the four dashboards actually
compared were pulled as tarballs, extracted, served on localhost and
screenshotted. Argon Dashboard 2 won on being light, black-free and closest to
what this app already does. Now UI was rejected outright: its orange sidebar
and blue chart header are diesel and petrol spent on chrome.

### What was worth taking

- **A softer, lower, wider shadow on `.card`** — `0 20px 27px 0 rgb(0 0 0 /
  0.05)` in place of `shadow-md`, with `rounded-2xl`. `shadow-md` is a tight
  contact shadow (two layers at 10% within 6px), which reads as cards pressed
  flat against the page and gives a grid of them a ruled, gritty look. The
  borrowed one separates card from canvas by *height* rather than by contrast.
  It has to stay faint: on a cheap tablet in poor light a heavier shadow turns
  into a grey band along every card edge and starts competing with the
  hairline dividers inside the card.
- **The icon as a badge in the tile's top-right corner**, which is the single
  most recognisable thing about the reference's stat row.

### What was rejected, and why it is written down

Argon's icon circles are **solid saturated fills**. Three of this app's four
ring meanings survive that; the fourth does not. Money owed is amber, and a
saturated amber is diesel — `amber-600` is hue 33°, diesel's own swatch is
27°, its accent rule 17°. Six degrees is not a distinction. Rendered, the "On
credit" ring sat one section above a diesel-accented card and was the loudest
thing on a page where orange is supposed to mean one fuel. No step is both
solid and not orange (`amber-700` is 25°, nearer still), so the whole set went
to `100` over `700` rather than making one tile the odd pale one out.

**The generalisable bit: check a chrome colour against `fuel-colors.js` by
hue, not by eye.** Six degrees apart looks like a different colour in a swatch
and the same colour on a page. An earlier draft of this change shipped a code
comment asserting the solid amber "sits on the chrome's side of that line" —
written before rendering it, and wrong.

### The bug the layout change exposed

Copying Argon's arrangement directly — label and figure in a column, icon
beside them — put `Rs 1,204,950` underneath the icon. Chasing that turned up
something older and worse.

**Money figures were overflowing their cards at nearly every laptop width, and
had been.** Swept in 20px steps from 340px to 1600px, `main` overflows the
figure at every width from 860px up, and the page itself scrolls sideways
between 860 and 900. It was invisible because `Rs 1,603,290` on the ordinary
dashboard happened to clear the icon by about 6px — the tiles that did not
clear are Expenses, Reports and any month with a seven-figure total.

Two fixes, both measured rather than guessed:

- **The icon moved onto the label's row**, so the figure spans the whole card
  instead of the card minus 48px. The label is short and elastic and can give
  up the width; the figure cannot.
- **`grid-cols-4` and `text-2xl` got separate thresholds** — `@[54rem]` and
  `@[62rem]`, against the grid. They were one number (`@[50rem]`) serving
  both, and four columns arrived while each tile was still ~204px. A single
  breakpoint cannot serve a column count and a font size that need different
  amounts of room.

The same 20px sweep now reports clean from 340px to 1600px.

### Blast radius

`StatTile` is on eight pages and `.card` on nearly every block in the app, so
this is a wider change than "the dashboard". Verified by rendering the
dashboard with realistic fixtures at laptop and phone width, plus a strip of
`StatTile` edge cases the dashboard does not itself produce: a negative tone
with its pill, a positive tone, a seven-figure value, a two-line `sub`, and
the no-icon variant.

## Stat tiles get the Ramtabs anatomy, and a sparkline

The owner sent a screenshot of the Ramtabs finance dashboard — the design he
had been trying to show since the start, and which none of the earlier
guessing had matched — with two asks: _"the cards on top with graphs too if
possible and the card text in the card should be shown like this"_, then
_"i want to improve the top cards in all my website pages which uses cards"_.

So this is app-wide, not the dashboard: `StatTile` is on eight pages.

**The anatomy is now the reference's.** A 16px icon sharing the label's line,
the figure below it, the comparison under that, and a sparkline at the
figure's right where a series exists. The filled icon ring from the Argon pass
is gone — the reference spends its colour on the chart, not on a badge, and it
is the better trade.

**The sparkline is hand-drawn SVG** (`app/_components/ui/Sparkline.js`), not
Recharts. Four Recharts instances in a stat row would each ship a client
bundle and measure themselves before painting, so the row the owner reads
first would land empty and pop in a beat later. A sparkline has no axes,
tooltip or interaction, so it is just a path: server-rendered, no JavaScript,
no layout shift, a few hundred bytes. It is `aria-hidden` and carries no
scale — it says "rising", "falling", "steady", and the figure is beside it at
24px.

**The dashboard's four sparklines are the same `trend` array the charts below
already draw**, read twice from one fetch. No extra query, and no way for the
little line and the big chart to disagree about a day.

### Diesel, again — and the rule that came out of it

The same trap as the Argon pass, sprung a second time in one sitting. The
tile's meaning colours include amber for money owed, so the "On credit"
sparkline came out amber, and rendered above the diesel-accented fuel cards it
was the same orange all over again.

The reasoning that let it through is worth recording, because it was written
down confidently and was wrong: a comment argued that a small glyph "spends so
little of the hue that the question goes away". True for a 16px outline
stroke. Not true for a 72×34px line with an area fill, which is **more** amber
than the 44px filled circle already rejected.

**The rule: the test is AREA, not size.** `SPARK_COLORS` is therefore a
separate map from `ACCENT_COLORS` and may only be green, red or slate — the
chrome colours no fuel owns. The money-owed group draws slate and keeps its
amber on the glyph. `tone` overrides both: direction beats category, or a
green line would sit under a red number saying the opposite thing.

### Verified

Rendered with the fuel-type cards deliberately in frame, because the colour
question only exists where chrome and fuel colours share a page — the first
pass was judged on a tile row alone and looked fine. Also swept in 20px steps
from 340px to 1600px: clean, including the 860–900 band where `main` used to
scroll the page sideways. At phone width the sparklines drop out entirely and
the tile is a label over a number, which is the intended degradation:
decoration must never be the reason a figure cannot be read.

### Two follow-ups from the owner, in the same pass

**"please use colorful icons too, relevant colors."** The accent map grew from
three meanings to five, and the two new ones are chosen around the fuel triad
rather than for it: **teal** for what the pump holds (fuel, stock, inventory,
lubricants, assets) and **violet** for the record-keeping (readings, banking,
dates). The obvious colours for "fuel" and "stock" are blue and orange, and
those belong to petrol and diesel — teal and violet are what is left that is
still distinct, and neither is a colour any fuel wears.

**"make sure graphs does not leak out of the card."** They were, and the sweep
that had reported CLEAN did not see it: it compared each figure's
`scrollWidth` against its own `clientWidth`, which says nothing about whether
the element sits inside its CARD. The sparkline carried `width={72}` as an SVG
attribute, so it stayed 72px wide however narrow the tile got and pushed
straight out through the right edge. It is now sized by class and shrinks with
its container.

Re-tested with the right check — every child's rect against its card's padding
box, at every width from 340px to 1600px — which promptly turned up a second
leak the first check had also missed: `Rs 14,386,211` escaping at 440px, where
two columns gave each tile 188px for a figure needing ~200px. Two columns now
wait until `@[32rem]`. **The lesson worth keeping: `scrollWidth` tests whether
an element overflows ITSELF, and that is not the question.**

**Not done: sparklines on the other seven pages.** Only the dashboard has a
daily series to hand. Customers, Expenses, Banking, Lubricants, Readings and
Reports would each need a small trend query before their tiles could carry
one; the anatomy change reaches them all today, the charts do not.

## Hover readouts, a redesigned Customers page, and the register goes live

Four asks from the owner in one round.

**Sparklines now show the value and date on hover.** `Sparkline.js` became a
client component to do it, having been written deliberately server-only with a
comment saying so. That comment was defending the right thing for the wrong
reason: what mattered was "do not put a charting library in a stat tile", not
"zero JavaScript". The markup is still server-rendered on first paint, so
there is no layout shift, and the hover state is all the client adds.

The readout is `fixed` and anchored to the pointer, not placed in the card.
The sparkline sits hard against the card's right padding and there is no room
inside for a panel beside it — and this component had just been through a
round of things escaping their cards. A fixed overlay is outside the layout
entirely: it cannot widen a card, push a figure, or scroll the page sideways.
It flips to the pointer's left near the viewport edge.

`tips` are formatted on the SERVER and passed as `{ v, d }` strings. A
formatter cannot cross the server/client boundary, and re-implementing PKR and
litre formatting inside the chart is how two parts of one app start
disagreeing about how a number is written.

### Customers, redesigned

- **"Over their limit" is gone**, as asked. What replaced it asks the same
  question without depending on a limit being set at all: how many owe
  anything right now, and the largest single balance. Most accounts have no
  credit limit on file, so a count of who was over one was a figure about
  whichever rows happened to have the field filled in.
- **Icons instead of initials on the avatars**, and they are not all the same
  one: a customer with a vehicle on file gets the vehicle, one without gets
  the person. That is a real distinction — fleet accounts and walk-up credit
  are different kinds of customer — rather than decoration picked from a hat,
  and it keeps the column from being forty identical circles. **What it costs
  is worth recording**: the initial was a faster cue than the name for telling
  two rows apart in a long list, and the deterministic tint is now carrying
  more of that work alone.
- **The vehicle moved out of its own column and under the name**, which is one
  fewer column to fit before the table scrolls sideways, and puts the field
  the owner scans for when two accounts share a name right beneath it.
- **The credit limit gained a usage bar.** How close an account is to its
  ceiling is a proportion, and a length is read faster than a number. Green
  under, red over, nothing in between — "approaching the limit" is not a state
  anyone acts on differently, and the word in the badge is what carries
  "over"; the colour is the second cue.

### The register is production now

- **The preview banner is gone** at the owner's word: _"this is a real page in
  production now"._
- **The default range ends TODAY, not on the 31st.** On the 3rd of August the
  page opened on "01 Aug – 31 Aug" with twenty-eight empty days below it, and
  a profit figure comparing three days of sales against whatever deliveries
  had landed, over a span the heading called a month. A past month still
  defaults to all of it, because there "so far" and "the whole month" are the
  same span. The day-of-month comes from `todayISO()`, so it is Asia/Karachi's
  day and not the server's.
- **The two fuel cards have graphs**, drawn from the per-day rows the card is
  already handed — no second query, and no way for the line and the total
  above it to disagree. They wear the **fuel's own colour**, which is the one
  place on the page allowed to: the card is that fuel's card and already
  carries its band. `onWhite` (the dark relative), because diesel's `#FDBA74`
  as a 2px line on white is 1.6:1 and all but invisible.
- **The four money tiles did NOT get graphs.** Only sales has a daily series;
  stock bought and expenses have no trend function behind them, and inventing
  one for a decoration is the wrong order to do that in. Three of four tiles
  bare and one charted looks like a bug rather than a choice, so all four stay
  as they are until the queries exist.

**Still open:** `MoneyTile` and `FuelCard` are MUI `Paper` while the rest of
the app is `.card`. That was justified while the page was a preview. It is not
a preview any more, so the two systems on one page should be reduced to one.

## Percent badges, graphs on the money tiles, and the Customers table ruled

**`DeltaBadge`** is the new shared piece: a coloured pill with the percentage
and an arrow, then the figure it is measured against in plain muted text
beside it. Split in two on purpose — the percentage is read at a glance, what
it is measured against is read only when the percentage is surprising, and
putting the whole sentence in the pill makes a chip that competes with the
figure above it.

**The arrow is direction; the colour is whether it is good news.** They are
different axes and this app has to keep them apart: expenses up is an up arrow
and a RED pill, sales up is an up arrow and a green one. Colouring by
direction alone would paint "expenses rose 40%" the same green as "sales rose
40%", which is the one mistake a money app cannot make. Callers pass
`higherIsBetter`. A change against zero has no percentage to state, so the
badge says the direction in words rather than inventing "+100%".

### Graphs on the register's money tiles

They were skipped last round for want of a daily series. Two new data
functions supply it — `getPurchaseTotalsByDay` and `getExpenseTotalsByDay` —
narrow date-bounded selects grouped in JavaScript, rather than a migration
written to feed a decoration.

**Neither takes a `limit`, deliberately.** `getExpenses` has one and defaults
it to 100, which is right for a table that pages and would be silently wrong
here: a cap on a list you are going to total is a cap on the total, and the
101st expense of a month would just vanish from the line.

**Days with nothing are zero, not absent.** Deliveries and expenses do not
happen daily, so their maps have holes; drawing straight from a map would give
a four-point line labelled as a month and quietly join the 3rd to the 19th as
if nothing sat between them. The day list comes from the sales trend, which
fills every day.

The percent badges compare against **the equally long span ending the day
before this one starts** — "this week against last week", never "these four
days against a whole month". One extra `get_range_summary` call, no new SQL.

### Customers

- **The table is ruled in both directions**, as asked. Vertical dividers are
  usually the wrong call — whitespace already does that work — but they earn
  their place once a row carries five short fields of similar visual weight,
  which is when the eye starts sliding between neighbouring cells.
- **The avatars are two-letter initials.** This has now been a single letter,
  an icon, and finally this, and the round trip is the point: the icon version
  lost something immediately visible, because forty identical circles tell you
  nothing about which row you are on. Initials are the strongest cue available
  because they differ per customer, which neither a colour nor an icon manages
  across a long list. First word and last word, so a trading name gives "BC"
  for Bilal Sons Goods Carrier rather than "BS".
- **Six tints, and none is a fuel's.** The reference uses lavender, pink,
  blue, peach and mint; blue and peach are the two this app cannot spend.
  Violet, fuchsia, teal, rose, green and slate give the same soft, varied look
  with nothing borrowed from petrol or diesel.
- **Search over name, vehicle and phone**, written to the query string like
  every other filter, debounced at 250ms and using `replace` so typing eight
  letters does not put eight entries in the browser's history. **The tiles
  still count every account**, not the matches — a search that quietly turned
  "total outstanding" into "total outstanding among rows matching 'ahm'" would
  be a figure that looks like the headline and is not.
- **Search and Add now sit in the table's own header bar**, at the owner's
  request, which is also the better place for them: both act on the table, and
  a control parked against the page title reads as applying to everything
  below it including the Removed list.
- **Phone is a column** — `migration 042`. The column has existed since 001 and
  the dialog has always written to it; nothing ever read it back, so a number
  typed into the form went in and was never seen again. Both read functions
  are dropped and recreated rather than altered, because Postgres will not
  change a function's return type in place, and the grants are restated
  underneath because dropping a function takes its grants with it. It renders
  as a `tel:` link: this list is read on a tablet at the pump, and the reason
  to look up a number is almost always to ring it.

### What is deliberately missing

**Cash and On credit have no percent badge on the dashboard.** Those tiles are
fuel cash plus lubricant cash, and `get_lubricant_trend` carries only amounts —
there is no per-day cash/credit split for oil. The comparison would have to
drop the oil half or pretend it was all cash, and a badge that is wrong by an
unstated amount is worse than none. Fuel sold and Total sales can be
reconstructed exactly from the two trends, so those two have badges. Fixing
the rest means widening the lubricant trend RPC — a migration, not a format
change.
## Company Assets get their colour back

_"add some colors in these icons, they look boring right now"_ — the owner,
looking at fourteen assets rendered as fourteen identical grey blocks.

This reverses part of an earlier decision, and the earlier reasoning is worth
keeping rather than quietly overwriting. The audit recorded above under **"What
the decorative hues were actually doing: nothing"** stripped five hues from the
asset categories on the grounds that a car, a wrench, a building, a monitor and
a tag already tell the five apart, so the colour was a weaker second copy of
what the icon said. That argument was correct and still is. What it missed is
that **it answers a question about safety, not a question about whether a page
is worth looking at.** Company Assets is a private register the owner opens for
his own reference — nothing on it gets checked against cash in a drawer — and
it was the one screen in the app that could afford to be pleasant. It was
instead the greyest thing in it.

**What the old hues actually broke, and what the new ones do differently.** The
set that was removed spent **sky and violet** — petrol's blue, and the colour
lubricant wears. That is the rule in `docs/UI_CONVENTIONS.md` → "Two palettes,
and they never overlap", and it is load-bearing: the owner's father reads the
fuel colours to know which nozzle he is entering. The restored set touches
none of them:

| | | |
|---|---|---|
| Vehicle | teal | |
| Machinery | violet | |
| Property | brand green | the app's own |
| Electronics | fuchsia | |
| Other | slate | uncoloured on purpose — "uncategorised" is the one value where the absence of a hue is accurate |

**Red and amber are barred too**, and for a sharper reason than tidiness: every
card on this page carries a money figure, and an amber tile beside `Rs 132,000`
reads as a warning about the number rather than as a category. That leaves
exactly four usable hues and a neutral — a real ceiling, and a sixth category
should fall to slate rather than reach for a reserved colour.

**Nothing here is knowable by colour alone**, which is what makes the hue
decoration rather than a cue: every card still carries its own icon *and* its
written category label. The rule the audit produced — colour a thing only when
the colour adds meaning its shape does not — governs where colour is
*required*, not where it is *forbidden*, and reading it as a ban is what
produced the grey page.

**Two of the four stat rings are now coloured, and two deliberately are not.**
"Total value" takes brand green (a briefcase says "assets"; the green says "and
this is money the business holds", which is what green means in every other
ring in the app), and "Biggest holding" wears its *category's* hue via the
`ringTone` escape hatch, so the tile and the cards below it agree about what
Electronics looks like. "Assets recorded" is a count and "Newest addition" is a
date — nothing for a colour to add, so they keep the neutral fallback rather
than being tinted to even the row up.

### What rendering it caught

- **The `50` step was too pale for the icon tile.** Built first at `bg-*-50`
  throughout, the teal and brand-green tiles washed to near-white against a
  white card — the page still read as grey, so the change had cost the earlier
  argument without buying the look. The tile is now the `100` and the chip
  stays the `50`, which is the pairing the neutral `other` already used
  (`bg-ink-200` tile, `bg-ink-100` chip). Only visible in a screenshot; the DOM
  was "correct" at both.
- Checked at 1152px, 1440px and 400px. No new wrapping, no horizontal scroll,
  money figures still on one line at phone width.

## Bigger tile icons, and initials that survive the real customer list

**The stat-tile icon went from 16px to 20px** — _"they are too small"_. It was
undersized against its own 12px uppercase label to begin with and read as a
bullet point rather than a picture of the thing. It is the shared tile, so the
size lands on every page with a stat row.

**The asset-category colours were cherry-picked onto this branch.** They were
built on `claude/icon-colors-ws7dln` and the owner was looking at a build
without them; the two branches now agree.

### The initials were wrong, and only the real data showed it

`customerInitials` took the first word and the LAST word, reasoning that a
trading name's last word is what distinguishes it — "Bilal Sons Goods Carrier"
vs "Bilal Sons Filling Station". Sound reasoning, never checked against this
pump's actual customer list, where names carry a **ledger number** on the end:

| Name | Was | Now |
|---|---|---|
| Abdul Ghaffar 13 Solang 561 | A5 | AG |
| Akram Saudi Arab 447 | A4 | AS |
| Al Jadeed poultry Farm Khizer 748 | A7 | AJ |
| Al-Mustafa Dera Bakha 605 | A6 | AD |

A column of A5 / A4 / A7 / A6 is worse than no bubble at all — it reads as a
code the reader is meant to recognise. It is now the **first two words**, and
words beginning with a digit are skipped, so "Akram 447 Saudi" gives AS rather
than A4.

**The lesson is not about initials.** The fixture names used to build this
were "John Doe" and "Bilal Sons Goods Carrier", and both worked perfectly. The
real list is names plus filing numbers, and no amount of care over the
algorithm would have found that — only running it over the actual names did.
When a helper derives something FROM USER DATA, test it on the user's data.

## The percent badge loses its sentence

`DeltaBadge` shipped as two parts — the pill, then "up from Rs 655,595
yesterday" beside it — on the reasoning that the percentage is read at a
glance and the baseline only when the percentage is surprising. The owner had
the sentence removed, and the tiles are better for it.

The argument for keeping it was about the badge in isolation. On the actual
tile it is the **fourth** thing on a card that already carries a label, a
figure and a sparkline, and it was the only line there made of prose. It also
pushed every tile taller to say something one date-step away already answers.

**`previous` is still required** — the badge cannot be computed without it. It
is simply no longer printed.

What this costs is one of the two written cues, so the remaining ones have to
carry it: the **arrow** states the direction independently of the colour, so a
reader who cannot separate the red pill from the green one still sees which
way the figure moved. That is why the arrow is drawn rather than implied by
hue, and it is now the only thing standing between this badge and colour being
the sole cue.

## "Why new?" — and the badge that had nothing to say

The register's four money tiles all showed a **"New"** badge at once. The
answer is in the data, not the code: this pump's records begin **01 Aug 2026**
(`min(reading_date)` confirms it), so the equal-length span before any August
range lands in July, which is empty. `previous` came back 0, there was nothing
to divide by, and the divide-by-zero branch printed "New" on every card.

**A zero baseline and an absent one cannot be told apart here.** Both arrive as
0 from the summary RPC, and "sales rose from nothing" and "there is no July to
compare against" are different sentences. Given a label that is sometimes
wrong or no label, **a card with no comparison now shows no comparison.** The
figure above it is unaffected and still true. The reasoning is kept in the
file because "just show 100%" is the obvious next suggestion and it is wrong —
a percentage of zero is not a percentage.

### Cash and On credit get their badges — migration 043

`get_lubricant_trend` returned amounts and litres but no cash/credit split, so
those two tiles (fuel cash **plus oil cash**) had no exact previous day and
shipped without badges. `lubricant_sales` has carried `cash_amount` and
`credit_amount` since 024, with a constraint that they sum to the amount —
nothing new is recorded, two existing columns are now summed and returned.
All four dashboard badges are exact; none is an estimate.

**042 and 043 are applied to the live database**, at the owner's instruction,
and verified by reading the function signatures back from `pg_proc` rather
than trusting the success flag.

### Two pills stacked is clutter

`StatTile` rendered every `sub` as a pill, which is not what its own
documentation said — the pill was meant for a `sub` with a *direction*. It did
not matter until the percent badge arrived and put two chips of nearly equal
size one above the other.

They are different kinds of thing: the badge is a **measurement** and earns a
chip; `sub` is a **description** ("Rs 795,698 fuel · Rs 2,400 lubricants") and
reads better as a line of text beneath one. A toned `sub` keeps its pill,
where the colour and arrow carry meaning grey text would lose. `DeltaBadge`
also stopped setting its own top margin — the tile owns the spacing between
its parts, and a component adding `mt-1` on top of the tile's gap sits at a
different distance depending on what is above it.

### No empty cards

On a day with no readings the four tiles were "Rs 0" over an inch of white,
which reads as a page that failed to load rather than a day nobody has entered
yet. Each tile now says which: "No readings entered for this day", "Nothing
sold on this day", "Nothing taken in cash", "Nothing sold on credit". There is
also a middle case worth naming — fuel sold but no oil — which now says "fuel
only — no oil sold" instead of falling back to the blank.

## Daily readings, redesigned — nozzles as cards, and the tank's own colour

_"it is the worst looking page on my website"_, with three specifics: keep the
fuel colours the Stock page uses, stop the nozzles being "a horizontal
container shiz", and make it obvious at a glance where each fuel's nozzles
are.

**Read the history first, as CLAUDE.md requires**, because this page has had
three designs reverted. Nothing reverted came back: entry is still a dialog
per nozzle (inline editing was built and reverted — _"model window was
better"_ — and the reason still holds: the dialog's value is one nozzle on
screen and nothing else to type into by mistake), the unit is still the card,
the day banner and the cash-up bar are untouched.

### The nozzles are cards, two across, not two full-width bands

A dispenser has two nozzles side by side; the page had them as two identical
strips running the whole width of the screen. A card each is closer to the
physical thing and much less page to scroll — three units now occupy roughly
what two did. `@container` rather than `sm:`, since this grid sits inside a
card inside a 240px sidebar layout, and `items-stretch` so an un-entered
nozzle stands the same height as its entered sibling.

The figures went from four columns across a full-width row to **two by two**,
which also puts the pair that has to agree — total sale, and cash plus credit
beneath it — directly above one another. The chevron went: on a full-width row
it was the only thing saying "this opens", but a card is obviously its own
target and the chip already carries the word.

### The unit band is now the Stock page's tank colour

`solid`, at the owner's request, so a pump and the tank it draws from are
unmistakably the same colour across the two screens. That gives up the
lightness channel the header used to carry (`soft` while unfinished, `strong`
when done). Acceptable: "finished" is still said by the check icon, the "2 of
2 entered" chip, and the absence of the progress bar — which the earlier note
on that bar had already observed was saying it three times over.

`solid` is dark-with-white-text for petrol and light-with-dark-text for diesel,
so everything sitting on the band needs to work on both. One pair of classes
does it: a `bg-white/25` wash with a hairline `ring-black/10`, and
`currentColor` for text and icons so they follow whichever the band brought.

### Which fuel, said loudest

Each nozzle card carries a **fuel-coloured pump glyph** — drawn, not a
photograph. It takes its hue from `fuel-colors.js`, so it cannot drift out of
step with the badge beside it or the band above it the way an image file
would; it stays sharp on the tablet; it adds nothing to download. `soft` is
the pale-tint-with-dark-text pair, which is legible for both fuels where
`solid` would put dark on dark for petrol.

It is the third statement of the fuel, never the only one: the badge says the
word, the card carries the fuel down its left edge, and the unit band names it
above.

### What rendering it caught

At 400px the icon, badge and chip took the row between them and the nozzle
name clipped to **"Noz…"** — the one word identifying which nozzle you are
about to type into, on the screen built entirely around not typing into the
wrong one. Letting it wrap instead stacked "Nozzle" over "A", which is not
hidden but is not a name read at a glance either. `whitespace-nowrap` on the
name plus `flex-wrap` on the row sets the priority properly: the name cannot
break, so the **chip** drops to a second line when the four things do not fit.

### Entered is now the fuel's own colour

Reported straight after the redesign: _"no clear differentiation whether
reading entered or not"_. It was fair — an entered card was `brand-50/40`,
which is four parts white to one part green, and beside a plain white card at
a glance they were the same card.

An entered nozzle now wears **its own fuel's tint**, at the owner's request.
One cue says both things: a finished diesel nozzle is unmistakably diesel and
unmistakably done, and an un-entered one stays white and stands out against
its filled neighbours. It also stops spending a second colour on a card that
already had one.

**This inverts which state is loud**, and that is the point rather than a side
effect — the ask was to *see* that a day has been entered. On a part-finished
day the white cards still read as the odd ones out, so nothing is lost for
someone working down the page; the Enter chip and the fuel edge still carry
the word and the border.

Two things had to move with it, both because the card is no longer white:

- **A new `tint` token in `fuel-colors.js`** — background only. `soft` could
  not do this job: it carries a text colour, so the whole subtree inherits the
  fuel's dark relative, which is right for a header band and wrong for a card
  full of money figures that must stay near-black.
- **The pump glyph sits on a white tile with a fuel-coloured icon**, not on
  the fuel's tint. Tinted-on-tinted is nothing — orange-100 on orange-100
  disappears. The divider inside the card became `border-black/10` for the
  same reason: a fixed slate hairline goes muddy over orange.

## The unit header band gets a texture

_"patterned, grainy with 3D look"_ — and, when a plain two-stop gradient was
tried first, _"no no nooo"_. The colours were never the problem: diesel stays
orange and petrol stays blue, flat `solid`, exactly as before. What was
missing was surface.

`.fuel-band` in `globals.css` layers four things over whatever
background-colour the element already carries:

1. **Grain** — fractal noise from an inline SVG filter, as a data URI so there
   is no second request. `overlay` blending is what makes it darken the dark
   parts and lighten the light ones rather than dusting the whole strip grey.
2. **Weave** — 45° hairlines at 4% white. Barely visible alone, which is the
   intent: it gives the surface a direction, so the band reads as a material
   rather than a fill.
3. **Sheen** — a wide radial highlight in the top-left, doing most of the "3D"
   work. Light comes from one place, so the strip reads as a curved surface
   lit from above rather than a rectangle with a gradient on it.
4. **Lift** — inset hairlines, white along the top edge and black along the
   bottom: the same trick a physical bevel plays.

**IT ADDS NO COLOUR.** Every layer is white or black at a low alpha, so the
band is "the fuel's colour, textured" and never a new hue — the only terms on
which a decorative treatment may go near the fuels. `fuel-colors.js` still
owns every hue in the app, and this class does not know which fuel it sits on,
which is exactly why it can sit on all of them: it works unchanged on diesel's
light orange and petrol's dark blue, the pair that breaks any treatment built
from a fixed colour.

Every alpha is under 12%. The band carries the unit name and its "2 of 2
entered" chip and is read on a cheap tablet in poor light, so the texture has
to survive being looked past, not looked at.

Rendered over diesel, petrol, lubricant and the mixed-unit neutral before
committing.

### Rejected first: a flat gradient

A `band` token was added first — the same colour as `solid` with a
left-to-right gradient — and turned down. Recorded because the reasoning still
holds for the constraint, if not for the result:

**Both stops are colours the fuel already owns**, taken from the tokens listed
above them in the same file — petrol `#075985 → #0369A1`, diesel
`#FDBA74 → #FB923C`. That is the constraint that keeps this safe: the band
cannot drift away from the badge beside it or the tank card on the Stock page
wearing the flat version, because there is no new colour in it.

**One step of lightness and no change of hue.** The band's job is still to be
read as "diesel" at a glance from across the office; a gradient wide enough to
be admired is one wide enough to make its far end a different colour from the
badge next to it. The darker stop is the one to check if either is ever
changed — it is where the text contrast is tightest.

Rendered across all four cases before committing: diesel, petrol, lubricant,
and the neutral fallback a mixed-fuel unit gets.

## The texture hurt: high-frequency out, low-frequency in — and the whole unit lifted

_"it hurts my eyes, some nice texture for 40 + clients"_, then _"where is the
whole unit 3D look man"_. Two corrections to the pass above, and the first is
the one worth keeping.

**Grain and 1px hairlines were the wrong kind of texture for this reader.**
They were genuinely "grainy" and "patterned" — and both are HIGH-FREQUENCY
detail, at the scale of one or two pixels. On a cheap tablet that shimmers as
the panel scrolls, can moiré against the screen's own pixel grid, and gives a
40-plus eye something to keep trying to focus on that is not there. This app's
entire type and contrast floor exists for that reader; putting sandpaper
behind his headings undoes it.

**Nothing in the band is now smaller than the band.** Every layer is a wide,
soft wash measured in hundreds of pixels — a broad sheen from the top-left, a
matching falloff at the bottom-right, and one ~300px diagonal sweep at 5%
white. It still reads as a lit, slightly curved surface, which was the actual
ask, but at a scale the eye takes in without working. The only fine detail
left is the 1px bevel, and an edge is read once rather than scanned.

**The whole unit card is the 3D object now, not just its band.** A lit strip
on a flat sheet did not read as one thing. `.unit-card` stacks **four**
shadows, which is the entire trick: a contact shadow at 1px where the object
meets the page, a mid shadow at 8–16px for the body of the lift, an ambient
one at 44px for the room's light, and a white hairline inset along the top
edge as the highlight on its upper lip. The eye reads the combination as
height and any one of them as a blur.

`.card` keeps its own quiet shadow everywhere else in the app. Only the unit
is lifted this far, because it is a physical pump on the forecourt and the one
thing on the page worth making solid — if everything were raised, nothing
would read as raised.

The shadows are tinted with the app's own slate rather than pure black, which
over an `ink-100` page goes grey and dead.

**The colours did not change** and have not changed through any of this:
diesel's orange and petrol's blue, flat `solid`, straight from
`fuel-colors.js`. Every layer added here is white or black at a low alpha.

---

# Porting this round to the offline (Electron) build

The desktop build tracks this repo. This section is the catch-up list for it —
everything from the redesign round, sorted by what a port actually has to do
with it, rather than by the order it happened in.

## 1. Database — two migrations, both function-only

**Neither changes a table.** Both widen the return of an existing read
function, so an older client talking to a newer database just receives a field
it ignores. If the desktop build ships its own Postgres, run these against it;
if it reimplements the queries in SQLite or similar, mirror the two extra
columns.

| Migration | Change |
|---|---|
| `042_customer_phone_on_the_list.sql` | `get_customer_balances`, `get_retired_customers` → add `phone` |
| `043_lubricant_trend_cash_and_credit.sql` | `get_lubricant_trend` → add `cash_amount`, `credit_amount` |

**Both DROP and recreate rather than `ALTER`.** Postgres will not change a
function's return type in place — `create or replace` fails with "cannot
change return type of existing function" — and **dropping a function takes its
grants with it**, so the `revoke`/`grant` pair is restated underneath each
one. Leaving those out ships a function every signed-in user is refused by.

Both are applied to the live Supabase project. Neither backfills anything;
`customers.phone` has existed since `001` and `lubricant_sales.cash_amount` /
`credit_amount` since `024` — the data was always there and simply never came
back out.

## 2. New shared files

| File | Purpose |
|---|---|
| `_components/ui/Sparkline.js` | `'use client'`. SVG trend line + hover readout |
| `_components/ui/DeltaBadge.js` | Percent pill; server component |
| `_components/admin/CustomerSearch.js` | `'use client'`. Debounced query-string search |

## 3. Changed shared files — these reach every page

- **`_styles/globals.css`** — `.card` shadow and radius; new `.fuel-band` and
  `.unit-card`.
- **`_components/admin/AdminStats.js`** — `StatTile` rebuilt (icon beside
  label, figure, optional `spark`/`sparkTips`/`delta`, then `sub`);
  `RING_COLORS` → `ACCENT_COLORS` + `SPARK_COLORS`; `ringTone` → `accentTone`;
  grid and type thresholds moved to `@[32rem]` / `@[54rem]` / `@[62rem]`.
- **`_lib/fuel-colors.js`** — new `tint` token (background only).
- **`_lib/customer-avatar.js`** — `customerInitials()` (first two words) and
  `customerAvatar()`; `customerInitial()` kept for anything still on one
  letter.
- **`_lib/data-service.js`** — `getPurchaseTotalsByDay`,
  `getExpenseTotalsByDay`.

**`StatTile` is on eight pages and `.card` on nearly every block**, so those
two are the whole-app blast radius. If the desktop build has diverged in
either, reconcile them before the page-level changes.

## 4. Page changes

| Page | Change |
|---|---|
| Dashboard | Sparklines + day-over-day badges on all four tiles; empty-day messages |
| Customers | Ruled table, initials avatars, phone column, search, Add moved into the table header, over-limit tile removed |
| Reports → Register | Preview banner removed; default range ends **today**; fuel cards get sparklines; money tiles get sparklines + prior-period badges |
| Readings | Nozzle cards two-across; unit band = Stock page tank colour + `.fuel-band`; entered nozzle wears its fuel's `tint`; `.unit-card` depth |
| Company Assets | Category icons coloured (teal / violet / brand / fuchsia / slate) |

## 5. The rules worth carrying over, not just the diffs

If the desktop build only takes one thing from this round, take these — each
was learned by getting it wrong first, and each is written up in full in
`docs/UI_CONVENTIONS.md`:

- **Check a chrome colour against `fuel-colors.js` by HUE before saturating
  it.** `amber-600` is 33°, diesel's swatch is 27°. Six degrees is not a
  distinction. Caught twice in one sitting — once as a filled ring, once as a
  sparkline — because the second felt too small to matter.
- **The test is AREA, not size.** A 16px amber glyph is fine; a 72×34px amber
  sparkline is more of the hue than the filled circle already rejected.
- **Test containment against the card's PADDING box.** `scrollWidth` asks
  whether an element overflows *itself*, which is not the question.
- **Decoration yields; the figure never does.** Money is `whitespace-nowrap`
  and cannot shrink, so the sparkline hides instead.
- **Nothing textured smaller than the thing it sits on.** High-frequency grain
  shimmers on a tablet and tires a 40-plus eye.
- **Depth is stacked shadows, not one big one.**
- **When a helper derives something from user data, test it on the user's
  data.** The initials helper passed every fixture and produced "A5" for a real
  customer.

## Credit slips: type the amount, the litres follow

_"right now entering amount calculates the amount, do the opposite, client
should enter the amount and litres calculated itself, and move the amount
input box in place of litre and vice versa"._

The slip row ran litres-in, amount-out. It now runs the other way, and the
input order was swapped to match: **Amount first, Litres second.**

**This matches how the slip is actually written at the pump.** A customer asks
for "two thousand rupees of diesel", the attendant serves it and writes the
rupees down. The litres are the consequence, not the input — the old direction
asked the person filling the form to do the division in their head first.

**Both fields stay editable.** The derived side is filled in and can then be
overwritten, because a slip is occasionally rounded off by hand, and the paper
in the drawer is what the books have to agree with — not what the rate says it
should have been. That was true of the amount before and is true of the litres
now.

**The rate is guarded rather than divided by blindly.** `rate` is null until
the day's price is set, and a bare `amount / rate` would put `Infinity` into a
field that goes to the database. No rate means the litres are left for the
reader to type. Checked across a rate of null, `0` and `undefined`, an empty
amount, a zero amount and a non-numeric one — every one of them leaves the
litres empty rather than producing a value.

The placeholders moved with the boxes. Swapping two identical-looking number
inputs without swapping their labels is exactly how a rupee figure ends up in
the litres column.

## Modals: the background blurs, and the way out looks like a button

**The backdrop went from `ink-900/50` to `ink-900/60` plus `backdrop-blur-sm`.**
A flat wash darkens the page behind but leaves every edge on it sharp, so the
eye keeps finding the cards underneath; blurring destroys the detail the eye
was catching on, and the dialog reads as the only thing in focus. Applied
**wherever a modal appears** — the shared `Dialog` (which `ConfirmAction` and
every entry dialog already route through) and `AdminSidebar`'s mobile nav
drawer, which owns its own `<dialog>` and would otherwise have been the one
that still looked flat.

**The close button is a real control now.** It was a bare `✕` glyph in
`ink-500` with no edge until hover, which on a white header reads as
decoration — and this dialog is the only way out of the entry task, so the way
out has to look like one. It is a bordered circle with a drawn stroke rather
than a text glyph, so it renders identically whatever font is loaded.

**And it is a TARGET.** 44×44, measured rather than eyeballed, which clears the
tap-target floor the app holds everywhere else; the old one was about 28px. On
a tablet held one-handed at the pump that is a miss waiting to happen — and a
miss here lands on the backdrop, which deliberately does nothing (dialogs
holding a form do not close on click-outside; see "No click-outside-to-close"),
so the reader taps twice and wonders why.

`hover:text-red-700` rather than a red default: leaving is not destructive, so
the button should not sit there coloured like it is. The red is a response to
being aimed at.

## The oil chart wears lubricant's colour

Packed was brand green and loose was violet — two hues borrowed from the
chrome to separate two halves of **one product**. On a chart headed "Oil
sales" that is backwards: the reader's first question is which bars are oil,
and neither colour answered it. Gold does, and it is what lubricant already
wears on its badge and its stat-tile glyph.

**The pair is separated by LIGHTNESS, not hue** — and as far apart as the
family allows: `#655216`, lubricant's darkest gold (the one its text on white
uses), against `#D4AF37`, its vivid one. Both come from `fuel-colors.js` and
are imported rather than retyped, so the chart cannot drift out of step with
the badge.

The first pass used the middle `#977B20` for packed and the two blocks sat too
close to separate in a stacked bar. `deepHex` was added to lubricant for this:
charts take colours, not classes, and `onWhite` only existed as a Tailwind
class — a chart that retypes the hex is a chart that drifts.

Two reasons that is the right axis here. A second hue would be another colour
decision inside a product that owns one. And a lightness step survives
red-green colour blindness, where two hues of similar value do not — stacked
in the same bar, a light block over a dark one reads as two parts of a whole,
which is exactly what packed and loose are. The legend still names both, so
the colour is never carrying it alone.

Violet remains spent in one place only: `CashCreditChart`, where it separates
credit from cash and was chosen with a palette validator (green/violet
separates for red-green colour blindness where green/amber does not).

## The sparklines stopped disappearing on a real window

_"the graphs disappear when screen size reduced"._ They did, and on the size
the app is actually used at: the tile grid hid its sparkline below `@[68rem]`,
and on a 1360px window the 240px sidebar leaves the grid around 1090px — just
under the line. The charts were missing on the owner's own screen.

**The rule was right and the mechanism was wrong.** "Decoration must never be
the reason a figure cannot be read" still holds — the money figure is
`whitespace-nowrap`, cannot shrink, and must own its line. But the alternative
to competing for that line was never *vanishing*; it was **moving**.

The figure's row now wraps. Where the two fit side by side they still do; where
they do not, the chart takes its own line underneath at **full card width** —
which is a better chart than the squeezed one, roughly four times wider than
the 72px it gets when it shares. The figure is untouched either way.

Applied to `StatTile` and to the register's `MoneyTile`, which had the same
`hidden … @[62rem]:block` treatment.

Verified by counting rendered sparklines at 1120px, 900px, 560px and 400px —
twelve at every width, where the narrow ones previously rendered none — and by
looking at each, because a count of twelve would also be satisfied by twelve
charts squashed into unreadable slivers.

## Treasury: the cash in the safe on site

The owner keeps cash on the pump site, in notes, in a safe — the day's takings
before they are banked, money lent to people and taken back, cash handed to a
supplier against a purchase code, and a float for whatever needs paying that
hour. **None of it is in the banking system**, so nothing in this app knew
about it. The record was an Excel sheet called "Tajori" with five columns —
Date, Cash In, Cash out, Balance, Details — and a balance nobody could check
without opening the file.

`/admin/treasury` is that sheet, owner-only, with the real 36 entries from
14–21 Aug 2026 seeded in (migrations 044, 045). The closing balance on screen
is **Rs 8,364**, which is the figure at the bottom of his own Balance column;
every intermediate balance was checked against the spreadsheet row by row
before this shipped, and the seed migration asserts the total and rolls itself
back if it does not match.

### Standalone, on purpose

Nothing else in the app writes here and nothing reads from it. "Cash of shift
closing" is typed by hand even though Readings knows the day's cash figure, and
cash deposited into a bank is typed into Banking separately. That was the
owner's call and it is the right one for a first cut: **the safe is reconciled
against notes in a drawer, not against another screen**, so an entry that
appeared in it by itself would be an entry nobody counted. The obvious next
step — offering a one-click "Cash of shift closing" when a day's readings are
saved — is deliberately not built yet.

### What the database enforces

- **The safe may never hold less than nothing**, judged over the *whole chain*
  rather than one balance. An entry inserted or deleted in the middle moves
  every balance after it, so a row that is fine where it lands can still push a
  later day below zero — and deleting an early cash-in is refused for the same
  reason. It is a **deferred constraint trigger**, so a multi-row change is
  judged on where it leaves the sheet, not on each row as it lands. The message
  names the line it breaks on: _"On 17 Aug 2026, after "PSO Zamzam PS 118014"
  (Rs 1,593,990 out), the safe would be at minus Rs 812,080."_
- **One opening entry, ever** — "Already in the safe" is a single moment, and a
  second one always means a miscategorised cash-in.
- **A category belongs to one direction.** "Deposited in a bank" is not a way
  cash arrives; "Cash of shift closing" is not a way it leaves.

Both of the last two surface as raw Postgres constraint names, so `describe()`
in `actions.js` maps them; the balance rule raises its own sentence and needs
no entry there.

### Order without times

Two entries on one day have no clock reading behind them — the owner writes a
line when the cash moves. So `seq` (an identity column) is the sheet's row
order, and the chain is ordered `(entry_date, seq)` everywhere: in the view, in
the balance rule, and on screen. A back-dated entry lands at the end of its own
date, which is the only honest place for it. `created_at` could not do this
job: a line typed in later for the same day would sort by when it was *typed*.

The running balance is a window function in the `treasury_ledger` view, not
JavaScript — the page shows 25 rows at a time and a balance worked out from the
rows on screen would be the balance of a page rather than of the safe.

### Two things the DOM check did not catch, and a screenshot did

Both are the failure CLAUDE.md warns about: `hasScroll: false` and "no clipped
text" while the screen is wrong.

**The form beside the table hid the balance column.** Built first as a standing
form in the 22rem column — right for a page opened five or six times a day to
write a line — the six-column table got 504px of the 736px it needs, and the
**Balance column was off the right-hand edge**, inside the table's own
scroller. That is the one column the page exists to show. The form moved behind
a dialog and the table took the full width, which is what "Layout: form beside
a table" already said to do, and what Readings arrived at independently.

**Then the pinned balance lost its last digit.** Pinning the balance right
(the register's pattern) needs `right: <width of everything right of it>`, and
the delete button's column is 3rem of button *plus* `.td` padding — 68px, not
the 3rem it was offset by. Every figure was painted 8px under the action
column: `Rs 1,781,910` lost its last digit on a phone, and the text was not
overflowing its own box so nothing measured it. **The balance and the delete
button now share one pinned cell at `right: 0`**, which has no offset to get
wrong — and which also keeps the button reachable, since a balance pinned
alone at `right: 0` would sit over it at every scroll position.

Only the right-hand end is pinned; the date scrolls. The register pins both
ends, but its middle is eight columns and this one's is four — two pinned ends
would leave ~140px of scrollport at 400px, which is the "the pinned columns are
very nearly the whole table" failure the register recorded, reached from the
other direction.

### A hand-drawn icon, the first since the set moved to Material UI

Material UI has no safe. Every money glyph it offers says the opposite of what
this page means or says nothing: `Savings` is a piggy bank (the owner's verdict
was immediate), `Lock` reads as security settings in a list of nav items,
`Payments` is a stack of notes sitting one row under `AccountBalance` saying
much the same thing. So `treasury` is drawn in `Icon.js` — a box on feet with a
combination dial and a handle — and registered there like any other name, so
call sites are unchanged.

**Four marks, not six, and that was measured.** The first draft drew the door
as a second rectangle inside the body with a small dial on it; at 16px the two
nested rectangles closed up and read as a little screen or a banknote — exactly
the confusion the icon exists to avoid. Dropping the inner rectangle and making
the dial big enough to be seen as a dial is what makes it legible small. Four
variants were rendered side by side at 16/20/24/48px before choosing.

### Smaller notes

- The stat tile's ring for `treasury` is **teal**, the "things the pump holds"
  group — cash in a safe is a level in a container, like fuel in a tank, not
  money arriving. The two movement tiles beside it use `moneyIn` / `moneyOut`
  and keep green and amber.
- The chart is one `ComposedChart`: bars for the day's movements in the app's
  validated green/violet pair, and the closing balance as a **slate line**,
  deliberately not a third hue — it is the level the two movements add up to,
  not a third kind of movement. One Y axis, because both are rupees.
- `CategoryBreakdown` gained an optional `title`; Treasury renders two of them,
  "Where it came from" and "Where it went", and one heading could not serve
  both. Expenses is untouched.
- The category picker is a `<select>`, which is the convention rather than an
  exception to it — tiles are for options with an obvious symbol, and "Cash of
  shift closing", "Entry" and "Money returned" have none.
- The daily series **carries the balance forward** across days with nothing
  recorded. A safe with nothing happening to it still holds what it held
  yesterday; a line dropping to zero on a quiet Sunday would be a lie told by a
  gap.

## A dialog was inheriting the table cell that opened it

Reported from the Treasury page: the delete confirmation came up with its
explaining sentence right-aligned, unwrapped, running off the panel and
scrolling sideways inside the dialog — so the line saying *what deleting
actually does* was half off screen.

`<dialog>` + `showModal()` paints in the top layer, so its position and size
owe nothing to where it sits in the DOM. **Inherited properties are a different
matter**, and every `ConfirmAction` renders its dialog inside the table cell its
trash icon lives in. Treasury's sits in a `.td-num` cell, which is `text-right`
and `whitespace-nowrap` so the balance beside it cannot break — and the
confirmation took both.

`Dialog`'s panel now carries `whitespace-normal text-left` as a reset. Fixed
there rather than at the call site because the panel is what is wrong: a
modal's typography must not depend on which cell opened it. **Banking's delete
dialog had been inheriting `text-right` from its own cell all along** and this
fixes that too.

Verified at 1152px and 400px: `text-align: left`, `white-space: normal`, no
horizontal scroll on the panel or the dialog, nothing clipped.

## The treasury chart stops where the entries stop

044 ran the day-by-day window to `greatest(pump_today(), max(entry_date))` and
carried the balance forward across days with nothing recorded, on the reasoning
that a safe nobody touched still holds what it held yesterday. That is right
for a **gap** — a quiet Tuesday between two busy days is a real day the safe sat
there — and wrong for the **end of the sheet**, where it was also being applied.

The difference is what the last point means. In the middle, a carried-forward
day is a day that happened and had no movement. At the end it is a day nothing
has been entered for *yet*, and drawing it says "the safe closed today at
Rs 8,364" when the truth is "nobody has written today down". With entries to
21 Aug and a pump day of 22 Aug the chart ran a flat line out to 22/08.

The owner's spreadsheet does carry its last balance past the last entry — a
spreadsheet needs somewhere to put the formula. The app computes the balance
from the rows, so it has nothing to gain by inventing a day.

Migration 046 ends the window at the last entry. The carry-forward *inside* the
window is untouched, because that part was right.

**The two movement tiles read from the same window**, so "the last 14 days" now
means the fourteen days up to the last entry. Rather than leave a window that
has quietly stopped moving described as though it had not, they name the day it
ends on: **"14 days to 21 Aug 2026"**. On a day the sheet is up to date that
reads as today's date, which is what it is. It costs four words and cannot go
stale — the general form of a lesson this file already has more than one entry
about.

## A treasury page is a day, not 25 rows

25 rows is the app's default page size and it was the wrong unit here. A pump
writes three to six treasury lines a day, so a 25-row page held four and a bit
days, **cut mid-day at both ends**, and was tall enough to hit the
`.table-scroll` 70vh cap — a scrollbar inside a card, inside a page that also
scrolls. Nothing about "25" means anything to the person reading it.

A day means something: it is the unit the owner counts in, closing the safe on
an evening and checking that evening's figure against the notes in it.
Migration 047 adds `treasury_day()`, and the page now shows one day at a time.
Three things fell out of that:

- **The date column left the table.** Every row on a page shares the date, so
  it belongs in the heading — which bought back about 110px of width and is why
  the reason column can afford to scroll on a phone.
- **The day's own opening and closing are on screen**, with its cash in and
  cash out. The 25-row view could not show these at all: its rows started and
  stopped mid-day, so there was no such figure to print. This is the number
  actually checked against the drawer.
- **Both scrollbars are gone** at laptop width, on the busiest day the sheet
  has (17 Aug, seven entries) as well as a typical three-entry one.

**Addressed by date, not by page number.** `?date=2026-08-21` rather than
`?page=3`, for two reasons. A page index is not stable — back-fill one older
entry and every page number after it means a different day, so a bookmarked or
reloaded page 3 quietly becomes page 4's contents. And a date is what the app's
existing `<DateJump>` box already navigates by, so jumping to a day cost
nothing new.

**Days with nothing recorded are skipped**, which is the point of paging by day
rather than stepping a calendar. `prev_day` and `next_day` are the neighbouring
days that *have* entries, not yesterday and tomorrow, so the arrows never land
on an empty page. That is deliberately the opposite of the carry-forward the
chart does inside its window (046): a chart draws a continuous quantity and a
gap in it is a real day the safe sat there, whereas a page is a thing to read
and an empty one is a dead end.

**A requested date always resolves to a day that exists** — the nearest at or
before it, falling back to the earliest. Type a day with nothing on it into the
date box and the page lands on the nearest real one *and says so*, because a
page that quietly shows a different day than the one asked for is a page that
will be misread as the day asked for.

`<TreasuryDayNav>` replaces `<Pager>` here and borrows from both it and
`<DateNav>`: the disabled-button-not-dead-link rule from the first, the date box
from the second, and `hrefForDay` so the chart's window survives stepping a day.

### The min-width that looked ample and was not

Dropping the date column, the table's `min-w` came down from 46rem to 36rem —
which seemed generous for four columns. It was 100px short. Measured, the
columns need 190px for "Fuel or code transfer" on one line, 146px for the
widest In with its arrow, 164px for the widest Out, and a fixed 176px for the
pinned balance block: **676px, not 576px**. The browser took the shortfall out
of the `whitespace-nowrap` money cells, clipping `Rs 135,000` to `Rs 135,0` and
breaking the reason column one word to a line on a phone. Now 43rem, from the
measurement rather than from how roomy four columns sounded.

## The eighteenth table was never attached, and a documentation audit found it

044 wires `treasury_entries` into the activity log. The copy of 044 that was
applied to the live Supabase project did not include that half — the function
body and the `create trigger` at the end of the file were left off — so on the
live database the trigger covered seventeen tables, not eighteen, and **every
movement of cash in and out of the safe went unlogged**. The repo migration was
right; the applied one was short.

**How it was found is the point.** Not a test, and not the app — nothing looks
wrong when a log is silently not written. It came out of updating the docs
before merging: `README.md` says the activity trigger covers seventeen tables
and 044 claimed an eighteenth, so the number was checked against `pg_trigger`
before the sentence was changed. The database said seventeen.

That is what a count in a doc is *for*. A number a future session will read and
believe has to be checkable, and checking one before rewriting it is cheap. The
lesson generalises past this bug: **when a doc states a count, verify it against
the system rather than against the diff that was supposed to change it.**

Migration 048 applies the missing half. It is a new numbered file rather than an
edit to 044, because a migration that has run is never edited — a fresh database
gets the wiring from 044 and then again from 048, which is harmless since
`create or replace function` and `drop trigger if exists` are both idempotent.

Verified by inserting an entry inside a transaction that then aborts: the log
row reads *"Cash out of the safe | Rs 4,000 · Given — …"*, `pg_trigger` now
reports eighteen tables, and afterwards the table still holds its 36 rows and
Rs 8,364 with no stray log rows left behind.

## Stepping a day stopped throwing the reader to the top

Reported: pressing Earlier or Later on Treasury jumped the page back to the
top every time. It did — a Next `Link` resets the scroll by default, and the
sheet is the last thing on that page, so stepping one day threw the reader up
past the tiles, the chart and both breakdowns to look at a table they were
already looking at.

`<TrendRange>` hit this first and its fix is one word, so this is the same one
word in two more places: `scroll={false}` on the day arrows, and a `scroll`
prop on `<DateJump>` so the date box beside them does not do it either.

`<DateJump>` defaults to `scroll: true`, which is what every existing caller
had. The rule for which to pass: **scroll to the top when the whole page
changes** (Readings, the Dashboard — a different day is a different screen),
**stay put when the control sits at the bottom and only the block above it
changes**, as here.

Worth noting `scroll` is not a prop `Button` knows about. MUI forwards what it
does not recognise to the component it renders as — `PendingLink`, which
spreads onto Next's `Link`, which consumes it. It never reaches the DOM, so
there is no unknown-attribute warning.

**Measured both ways rather than assumed**, because a fix that is already the
default behaviour is indistinguishable from a working one if you only test
after. Without it, `scrollY` went 479 → 0 on Earlier, on Later and on the date
box. With it, 479 on all three, with the day and the day counter changing
underneath — and the chart's `days=14` window carried through each.

## Profit was counting stock bought instead of stock sold

The owner asked why August showed a loss of **Rs 1,464,581** in a month he had
done well in. It was not a display bug. All three reporting RPCs computed:

```
profit = sales − purchases − expenses
```

There is no opening or closing stock in that anywhere. It charges a month for
every litre that *arrived* in it, whether or not any of it was sold.

August is the clearest possible illustration: 49,000 L bought, 43,418 L sold,
including **two 5,000 L petrol loads on the 21st**. The petrol tank went from
854 L on 31 July to 9,610 L. About Rs 1,866,000 of fuel was sitting in the
ground, paid for by August and to be sold in September.

```
profit = sales − cost of goods SOLD − expenses
cost of goods sold = opening stock + purchases − closing stock
```

August becomes **+Rs 566,307**:

| | |
|---|---|
| Sales | 14,984,221 |
| Opening stock (31 Jul) | 2,405,822 |
| + Stock bought | 16,385,110 |
| − Closing stock | 4,436,709 |
| **= Cost of stock sold** | **14,354,223** |
| Expenses | 63,692 |
| **Profit** | **566,307** |

It would not have come right at month end either, which is what made this
worth fixing rather than explaining. The old formula is only correct when
litres bought equal litres sold at the same rate, which is no month; a month
ending with fuel in the tank is understated and one that runs the tanks down is
*overstated*. The errors cancel over years and never within a month.

### Valuing what is in the tank

A litre in a tank has no price tag, so one has to be chosen. Stock is valued at
the **weighted average cost of the deliveries it is actually made of** — walk
that tank's purchases newest-first until its litres are accounted for. Petrol
came out at Rs 332.60/L (the two loads of the 21st plus part of the 18th's) and
diesel at Rs 386.40 (the 18th's delivery), which is exactly what is physically
down there.

**A single flat average over every purchase ever was considered and rejected.**
With rates climbing through August (321 → 336), an average still carrying older
cheap deliveries values a full tank below what it cost and understates profit
for as long as prices rise — a smaller version of the bug being fixed.

Litres older than any recorded delivery — the opening quantity typed into
Settings when the pump joined the app — are valued at that tank's all-time
average rate. That is an estimate and is documented as one; it affects only the
first month that has purchases.

Lubricants get identical treatment. It barely matters today (the shelf turns
over slowly and August restocked nothing) but a half-fixed profit figure is
worse than an unfixed one, because it looks trustworthy.

### One formula, three callers

`cost_of_goods_sold(from, to)` is the only place the arithmetic lives, and
`get_monthly_report`, `get_month_export` and `get_range_summary` all call it —
verified to return the identical figure for the same days, which is the whole
reason aggregation is in Postgres rather than in three page components.

**The three functions were patched, not reproduced in full**, which departs
from how 036, 039 and 044 replaced functions. Those reproduced one function to
add one branch; this changes one expression in three functions totalling about
25,000 characters, none of which is otherwise touched, and three hand-copied
near-duplicates is three chances to silently drop a line from a report nobody
re-reads. Each is read back with `pg_get_functiondef`, has the known expressions
swapped, and is re-declared — and **raises** if the expected text is not found,
rather than reporting success while leaving a wrong profit in place.

### What the page says now

The line under the tiles used to apologise for the figure ("profit counts stock
bought this month, not stock sold — so a big delivery near month end makes it
look low"). That was honest about a formula that was wrong. It now shows the
working instead: opening stock, plus bought, less closing, equals the cost of
what sold. The Excel Summary sheet gained the same three figures and the same
note.

**The register's daily profit sparkline had to change too**, and this is the
part that would have been easy to miss: it computed `sales − stock bought −
expenses` per day in JavaScript. Left alone it would have been *worse* than
before — a delivery day plunging to a deep loss on a line sitting directly
beneath a headline that no longer counts deliveries. It now spreads the cost of
stock sold across the days **by litres sold**, which is exact at the total
(every day's litres sum to the period's, so every day's cost sums to the
period's) and an apportionment within it. Verified: the daily series sums to
566,306.57, the headline to the same.

### Two things caught by rendering it

Both in the new explanation line, both invisible to the build:

- **Money broke across lines.** At 400px the total rendered as "Rs" ending one
  line and "14,354,223" starting the next, which reads for a moment as two
  figures. Every figure in the sentence is now `whitespace-nowrap`: prose
  wraps, money inside prose does not.
- **React dropped one space.** "Rs 4,436,709still there at the end" — one of
  four gaps written as ordinary JSX whitespace came out missing while its three
  identical-looking siblings were fine. Every gap around a figure is now an
  explicit `{' '}`. JSX's rules about whitespace next to an element and a line
  break are subtle enough that "it looks the same as the one above it" is not
  evidence.

## The old end of the activity log can be thrown away

The owner: the activity page grows much faster than anything else in the app,
and a month later most of it is useless. He wanted a button to clear the old
entries.

Which sounds like it contradicts migration 035, whose whole point is that the
log is append-only for everybody, the owner included. It does not, and the
difference is worth writing down, because it is the difference between a trail
that is worth something and one that is decoration:

- **A line may never be EDITED.** That is untouched, for everyone, always. The
  UPDATE half of the guard is exactly as it was.
- **A line may never be picked out and removed on its own.** That is the half
  that would have made the trail worthless — remove the one line about the
  payment somebody backdated on Tuesday, leave Monday and Wednesday, and the
  log now lies by looking complete.

So what shipped is a coarse, whole-period trim and nothing finer. The dialog
offers four choices and they are all "how much to KEEP": the last month, three
months, six months or year. The cutoff date is computed in Postgres from
`pump_today()`, not sent from the browser, so no caller can ask for "everything
up to five minutes ago"; the most recent month can never be cleared whatever is
asked for; and the trim writes its own line into the log it just trimmed,
naming who did it and how many entries went. Migration 050.

**The append-only guard was not disabled to do it.** It learns one named
exception, `app.trimming_activity`, set only by `clear_activity_log()`, only
for the length of its transaction, and even then it refuses any row that is not
older than the cutoff the setting names — so the setting alone does not open
the table, it only opens the far end of it. This is the same shape as
`app.purging_customer` in migration 033 and for the same reason: a stray DELETE
from PostgREST, from server code, or from a later refactor meets the refusal it
always did, because none of them set it.

**Each period says how many lines it would take**, from
`activity_log_trim_counts()`, which returns all four counts and the span of the
log in one round trip. "Older than six months" is a tidy-up at 4 lines and a
decision at 4,000, and the owner cannot tell which one he is agreeing to
without the number. The counts and the delete share one cutoff function, so the
figure shown and the rows that actually go cannot drift apart. The dialog
defaults to the largest period that would actually remove something — somebody
opening it has too much log, not too little — and a period with nothing older
than it is drawn disabled rather than hidden, so the four options stay in the
same places.

**Tested on a local Postgres** against a shim of the 035 schema rather than the
live project: staff refused on both functions, an out-of-range period refused,
a direct DELETE and any UPDATE still refused, the trim removing exactly the
rows older than its cutoff, the log line it writes about itself, a second trim
in a row reporting nothing to do and writing no line claiming otherwise, and
the transaction-local setting not surviving into the next statement.

## The active section carries a dark bar

The tinted band and the greener label already said which section was open, but
both are soft, and on a cheap tablet in daylight the `brand-50` fill washes out
to the same white as the rest of the column — at which point nothing on screen
says which of thirteen sections is showing. Each active row now ends with a
short dark bar (`ActiveMark` in `AdminSidebar.js`): `ml-auto` so the markers
line up down the column's right edge whatever the label's length, and
`brand-800`, which is the darkest thing in the nav and sits somewhere no other
row has ink at all. It reads as a marker rather than as one more pale wash.
Decorative only — `aria-current="page"` on the link is what a screen reader is
told, and the mark is `aria-hidden`. It is on the phone drawer's rows and on
Account as well as the sections, checked at 1152px and 400px.

## The books can leave Supabase, and come back

The owner asked the question that had not been asked in fifty migrations: if he
lost access to the Supabase account, could he stand a new project up and put
everything back? At the time the honest answer was no. The project is on the
free plan — no daily backup anybody can restore from, and a pause after a week
of inactivity — and the only export was the Excel workbook, which is a report:
one month, laid out for reading, with no way back into a database.

So: **Download backup** at the foot of Reports, and a recovery script beside it.

**What is in the file.** Every table, in dependency order, as one JSON
document. Two things are left out on purpose. The activity log's ROWS, at the
owner's request — it is the largest table, nothing depends on it, and it
answers "what happened last week" rather than "what are the books"; the table
and its trigger still come from migration 035, so a restored project writes new
lines from its first save. And the profiles, because a profile row is half of a
login and the other half lives in `auth.users`, where passwords are hashes no
API hands out. The names ARE exported, which is what lets a restore put each
entry back under the person who made it.

**Why the loading is a database function rather than a loop in JavaScript.**
This is the part that would have been easy to get wrong and hard to notice: the
schema is not a passive store. A credit slip auto-posts its own ledger entry —
reload both through the normal path and every credit customer's balance
doubles. Tank and lubricant stock are recalculated per row, from a table that
is only partly loaded. Readings may not overlap, a day must balance, and the
safe may never go below zero at any point in the chain — all true of the
finished data, and not necessarily true half way through loading it in table
order. `restore_everything()` therefore disables user triggers for one
transaction, loads parents before children, turns them back on, and recomputes
the two derived stock figures itself.

**It refuses a target that already holds trading data**, and names the tables.
Merging two books is not something to ask a script to attempt, and "restore
over the top of what is there" is how a stale backup destroys a good database.

### Three things only found by actually restoring

The round trip was run for real against a local Postgres with all fifty-one
migrations applied: seed a database through the normal path, export, wipe,
rebuild from the migrations, restore, and diff every count, money total,
customer balance, stock figure and trigger state. It came back identical — but
only after three things that reading the code would not have caught:

- **A fresh project is not empty.** Migration 045 seeds the owner's real 36
  treasury movements, on top of the tanks and nozzles from 004/012/013. The
  first restore into a freshly migrated database was refused by its own
  emptiness check. Hence `backup_seeded_tables()`, which names what the
  migrations put there and is cleared and replaced by the file's own copy.
- **`treasury_entries.seq` is an identity column, and it is load-bearing.** The
  safe's running order is `(entry_date, seq)`, so letting Postgres hand out
  fresh values would silently reorder two movements made on the same day. The
  restore writes the old values with `overriding system value` and then moves
  the sequence past them, or the next entry after a restore would collide.
- **A restore that returns nothing must say so.** With a 200 carrying no
  result, the script went on to its checks and reported all seventeen tables as
  mismatched — seventeen alarming lines for a load that never started. It now
  stops and says the load did not happen.

**The script's own failure paths were exercised too**: a project with no logins
yet, an author with no matching login (restored with nobody against them, and
said out loud), a file whose header disagrees with its rows, a file from a
future schema version, and a target that already has data.

One honest limitation, recorded because a future session will want to know: the
script's HTTP path was exercised against a small stand-in for PostgREST backed
by the real database and the real restore function, because Docker Hub is
unreachable from this environment and the genuine article could not be run. The
database half of the round trip is tested for real; PostgREST's own routing is
the one thing standing in for itself.
