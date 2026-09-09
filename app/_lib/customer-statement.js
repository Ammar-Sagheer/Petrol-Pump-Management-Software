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
 * The ledger has TWO ways of cancelling a row, and both have to be paired off.
 *
 * A pair nets to zero by construction - same amount, opposite direction - so
 * removing both leaves the balance exactly where it was and leaves the
 * allocation looking at real money only. The REPLACEMENT half of a correction is
 * an ordinary entry and stays: it is what the row should have said.
 *
 * 1. A HAND CORRECTION (063) carries `corrects_entry_id`, naming the row it
 *    cancels. Structural, unambiguous, and what this function was written for.
 *
 * 2. A DELETED SALE (014, 015, 024) posts a plain credit with NO
 *    `corrects_entry_id` at all. Deleting a reading, clearing a day, or deleting
 *    a lubricant sale each insert a credit for the slip's amount, on the slip's
 *    own date, with a note beginning "Reversal - ". The original debit stays on
 *    the ledger by design - the README's *"deleting a reading reverses its credit
 *    slips, it does not erase them"*.
 *
 * The second kind is why "Total received" on a real customer's statement read Rs
 * 35,501 when he had actually paid Rs 30,500: a deleted 10 Aug nozzle entry had
 * put a Rs 5,001 credit on the ledger, and the statement listed it under PAYMENTS
 * RECEIVED as though the man had handed over the money. On a page you give to
 * the person you are asking to pay, that is not a rounding error - it is a
 * receipt for money he never paid.
 *
 * MATCHED ON DATE AND AMOUNT, because that is all there is: the reversal is
 * written with `cs.amount` and the slip's own date, and the credit_sale row it
 * came from is deleted in the same statement, so no id survives to join on. The
 * note prefix is the discriminator and it is generated by Postgres, never typed.
 * A reversal that finds no partner is LEFT ALONE and treated as an ordinary
 * credit - the balance still comes out right, and guessing is worse than
 * listing it.
 */
const REVERSAL_NOTE = /^Reversal - /;

