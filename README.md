# Mubeen Petroleum Service

Daily management for the petrol pump: nozzle readings, fuel purchases,
lubricant sales, stock gain/loss, customer credit, banking and monthly profit.

**Naming and logo** live in `app/_lib/brand.js`. Change `BUSINESS_NAME` there and
the sidebar, the login screen, every browser tab title and the monthly workbook
all follow. The logo is whatever sits at `public/logo.png` — drop a file in and
it appears; take it away and the initials tile comes back. No code change either
way.

Built with Next.js (App Router, plain JavaScript), Tailwind CSS v4 and Supabase
(Postgres + RLS + Auth). Deploys to Vercel.

---

## First-time setup

### 1. Environment variables

Copy `.env.example` to `.env.local` and fill it in from the Supabase dashboard
(**Project Settings → API**):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The first two are safe in the browser — RLS is what protects the data, not those
keys. `SUPABASE_SERVICE_ROLE_KEY` is secret, bypasses RLS entirely, and is used
in exactly one place: creating staff logins. If it ever leaks, rotate it in the
dashboard immediately.

> **Careful:** `NEXT_PUBLIC_*` values are baked in when the app is **built**, not
> when it runs. On Vercel, set them in project settings *before* deploying, and
> redeploy after changing one — otherwise the old value stays compiled in.

### 2. Install and run

```bash
npm install
npm run dev
```

### 3. Create the first owner login

There is no public signup — by design. So the very first account has to be made
by hand, once:

1. In the Supabase dashboard go to **Authentication → Users → Add user**.
2. Enter your father's email and a password, and tick **Auto Confirm User**.
3. A `profiles` row is created automatically, as `data_entry`. Promote it in the
   **SQL Editor**:

   ```sql
   update public.profiles
      set role = 'super_admin', full_name = 'His Name'
    where id = (select id from auth.users where email = 'his-email@example.com');
   ```

From then on every other login is created inside the app, under **Account →
Add login**. Never add accounts by hand again.

### 4. Set the fuel prices

Readings cannot be entered until a rate exists for each fuel. Go to **Settings →
Fuel prices** and set petrol and diesel.

---

## The two roles

| | `super_admin` (owner) | `data_entry` (staff) |
|---|---|---|
| Enter daily readings | yes | yes |
| Record lubricant sales | yes | yes |
| Record purchases and dips | yes | yes |
| Add customers, record payments | yes | yes |
| See sales totals, profit, reports | yes | **no** |
| Record and see expenses | yes | **no** |
| See the bank accounts and their balances | yes | **no** |
| Change prices, tanks, nozzles | yes | **no** |
| Add or remove a lubricant from the shelf | yes | **no** |
| Correct or delete past entries | yes | **no** |
| Manage staff logins | yes | **no** |

Roles live in the `profiles` table — no email is hardcoded anywhere. They are
enforced in three independent places:

1. **RLS policies in Postgres** — the real protection. Even with a stolen
   publishable key and a handwritten query, the database refuses.
2. **`requireRole()`** at the top of every Server Action.
3. **The navigation**, which hides what a role cannot open. Cosmetic only.

---

## The daily routine

1. During the day the attendant writes credit slips on paper, as now.
2. In the evening, open **Readings**. Each nozzle's opening figure is already
   filled in from yesterday's closing.
3. Type the closing reading. Litres and value appear instantly.
4. For each credit slip, press **+ Add customer**, pick the customer and type the
   litres — the amount fills in at today's rate.
5. **Cash is calculated for you** as whatever is left over. Check it against the
   notes in the drawer *before* saving. If it does not match, something is wrong
   while it is still easy to fix.
6. Save. Each customer's balance updates by itself.

Oil sold over the counter goes under **Lubricants**, one sale at a time as it
happens: pick the product, tap the pack size or type the litres, and say whether
it was cash or credit. Credit lands on the same customer ledger as fuel.

Deliveries go under **Purchases** — fuel into the tanks and lubricants onto the
shelf, in one list. Enter the litres and the amount on the delivery note; the
rate per litre is worked out for you. The dip stick reading, and what is left on
the lubricant shelf, both sit under **Stock**.

