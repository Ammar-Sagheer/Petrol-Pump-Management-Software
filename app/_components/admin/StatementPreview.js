'use client';

import { formatPKR, formatLitres } from '@/app/_lib/format-helpers';
import { formatDate } from '@/app/_lib/date-helpers';
import FuelBadge from '@/app/_components/ui/FuelBadge';
import EmptyState from '@/app/_components/ui/EmptyState';

/**
 * The statement, on screen, exactly as it will print.
 *
 * WHY IT EXISTS. The first version of this feature was a button that produced a
 * file, and the only way to find out what was on the file was to open it. That
 * is a poor loop for a document you are about to hand to someone and ask them
 * for money - and it is how a wrong statement got as far as being printed: the
 * lines said Rs 12,000 and the total said Rs 10,100, and nothing on screen was
 * ever going to show that, because the screen was not showing the statement.
 *
 * So the figures are checked here first, on the page where the reader already
 * trusts what he is looking at, and the PDF is the thing you reach for once they
 * are right.
 *
 * IT SHARES THE ARITHMETIC RATHER THAN REPEATING IT. `statementFromParts` in
 * customer-statement.js produces what this renders and what the PDF renders,
 * from one allocation done on the server. A preview that computes its own
 * figures is worse than none: it agrees with the file right up until the day it
 * quietly stops.
 *
 * Deliberately NOT a picture of the A4 page. A preview that mimics the paper is
 * unreadable on a phone and invites the reader to check the layout instead of
 * the numbers. This is the same information in this app's own idiom - the table
 * classes the ledger below it already uses - so it can be read at a glance on a
 * tablet.
 */
