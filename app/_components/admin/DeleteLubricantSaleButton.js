'use client';

import { useActionState, useState } from 'react';

import { deleteLubricantSale } from '@/app/_lib/actions';
import IconButton from '@/app/_components/ui/IconButton';
import SubmitButton from '@/app/_components/ui/SubmitButton';

/**
 * Owner only, like deleting a nozzle reading.
 *
 * Confirms first, because a sale carrying credit has already moved a customer's
 * balance. The reversal that undoes it is posted by the database in the same
 * transaction as the delete, so there is no state where the row is gone and the
 * debt is still standing.
 */
export default function DeleteLubricantSaleButton({ saleId, summary }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(deleteLubricantSale, null);

  if (!confirming) {
    return (
      <IconButton
        name="trash"
        label="Delete this sale"
        tone="danger"
        onClick={() => setConfirming(true)}
      />
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="sale_id" value={saleId} />
      <p className="text-xs text-ink-600">Delete {summary}?</p>
      <div className="flex gap-2">
        <SubmitButton className="btn-danger px-2 py-1 text-xs" pendingLabel="Deleting…">
          Yes, delete
        </SubmitButton>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs font-medium text-ink-500 hover:text-ink-800"
        >
          Cancel
        </button>
      </div>
      {state?.ok === false ? <span className="text-xs text-red-700">{state.message}</span> : null}
    </form>
  );
}