Every screen with a date has arrows either side of a date box; picking a date in
the box goes straight to that day. If a day was entered against the wrong date,
the owner can wipe it with **Clear this day** on Readings and type it again.

---

## What the database will not let you do

This is a money tool, so several rules are enforced in Postgres itself, where no
amount of application code can get around them.

- **Cash + credit must equal what the meter says was sold.** A day cannot be
  saved half-balanced.
- **Credit slips must add up to the reading's credit amount.** Checked at the end
  of the transaction, so a reading and its slips are saved together or not at
  all.
- **A meter cannot run backwards** — closing is never below opening.
- **Two readings for one nozzle may not overlap.** A meter only moves
  forwards, so if a later reading starts before an earlier one finished, the
  same litres are on the books twice. Refused, naming the other date and how
  many litres would be duplicated. A *gap* is still allowed — that is a
  skipped day or a replaced meter, and blocking it would leave no way
  forward — so gaps stay warnings in the entry dialog.
- **A day the next reading already covers whole cannot be entered at all.**
  If the following reading opens exactly where this day starts, there is no
  honest figure left to type: the only closing the overlap rule would still
  accept is the opening itself, and a nought-litre day says "nothing sold" for
  a day that traded. So enter days **oldest first**. If one is missed, clear
  everything after it and re-enter forwards — back-filling underneath a saved
  day is refused, and the message names the day to clear.
- **The customer ledger is append-only.** No update, no delete, for anybody,
  including the owner and including the service-role key. A mistake is corrected
  by posting a new entry pointing the other way, so the history always adds up.
  This is enforced by a database trigger, not just by permissions. Two narrow
  exceptions exist and only these: `created_by`, `credit_sale_id` and
  `lubricant_sale_id` may be set to null when the profile, credit slip or
  lubricant sale they point at is deleted. Every other column must be
  byte-for-byte identical, so none can be used as a way in to change an amount,
  a date or a customer.
- **Deleting a reading reverses its credit slips, it does not erase them.** The
  customer's original debit stays on the ledger and an offsetting credit is
  posted beside it, so the balance comes back to correct while the history still
  reads as what happened. Same for clearing a whole day.
- **Deleting a lubricant sale reverses its credit the same way**, in the same
  transaction as the delete, so a customer is never left owing money for a tin
  the books no longer show them taking.
- **A lubricant sale must balance and must be attributable.** Cash plus credit
  has to equal the amount charged, and any credit on it has to name the customer
  it is owed by.
- **A loose oil product must have a selling rate.** The rate is the only thing
  turning "Rs 20 of oil" into litres off the drum, so without one a sale could
  take money and no stock, and the drum would read full for ever.
- **A customer carrying a balance cannot be removed** — in either direction,
  whether they owe the pump or the pump owes them. Judged to the nearest rupee,
  so the most it can forgive is 49 paisa, less than the smallest coin that
  exists; anything a customer could actually be asked for still blocks removal
  and is named in the message. A removed customer drops out
  of the outstanding total, so this would write a debt off (or lose a credit)
  with nothing on screen to say it had happened. Settle the account first. A
  customer who never traded is deleted outright; one with history is retired,
  and can be brought back from the **Removed** list.
- **Tank and lubricant stock are recalculated from history**, never incremented,
  so the cached figures cannot drift away from the purchases, sales and dips
  that produced them.
- **A tank cannot be given more opening stock than it holds.**
- **No bank account may go below zero** — checked per account, not across the
  total. A payment too large for one account is split across the others the
  owner picks, computed in the database from real balances.
- **A delivery's invoice total is what gets stored**; its rate per litre is
  generated from it. The amount on the note is the fact - see "Things worth
  knowing".

If the app and the database ever disagree, the database is right.

---

## How stock is worked out

```
expected stock = last measured dip
               + fuel delivered since
               − litres sold since
```