function withoutCancelledPairs(entries) {
  const cancelled = new Set();

  // 1. Hand corrections, by the column that exists for exactly this.
  for (const entry of entries) {
    if (entry.corrects_entry_id) {
      cancelled.add(entry.id);
      cancelled.add(entry.corrects_entry_id);
    }
  }

  // 2. Deleted sales, by date and amount, oldest first so two reversals of the
  //    same amount on the same day take one debit each rather than both taking
  //    the first.
  const ordered = oldestFirst(entries);
  const debits = ordered.filter(
    (entry) => entry.entry_type === 'debit' && !cancelled.has(entry.id),
  );

  for (const entry of ordered) {
    if (entry.entry_type !== 'credit') continue;
    if (cancelled.has(entry.id)) continue;
    if (!REVERSAL_NOTE.test(entry.note ?? '')) continue;

    const partner = debits.find(
      (debit) =>
        !cancelled.has(debit.id) &&
        debit.entry_date === entry.entry_date &&
        Math.abs(Number(debit.amount) - Number(entry.amount)) < 0.005,
    );

    if (partner) {
      cancelled.add(entry.id);
      cancelled.add(partner.id);
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
 * MONEY PAID AHEAD OF THE FILLS STAYS ON THE ACCOUNT. When a payment is larger
 * than everything open at the moment it lands, the remainder becomes a standing
 * credit and the NEXT fill is charged against it before anything is asked for.
 * That is what a credit balance is; it is not the customer's problem that his
 * money arrived on Tuesday and his diesel on Thursday.
 *
 * THIS IS THE BUG THIS FUNCTION SHIPPED WITH, and it is worth keeping the story.
 * The remainder used to be added to an `unapplied` total and then never spent -
 * dropped on the floor while every later fill was billed as though the money had
 * never come in. A real customer settled Rs 16,000 on 1 Sep against Rs 14,100 of
 * open fills; the Rs 1,900 over vanished, and his statement listed Rs 12,000 of
 * unpaid fills under a total that said Rs 10,100. Every figure on the page was
 * individually defensible and the page as a whole was worthless, because the one
 * thing a statement has to do is add up. `reconcile()` below now asserts exactly
 * that, so this cannot come back silently.
 *
 * `unapplied` is still returned, and now means what it says: credit left over at
 * the END of the whole history, after every fill has taken what it could - a
 * customer who is genuinely in hand. It can only be non-zero when nothing is
 * owed.
 */
export function allocatePayments(entries) {
  const rows = oldestFirst(withoutCancelledPairs(entries));

  const open = [];
  let credit = 0;

  for (const entry of rows) {
    const amount = Number(entry.amount ?? 0);

    if (entry.entry_type === 'debit') {
      const item = {
        id: entry.id,
        date: entry.entry_date,
        detail: describe(entry),
        fuelType: entry.fuel_type ?? null,
        litres: entry.litres === null || entry.litres === undefined ? null : Number(entry.litres),
        original: amount,
        paid: 0,
        due: amount,
        auto: Boolean(entry.credit_sale_id || entry.lubricant_sale_id),
      };

      // Spend any standing credit on this fill the moment it arrives.
      if (credit > 0) {
        const taken = Math.min(item.due, credit);
        item.due -= taken;
        item.paid += taken;
        credit -= taken;
      }

      open.push(item);
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

    // Anything over stands on the account and waits for the next fill.
    if (left > 0) credit += left;
  }

  const unapplied = credit;

  /*
   * A hair of float dust would otherwise print as a fully-settled fill still
   * showing "Rs 0 still due" on its own line. Fills carry paisa (litres times a
   * rate), payments are whole rupees, so a remainder under half a rupee is
   * arithmetic left over rather than a debt - the same reasoning that removed
   * formatPKRExact from helpers.js. Nobody in Pakistan can pay it.
   */
  return { openItems: open.filter((item) => item.due >= 0.5), unapplied };
}

/**
 * Every real payment on the account, oldest first.
 *
 * "Real" is doing work: `withoutCancelledPairs` has already taken out both the
 * hand corrections and the deleted-sale reversals, so what is left is money the
 * customer actually handed over. Listing a reversal here told one customer he
 * had paid Rs 5,001 that he had not.
 */
export function listPayments(entries) {
  return oldestFirst(withoutCancelledPairs(entries))
    .filter((entry) => entry.entry_type === 'credit')
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
export function buildStatement(entries, options = {}) {
  const { openItems, unapplied } = allocatePayments(entries);
  return statementFromParts({ openItems, unapplied, payments: listPayments(entries) }, options);
}

/**
 * The windowing half of buildStatement, over an allocation already done.
 *
 * SPLIT OUT SO THE SCREEN AND THE PDF CANNOT DRIFT. The customer page previews
 * the statement before printing it, and the reader changes the day range in a
 * dialog - which must not mean a server round trip per click, and must REALLY not
 * mean a second implementation of the windowing in the client component. So the
 * allocation, which needs the whole ledger, is done once on the server; this,
 * which is pure and cheap, runs again in the browser on every range change and
 * once more inside the download route. One code path, three callers.
 *
 * Everything here is serialisable, which is what lets the allocation cross the
 * server/client boundary as a prop.
 */
export function statementFromParts(
  { openItems, unapplied = 0, payments = [] },
  { asOf, balance, days = null } = {},
) {
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

  /*
   * THE ONE THING A STATEMENT HAS TO DO IS ADD UP, so it is checked rather than
   * assumed. `totalDue` comes from Postgres and the lines come from the walk
   * above; they are the same rows summed two different ways and must agree.
   *
   * They did not, once - see allocatePayments - and nothing on the page said so.
   * A discrepancy is now carried out to the renderer, which prints it as its own
   * line rather than letting a column of figures quietly fail to reach its own
   * total. Naming it is not as good as not having one, but it is the difference
   * between a document that is wrong and a document that is lying.
   *
   * `unapplied` is part of the sum, not an exception to it. A customer who has
   * paid ahead has no open fills and a NEGATIVE balance; the standing credit is
   * what bridges the two, and leaving it out flagged every account in hand as a
   * discrepancy.
   */
  const listedTotal =
    listed.reduce((sum, item) => sum + item.due, 0) + broughtForward - unapplied;
  const discrepancy = Math.abs(listedTotal - totalDue) < 0.5 ? 0 : totalDue - listedTotal;

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
    payments: cutoff ? payments.filter((payment) => payment.date >= cutoff) : payments,

    totalDue,

    /** Credit standing on the account after every fill has taken its share. */
    unapplied,

    /** Non-zero only if the lines fail to reach the total - see above. */
    discrepancy,

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
