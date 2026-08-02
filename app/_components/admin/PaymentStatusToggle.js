'use client';

import { useActionState, useRef } from 'react';

import { setPurchasePaymentStatus } from '@/app/_lib/actions';

/**
 * Whether a delivery has been paid for. Owner only - the page renders a plain
 * badge for staff instead.
 *
 * A real <select> rather than a badge that happens to be a button: the dropdown
 * arrow is the thing that tells you it can be changed at all. As a coloured pill
 * it read as a status label, and nobody thought to click it.
 *
 * Saves as soon as the choice changes, so there is no second "apply" step. Left
 * uncontrolled on purpose - the browser keeps the chosen value while the server
 * action runs, so it never flickers back to the old one and then forward again.
 */
export default function PaymentStatusToggle({ purchaseId, status }) {
  const formRef = useRef(null);
  const [state, formAction] = useActionState(setPurchasePaymentStatus, null);

  const isPaid = status === 'paid';

  return (
    <form ref={formRef} action={formAction}>
      <input type="hidden" name="purchase_id" value={purchaseId} />

      <label className="sr-only" htmlFor={`payment-${purchaseId}`}>
        Payment status for this delivery
      </label>

      <select
        id={`payment-${purchaseId}`}
        name="payment_status"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
        className={`rounded-full border px-2.5 py-1 text-xs font-semibold outline-none transition
          focus:ring-2 focus:ring-offset-1 ${
            isPaid
              ? 'border-brand-300 bg-brand-100 text-brand-800 hover:bg-brand-200 focus:ring-brand-300'
              : 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 focus:ring-amber-300'
          }`}
      >
        <option value="pending">Pending</option>
        <option value="paid">Paid</option>
      </select>

      {state?.ok === false ? (
        <span className="mt-1 block text-xs text-red-700">{state.message}</span>
      ) : null}
    </form>
  );
}