The baseline is the last physical dip, because a measured number beats a
calculated one. Before the first dip it falls back to the tank's opening stock
(set under **Settings → Tanks**).

`gain / loss = actual dip − expected`.

---

## Project layout

```
app/
  layout.js, page.js
  admin/
    layout.js              auth shell for every admin page
    login/                 sign in (no signup)
    page.js                dashboard - owner only
    readings/              the daily entry screen
    lubricants/            counter sales, and the shelf
      loose/               the drum, sold by the rupee
    purchases/             fuel deliveries and lubricant restocks
    stock-checks/          dip readings, gain/loss, and lubricant stock
    customers/             list, new, and [id] detail with ledger
    banking/               the owner's bank accounts - owner only
    expenses/              what the pump spends, by month - owner only
    reports/               monthly profit, charts, Excel export
      daily/               every trading day, newest first, paged
    settings/              prices, tanks, nozzle wiring
      fuel-prices/         the full rate history, paged
    account/               your own login, and staff logins for the owner
    guide/                 how to use the app, English and Urdu (?lang=ur)
  _components/
    admin/                 admin-only components
    ui/                    shared building blocks
  _lib/
    supabase.js            browser client
    supabase-server.js     server client (session-bound, RLS applies)
    supabase-auth.js       service-role client - staff accounts only
    data-service.js        every read query
    actions.js             every Server Action
    helpers.js             requireRole(), formatting, calculations
    date-helpers.js        dates, safe on the server AND in the browser
    format-helpers.js      formatRate() - same reason as date-helpers
    brand.js               business name; the logo is public/logo.png
    guide-content.js       the guide's text, both languages, as data
    excel-report.js        builds the monthly workbook from the template
  _styles/globals.css
proxy.js                   session refresh + signed-in gate
scripts/                   build-report-template.py, build-icons.py
supabase/migrations/       the schema, in order
docs/                      UI_CONVENTIONS.md, CHANGELOG.md
```

`_components`, `_lib` and `_styles` are underscore-prefixed on purpose — that is
the Next.js private-folder convention, which keeps them out of routing.

---

## Database migrations

Applied in order:

| File | What it does |
|---|---|
| `001_core_schema.sql` | Enums, tables, constraints, indexes |
| `002_functions_and_triggers.sql` | Role helpers, stock maths, ledger auto-post, append-only guard |
| `003_rls_policies.sql` | Row Level Security for both roles |
| `004_seed_tanks_and_nozzles.sql` | The 2 tanks and 6 nozzles |
| `005_reporting_rpcs.sql` | Aggregate reporting functions |
| `006_lock_down_function_grants.sql` | Revokes the default PUBLIC execute grant |
| `007_reading_sheet_rpc.sql` | The daily reading screen, in one query |
| `008_pump_timezone.sql` | `pump_today()` - the database's idea of today, pinned to the pump |
| `009_reading_chain_context.sql` | Returns the neighbouring readings, so a broken chain can be flagged before saving |
| `010_month_export_rpc.sql` | Everything the monthly Excel workbook needs, in one call |
| `011_delete_staff_account.sql` | Lets a login be deleted, not just switched off |
| `012_nozzle_starting_reading.sql` | Where each meter stood when the pump joined the app |
| `013_correct_nozzle_fuel_layout.sql` | Unit 1 diesel, units 2 and 3 petrol - corrects 004's guess |
| `014_clear_day_and_reset.sql` | Clear one day; empty the books (testing only) |
| `015_delete_reading_reverses_slips.sql` | Deleting a reading posts offsetting ledger entries |
| `016_reset_all_data_safeupdate.sql` | Satisfies the WHERE-clause guard when emptying |
| `017_tank_opening_stock_within_capacity.sql` | A tank cannot be given more than it holds |
| `018_bank_accounts.sql` | Bank accounts, deposits, payments, 60-row retention |
| `019_month_export_with_banking.sql` | Adds the bank movements to the export |
| `020_bank_no_overdraw.sql` | Money out may not exceed money there is |
| `021_bank_split_payments.sql` | Per-account zero floor; one payment across several accounts |
| `022_set_nozzle_wiring.sql` | All six nozzles saved in one UPDATE |
| `023_purchase_total_is_the_input.sql` | Invoice total stored; rate per litre generated from it |
| `024_lubricants.sql` | The lubricant shelf: products, purchases, counter sales, credit to the ledger |
| `025_lubricants_in_reports.sql` | Lubricants in the dashboard, the trend, the monthly report and the export |
| `026_readings_may_not_overlap.sql` | A nozzle's readings may not overlap: two rows cannot cover the same litres |
| `027_no_backfill_without_room.sql` | And a day the next reading already covers whole cannot be entered at all |
| `028_loose_oil.sql` | Loose oil: a drum sold by the rupee, and litres to three decimals |
| `029_lubricant_trend.sql` | A day-by-day series for the shelf and the drum, for the dashboard chart |
| `030_loose_oil_in_the_export.sql` | The workbook's loose oil split and its Kind column |
| `031_remove_a_customer.sql` | Removing a customer: delete if never traded, retire if not, never while owing |
| `032_ledger_in_whole_rupees.sql` | The removal guard rounds to the rupee, matching the ledger |

