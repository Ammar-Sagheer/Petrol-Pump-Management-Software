'use client';

import { useActionState, useState } from 'react';

import { createStockCheck, deleteStockCheck } from '@/app/_lib/actions';
import { shiftISODate, formatDate } from '@/app/_lib/date-helpers';
import SubmitButton from '@/app/_components/ui/SubmitButton';
import FormMessage from '@/app/_components/ui/FormMessage';
import FuelBadge from '@/app/_components/ui/FuelBadge';
import NumberInput from '@/app/_components/ui/NumberInput';
import ConfirmAction from '@/app/_components/ui/ConfirmAction';
import BalanceDirection from '@/app/_components/admin/BalanceDirection';

const litreFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const showLitres = (n) => `${litreFormat.format(n || 0)} L`;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/*
 * A dip is a MOMENT, not a day, and which day it judges depends on when the rod
 * went in.
 *
 * This pump dips first thing in the morning, before the pumps are switched on,
 * so a dip taken on the 11th measures the tank as it stood at the close of the
 * 10th - and has to be compared against the 10th's books. Recording it against
 * the 11th, as the app did until migration 039, compared it against a book
 * figure that still had the 10th's fuel in it and reported a whole day's sales
 * as a loss, every single day.
 *
 * Morning is the default because it is the pump's routine. Both options are
 * legal and only the person holding the rod knows which is right, so this
 * follows the rule in docs/UI_CONVENTIONS.md for exactly that shape of control:
 * name the choice in plain words, then SHOW THE CONSEQUENCE - the day it closes
 * and the book figure that produces - before it is committed.
 */
const TIMINGS = [
  {
    value: 'morning',
    title: 'Morning — before the pumps opened',
    detail: 'The usual one. It closes yesterday, whose readings you are entering now.',
  },
  {
    value: 'evening',
    title: 'Evening — after the pumps closed',
    detail: 'Only if the rod went in at the end of the day, after the last sale.',
  },
];

