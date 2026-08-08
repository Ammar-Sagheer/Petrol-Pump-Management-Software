'use client';

import { useActionState, useState } from 'react';

import { deletePurchase } from '@/app/_lib/actions';
import IconButton from '@/app/_components/ui/IconButton';
import SubmitButton from '@/app/_components/ui/SubmitButton';

/**
 * Owner-only. The way to correct a mistyped delivery: remove it and record it
 * again. Stock recalculates itself from history, so the correction flows
 * straight through to the stock and gain/loss figures.
 *
 * Two taps rather than one - deleting a delivery moves the stock figures, so it
 * should not happen from a stray tap on a phone.
 *
 * `kind` tells the action which list this row belongs to, since fuel and
 * lubricant purchases share one table on screen.
 */
export default function DeletePurchaseButton({ purchaseId, summary, kind = 'fuel' }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(deletePurchase, null);

  if (!confirming) {
    return (
      <IconButton
        name="trash"
        label="Delete this purchase"
        tone="danger"
        onClick={() => setConfirming(true)}
      />
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <input type="hidden" name="kind" value={kind} />
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
      {state?.ok === false ? (
        <span className="text-xs text-red-700">{state.message}</span>
      ) : null}
    </form>
  );
}
