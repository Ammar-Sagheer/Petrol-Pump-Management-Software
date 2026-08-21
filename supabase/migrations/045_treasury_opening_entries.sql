-- =============================================================================
-- 045_treasury_opening_entries.sql
--
-- The owner's "Tajori" sheet, as it stood on 21 Aug 2026, moved into the app.
--
-- WHY THIS IS A MIGRATION AND NOT SOMETHING TYPED IN. Thirty-six movements
-- covering eight days, whose running balance has to come out at exactly
-- Rs 8,364 - the figure the owner will check the screen against on the first
-- evening he uses this page. Typed in by hand, one mistyped digit anywhere in
-- the chain moves that figure and nothing on screen says which line is wrong.
-- Written out here, it is checked once, by the assertion at the bottom.
--
-- The rows are the sheet's rows, in the sheet's order, with three edits, all
-- of them recorded here rather than made quietly:
--
--   1. A line carrying BOTH a cash-in and a cash-out becomes two entries.
--      The sheet has one - "Entry/Cash deposit in 7803", Rs 330,000 in and
--      Rs 515,000 out on 21 Aug - and the two halves of its Details text are
--      the two things that happened, so each half goes with its own movement.
--
--   2. Rows whose Details said nothing the category does not already say -
--      "Entry", "Cash of shift closing", "Already present" - have their
--      details left null. The label is on screen either way, and a details
--      line repeating it is a line the eye has to read and discard. Where the
--      text carried something extra it is kept verbatim, spelling, spacing and
--      all: "Entry(135000+35000)" is the owner's own working and it stays.
--
--   3. Dates written dd.mm.yy in the sheet become real dates. A date that only
--      appeared on the first row of a group belongs to every row under it, so
--      the blanks are filled forward - which is what the sheet means by them.
--
-- `seq` is written explicitly rather than left to the identity default, so the
-- order of the rows in this file IS the order of the sheet, provably, and not
-- whatever order the insert happened to evaluate in. The identity counter is
-- moved past them at the end so the next entry the owner records continues the
-- chain instead of colliding with it.
--
-- created_by is null on every row on purpose. Nobody typed these into the app;
-- they came off a spreadsheet, and naming the owner as the person who recorded
-- them would put thirty-six things in the activity log that he never did.
-- =============================================================================

insert into public.treasury_entries
  (seq, entry_date, direction, amount, category, details)
overriding system value
values
  (1, date '2026-08-14', 'in', 25550, 'opening', null),
  (2, date '2026-08-14', 'in', 128195, 'shift_closing', null),
  (3, date '2026-08-14', 'in', 150000, 'entry', null),
  (4, date '2026-08-14', 'in', 230000, 'entry', null),
  (5, date '2026-08-15', 'in', 299030, 'shift_closing', null),
  (6, date '2026-08-15', 'in', 130000, 'entry', null),
  (7, date '2026-08-15', 'in', 220000, 'entry', null),
  (8, date '2026-08-16', 'in', 168050, 'shift_closing', null),
  (9, date '2026-08-16', 'in', 210000, 'entry', null),
  (10, date '2026-08-16', 'in', 170000, 'entry', null),
  (11, date '2026-08-17', 'in', 120000, 'entry', null),
  (12, date '2026-08-17', 'in', 31085, 'shift_closing', null),
  (13, date '2026-08-17', 'out', 100000, 'given', 'Munir sb for Haider'),
  (14, date '2026-08-17', 'out', 1593990, 'supplier', 'PSO Zamzam PS 118014'),
  (15, date '2026-08-17', 'in', 200000, 'entry', null),
  (16, date '2026-08-17', 'out', 300000, 'given', 'Munir sb by Hamza saqib'),
  (17, date '2026-08-17', 'in', 135000, 'entry', null),
  (18, date '2026-08-18', 'in', 169615, 'shift_closing', null),
  (19, date '2026-08-18', 'out', 35040, 'given', 'Munir sb by Hamza saqib for sylage'),
  (20, date '2026-08-18', 'in', 170000, 'entry', 'Entry(135000+35000)'),
  (21, date '2026-08-18', 'out', 500000, 'bank_deposit', 'cash deposited in ac# 803'),
  (22, date '2026-08-18', 'out', 4400, 'given', 'Cash taken by sagheer'),
  (23, date '2026-08-18', 'in', 165000, 'entry', null),
  (24, date '2026-08-19', 'in', 188282, 'shift_closing', null),
  (25, date '2026-08-19', 'in', 80000, 'entry', null),
  (26, date '2026-08-19', 'in', 240000, 'entry', null),
  (27, date '2026-08-19', 'out', 500000, 'given', 'Cash taken by sagheer'),
  (28, date '2026-08-19', 'in', 140000, 'entry', null),
  (29, date '2026-08-20', 'in', 141410, 'shift_closing', null),
  (30, date '2026-08-20', 'in', 130000, 'entry', null),
  (31, date '2026-08-20', 'out', 600000, 'supplier', 'Zamzam code transfer 118014 from cash'),
  (32, date '2026-08-20', 'in', 410000, 'entry', null),
  (33, date '2026-08-20', 'out', 410000, 'given', 'Cash  given to new chaudhry fs'),
  (34, date '2026-08-21', 'in', 185577, 'shift_closing', null),
  (35, date '2026-08-21', 'in', 330000, 'entry', null),
  (36, date '2026-08-21', 'out', 515000, 'bank_deposit', 'Cash deposit in 7803')
;

-- Continue the chain from where the sheet left off.
--
-- Moved with setval rather than `alter table ... alter column seq restart`,
-- which is the obvious way to write it and does not work here: the balance
-- rule in 044 is a DEFERRED constraint trigger, so at this point in the
-- transaction the insert above still has thirty-six trigger events pending,
-- and Postgres refuses to ALTER a table that has any ("cannot ALTER TABLE
-- because it has pending trigger events"). setval touches the identity
-- sequence directly and is not an ALTER, so it is allowed.
select setval(pg_get_serial_sequence('public.treasury_entries', 'seq'), 36, true);

-- ---------------------------------------------------------------------------
-- Prove it.
--
-- Rs 8,364 is the last figure in the Balance column of the sheet. If the rows
-- above do not add up to it, something was mistyped and this migration must
-- not be the thing that puts a wrong opening balance into the owner's books -
-- so it fails loudly and rolls itself back rather than leaving the safe
-- quietly holding the wrong amount.
-- ---------------------------------------------------------------------------
do $$
declare
  v_balance numeric;
  v_count   integer;
begin
  select coalesce(sum(case when direction = 'in' then amount else -amount end), 0),
         count(*)
    into v_balance, v_count
    from public.treasury_entries;

  if v_count <> 36 or v_balance <> 8364 then
    raise exception
      'Treasury seed does not match the sheet: % entries totalling Rs %, expected 36 totalling Rs 8,364.',
      v_count, to_char(v_balance, 'FM999,999,999,990');
  end if;
end;
$$;
