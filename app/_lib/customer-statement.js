/**
 * What a customer still owes, broken back down into the fills behind it.
 *
 * THE PROBLEM THIS SOLVES. The customer page shows one figure - "currently owes
 * Rs 67,138" - and the ledger under it shows every entry that ever was. Neither
 * is what you hand a haulier when you go to collect. He does not want his whole
 * history, and he will not accept a bare total; he wants the list of fills that
 * add up to what is being asked for, so he can check it against his own book.
 *
 * The trade here is credit for seven to fifteen days, sometimes a month, settled
 * mostly in one lump and sometimes in parts. So by the time anyone asks, the
 * ledger holds a run of fills, a payment or two that cleared the older ones, and
 * a tail that is still open. The statement has to show the tail and nothing
 * else.
 *
 * OPEN ITEM, NOT BALANCE FORWARD. Those are the two standard shapes for a
 * statement of account, and this is deliberately the first. A balance-forward
 * statement lists everything in a period with a carried-in figure at the top; an
 * open-item statement lists only what is unpaid or part-paid, each line still
 * showing what is left on it. Open item is the collecting document - it is what
 * you can put in front of someone and go through line by line - and it is what
 * the owner described wanting before either of us had a name for it.
 *
 * HOW A PAYMENT IS APPLIED, AND WHY IT IS A CHOICE RATHER THAN A FACT. Nothing
 * in `ledger_entries` says which payment settled which fill, and nothing ever
 * could: the customer hands over Rs 50,000 against a running account, not
 * against three named slips. So the allocation here is a convention - OLDEST
 * FIRST, the same one every running account in the world uses, and the same one
 * the balance itself implies. The PDF says so in as many words, because a figure
 * that is a convention must not be presented as a measurement.
 *
 * The total is the one thing that is NOT a convention: whatever the allocation
 * does, the open items sum to the balance, because they are the same rows summed
 * the same way. That is what makes this safe to hand over.
 *
 * CORRECTIONS ARE PAIRED OFF FIRST, and getting this wrong would be the bug that
 * matters. A correction is a reversal plus a replacement (migration 063): the
 * reversal is a credit carrying `corrects_entry_id`, pointing at the debit it
 * cancels. Run it through oldest-first allocation naively and that credit pays
 * off the oldest OPEN fill instead of the one it was written to cancel - so a
 * mistyped entry from August would silently settle a real fill from September,
 * and the statement would drop a fill the customer genuinely owes for. Both rows
 * of every pair are therefore removed before allocation starts. They cancel each
 * other exactly, so the balance is untouched.
 *
 * No imports: this is pure arithmetic over rows, called from a route handler and
 * exercised directly by a script. Formatting belongs to the caller.
 */

/**
 * Ageing bands, in days.
 *
 * The textbook bands are 30/60/90, which come from net-30 invoice terms and are
 * useless here - this pump's whole credit cycle finishes inside the first one.
 * These follow the trade instead: a week is normal, a fortnight is the usual
 * outside edge, a month is late, and past a month is the money worth chasing
 * today. The point of the band is to draw the eye to the bottom of the list, and
 * a band nothing ever falls into cannot do that.
 */
export const AGE_BANDS = [
  { key: 'week', label: 'Up to 7 days', from: 0, to: 7 },
  { key: 'fortnight', label: '8 to 15 days', from: 8, to: 15 },
  { key: 'month', label: '16 to 30 days', from: 16, to: 30 },
  { key: 'over', label: 'Over 30 days', from: 31, to: Infinity },
];

/** Plain calendar-date arithmetic, in UTC, so no timezone can nudge a day. */
function dayNumber(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** Whole days from `iso` up to `asOf`. Same day is 0, not 1 - this is an age. */
function ageInDays(iso, asOf) {
  return Math.max(0, dayNumber(asOf) - dayNumber(iso));
}

/**
 * Oldest first, and stable.
 *
 * `entry_date` is the business date and is what the customer recognises;
 * `created_at` breaks a tie within a day in the order the rows were actually
 * written, which is the order a correction has to follow its original in.
 */
function oldestFirst(entries) {
  return [...entries].sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? -1 : 1;
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
    return String(a.id) < String(b.id) ? -1 : 1;
  });
}

/**
 * Drop every cancelled entry along with the reversal that cancelled it.
 *
 * See the header note. A pair nets to zero by construction - same amount,
 * opposite direction - so removing both leaves the balance exactly where it was
 * and leaves the allocation looking at real money only.
 *
 * The REPLACEMENT is an ordinary entry and stays: it is what the row should have
 * said, and it is what the customer owes.
 */
function withoutCorrections(entries) {
  const cancelled = new Set();

  for (const entry of entries) {
    if (entry.corrects_entry_id) {
      cancelled.add(entry.id);
      cancelled.add(entry.corrects_entry_id);
    }
  }

  return entries.filter((entry) => !cancelled.has(entry.id));
}

/** What a debit row is called on the statement when nobody wrote a note. */
function describe(entry) {
  if (entry.note && entry.note.trim()) return entry.note.trim();
  return entry.entry_type === 'debit' ? 'Fuel on credit' : 'Payment';
}

/**
 * Apply payments to fills, oldest first, and hand back what is still open.
 *
 * Returns the open items in date order plus `unapplied` - money paid beyond
 * everything owed, which is a customer in credit. That is rare and it is real
 * (someone pays a round Rs 50,000 against Rs 48,300), so it is carried out
 * rather than swallowed: the statement owes him an explanation of it.
 */
