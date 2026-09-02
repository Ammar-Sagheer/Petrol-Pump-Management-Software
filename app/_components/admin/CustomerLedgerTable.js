import { formatDate, formatPKR, formatLitres } from '@/app/_lib/helpers';
import EmptyState from '@/app/_components/ui/EmptyState';
import FuelBadge from '@/app/_components/ui/FuelBadge';
import CorrectEntryButton from '@/app/_components/admin/CorrectEntryButton';

/**
 * The full ledger, newest first, with a running balance.
 *
 * The running total is worked out oldest-first and then flipped for display, so
 * each row shows what was owed immediately after that entry - which is how a
 * paper khata reads.
 *
 * A CANCELLED ROW STAYS ON THE PAGE, STRUCK THROUGH. Nothing is ever deleted
 * here (the database refuses), so a corrected mistake leaves three rows: the
 * wrong one, the entry that cancelled it, and the replacement. Shown plainly
 * that is unreadable - three amounts, two of them meaningless, and no way to
 * tell which. So the cancelled row is struck and greyed and the cancelling row
 * is labelled, and the pair reads as one crossed-out line the way it would in a
 * register. The figures are still there to be checked; they have simply stopped
 * claiming to be live.
 *
 * BOTH ROWS KEEP THEIR PLACE IN THE RUNNING BALANCE. It would look tidier to
 * skip them, and it would be wrong: the balance column says what was owed after
 * each entry, and on the day between the mistake and its correction that really
 * was the figure. Striking the row says it is not the last word; removing it
 * from the arithmetic would make the column stop adding up.
 */
export default function CustomerLedgerTable({
  entries,
  correctedIds = [],
  customerId,
  balance = 0,
  canCorrect = false,
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="Nothing recorded yet"
        description="Credit slips appear here automatically once a reading with this customer is saved. Payments are recorded with the button above."
      />
    );
  }

  const cancelled = new Set(correctedIds);

  const oldestFirst = [...entries].sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? -1 : 1;
    return a.created_at < b.created_at ? -1 : 1;
  });

  let running = 0;
  const withBalance = oldestFirst.map((entry) => {
    running += entry.entry_type === 'debit' ? Number(entry.amount) : -Number(entry.amount);
    return { ...entry, balanceAfter: Math.round((running + Number.EPSILON) * 100) / 100 };
  });

  const newestFirst = withBalance.reverse();

  return (
    <div className="card table-scroll">
      <table className="w-full min-w-[40rem]">
        <thead className="border-b border-ink-200 bg-ink-50">
          <tr>
            <th className="th">Date</th>
            <th className="th">Detail</th>
            <th className="th text-right">Fuel taken</th>
            <th className="th text-right">Paid</th>
            <th className="th text-right">Balance</th>
            {canCorrect ? (
              <th className="th text-right">
                <span className="sr-only">Correct</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {newestFirst.map((entry) => {
            const isDebit = entry.entry_type === 'debit';
            const isCancelled = cancelled.has(entry.id);
            const isReversal = Boolean(entry.corrects_entry_id);
            // Posted by a reading or a lubricant sale, so the sale is where it
            // gets fixed - the database says the same thing if asked anyway.
            const isAuto = Boolean(entry.credit_sale_id || entry.lubricant_sale_id);
            const correctable = canCorrect && !isCancelled && !isReversal && !isAuto;

            return (
              <tr key={entry.id} className={isCancelled ? 'bg-ink-50/60 text-ink-500' : undefined}>
                <td className="td whitespace-nowrap">{formatDate(entry.entry_date)}</td>
                <td className="td">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={isCancelled ? 'line-through' : undefined}>
                      {entry.note ?? (isDebit ? 'Fuel on credit' : 'Payment')}
                    </span>
                    {entry.fuel_type ? <FuelBadge fuelType={entry.fuel_type} /> : null}
                    {/* Both auto sources wear the badge, not just readings.
                        A lubricant sale posts here the same way and is
                        equally not correctable from this page - leaving it
                        unbadged made it the one row with no pencil and no
                        reason given. */}
                    {isAuto ? (
                      <span
                        className="badge bg-ink-100 text-ink-600"
                        title={
                          entry.credit_sale_id
                            ? 'Posted automatically from a nozzle reading'
                            : 'Posted automatically from a lubricant sale'
                        }
                      >
                        auto
                      </span>
                    ) : null}
                    {/* THE WORD, NOT JUST THE STRIKETHROUGH. A line through a
                        number is easy to miss on a tablet in poor light, and
                        it is the one thing on this row that changes what it
                        means. Colour and a line are both decoration; this is
                        the statement. */}
                    {isCancelled ? (
                      <span
                        className="badge bg-amber-100 text-amber-900"
                        title="This entry was entered in error and has been cancelled"
                      >
                        cancelled
                      </span>
                    ) : null}
                    {isReversal ? (
                      <span
                        className="badge bg-ink-100 text-ink-600"
                        title="Posted to cancel an earlier entry"
                      >
                        correction
                      </span>
                    ) : null}
                  </div>
                  {entry.litres ? (
                    <span className="tabular mt-0.5 block text-sm text-ink-600">
                      {formatLitres(entry.litres)}
                    </span>
                  ) : null}
                </td>
                <td
                  className={`td-num ${isCancelled ? 'text-ink-400 line-through' : 'text-red-700'}`}
                >
                  {isDebit ? formatPKR(entry.amount) : '—'}
                </td>
                <td
                  className={`td-num ${isCancelled ? 'text-ink-400 line-through' : 'text-brand-700'}`}
                >
                  {isDebit ? '—' : formatPKR(entry.amount)}
                </td>
                <td
                  className={`td-num font-bold ${isCancelled ? 'text-ink-400' : 'text-ink-900'}`}
                >
                  {formatPKR(entry.balanceAfter)}
                </td>
                {canCorrect ? (
                  <td className="td text-right">
                    {correctable ? (
                      <CorrectEntryButton
                        entry={entry}
                        customerId={customerId}
                        balance={balance}
                      />
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
