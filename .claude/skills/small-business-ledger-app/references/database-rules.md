# Putting money rules in the database

## Why here and not in the action handler

Application code is one of several doors into the table. A direct query, a
second client, a background job, or next year's refactor can all miss a check
written in JavaScript. A trigger cannot be missed. In an app holding one
business's accounts, "the UI stops that" is not a guarantee; "the database
refuses it" is.

State this in the project's own docs too, so a future session does not
re-implement the rule in the UI and assume that is enough. A useful line to
keep: *if the app and the database ever disagree, the database is right.*

## What to enforce

Enforce the arithmetic that must hold for the books to mean anything:

- the split adds up — cash + credit equals the amount sold
- a counter cannot run backwards — closing is never below opening
- a ledger is append-only — corrections are new offsetting entries, never edits
- a container cannot exceed its capacity, an account cannot go below zero
- two records cannot describe the same span of a continuous meter

That last one is the family most often forgotten, and the most expensive. A
meter, an odometer, a sequence of invoice numbers — anything monotonic —
supports the question *do these two rows overlap?*, and an overlap silently
doubles a figure that nobody re-derives.

## Block the impossible, warn about the merely odd

An overlap is arithmetically impossible: a later record starting before an
earlier one finished means the same units are on the books twice. Refuse it.

A *gap* is possible and sometimes true — a skipped day, a replaced meter, a
device reset. Blocking it leaves the owner with a business whose books they
cannot make correct. Warn, explain the consequence, allow.

The test is not "is this suspicious" but "could this ever be honest".

## The edge where one legal value is a lie

After adding an overlap rule, check what values remain legal. If the next
record opens exactly where this one starts, the only closing value the overlap
rule still accepts is the opening itself — a zero-quantity row. That records
"nothing sold" for a period that traded, and nothing flags it afterwards.

Express the rule in terms of the room available rather than the collision:

```
room = next record's opening − this record's opening

room > 0    a genuine gap; this record may be entered, up to that figure
room <= 0   the next record already covers this one; nothing to record
```

This also keeps the honest repair working. Back-filling a genuinely missing
period looks almost identical to back-filling under a record that already
swallowed it — the difference is whether room was left. A blanket "no
back-filling" rule blocks the repair, which is worse than the bug.

## Write the exception as an instruction

The message reaches a non-technical owner more or less verbatim — most of these
apps map a few known constraint names to friendly text and pass everything else
straight through. So the exception text *is* the UI. Name the other record,
quote both figures, give the quantity at stake, and say what to do:

```sql
raise exception
  'This day would overlap the reading already saved for %. That one starts at %, '
  'before this day closes at %, so the same % litres would be counted on both days. '
  'Clear % on Readings first, then enter this day again.',
  to_char(v_next.reading_date, 'DD Mon YYYY'),
  trim(to_char(v_next.opening_reading, 'FM9999999990.00')),
  trim(to_char(new.closing_reading,    'FM9999999990.00')),
  trim(to_char(new.closing_reading - v_next.opening_reading, 'FM9999999990.00')),
  to_char(v_next.reading_date, 'DD Mon YYYY')
  using errcode = '23514';
```

`FM9999999990.00` gives a fixed two decimals with no padding — meter figures
should not lose a trailing zero in a message where the reader is comparing two
numbers.

## Testing a trigger without writing a row

Wrap the attempt so the transaction cannot commit. The inner block captures
what the rule said; the outer `raise` aborts everything:

```sql
do $$
declare v_msg text;
begin
  begin
    insert into ... ;              -- or update
    v_msg := 'ALLOWED (should not be)';
  exception when others then
    v_msg := SQLERRM;
  end;
  raise exception 'RESULT >> %', v_msg;
end $$;
```

The call "fails" and the failure message contains your result. Nothing is
written. Verify with a count afterwards and say so in your summary.

**Set up the scenario inside the same block** when the live data does not
happen to contain it — insert the later record, then attempt the back-fill
underneath it, then raise. Both disappear on rollback, and the test no longer
depends on the state of someone's real books, which can change under you while
you work.

**Watch for other constraints firing first.** If an unrelated check rejects
your test row, you learn nothing about the rule you are testing. Make the
fixture row internally consistent — a zero-quantity row also needs zero cash —
or the earlier constraint masks the answer.

**Generated columns cannot be inserted.** If `sale_amount` or `litres_sold` is
`generated always as`, omit it and let Postgres compute it.

## Dry-run before applying

Ask which existing rows the rule would reject:

```sql
with pairs as (
  select id, closing_reading,
         lead(opening_reading) over w as next_opening
    from readings
  window w as (partition by nozzle_id order by reading_date)
)
select * from pairs where next_opening < closing_reading;
```

Six rows, all part of the problem being fixed → apply. Hundreds going back a
year → the rule is wrong, or needs to apply only from a date forward. Either
way you want to know before the owner is locked out of editing their history.

Triggers fire on insert and update, not delete — so an existing violation stays
readable and, importantly, *clearable*. Check that the repair path is still
open: if the only way to fix a bad row is an edit the new rule refuses, you
have built a trap.

## Keep the repo and the database in step

Applying a migration to the live project and forgetting to commit the file
leaves the schema ahead of the repo, and the next person reads a `README`
migration table that stops two releases back. Commit the `.sql`, add the row to
whatever table the project keeps, and add the rule to the human-readable "what
the database will not let you do" list — that list is what someone reads
*before* hitting the refusal.

## Profit subtracts what was SOLD, never what was bought

The single most damaging arithmetic bug this project has had, and it shipped
looking reasonable for months.