All reporting is done as Postgres aggregate RPCs rather than in the browser, so
the numbers are fast and cannot be altered client-side.

---

## Things worth knowing

- **Nozzle wiring.** Unit 1 runs both nozzles on diesel; units 2 and 3 run both
  on petrol. Migration 004 originally guessed one of each per unit and 013
  corrects it. Change it under **Settings → Edit nozzle wiring**, which also
  holds each nozzle's starting meter reading — no migration needed. The tank
  decides which stock a sale draws down, so a wrong one silently empties the
  wrong tank.
- **Starting meter readings matter on day one.** A pump that has been trading
  has meters reading hundreds of thousands of litres when it goes onto this
  app. Set them before entering the first day, or that day books the meter's
  whole lifetime as one day of sales.
- **A delivery is entered by its invoice total, not its rate per litre.** The
  note states litres and an amount payable; the amount is what leaves the bank
  and what profit is computed from, so it is stored as typed and the rate is
  generated from it. The rate is held to 4 decimals and shown to 2, so a row can
  read 20,000 L at Rs 240.00 totalling Rs 4,800,010 and not multiply out - the
  total is the record, the rate is derived.
- **A fuel rate can be removed** under Settings. One rate per fuel per date is
  enforced by a unique constraint, so a mistyped rate cannot be corrected by
  saving over the top. Removing it does not touch readings already saved: those
  keep the rate they were sold at and have to be cleared and re-entered.
- **Shifts.** Readings are recorded once per nozzle per day. The `shift` column
  already accepts `day` and `night`, so splitting the day later is a UI change,
  not a data migration.
- **The business day is pinned to `Asia/Karachi`**, in `app/_lib/date-helpers.js`.
  It is deliberately *not* taken from the machine's clock: the browser sits in
  Pakistan but a Vercel server runs in UTC, so between midnight and 5am the two
  would disagree and entries would be filed against the previous day. Change the
  one `PUMP_TIMEZONE` line if the pump ever moves.
- **Number grouping** is `140,000` style. For the lakh style (`1,40,000`), change
  `'en-US'` to `'en-IN'` in the two formatters in `app/_lib/helpers.js`.
- **The customer ledger is in whole rupees**, because Pakistan has no coin below
  one. A credit slip is litres × rate, which produced debts like Rs 3,734.28 —
  the customer paid the Rs 3,734 he was asked for and 28 paisa stayed on his
  account for ever, since no payment can clear it. `roundRupees` is now applied
  to every ledger write (credit slips, payments, adjustments, lubricant sales).
  The **meter arithmetic keeps its paisa**: `sale_amount` is litres × rate and
  rounding it would put a day's takings out of step with the litres behind
  them. Where a whole-rupee credit comes out of a fractional sale, the
  difference lands on the cash side — which is right, cash being the residual
  and counted in notes.