export default function StockCheckForm({
  tank,
  date,
  existingCheck,
  earliestBooksDate = null,
  openingStock = null,
  canManage = false,
}) {
  const [state, formAction] = useActionState(createStockCheck, null);
  const [clearState, clearAction] = useActionState(deleteStockCheck, null);
  const [dip, setDip] = useState('');
  const [taken, setTaken] = useState('morning');

  // The day this dip closes, and so the books it is judged against.
  const closesDate = taken === 'morning' ? shiftISODate(date, -1) : date;

  /*
   * Once a dip is recorded, its OWN stored figures are what the card shows -
   * not a live recomputation for whichever timing the toggle happens to be
   * sitting on. They cannot go stale: migration 039 rebuilds expected_stock
   * from history whenever anything behind it moves.
   */
  const shownClosesDate = existingCheck
    ? (existingCheck.books_date ?? shiftISODate(date, -1))
    : closesDate;
  const expected = existingCheck
    ? Number(existingCheck.expected_stock ?? 0)
    : Number((taken === 'morning' ? tank.expected_if_morning : tank.expected_if_evening) ?? 0);

  /*
   * A dip with no dip behind it is measured against the tank's OPENING STOCK
   * from Settings, because there is nothing else to measure it against. That
   * makes any difference a disagreement between two typed figures, not fuel
   * that appeared or vanished - so it must not be dressed up as a gain.
   *
   * This is not hypothetical: the pump's first dip read 5,556 L against an
   * opening of 854 L and the page announced "Gain of 4,702 L" in green. The two
   * tanks' figures had been entered into each other's cards.
   */
  const isFirstDip = existingCheck
    ? !earliestBooksDate || (existingCheck.books_date ?? '') <= earliestBooksDate
    : !earliestBooksDate || closesDate <= earliestBooksDate;

  const dipValue = dip === '' ? null : Number(dip);
  const hasDip = dipValue !== null && Number.isFinite(dipValue);
  const difference = hasDip ? round2(dipValue - expected) : null;

  const openingNote = isFirstDip ? (
    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
      This is the first dip for this tank, so there is no earlier measurement behind it — it is
      worked out from the <strong>opening stock</strong> of{' '}
      {showLitres(openingStock ?? expected)} set under Settings → Tanks. That figure was typed,
      not measured, so if it is wrong (or on the wrong tank) the difference below is not fuel.
      Check it before reading this as a gain or a loss.
    </p>
  ) : null;

  const capacity = Number(tank.capacity_litres ?? 0);
  const fillPercent = capacity ? Math.min(100, Math.max(0, (expected / capacity) * 100)) : 0;

  // More fuel on the books than the tank can physically hold, or less than
  // nothing in it. Either way the books are wrong, not the tank.
  const overCapacity = capacity > 0 && expected > capacity;
  const belowZero = expected < 0;

  return (
    <section className="card p-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-ink-900">{tank.name}</h2>
          <FuelBadge fuelType={tank.fuel_type} />
        </div>
        <span className="text-sm text-ink-600">
          Capacity {litreFormat.format(tank.capacity_litres)} L
        </span>
      </header>

      <div className="mb-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="figure-label">Expected in tank</span>
          {/* nowrap: at a phone's width this figure was breaking between the
              number and its unit, leaving a bare "L" on the next line. */}
          <span
            className={`tabular whitespace-nowrap text-lg font-bold ${
              overCapacity || belowZero ? 'text-red-700' : 'text-ink-900'
            }`}
          >
            {showLitres(expected)}
          </span>
        </div>
        {/* Which day's books that is. Its own line rather than part of the
            label above, so the date can never squeeze the figure. */}
        <p className="text-sm text-ink-600">at the close of {formatDate(shownClosesDate)}</p>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-ink-200"
          role="img"
          aria-label={`Tank is about ${Math.round(fillPercent)} percent full`}
        >
          <div
            className={`h-full rounded-full ${
              overCapacity
                ? 'bg-red-500'
                : tank.fuel_type === 'petrol'
                  ? 'bg-sky-500'
                  : 'bg-amber-500'
            }`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>

        {openingNote}

        {overCapacity ? (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
            The books show {showLitres(expected)} in a tank that only holds{' '}
            {litreFormat.format(capacity)} L — {showLitres(expected - capacity)} too much. A
            delivery quantity was probably mistyped. Check Purchases before recording a dip, or the
            loss below will be nonsense.
          </p>
        ) : null}

        {belowZero ? (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
            The books show less than nothing in this tank. A delivery is probably missing, or the
            opening stock was never set under Settings.
          </p>
        ) : null}
      </div>

      {existingCheck ? (
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 text-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-ink-600">
                A dip was already recorded for this date:{' '}
                <span className="tabular font-semibold text-ink-900">
                  {showLitres(existingCheck.actual_dip_reading)}
                </span>
              </p>
              <p className="text-ink-600">
                Taken {existingCheck.taken ?? 'morning'} of {formatDate(date)}.
              </p>
              <p
                className={[
                  'tabular mt-1 font-bold',
                  Number(existingCheck.gain_loss) === 0
                    ? 'text-ink-700'
                    : isFirstDip
                      ? 'text-amber-900'
                      : Number(existingCheck.gain_loss) > 0
                        ? 'text-brand-700'
                        : 'text-red-700',
                ].join(' ')}
              >
                {Number(existingCheck.gain_loss) === 0
                  ? isFirstDip
                    ? 'Matches the opening stock exactly'
                    : 'Matches the books exactly'
                  : isFirstDip
                    ? `${showLitres(Math.abs(Number(existingCheck.gain_loss)))} away from the opening stock`
                    : Number(existingCheck.gain_loss) > 0
                      ? `Gain of ${showLitres(existingCheck.gain_loss)}`
                      : `Loss of ${showLitres(Math.abs(Number(existingCheck.gain_loss)))}`}
              </p>
            </div>

            {/* A mistyped rod reading has to be correctable, and a dip is the
                baseline every later figure is built on - so a wrong one is
                wrong for every day after it, not just its own. Cleared and
                re-entered rather than edited, the same as a purchase. */}
            {canManage ? (
              <ConfirmAction
                triggerLabel={`Clear the ${tank.name} dip`}
                title="Clear this dip?"
                confirmLabel="Clear dip"
                pendingLabel="Clearing…"
                action={clearAction}
                state={clearState}
                hidden={{ check_id: existingCheck.id }}
              >
                <p>
                  The {showLitres(existingCheck.actual_dip_reading)} measured on{' '}
                  {formatDate(date)} will be removed, and you can record the corrected reading
                  straight away.
                </p>
                <p>
                  Every later dip is measured from this one, so their gain and loss figures will
                  be worked out again from whatever is left behind it.
                </p>
                <FormMessage state={clearState} />
              </ConfirmAction>
            ) : null}
          </div>
        </div>
      ) : (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="tank_id" value={tank.id} />
          <input type="hidden" name="check_date" value={date} />

          <div>
            <span className="label block">When was the rod put in?</span>
            <BalanceDirection
              name="taken"
              value={taken}
              onChange={setTaken}
              options={TIMINGS}
            />
            <p className="mt-1 text-sm text-ink-600">
              A dip taken on the morning of {formatDate(date)} measures what was left at the end
              of {formatDate(shiftISODate(date, -1))}, so that is the day it is checked against.
            </p>
          </div>

          <div>
            <label className="label" htmlFor={`dip-${tank.id}`}>
              Measured dip reading{' '}
              <span className="font-semibold text-ink-900">in litres</span>
            </label>
            <NumberInput
              id={`dip-${tank.id}`}
              name="actual_dip_reading"
              step="0.01"
              min="0"
              required
              value={dip}
              onChange={(event) => setDip(event.target.value)}
              className="input-number"
              placeholder="0.00"
              aria-describedby={`dip-help-${tank.id}`}
            />
            <p id={`dip-help-${tank.id}`} className="mt-1 text-sm text-ink-600">
              The dip rod reads a depth — convert it to litres on the tank chart first, then enter
              that figure here.
            </p>
          </div>

          {difference !== null ? (
            <p
              className={[
                'rounded-lg px-3 py-2 text-sm font-semibold',
                difference === 0
                  ? 'bg-ink-100 text-ink-700'
                  : difference > 0
                    ? 'bg-brand-50 text-brand-800'
                    : 'bg-red-50 text-red-800',
              ].join(' ')}
            >
              {difference === 0
                ? isFirstDip
                  ? 'Matches the opening stock exactly.'
                  : 'Matches the books exactly.'
                : isFirstDip
                  ? `${showLitres(Math.abs(difference))} away from the opening stock.`
                  : difference > 0
                    ? `Gain of ${showLitres(difference)} against the books.`
                    : `Loss of ${showLitres(Math.abs(difference))} against the books.`}
              <span className="mt-0.5 block text-xs font-normal">
                For {formatDate(closesDate)}.
              </span>
            </p>
          ) : null}

          <div>
            <label className="label" htmlFor={`note-${tank.id}`}>
              Note <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <input
              id={`note-${tank.id}`}
              name="note"
              type="text"
              className="input"
              placeholder="e.g. measured after the evening delivery"
            />
          </div>

          <FormMessage state={state} />

          <SubmitButton className="btn-primary w-full">Record dip</SubmitButton>
        </form>
      )}
    </section>
  );
}