```
-- wrong, and it reads fine
profit = sales - purchases - expenses

-- right
profit = sales - cost of goods sold - expenses
cost of goods sold = opening stock + purchases - closing stock
```

The wrong one charges a period for every unit that *arrived* in it. A pump that
took two 5,000 L loads six days before month end showed a **loss of
Rs 1,464,581 in a month that made Rs 566,307** — the fuel was in the ground,
paid for, and would sell next month.

**It does not come right at month end**, which is the argument for fixing it
rather than explaining it. The two agree only when units bought equal units sold
at the same rate, which is no real period. A period closing with stock on hand
is understated; one that runs stock down is *overstated*. They cancel over
years and never within the period anyone actually reads.

**Warning signs in any ledger app**: a profit figure computed from a purchases
table; a report whose explanatory note apologises for the number ("a big
delivery near month end makes it look low" — that note is a bug report); a
"stock bought" figure and a "profit" figure that move in lockstep.

### Valuing stock on hand

Something has to put a price on a unit sitting in a tank or on a shelf. Value it
at **the weighted average cost of the deliveries it is actually made of** —
walk purchases newest-first until the quantity on hand is accounted for.

**Do not use a flat average over every purchase ever.** In a rising market it
values current stock below what it cost, which reintroduces a smaller version
of the same understatement, permanently. Weighting by what is physically left
has no such drift, and for a tank it is also just true: what is in there is the
last few loads.

Quantities older than any recorded delivery — an opening balance typed in when
the business joined the app — have no cost on record. Value them at the
all-time average, **document that it is an estimate**, and note that it only
affects the first period with purchases.

### Keep the arithmetic in one function

Put cost-of-goods-sold in a single database function and have every report call
it. This project had three RPCs with the same expression copy-pasted — a monthly
report, an Excel export and an arbitrary date range — and a fix applied to two
of three is a business where two screens disagree about whether the month was
profitable. Verify they return identical figures for identical days.

### Fixing an expression inside several large functions

When the same wrong expression sits in several functions of a few thousand
characters each, and nothing else in them changes, reproducing all of them by
hand is several chances to silently drop a line from a report nobody re-reads.
Read each back with `pg_get_functiondef`, swap the known expression, re-declare
it — and **raise if the expected text is not found**, so a migration that cannot
do its job fails instead of reporting success over a still-wrong number.

### Anything derived from the fix has to move with it

A per-period breakdown computed in the application from the *old* formula
becomes actively worse once the headline is fixed: the total says one thing and
the chart under it says another. This project's daily profit sparkline
subtracted stock bought per day; it now apportions the cost of goods sold
across days **by units sold**, which is exact at the total and an apportionment
within it. Grep for every place the old formula was re-implemented before
calling the fix done.


## Append-only means "no line may be EDITED", not "no line may ever leave"

An audit trail or a ledger grows by a line per change, and after a year most of
it is dead weight. The instinct is to refuse every delete for ever, and it is
half right. Two different guarantees hide inside "append-only", and only one of
them is what makes the trail worth anything:

- **No line may ever be changed.** Keep this absolutely, for everyone, always.
- **No single line may be picked out and removed** while its neighbours stay.
  This is the one that matters: remove the one entry about the payment somebody
  backdated on Tuesday, leave Monday and Wednesday, and the record now lies by
  looking complete.

Neither of those is violated by dropping a **whole period** off the old end. So
if the owner needs the log trimmed, give them exactly that shape and nothing
finer:

- offer only whole retention periods — keep the last month, three, six, a year
- compute the cutoff **in the database**, from the business day, so a caller
  cannot name an arbitrary instant
- never let the most recent period go, whatever is asked for
- say how many entries each period would remove before it is chosen; "older
  than six months" is a tidy-up at 4 lines and a decision at 4,000
- **write the trim into the log it just trimmed** — who did it, how many went
- do not disable the guard to do it. Teach it ONE named, transaction-local
  exception, and have it still refuse any row that is not older than the cutoff
  the exception names. A stray delete from anywhere else meets the same refusal
  it always did.

## The books must be able to leave the database, and come back

A single hosted project — especially on a free tier with no restorable
backup — is one account closure away from being the end of the business's
records. Give the owner a button that writes the whole thing to a file they
keep, and a tested way to load it into an empty database.

**This is the HOSTED case.** An app that ships its own local database has
better tools and should use them: a copy of the data directory, or a dump on a
timer, both of which capture the logins that an application-level export usually
cannot. Do not build the JSON round trip twice — decide which case you are in.

The export is the easy half. The restore is where the work is, because a schema
that enforces its own rules will fight a reload:

- a line that **auto-posts another line** (a credit slip posting its own ledger
  entry) will double every balance if both are reloaded through the normal path
- running totals recalculated per row will be computed from a half-loaded table
- rules that are true of the finished data — a balanced day, no overlapping
  readings, a balance that never goes negative — are not necessarily true half
  way through loading it in table order

So the loading belongs **in the database, in one transaction, with user triggers
off**, parents before children, derived figures recomputed at the end. Then:

- **refuse a target that already holds data.** Merging two sets of books is not
  something to attempt; "restore over the top" is how a stale file destroys a
  good database
- **know what your migrations seed.** A freshly migrated database is usually not
  empty — seeded reference rows and opening balances are not "data" for this
  purpose, and must be replaced rather than treated as a blocker
- **preserve identity/sequence columns** if anything orders by them, and move
  the sequence past what was loaded
- **check afterwards, out loud**: row counts and money totals recomputed from
  the live database and compared against the file, non-zero exit on any
  disagreement
- **rehearse it once, for real.** A backup nobody has ever restored is a guess.