- **Lubricant stock is always in litres**, whether it leaves as a sealed 4 litre
  carton or as 30 rupees' worth poured out of a drum. A purchase is entered in
  litres too: twelve 4 litre cartons is 48, and the form does that
  multiplication in front of you rather than letting 12 be typed.
- **There are two kinds of lubricant, and the product says which.** A product
  carries a `sold_loose` flag, and it decides which number the sale form asks
  for:
  - **Sealed packs** — type the litres; the amount is prefilled from the rate.
    The pack size is a one-tap shortcut into the litres box.
  - **Loose oil** — a drum, bought from a supplier the way fuel is, with no
    brand on it. Type the **rupees**; the litres are worked out from the drum's
    rate and are never accepted from the browser. Recorded on its own page,
    `/admin/lubricants/loose`, because a long run of Rs 20 and Rs 50 pours
    reads nothing like a handful of carton sales and each buried the other.

  Everything downstream treats a drum as an ordinary lubricant — the same stock
  triggers, the same customer ledger, the same monthly report line — so the flag
  changes the *entry*, not the accounting.
- **Loose oil litres carry three decimals.** Rs 20 out of a drum priced at
  Rs 580 a litre is 0.0345 L, which at two decimals is 0.03 — a tenth of every
  pour lost, always in the same direction, on the kind of sale that happens
  dozens of times a day. The drum's book level is therefore only as good as its
  rate: if the level here drifts from the level in the shed, the rate is the
  first thing to check.
- **Removing a lubricant means one of two things, and the database picks.** A
  product never bought or sold is deleted outright — it was a typo. One with
  history is *retired*: it stops appearing on the sale form, its past sales and
  purchases keep counting in every month they belong to, and its name is
  released so a replacement brand can reuse it. Retired products stay listed
  under **Manage lubricants** with a **Bring back** button.
- **Monthly profit** counts stock *bought* in the month — fuel and lubricants
  alike — not stock sold from the tank or the shelf. A big delivery near month
  end makes profit look low — that money is sitting in stock, which is what the
  closing stock figures show.
- **Banking keeps only the last 60 transactions per account.** Older ones are
  deleted automatically as new ones arrive. The *balances are never wrong* —
  each removed amount is folded into `pruned_deposits` / `pruned_payments` on the
  account before the row goes, so the balance and the lifetime totals stay exact.
  What the cap costs is the itemised detail. **Download the monthly report and
  that detail is kept forever**; skip a month and those individual rows really
  are gone. The workbook's `Bank` sheet is written from the rows while they still
  exist, which is why the export is the backup rather than a convenience.
- **No account may go below zero.** A payment larger than the account it is paid
  from is refused by a trigger — per account, not across the total.
- **A payment too big for one account can be split across others.** The owner
  ticks which accounts cover the rest; they are drawn on in the order he ticks
  them, chosen account first, each down to what it holds. That is one payment
  written as several rows, so it goes through `record_bank_payment()` rather
  than a loop in the app: several inserts that are really one payment must land
  together or not at all, and only the database can promise that. **The split is
  computed in the RPC from real balances, never from what the browser posted** —
  the form works out the same allocation while you type, but only to show you.
- Deletes are deliberately *not* checked: deleting a transaction is how a
  mistake gets corrected, and blocking a correction because the books are
  already wrong would trap you. So a correction can still leave an account
  negative — that shows in red on its card with a note saying how to fix it, and
  payments out of it are refused until it is back to zero.
- **Bank movements are not profit.** Paying cash into the bank is not income and
  transferring it out is not a cost — the sale and the expense were already
  counted when they happened. That is why the Summary sheet keeps them in their
  own `BANK` block instead of under `COSTS`, where they would count twice.
- **Adding a sheet to the Excel template**: the app addresses sheets by file name
  (`sheet1.xml`, `sheet2.xml`, …), and openpyxl numbers them in creation order.
  Always `create_sheet` a new one **last** in `scripts/build-report-template.py`,
  or every sheet after the insertion point is silently renumbered and the app
  starts rewriting the wrong ones.
