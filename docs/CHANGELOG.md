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
logins, one pump. Migrations run to **039**.

**What was added most recently**, newest last, all of it detailed further down:

| Area | What changed |
|---|---|
| Loose oil | A drum bought from a supplier and sold by the rupee, not the litre. Its own page under Lubricants, litres derived server-side from a rate, sale litres widened to 3 dp. Migrations 028–030. |
| Tables that grow | `<Pager>` on Purchases, Banking, Stock checks, the customer ledger and both sales tables — and the removal of `.limit()` caps that were silently truncating a money total. |
| Dashboard | An oil-sales chart beside the fuel ones (`get_lubricant_trend`, 029). |
| Customers | Removing one (delete if never traded, retire if it did), deleting one for good, an opening balance created with the account, and editable details. Migrations 031, 033, 034. |
| Money precision | The ledger moved to **whole rupees**, storage as well as display — there is no coin below one rupee. Migration 032. |
| Speed | Functions moved to Singapore beside the database; the Guide is prefetched. |
| Feedback | Every destructive submit shows a pending state; delete triggers are a trash icon. |
| Guide | Location chips, bold rule titles and a folded setup section — a fifth shorter than before, and scannable. |
| Settings | The rate panel previews five changes (rounded up to a whole date) instead of seven days, so it no longer scrolls inside itself. |
| Dashboard | The charts take a 7 / 14 / 30 / 90-day window (`<TrendRange>`), carried through the day arrows by `<DateNav extraParams>`. |
| Dashboard | The fuel-sales chart toggles Rupees / Litres, split by fuel, so it no longer duplicates the cash-vs-credit chart beside it. |
| All fuel rates | Eight rows a page instead of 25, and the 70vh height cap dropped, so nothing scrolls inside the card. |
| Activity | An audit trail: a trigger on sixteen tables writes who changed what into an append-only `activity_log`, read at `/admin/activity` by the owner. Migration 035. |
| Lubricants | Packed and loose sales merged into one filtered table (the drum's route is now a redirect), the day's totals split and labelled, low-stock badges, and the Urdu register words بنام / جمع on the balance cards. |
| Company Assets | A new owner-only page for what the pump has bought and kept — vehicles, machinery, property, electronics. Card grid, icon-tile category picker, figures from a summary RPC. Migration 036. |
| Readings | A warning naming the missing day, and a checkbox that must be ticked to save a reading when the day before it was never entered. A day-completion strip was tried three ways alongside it and removed — migrations 037 and 038 add and then drop its RPC. |
| Stock | **A dip taken in the morning closes yesterday.** The maths assumed the opposite and reported a whole day's sales as a loss, every day. `taken` + generated `books_date`; `expected_stock` recalculated from history rather than frozen at insert; the dashboard's tank card stopped ignoring the date on screen; and the owner can clear a mistyped dip. Migration 039. |

**If you are porting this to Electron or another shell**, read
`README.md` → "If you are porting this off Supabase" first. The short version:
almost none of the important logic is in the JavaScript. Thirty-nine
migrations of triggers and constraints hold the money rules, and the hardest
single thing to reproduce is the activity log (035) — one PL/pgSQL trigger on
seventeen tables that diffs `jsonb` and writes an English sentence. Decide
early whether a single-user offline build needs it at all.

**Five things that are load-bearing and easy to break:**

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
   the trading day it *closes* — not the day it was taken. This pump dips in
   the morning, so those differ by one. See `README.md` → "A dip belongs to the
   day it closes".
4. **The business day is `Asia/Karachi`**, never the server clock. The activity
   log is the one place a *time of day* is shown, and it is pinned the same way
   — rendered on a UTC server without pinning, an evening entry prints as an
   afternoon one.
5. **`activity_log` is written only by trigger and can never be edited.** If a
   future change adds a table that holds money, attach the trigger to it in the
   same migration; if one is renamed, the log line degrades rather than
   breaking, so nothing will tell you.

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
  box is drawn in the *browser's* locale, so on an en-US browser the 7th of
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
  now, and the grid drops to one column below 380px so the number has room.

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
the client *instance* — middleware builds a fresh client per request, so it
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
  between two bounds, including days with no trade, so a page is 25 *days*:
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

**A gap is still allowed.** A later reading starting *after* an earlier one
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
  meter was not read on." The unentered wording also now says the save *will
  be refused*, which since migration 026 it will be.

A third case fell out of separating the two: a saved day whose next reading
starts *above* where it closed is a gap, not an overlap, and now says so —
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

It is deliberately *not* a ban on back-filling, because the honest repair
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
(migration 028). A drum *is* a lubricant — bought in litres from a supplier,
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
back unchanged: `rate_per_litre` is generated *from* `litres`, and
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
and names what is left in the drum. The rate is shown *before* an amount is
typed, because a wrong rate is the one thing that can make every loose sale
wrong at once. With one drum the product select is not rendered at all.

Purchases gets a separate **Record a loose oil purchase** button rather than
one more entry in the lubricant dropdown — a drum arrives from a different
supplier with no brand, so splitting the button is what lets each form say the
right thing instead of hedging. It warns if the drum's buying rate has caught
up with its selling rate.

### Everywhere else

Reports splits "of which loose oil" out of the lubricant line and badges the
drum in the per-product table — it is most of the sale *count* and a small
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
stopped at 100 rows — but the Purchases page totals *what is still owed to
suppliers across every row*, so the hundred-and-first delivery pushed the
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
is *only* a list (the customer ledger, whose balance comes from an RPC that
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
that page the round trip *is* the entire wait, and `loading.js` covers it with
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
*dashboard's* skeleton, which is worse.

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
round trip was only expensive *because* of the region; once the function sits
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

The manual adjustment offered a dropdown reading *Increases what they owe* and
*Reduces what they owe*. The owner could not tell them apart at a glance — two
long phrases differing by one word in the middle, both starting the same shape.

This is the worst place in the app for an ambiguous control. Picking the wrong
direction does not fail: both are legal, no constraint can catch it, and the
ledger is append-only, so the mistake is permanent and has to be corrected with
a second entry. The only defence is not making it in the first place.

Two changes, and the second is the one that actually works:

- **Cards in yard language, shared between both forms.** `BalanceDirection`
  gives "They owe more" / "They owe less", each with a line saying *when* to use
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

*Process note*: `npx prettier` was run on `CustomerForm.js` without checking the
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
rule is about icons carrying *information* — a nozzle's Entered badge, a fuel
type — where colour is the cue that fails in a dim office. A control is
different, and two conditions keep it honest: `label` is mandatory and becomes
both `aria-label` and the hover title, and every one of these confirms **in
words** before anything happens. Text is kept where the words *are* the
distinction: *Bring back* beside *Delete for good* would be a guess as two
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
  entries in theme order is the right shape for *why*, and the wrong shape for
  *what is true today* — so there is now a table of the recent work and a list
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

The owner's verdict on the guide, after it had been brought up to date: *"too
much detail... add some visual markers instead, so that it does not become
boring to read."* It measured **4,603px** — five screens on a laptop — and the
reader it is written for is an attendant who has opened it to find one answer.

Where the height was: setup 1,133px (24%), the evening routine 1,127px (24%),
the rules 779px (17%), the section map 668px (14%), roles 442px (10%).

**Three markers replaced prose, and one section folded away:**

- **Location chips.** Ten steps across the two languages said, in a sentence,
  where to go. They now carry `where: { icon, path }` and render it as a pill
  under the step heading — `Lubricants → Record a lubricant sale`, with the
  *same icon as the sidebar tab*, so it points at something already on screen.
- **Rules lead with the claim.** `rules.items` went from strings to
  `{ title, body }`; the title is bold. Ten rules are now ten scannable lines
  rather than ten paragraphs behind ten identical warning triangles — the
  repeated icon was marking nothing, and the eye had nowhere to land.
- **The one-time setup folds.** The page already tells the reader to skip it,
  so it is now a native `<details>` styled as a card row. No JavaScript, no
  state, still found by the browser's own search.

The chips *raised* the height first — 4,603 → 4,957px — which is worth
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

*"Show only the recent 5 readings, rest should be visible in view all."*

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
it: *"the graphs on dashboard also need date filter"* and *"this page should
show 8 max and next page the remaining, means the pagination is set at max 8
so scroll bar does not appear."*

**The charts can now be asked for 7, 14, 30 or 90 days.** They were hard-wired
to 14. `<TrendRange>` is four fixed windows rather than a from/to pair,
because the day they *end* on is already chosen by `<DateNav>` at the top of
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

Reported the day it went out: *"i deployed, its working, but changing from 7
days to 14 moves the UI to the top."*

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

*"Add trail logs and log the user activity and create a tabular log data in
the navigation menu after guide button."*

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
sentence *at write time* — "Unit 1 · Nozzle A — 151.15 L, Rs 50,055" — because
half these rows describe something that no longer exists, and a log that joined
back to the row at read time would render a deletion as blanks.

**It can never block a write.** The trigger body ends in `exception when others
then return coalesce(new, old)`. A pump that cannot record its evening because
the logging is broken is worse than a pump with no log. The cost is that a bug
in it is invisible except as a gap, which is why every branch was exercised
before it shipped rather than after.

**Three things it deliberately stays quiet about**, each found by running it:

- *Stock recalculation.* `tanks.current_stock_litres` is recomputed by trigger
  after every reading, so logging it would bury each real event under a line of
  machine bookkeeping. An update whose only changed columns are ignored is not
  logged at all.
- *The ledger row a credit slip posts for itself.* One event, described twice,
  and the slip is the half a person recognises.
- *The cascade under a deleted reading.* Deleting a reading deletes its credit
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
described the *stock* and implied the drum was included in the *sales*.

Two feet below, the shelf table listed the drum with "sold 1 L" against it. So
the screen said "nothing sold today" and "the drum sold a litre" at the same
time. Neither was wrong; they were counting different things and nothing on the
page said which.

**The day leads, then its halves.** The tiles are now `Oil sold today` (both
kinds), `Packed, off the shelf`, `Loose, out of the drum`, `On credit` (the
whole day, because "how much of today's oil is not in the drawer" does not care
which container it came out of). The split that was invisible is now the first
thing on the page.

**The shelf says which span it covers.** *Bought* and *Sold* there are running
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

*"Lube oil sale should also show here instead of a separate page"* and *"I
don't want this button here, just the loose sales here."*

This reverses the split recorded further up this file, and the original reason
for it was sound: a run of rupee-priced pours buries the four carton sales that
need reading. What changed is the answer, not the problem. A route split makes
the reader work out *where a sale lives* before they can look for it, and a
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

**The delete guards became dialogs.** Reported as *"they shift the UI"*, and
that is exactly it: each of the seven replaced its own trash icon with a
question, two buttons and sometimes a paragraph, inside a table cell — so the
row grew, the column widened, and every row below jumped. On the Customers
table the row you were aiming at moved while you were reading the question.

`<ConfirmAction>` is the shared shape now. Verified by watching the row *below*
the one being confirmed: it moves **0px** at 1152 and at 400, where before it
dropped by the height of the expanded block. The dialogs also have room for the
sentence that matters — the fuel-rate one can say in full that readings already
entered keep the rate they were sold at, instead of six words squeezed into a
cell.

Two things kept deliberately: a refusal leaves the dialog **open**, because the
database's explanation is the whole point of the interaction and closing would
throw it away; and `PurgeCustomerButton` keeps its own dialog, because its
trigger must be the words *Delete for good* beside *Bring back*, and its body
owns the type-the-name field that gates the submit.

### The two dashboard charts were drawing the same picture

*"Both of these graphs shows almost the same thing, configure the left graph
to show sales of petrol and diesel in litres too with a toggle."*

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

*"I need a page named Company Assets, where I can add all the company assets
with their value at the time of purchase, and edit or delete them. This page
is just for the owner to see what he bought using pump money."*

A new page, `/admin/company-assets`, owner-only in the same way Banking is —
RLS refuses `data_entry` outright, the nav link is hidden for anyone else, and
neither is treated as the real gate. Nothing here touches a sale, an expense,
or the month's profit; it is a separate ledger of things bought and *kept*
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

*"Father came back after 2 days to enter the reading and mistakenly added the
reading in today's section, instead of Sunday, without knowing that he missed
a day."* Real evening, real numbers: 09 Aug 2026 sat at 0 of 6 nozzles while
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
  whose job is six nozzles — *"I just needed a visual indication… things did
  not work out."* Its RPC (`get_reading_completion`, migration 037) went with
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

Reported as *"the daily stock reading when compared to dips differ by a lot"*.
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
anything entered *afterwards* for an earlier date left it permanently wrong,
with nothing on screen to say so.

It had already happened. The dips for 3–8 Aug were back-filled on the 11th in
**newest-first order**, so every one of them took its baseline from the 2 Aug
dip instead of the day before it, and all six landed on the same phantom "gain
of about 3,300 L". Nothing was wrong with the fuel — the rows were computed
against a baseline that was superseded a minute later.

`expected_stock` is now **recalculated from history by trigger**, exactly as
`tanks.current_stock_litres` already was, and for the same reason. Four
triggers feed it: deliveries and readings are what happen *between* dips, a dip
is the baseline for the next one, and a tank's opening stock is the baseline for
the first. The dip trigger is deliberately `after update OF` named columns —
the recalc writes `expected_stock`, and an unqualified trigger would call
itself.

Both derived columns joined the activity log's ignored list, so a day's
readings no longer credit whoever typed them with "changing" a dip taken last
week.

### The dashboard's tank stock ignored the date on screen

Reported separately: *"the tank stock on the dashboard is always the same as
today's no matter which day I am visiting"*. True, and unrelated to the above.
The card was rendering `tank.current_stock_litres` — a single cached number
meaning *right now* — while `get_daily_summary` had always returned a per-date
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

Follow-up, once the timing fix was live: 1 Aug still showed *"Gain of 4,702 L"*
in green on petrol and the same loss on diesel.

The first dip on a tank has no earlier dip behind it, so
`calculate_expected_stock` falls back to the tank's **opening stock** from
Settings. That figure was *typed*, not measured — so a difference between it
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
the difference *is* partly genuine. What is always true is that the baseline was
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
comments explaining *why* a name looks the way it does — the wrench for
Machinery, the briefcase for Assets — carried over to the new file), so no
caller had to change what name it asks for.

**Sizing needed a wrapper, and this was the one real gotcha.** The old
`<svg className="shrink-0 h-5 w-5">` sized itself directly off the passed
Tailwind classes. MUI's `SvgIcon` sizes itself in `em` via its own
Emotion-generated CSS class, and Emotion injects its `<style>` tags at
runtime — which can land *after* Tailwind's build-time utilities in the
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
the *same* per-category icon (`vehicle`/`machinery`/`property`/…) that
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
