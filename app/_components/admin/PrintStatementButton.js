'use client';

import { useMemo, useState } from 'react';

import Dialog from '@/app/_components/ui/Dialog';
import Button from '@/app/_components/ui/Button';
import NumberInput from '@/app/_components/ui/NumberInput';
import StatementPreview from '@/app/_components/admin/StatementPreview';
import {
  STATEMENT_RANGES,
  MAX_STATEMENT_DAYS,
  statementFromParts,
} from '@/app/_lib/customer-statement';

/**
 * "Print statement" - the page you take when you go to collect.
 *
 * IT SHOWS THE STATEMENT BEFORE IT PRINTS ONE. The first version of this was a
 * range picker and a download button, and the only way to see what you were
 * about to hand someone was to open the file. That is the wrong way round for a
 * document whose whole job is to be checked: the figures belong on screen, where
 * the owner can compare them against the ledger sitting underneath on the same
 * page, and the PDF is what you reach for once they look right.
 *
 * THE PREVIEW IS THE STATEMENT, not a summary of it. `statementFromParts` is the
 * same function the download route calls, running here over an allocation the
 * server did once - so changing the range re-windows in the browser with no
 * round trip, and there is no second implementation to drift out of step.
 *
 * WHY THERE IS A RANGE PICKER when the default is right nearly every time.
 * Because the two answers are not the same document: everything still owed is
 * what you hand a haulier who has drifted; the last 30 days is what you hand a
 * regular on his monthly round, who does not want a fill from June on the page
 * he is settling.
 *
 * THE RANGE NEVER CHANGES WHAT IS OWED, and now the reader can see that rather
 * than being told it - the total stays put while the list shortens and a
 * carried-forward line appears. That was a sentence in a grey box before, which
 * is a much weaker way of making a promise about arithmetic.
 *
 * A PLAIN <a> AND NO `download` ATTRIBUTE. Same reasoning as the Excel export on
 * the Reports page: the route sets Content-Disposition itself, so the file saves
 * anyway, while a failure is free to redirect back here and put the reason on
 * screen. With `download` the browser writes whatever comes back straight to
 * disk, and the owner gets a junk file instead of a sentence.
 */
export default function PrintStatementButton({
  customerId,
  customerName,
  balance = 0,
  allocation,
  asOf,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [days, setDays] = useState(0);
  const [custom, setCustom] = useState('');

  // A typed number wins over the presets, but only once it is a real one -
  // otherwise a half-typed "1" would silently narrow the statement to a day.
  const typed = Number(custom);
  const effective =
    custom !== '' && Number.isFinite(typed) && typed >= 1
      ? Math.min(Math.floor(typed), MAX_STATEMENT_DAYS)
      : days;

  const statement = useMemo(
    () =>
      allocation
        ? statementFromParts(allocation, {
            asOf,
            balance: Number(balance ?? 0),
            days: effective > 0 ? effective : null,
          })
        : null,
    [allocation, asOf, balance, effective],
  );

  const href = `/admin/customers/${customerId}/statement${
    effective > 0 ? `?days=${effective}` : ''
  }`;

  function choose(value) {
    setDays(value);
    setCustom('');
  }

  return (
    <>
      <Button variant="secondary" type="button" onClick={() => setIsOpen(true)}>
        Print statement
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        size="lg"
        title="Statement of account"
        subtitle={
          <span className="text-sm text-ink-600">
            What {customerName} still owes, fill by fill. Check it here, then download the PDF to
            hand over, send on, or keep.
          </span>
        }
      >
        <div className="space-y-4 p-4">
          {/* ---- the range, as one row of chips ----

              Chips rather than the stacked radio cards this started with: the
              preview underneath is now the thing worth the vertical space, and
              five explanatory paragraphs pushed it below the fold on a tablet.
              What each range does is visible in the table a tap later, which is
              a better explanation than a sentence about it. */}
          <div>
            <p className="label mb-2">Which fills should be listed?</p>
            <div className="flex flex-wrap gap-2">
              {STATEMENT_RANGES.map((range) => {
                const active = custom === '' && days === range.days;
                return (
                  <button
                    key={range.days}
                    type="button"
                    onClick={() => choose(range.days)}
                    aria-pressed={active}
                    className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                        : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50'
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}

              <label className="flex min-h-11 items-center gap-2 rounded-lg border border-ink-200 bg-white px-3">
                <span className="text-sm text-ink-600">Or</span>
                <NumberInput
                  aria-label="A different number of days"
                  step="1"
                  min="1"
                  max={MAX_STATEMENT_DAYS}
                  value={custom}
                  onChange={(event) => setCustom(event.target.value)}
                  className="input-number w-20 border-0 bg-transparent p-0 text-sm"
                  placeholder="45"
                />
                <span className="text-sm text-ink-600">days</span>
              </label>
            </div>
          </div>

          {statement ? (
            <StatementPreview statement={statement} customerName={customerName} />
          ) : (
            <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">
              The statement will list every fill that has not been paid for, oldest first.
            </p>
          )}

          <div className="sticky bottom-0 flex gap-2 border-t border-ink-200 bg-white pt-3">
            <Button
              component="a"
              href={href}
              variant="primary"
              sx={{ flex: 1 }}
              onClick={() => setIsOpen(false)}
            >
              Download PDF
            </Button>
            <Button variant="secondary" type="button" onClick={() => setIsOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
