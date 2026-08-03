'use client';

import { useActionState, useRef, useState } from 'react';

import { createBankTransaction } from '@/app/_lib/actions';
import SubmitButton from '@/app/_components/ui/SubmitButton';
import FormMessage from '@/app/_components/ui/FormMessage';
import NumberInput from '@/app/_components/ui/NumberInput';
import { todayISO } from '@/app/_lib/date-helpers';

const PAYMENT_CATEGORIES = [
  'Fuel purchase',
  'Salaries',
  'Electricity',
  'Rent',
  'Maintenance',
  'Transport',
  'Tax',
  'Other',
];

/**
 * Money in, or money out.
 *
 * One form with a direction switch rather than two forms, because the fields
 * are otherwise identical and two near-identical forms side by side is how an
 * amount ends up recorded the wrong way round.
 *
 * The direction is picked first and stated in plain words - "cash paid into the
 * bank" against "transfer out of the bank" - since in and out is the only thing
 * here that cannot be corrected by reading the number back.
 */
export default function BankTransactionForm({ accounts }) {
  const formRef = useRef(null);
  const [txnType, setTxnType] = useState('deposit');
  const [state, formAction] = useActionState(async (prevState, formData) => {
    const result = await createBankTransaction(prevState, formData);
    if (result?.ok) {
      formRef.current?.reset();
      setTxnType('deposit');
    }
    return result;
  }, null);

  const isDeposit = txnType === 'deposit';

  if (accounts.length === 0) return null;

  return (
    <form ref={formRef} action={formAction} className="card h-fit space-y-4 p-4">
      <h3 className="text-sm font-bold text-ink-900">Record a transaction</h3>

      <input type="hidden" name="txn_type" value={txnType} />

      {/* Two big targets rather than a dropdown: this is the choice that matters
          most and the one a thumb on a phone gets wrong most easily. */}
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Direction">
        <button
          type="button"
          onClick={() => setTxnType('deposit')}
          aria-pressed={isDeposit}
          className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
            isDeposit
              ? 'border-brand-600 bg-brand-50 text-brand-800'
              : 'border-ink-300 bg-white text-ink-600 hover:bg-ink-50'
          }`}
        >
          Money in
        </button>
        <button
          type="button"
          onClick={() => setTxnType('payment')}
          aria-pressed={!isDeposit}
          className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
            !isDeposit
              ? 'border-amber-500 bg-amber-50 text-amber-900'
              : 'border-ink-300 bg-white text-ink-600 hover:bg-ink-50'
          }`}
        >
          Money out
        </button>
      </div>

      <p className="text-xs text-ink-500">
        {isDeposit
          ? 'Cash from the pump paid into the bank.'
          : 'A transfer out of the bank — fuel, salaries, a bill.'}
      </p>

      <div>
        <label className="label" htmlFor="txn_account">
          Account
        </label>
        <select id="txn_account" name="account_id" required className="input">
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.account_label} — {account.bank_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="txn_amount">
          Amount
        </label>
        <NumberInput
          id="txn_amount"
          name="amount"
          step="0.01"
          min="0.01"
          required
          className="input-number"
          placeholder="0"
        />
      </div>

      <div>
        <label className="label" htmlFor="txn_date">
          Date
        </label>
        <input
          id="txn_date"
          name="txn_date"
          type="date"
          required
          defaultValue={todayISO()}
          className="input"
        />
      </div>

      {/* A category describes a payment. On a deposit it would say nothing, so
          it is not asked for. */}
      {!isDeposit ? (
        <div>
          <label className="label" htmlFor="txn_category">
            What for
          </label>
          <input
            id="txn_category"
            name="category"
            type="text"
            list="bank-payment-categories"
            className="input"
            placeholder="e.g. Fuel purchase"
          />
          <datalist id="bank-payment-categories">
            {PAYMENT_CATEGORIES.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="txn_note">
          Note <span className="font-normal text-ink-500">(optional)</span>
        </label>
        <input id="txn_note" name="note" type="text" className="input" />
      </div>

      <FormMessage state={state} />

      <SubmitButton className={isDeposit ? 'btn-primary w-full' : 'btn-secondary w-full'}>
        {isDeposit ? 'Record money in' : 'Record money out'}
      </SubmitButton>
    </form>
  );
}
