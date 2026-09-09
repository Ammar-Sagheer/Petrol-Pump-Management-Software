'use client';

import { useState } from 'react';

import Dialog from '@/app/_components/ui/Dialog';
import Button from '@/app/_components/ui/Button';
import NumberInput from '@/app/_components/ui/NumberInput';
import { STATEMENT_RANGES, MAX_STATEMENT_DAYS } from '@/app/_lib/customer-statement';

/**
 * "Print statement" - the page you take when you go to collect.
 *
 * WHY THERE IS A DIALOG AT ALL, when the default answer is right nearly every
 * time. Because the two answers are not the same document. Everything still
 * owed is what you hand a haulier who has drifted; the last 30 days is what you
 * hand a regular on his monthly round, who does not want a fill from June on the
 * page he is settling. Making that a choice at the moment of printing costs one
 * tap and saves an explanation.
 *
 * THE RANGE NEVER CHANGES WHAT IS OWED, and the dialog says so in as many words
 * before anyone picks one. It would be very easy to read "last 30 days" as "only
 * chase the last 30 days", and a customer handed a page adding up to less than
 * the total at its foot will read it that way on purpose. Older dues come
 * through as one carried-forward line - see buildStatement.
 *
 * A PLAIN <a> AND NO `download` ATTRIBUTE. Same reasoning as the Excel export on
 * the Reports page: the route sets Content-Disposition itself, so the file saves
 * anyway, while a failure is free to redirect back here and put the reason on
 * screen. With `download` the browser writes whatever comes back straight to
 * disk, and the owner gets a junk file instead of a sentence.
 */
export default function PrintStatementButton({ customerId, customerName, balance = 0 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [days, setDays] = useState(0);
  const [custom, setCustom] = useState('');

  const settled = Number(balance ?? 0) < 0.5;

  // A typed number wins over the presets, but only once it is a real one -
  // otherwise a half-typed "1" would silently narrow the statement to a day.
  const typed = Number(custom);
  const effective =
    custom !== '' && Number.isFinite(typed) && typed >= 1
      ? Math.min(Math.floor(typed), MAX_STATEMENT_DAYS)
      : days;

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
        title="Print statement"
        subtitle={
          <span className="text-sm text-ink-600">
            A PDF of what {customerName} still owes, fill by fill — to hand over, send on, or
            keep.
          </span>
        }
      >
        <div className="space-y-4 p-4">
          {settled ? (
            <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
              This account is clear. The statement will say so — useful as a receipt that
              nothing is outstanding.
            </p>
          ) : null}

          <fieldset>
            <legend className="label mb-2">How far back should the fills be listed?</legend>

            {/*
             * Radio inputs rather than a <select>: five options is few enough to
             * show at once, each one carries a line of explanation that a select
             * cannot hold, and the whole row is a tap target on a tablet - which
             * a select's options are not, once the native picker opens over
             * them.
             */}
            <div className="space-y-2">
              {STATEMENT_RANGES.map((range) => {
                const active = custom === '' && days === range.days;
                return (
                  <label
                    key={range.days}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                      active
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="statement_range"
                      className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700"
                      checked={active}
                      onChange={() => choose(range.days)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink-900">
                        {range.label}
                      </span>
                      <span className="block text-sm text-ink-600">{range.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <label className="label" htmlFor="statement_custom_days">
              Or a different number of days{' '}
              <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <NumberInput
              id="statement_custom_days"
              step="1"
              min="1"
              max={MAX_STATEMENT_DAYS}
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              className="input-number"
              placeholder="e.g. 45"
            />
          </div>

          {/* THE SENTENCE THAT STOPS THE ARGUMENT, said before printing rather
              than only on the page. */}
          <p className="rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">
            {effective > 0
              ? `Fills from the last ${effective} days are listed one by one. Anything still unpaid from before that is carried forward as a single line, so the total is always the full amount owed.`
              : 'Every fill that has not been paid for is listed, oldest first. Fills already covered by a payment are left off.'}
          </p>

          <div className="flex gap-2 border-t border-ink-200 pt-3">
            <Button
              component="a"
              href={href}
              variant="primary"
              className="flex-1"
              sx={{ flex: 1 }}
              onClick={() => setIsOpen(false)}
            >
              Download PDF
            </Button>
            <Button variant="secondary" type="button" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
