'use client';

import { useActionState, useState } from 'react';

import { clearDay } from '@/app/_lib/actions';
import SubmitButton from '@/app/_components/ui/SubmitButton';
import Dialog from '@/app/_components/ui/Dialog';

/**
 * Wipes the day on screen so it can be entered again. Owner only.
 *
 * Sits behind a dialog rather than a plain confirm, because the thing worth
 * reading is not "are you sure" - it is what happens to the credit slips, and
 * that fuel deliveries and expenses are not touched.
 */
export default function ClearDayButton({ date, dateLabel, entryCount }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction] = useActionState(clearDay, null);

  const nothingToClear = entryCount === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={nothingToClear}
        title={
          nothingToClear
            ? 'Nothing has been entered for this day yet'
            : `Clear all entries for ${dateLabel}`
        }
        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-500 transition
                   hover:bg-red-50 hover:text-red-700
                   disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent
                   disabled:hover:text-ink-500"
      >
        Clear this day
      </button>

      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={`Clear ${dateLabel}?`}
        subtitle={
          <span className="text-xs text-ink-500">
            {entryCount} nozzle {entryCount === 1 ? 'entry' : 'entries'} will be removed
          </span>
        }
      >
        <form action={formAction} className="space-y-4 p-4">
          <input type="hidden" name="date" value={date} />

          <p className="text-sm text-ink-700">
            Every nozzle entered for this day is removed so you can type the day again from
            scratch. Tank stock goes back to what it was before these entries.
          </p>

          <ul className="space-y-2 text-xs text-ink-600">
            <li className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
              <span className="font-semibold text-ink-900">Credit slips are reversed, not
              erased.</span>{' '}
              Each customer gets an offsetting entry, so their balance comes back to correct and
              the ledger still shows what happened.
            </li>
            <li className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
              <span className="font-semibold text-ink-900">Deliveries, stock checks and expenses
              are left alone.</span>{' '}
              Remove those one at a time on their own screens.
            </li>
          </ul>

          {state?.ok === false ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.message}
            </p>
          ) : null}
          {state?.ok ? (
            <p className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
              {state.message}
            </p>
          ) : null}

          <div className="flex gap-2">
            <SubmitButton className="btn-danger flex-1" pendingLabel="Clearing…">
              Clear this day
            </SubmitButton>
            <button type="button" onClick={() => setIsOpen(false)} className="btn-secondary">
              {state?.ok ? 'Close' : 'Cancel'}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
