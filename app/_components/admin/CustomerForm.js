'use client';

import { useActionState, useState } from 'react';

import { createCustomer } from '@/app/_lib/actions';
import SubmitButton from '@/app/_components/ui/SubmitButton';
import FormMessage from '@/app/_components/ui/FormMessage';
import NumberInput from '@/app/_components/ui/NumberInput';
import BalanceDirection from '@/app/_components/admin/BalanceDirection';

const moneyFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const showMoney = (n) => `Rs ${moneyFormat.format(n || 0)}`;

/**
 * Adding a customer, and the balance they arrive with.
 *
 * Almost nobody typed in here is a NEW customer - they came out of a paper
 * register, and plenty of them already owe money on the day the name is
 * entered. Asking for that here rather than leaving it to a manual adjustment
 * on their own page matters, because the second trip is the one that gets
 * forgotten, and an account starting at zero when the man owes Rs 40,000 is a
 * loss nobody notices until they stop paying.
 *
 * The default is "nothing owed", so the ordinary case is one tap and the
 * question does not slow down adding a genuinely new customer.
 */
export default function CustomerForm() {
  const [state, formAction] = useActionState(createCustomer, null);
  const [direction, setDirection] = useState('');
  const [amount, setAmount] = useState('');

  const typed = Number(amount);
  const hasAmount = Number.isFinite(typed) && typed > 0;
  const opening = hasAmount ? Math.round(typed) : 0;

  return (
    <form action={formAction} className="card space-y-4 p-4">
      <div>
        <label className="label" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoFocus
          className="input"
          placeholder="e.g. Bashir Sahib"
        />
      </div>

      <div>
        <label className="label" htmlFor="vehicle_number">
          Vehicle number <span className="font-normal text-ink-500">(optional)</span>
        </label>
        <input
          id="vehicle_number"
          name="vehicle_number"
          type="text"
          className="input"
          placeholder="e.g. LEA-1234"
        />
      </div>

      <div>
        <label className="label" htmlFor="phone">
          Phone <span className="font-normal text-ink-500">(optional)</span>
        </label>
        <input id="phone" name="phone" type="tel" className="input" placeholder="03xx-xxxxxxx" />
      </div>

      <div>
        <label className="label" htmlFor="credit_limit">
          Credit limit <span className="font-normal text-ink-500">(optional)</span>
        </label>
        <NumberInput
          id="credit_limit"
          name="credit_limit"
          step="0.01"
          min="0"
          className="input-number"
          placeholder="0"
        />
        <p className="mt-1 text-sm text-ink-600">
          Leave blank for no limit. Going over it does not block a sale — the customer is just
          flagged on the list.
        </p>
      </div>

      <fieldset className="border-t border-ink-200 pt-4">
        <legend className="label">Do they already owe anything?</legend>
        <p className="mb-2 text-sm text-ink-600">
          For a customer carried over from the register. Leave this alone for someone starting
          fresh.
        </p>

        <BalanceDirection
          name="opening_direction"
          value={direction}
          onChange={(next) => {
            setDirection(next);
            if (next === '') setAmount('');
          }}
          options={[
            {
              value: '',
              title: 'Nothing owed — starting fresh',
              detail: 'The account begins at zero',
            },
            {
              value: 'owes',
              title: 'They owe the pump',
              detail: 'An unpaid balance carried over from the old register',
            },
            {
              value: 'in_credit',
              title: 'They have paid ahead',
              detail: 'The pump is holding money of theirs',
            },
          ]}
        />

        {direction !== '' ? (
          <div className="mt-3">
            <label className="label" htmlFor="opening_amount">
              How much
            </label>
            <NumberInput
              id="opening_amount"
              name="opening_amount"
              step="1"
              min="1"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="input-number"
              placeholder="0"
            />
            {/* Same check as the manual adjustment: state the result, so a
                misread label is caught by the figure. */}
            {hasAmount ? (
              <p className="mt-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-700">
                {direction === 'owes' ? (
                  <>
                    This customer will start out owing{' '}
                    <span className="whitespace-nowrap font-bold text-ink-900">
                      {showMoney(opening)}
                    </span>
                    .
                  </>
                ) : (
                  <>
                    The pump will start out owing them{' '}
                    <span className="whitespace-nowrap font-bold text-ink-900">
                      {showMoney(opening)}
                    </span>
                    .
                  </>
                )}
                <span className="mt-0.5 block text-xs text-ink-600">
                  Recorded on their ledger as an opening balance. Like every ledger entry it is
                  permanent — a mistake is corrected with a new entry, not by editing this one.
                </span>
              </p>
            ) : null}
          </div>
        ) : null}
      </fieldset>

      <FormMessage state={state} />

      <SubmitButton className="btn-primary w-full">Create customer</SubmitButton>
    </form>
  );
}