export function allocatePayments(entries) {
  const rows = oldestFirst(withoutCorrections(entries));

  const open = [];
  let unapplied = 0;

  for (const entry of rows) {
    const amount = Number(entry.amount ?? 0);

    if (entry.entry_type === 'debit') {
      open.push({
        id: entry.id,
        date: entry.entry_date,
        detail: describe(entry),
        fuelType: entry.fuel_type ?? null,
        litres: entry.litres === null || entry.litres === undefined ? null : Number(entry.litres),
        original: amount,
        paid: 0,
        due: amount,
        auto: Boolean(entry.credit_sale_id || entry.lubricant_sale_id),
      });
      continue;
    }

    // A payment eats the oldest open fills until it runs out.
    let left = amount;
    for (const item of open) {
      if (left <= 0) break;
      if (item.due <= 0) continue;

      const taken = Math.min(item.due, left);
      item.due -= taken;
      item.paid += taken;
      left -= taken;
    }

    // Paid more than was owed at that moment - carried, not lost.
    if (left > 0) unapplied += left;
  }

  /*
   * A hair of float dust would otherwise print as a fully-settled fill still
   * showing "Rs 0 still due" on its own line. Fills carry paisa (litres times a
   * rate), payments are whole rupees, so a remainder under half a rupee is
   * arithmetic left over rather than a debt - the same reasoning that removed
   * formatPKRExact from helpers.js. Nobody in Pakistan can pay it.
   */
  return { openItems: open.filter((item) => item.due >= 0.5), unapplied };
}

/** Every payment the customer made on or after `from`, newest last. */
function paymentsSince(entries, from) {
  return oldestFirst(withoutCorrections(entries))
    .filter((entry) => entry.entry_type === 'credit' && (!from || entry.entry_date >= from))
    .map((entry) => ({
      id: entry.id,
      date: entry.entry_date,
      detail: describe(entry),
      amount: Number(entry.amount ?? 0),
    }));
}

/** Split a set of open items across the ageing bands. */
export function ageOpenItems(openItems, asOf) {
  const bands = AGE_BANDS.map((band) => ({ ...band, amount: 0, count: 0 }));

  for (const item of openItems) {
    const age = ageInDays(item.date, asOf);
    const band = bands.find((b) => age >= b.from && age <= b.to) ?? bands[bands.length - 1];
    band.amount += item.due;
    band.count += 1;
  }

  return bands;
}

/**
 * The whole statement, ready to render.
 *
 * `days` narrows what is LISTED, never what is owed. Ask for the last 30 days
 * and the fills inside that window are itemised while everything still open from
 * before it collapses into one "older dues brought forward" line - so the total
 * at the foot is still the balance, and the customer is not handed a page that
 * quietly asks for less than he owes. A statement whose lines do not add up to
 * its total is worse than no statement; it is an argument waiting to happen.
 *
 * `balance` is passed IN, from `customer_balance()` in Postgres, and is what the
 * total prints. The allocation above reaches the same figure from the same rows,
 * but the database owns money totals in this app and the screen the owner just
 * read the number off got it from there.
 */
export function buildStatement(entries, { asOf, balance, days = null } = {}) {
  const { openItems, unapplied } = allocatePayments(entries);

  const cutoff = days && days > 0 ? isoDaysBefore(asOf, days - 1) : null;

  const listed = [];
  let broughtForward = 0;
  let broughtForwardCount = 0;
  let oldestBroughtForward = null;

  for (const item of openItems) {
    if (cutoff && item.date < cutoff) {
      broughtForward += item.due;
      broughtForwardCount += 1;
      if (!oldestBroughtForward || item.date < oldestBroughtForward) {
        oldestBroughtForward = item.date;
      }
      continue;
    }
    listed.push({ ...item, ageDays: ageInDays(item.date, asOf) });
  }

  const totalDue = Number(balance ?? 0);

  return {
    asOf,
    cutoff,
    days: days ?? null,

    /** Itemised, oldest first - the order you read a khata in. */
    items: listed,

    /** Everything still open from before the window, as one line. */
    broughtForward,
    broughtForwardCount,
    oldestBroughtForward,

    /** Ageing across ALL open items, not just the listed ones. */
    aging: ageOpenItems(openItems, asOf),

    /** Payments inside the window, so a part-payment is visibly credited. */
    payments: paymentsSince(entries, cutoff),

    totalDue,
    unapplied,

    /** Nothing outstanding - the "all dues cleared" page. */
    settled: openItems.length === 0 && totalDue < 0.5,

    /** The oldest thing still unpaid, which is the sentence that gets results. */
    oldestOpenDate: openItems.length > 0 ? openItems[0].date : null,
    oldestOpenAge: openItems.length > 0 ? ageInDays(openItems[0].date, asOf) : 0,
  };
}

/** `days` back from an ISO date, in UTC, for the same reason as dayNumber. */
function isoDaysBefore(iso, days) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

/**
 * The day-range choices offered on the button.
 *
 * "Everything still owed" is the default and the one that matches how the owner
 * described collecting - the whole tail, however far back it runs. The rest are
 * the credit cycle he named: a week, a fortnight, a month, and a quarter for the
 * account that has drifted.
 */
export const STATEMENT_RANGES = [
  { days: 0, label: 'Everything still owed', hint: 'Every unpaid fill, however old' },
  { days: 7, label: 'Last 7 days', hint: 'Older dues shown as one carried-forward line' },
  { days: 15, label: 'Last 15 days', hint: 'Older dues shown as one carried-forward line' },
  { days: 30, label: 'Last 30 days', hint: 'Older dues shown as one carried-forward line' },
  { days: 90, label: 'Last 90 days', hint: 'Older dues shown as one carried-forward line' },
];

/** Longest range the route will accept, so a typed number cannot be nonsense. */
export const MAX_STATEMENT_DAYS = 3650;
