'use client';

import { useActionState, useRef } from 'react';

import { createBankAccount } from '@/app/_lib/actions';
import SubmitButton from '@/app/_components/ui/SubmitButton';
import FormMessage from '@/app/_components/ui/FormMessage';
import NumberInput from '@/app/_components/ui/NumberInput';

/**
 * Adds a bank account.
 *
 * The opening balance is the one field worth explaining, and the note under it
 * does that: an account added here has usually been open for years, so starting
 * its running balance at zero would make every figure on this page wrong by
 * whatever was already in it.
 */
export default function BankAccountForm() {
  const formRef = useRef(null);
  const [state, formAction] = useActionState(async (prevState, formData) => {
    const result = await createBankAccount(prevState, formData);
    if (result?.ok) formRef.current?.reset();
    return result;
  }, null);

  return (
    <form ref={formRef} action={formAction} className="card h-fit space-y-4 p-4">
      <h3 className="text-sm font-bold text-ink-900">Add a bank account</h3>

      <div>
        <label className="label" htmlFor="bank_name">
          Bank
        </label>
        <input
          id="bank_name"
          name="bank_name"
          type="text"
          required
          className="input"
          placeholder="e.g. Meezan Bank"
        />
      </div>

      <div>
        <label className="label" htmlFor="account_label">
          Short name
        </label>
        <input
          id="account_label"
          name="account_label"
          type="text"
          required
          className="input"
          placeholder="e.g. Main account"
        />
        <p className="mt-1 text-xs text-ink-500">
          What you call it, so two accounts at the same bank stay apart.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="account_number">
          Account number <span className="font-normal text-ink-500">(optional)</span>
        </label>
        <input
          id="account_number"
          name="account_number"
          type="text"
          className="input"
          placeholder="Last few digits are enough"
        />
      </div>

      <div>
        <label className="label" htmlFor="opening_balance">
          Balance today
        </label>
        <NumberInput
          id="opening_balance"
          name="opening_balance"
          step="0.01"
          defaultValue="0"
          className="input-number"
        />
        <p className="mt-1 text-xs text-ink-500">
          What is in the account right now, before anything is recorded here. Everything entered
          from now on moves the balance up or down from this figure.
        </p>
      </div>

      <FormMessage state={state} />

      <SubmitButton className="btn-primary w-full">Add account</SubmitButton>
    </form>
  );
}
