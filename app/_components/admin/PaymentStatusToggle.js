'use client';

import { useActionState } from 'react';

import { setPurchasePaymentStatus } from '@/app/_lib/actions';

/**
 * Flips a delivery between paid and pending. Owner only - the page decides
 * whether to render this or a plain badge.
 */
export default function PaymentStatusToggle({ purchaseId, status }) {
  const [state, formAction] = useActionState(setPurchasePaymentStatus, null);
  const isPaid = status === 'paid';

  return (
    <form action={formAction}>
      <input type="hidden" name="purchase_id" value={purchaseId} />
      <input type="hidden" name="payment_status" value={isPaid ? 'pending' : 'paid'} />
      <button
        type="submit"
        title={isPaid ? 'Mark as not paid' : 'Mark as paid'}
        className={`badge transition ${
          isPaid
            ? 'bg-brand-100 text-brand-800 hover:bg-brand-200'
            : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
        }`}
      >
        {isPaid ? 'Paid' : 'Pending'}
      </button>
      {state?.ok === false ? (
        <span className="mt-1 block text-xs text-red-700">{state.message}</span>
      ) : null}
    </form>
  );
}
