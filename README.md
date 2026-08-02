# Pump Manager

Daily management for the petrol pump: nozzle readings, fuel purchases, stock
gain/loss, customer credit and monthly profit.

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

From then on every other login is created inside the app, under **Settings →
Staff logins**. Never add accounts by hand again.

### 4. Set the fuel prices

Readings cannot be entered until a rate exists for each fuel. Go to **Settings →
Fuel prices** and set petrol and diesel.

---

## The two roles

| | `super_admin` (owner) | `data_entry` (staff) |
|---|---|---|
| Enter daily readings | yes | yes |
| Record purchases and dips | yes | yes |
| Add customers, record payments | yes | yes |
| See sales totals, profit, reports | yes | **no** |
| Change prices, tanks, nozzles | yes | **no** |
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

Deliveries go under **Purchases**, and the dip stick reading under **Stock**.

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
- **The customer ledger is append-only.** No update, no delete, for anybody,
  including the owner and including the service-role key. A mistake is corrected
  by posting a new entry pointing the other way, so the history always adds up.
  This is enforced by a database trigger, not just by permissions.
- **A reading whose slips already reached a ledger cannot be deleted.** Cancel
  the debt with an offsetting entry instead.
- **Tank stock is recalculated from history**, never incremented, so the cached
  figure cannot drift away from the purchases, sales and dips that produced it.

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
    purchases/             fuel deliveries
    stock-checks/          dip readings and gain/loss
    customers/             list, new, and [id] detail with ledger
    reports/               30-day trend, monthly profit, expenses
    settings/              prices, tanks, nozzles, staff logins
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
  _styles/globals.css
proxy.js                   session refresh + signed-in gate
supabase/migrations/       the schema, in order
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

All reporting is done as Postgres aggregate RPCs rather than in the browser, so
the numbers are fast and cannot be altered client-side.

---

## Things worth knowing

- **Nozzle wiring.** Each of the 3 units is set up with nozzle A on petrol and
  nozzle B on diesel. If the real plumbing differs, change it under **Settings →
  Nozzles** — no migration needed. It decides which tank a sale draws down.
- **Shifts.** Readings are recorded once per nozzle per day. The `shift` column
  already accepts `day` and `night`, so splitting the day later is a UI change,
  not a data migration.
- **Number grouping** is `140,000` style. For the lakh style (`1,40,000`), change
  `'en-US'` to `'en-IN'` in the two formatters in `app/_lib/helpers.js`.
- **Monthly profit** counts fuel *bought* in the month, not fuel sold from stock.
  A big delivery near month end makes profit look low — that money is sitting in
  the tank, which is what the closing stock figure shows.
