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