export default function StatementPreview({ statement, customerName }) {
  const {
    items,
    payments,
    aging,
    totalDue,
    broughtForward,
    broughtForwardCount,
    oldestBroughtForward,
    unapplied,
    discrepancy,
    settled,
    cutoff,
    asOf,
    oldestOpenAge,
  } = statement;

  const paymentTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);

  if (settled) {
    return (
      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <p className="text-lg font-bold text-brand-800">All dues cleared</p>
        <p className="mt-1 text-sm text-ink-700">
          Nothing is outstanding on this account as at {formatDate(asOf)}.
          {unapplied >= 0.5
            ? ` ${formatPKR(unapplied)} is held in credit against the next fill.`
            : ''}
        </p>
        <p className="mt-2 text-sm text-ink-600">
          The statement will say so — useful as a receipt that nothing is owed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ---- the answer, before the working ---- */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 rounded-lg bg-red-50 px-4 py-3">
        <div>
          <p className="figure-label text-red-800">Total now due</p>
          <p className="tabular text-3xl font-bold text-red-800">{formatPKR(totalDue)}</p>
        </div>
        <p className="text-sm text-ink-600">
          {oldestOpenAge > 0
            ? `Oldest unpaid fill is ${oldestOpenAge} days old`
            : 'Taken today'}
        </p>
      </div>

      {/* ---- ageing ---- */}
      <div>
        <p className="figure-label mb-2">How old the dues are</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {aging.map((band) => {
            const empty = band.amount < 0.5;
            // Only the last band is a problem, and only with something in it.
            const alarming = band.key === 'over' && !empty;
            return (
              <div
                key={band.key}
                className={`rounded-lg px-3 py-2 ${alarming ? 'bg-red-50' : 'bg-ink-50'}`}
              >
                <p className={`text-xs ${empty ? 'text-ink-400' : 'text-ink-600'}`}>
                  {band.label}
                </p>
                <p
                  className={`tabular text-base font-bold ${
                    empty ? 'text-ink-400' : alarming ? 'text-red-800' : 'text-ink-900'
                  }`}
                >
                  {formatPKR(band.amount)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- the fills ---- */}
      <div>
        <p className="figure-label mb-2">
          {cutoff ? 'Unpaid fills in this period' : 'Fills still unpaid'}
        </p>

        {items.length === 0 && broughtForward < 0.5 ? (
          <EmptyState
            title="Nothing to list"
            description="Nothing on this account is unpaid in the period chosen."
          />
        ) : (
          <div className="card table-scroll">
            <table className="w-full min-w-[34rem]">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Detail</th>
                  <th className="th text-right">Amount</th>
                  <th className="th text-right">Paid off</th>
                  <th className="th text-right">Still due</th>
                  <th className="th text-right">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {/* THE SUMMARY ROWS SPAN THE FIRST FOUR COLUMNS. Given a cell
                    of their own, "Total now due" and "Brought forward" wrap
                    onto three lines in the Detail column on a phone, which is
                    where this is most likely to be read. There is nothing in
                    Amount or Paid off on these rows to make room for. */}
                {broughtForward >= 0.5 ? (
                  <tr className="bg-ink-50">
                    <td className="td" colSpan={4}>
                      <span className="font-bold">Brought forward</span>
                      <span className="mt-0.5 block text-sm text-ink-600">
                        {broughtForwardCount} earlier{' '}
                        {broughtForwardCount === 1 ? 'fill' : 'fills'} still unpaid, from{' '}
                        {formatDate(oldestBroughtForward)}
                      </span>
                    </td>
                    <td className="td-num font-bold">{formatPKR(broughtForward)}</td>
                    <td className="td-num">—</td>
                  </tr>
                ) : null}

                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="td whitespace-nowrap">{formatDate(item.date)}</td>
                    <td className="td">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{item.detail}</span>
                        {item.fuelType ? <FuelBadge fuelType={item.fuelType} /> : null}
                      </div>
                      {item.litres ? (
                        <span className="tabular mt-0.5 block text-sm text-ink-600">
                          {formatLitres(item.litres)}
                        </span>
                      ) : null}
                    </td>
                    <td className="td-num">{formatPKR(item.original)}</td>
                    {/* The minus sign as well as the colour - this gets printed
                        and photocopied, and read on a tablet in poor light. */}
                    <td className="td-num text-brand-700">
                      {item.paid >= 0.5 ? `− ${formatPKR(item.paid)}` : '—'}
                    </td>
                    <td className="td-num font-bold">{formatPKR(item.due)}</td>
                    <td className="td-num text-ink-600">{item.ageDays}</td>
                  </tr>
                ))}

                {/* Zero on every statement this can produce - it is here because
                    it was once not zero and nothing said so. */}
                {discrepancy ? (
                  <tr>
                    <td className="td text-ink-600" colSpan={4}>
                      Other movements on the account
                    </td>
                    <td className="td-num font-bold">{formatPKR(discrepancy)}</td>
                    <td className="td-num">—</td>
                  </tr>
                ) : null}

                <tr className="bg-red-50">
                  <td className="td whitespace-nowrap font-bold text-red-800" colSpan={4}>
                    Total now due
                  </td>
                  <td className="td-num text-base font-bold text-red-800">
                    {formatPKR(totalDue)}
                  </td>
                  <td className="td-num">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- payments, so a part-payment is visibly credited ---- */}
      {payments.length > 0 ? (
        <div>
          <p className="figure-label mb-2">
            {cutoff ? 'Payments received in this period' : 'Payments received'}
          </p>
          <div className="card divide-y divide-ink-100">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2"
              >
                <span className="text-sm text-ink-600">{formatDate(payment.date)}</span>
                <span className="min-w-0 flex-1 text-sm">{payment.detail}</span>
                <span className="tabular text-sm font-bold text-brand-700">
                  {formatPKR(payment.amount)}
                </span>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 bg-ink-50 px-4 py-2">
              <span className="text-sm font-bold">Total received</span>
              <span className="tabular text-sm font-bold text-brand-700">
                {formatPKR(paymentTotal)}
              </span>
            </div>
          </div>
          <p className="mt-1.5 text-sm text-ink-600">
            These have already been taken off the fills above.
          </p>
        </div>
      ) : null}

      <p className="text-sm text-ink-600">
        Payments are applied to the oldest fill first, so a fill drops off this list once it has
        been covered. {customerName} is asked for {formatPKR(totalDue)}.
      </p>
    </div>
  );
}
