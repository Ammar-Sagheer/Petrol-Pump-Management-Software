'use client';

import { useActionState, useState } from 'react';

import { deleteCustomer, purgeCustomer, setCustomerActive } from '@/app/_lib/actions';
import IconButton from '@/app/_components/ui/IconButton';
import SubmitButton from '@/app/_components/ui/SubmitButton';

/**
 * Taking a customer off the list, and putting one back.
 *
 * Owner only, and it confirms first — the same treatment as removing a
 * lubricant, for the same reason: what happens next depends on history the
 * person clicking cannot see from the row.
 *
 * THE WORD IS "REMOVE", NOT "DELETE". Only an account that never traded is
 * actually deleted; one with credit or payments behind it is retired, because
 * deleting it would tear a hole in months already reported and exported. The
 * database decides which, so the button cannot promise either — "Remove" is
 * true of both, and the confirmation says what will really happen.
 *
 * The refusal case is the one worth designing for: an account with a balance
 * still on it cannot be removed at all, and the message naming the figure
 * comes straight from the database. So the error is given room to wrap rather
 * than being squeezed onto the end of the row.
 */
export default function RemoveCustomerButton({ customerId, name, balance }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(deleteCustomer, null);

  /*
   * The same test the database applies, so the row can explain itself before
   * the click rather than after it. The database is still the rule - this is
   * the courtesy.
   *
   * ROUNDED TO THE RUPEE, and it has to stay that way. This check was left at
   * a 0.01 threshold when delete_customer moved to whole rupees, and the two
   * promptly disagreed: an account sitting on a 28-paisa residue displayed
   * "Rs 0", warned "this account is not settled", and would then have been
   * removed perfectly happily by the database. A courtesy check that
   * contradicts the rule it is previewing is worse than no check.
   *
   * Three things now round the same way and must be changed together: this,
   * `delete_customer` (migration 032), and `formatPKR` in the Owes column.
   */
  const owes = Number(balance ?? 0);
  // Half away from zero, matching Postgres and formatPKR - Math.round would
  // call a balance of -0.5 settled while the column beside it reads "Rs -1".
  const notSquare = (owes < 0 ? -1 : 1) * Math.round(Math.abs(owes)) !== 0;

  if (!confirming) {
    return (
      <IconButton
        name="trash"
        label={`Remove ${name}`}
        tone="danger"
        onClick={() => setConfirming(true)}
      />
    );
  }

  return (
    /*
     * A minimum width, so the confirmation gets a readable measure instead of
     * being crushed into whatever the last column has left. On a phone that
     * pushes the table past the screen and it scrolls, which is the trade this
     * app always makes - the layout gives way, the words do not.
     */
    <form action={formAction} className="flex min-w-[14rem] flex-col gap-1.5">
      <input type="hidden" name="customer_id" value={customerId} />

      {notSquare ? (
        <p className="text-xs text-amber-900">
          <span className="font-semibold">This account is not settled.</span> Square it on{' '}
          {name}’s page first — removing it would take the balance off the books.
        </p>
      ) : (
        <p className="text-xs text-ink-600">
          Remove <span className="font-semibold">{name}</span>? Anything already on their ledger
          stays on the books.
        </p>
      )}

      <div className="flex gap-2">
        <SubmitButton
          className="btn-danger whitespace-nowrap px-2 py-1 text-xs"
          pendingLabel="Removing…"
        >
          Yes, remove
        </SubmitButton>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs font-medium text-ink-500 hover:text-ink-800"
        >
          Cancel
        </button>
      </div>

      {state?.ok === false ? (
        <span className="block text-xs leading-snug text-red-700">{state.message}</span>
      ) : null}
    </form>
  );
}

/** Puts a removed customer back on the list. */
export function RestoreCustomerButton({ customerId }) {
  const [state, formAction] = useActionState(setCustomerActive, null);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="customer_id" value={customerId} />
      <input type="hidden" name="is_active" value="true" />
      <SubmitButton
        className="text-xs font-semibold text-brand-700 hover:underline"
        pendingLabel="Bringing back…"
      >
        Bring back
      </SubmitButton>
      {state?.ok === false ? <span className="text-xs text-red-700">{state.message}</span> : null}
    </form>
  );
}

/**
 * The step past Remove: gone for good, ledger entries and all.
 *
 * ONLY OFFERED ON THE REMOVED LIST, so getting here is always two deliberate
 * decisions rather than one click next to six live customers.
 *
 * TYPING THE NAME is the confirmation, not a Yes button. Everything else
 * destructive in this app is recoverable — a retired customer comes back, a
 * deleted sale posts a reversal — and this one is not, so it asks for
 * something a mis-aimed click cannot produce. The database checks the typed
 * name too; this is the courtesy copy of that rule, and the Submit stays
 * disabled until they match so the refusal is rare rather than routine.
 *
 * Most attempts here are expected to FAIL, and that is the feature working: a
 * customer who ever took fuel on credit cannot be purged at all, because the
 * slip belongs to a day already on the books. The message explaining that
 * comes from the database and needs room, so it wraps under the form.
 */
export function PurgeCustomerButton({ customerId, name }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [state, formAction] = useActionState(purgeCustomer, null);

  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-semibold text-red-700 hover:underline"
      >
        Delete for good
      </button>
    );
  }

  return (
    <form action={formAction} className="flex min-w-[15rem] flex-col gap-1.5">
      <input type="hidden" name="customer_id" value={customerId} />

      <p className="text-xs text-ink-700">
        This cannot be undone. Type <span className="font-semibold">{name}</span> to confirm.
      </p>

      <input
        type="text"
        name="confirm_name"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        className="input py-1.5 text-sm"
        aria-label={`Type ${name} to confirm`}
        autoComplete="off"
      />

      <div className="flex gap-2">
        <SubmitButton
          disabled={!matches}
          className="btn-danger whitespace-nowrap px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          pendingLabel="Deleting…"
        >
          Delete for good
        </SubmitButton>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setTyped('');
          }}
          className="text-xs font-medium text-ink-500 hover:text-ink-800"
        >
          Cancel
        </button>
      </div>

      {state?.ok === false ? (
        <span className="block text-xs leading-snug text-red-700">{state.message}</span>
      ) : null}
    </form>
  );
}
