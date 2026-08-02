'use client';

import { useActionState, useRef, useState } from 'react';

import { createPurchase } from '@/app/_lib/actions';
import SubmitButton from '@/app/_components/ui/SubmitButton';
import FormMessage from '@/app/_components/ui/FormMessage';

const moneyFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export default function PurchaseForm({ tanks }) {
  const formRef = useRef(null);
  const [state, formAction] = useActionState(async (prevState, formData) => {
    const result = await createPurchase(prevState, formData);
    // Clear the form after a successful save so the next delivery starts fresh.
    if (result?.ok) formRef.current?.reset();
    return result;
  }, null);

  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');

  const totalCost = Number(quantity) * Number(rate);
  const showTotal = Number.isFinite(totalCost) && totalCost > 0;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form ref={formRef} action={formAction} className="card space-y-4 p-4">
      <h2 className="text-sm font-bold text-ink-900">Record a delivery</h2>

      <div>
        <label className="label" htmlFor="tank_id">
          Tank
        </label>
        <select id="tank_id" name="tank_id" required className="input">
          <option value="">Choose a tank…</option>
          {tanks.map((tank) => (
            <option key={tank.id} value={tank.id}>
              {tank.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="purchase_date">
          Delivery date
        </label>
        <input
          id="purchase_date"
          name="purchase_date"
          type="date"
          required
          defaultValue={today}
          className="input"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="quantity_litres">
            Litres
          </label>
          <input
            id="quantity_litres"
            name="quantity_litres"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="input-number"
            placeholder="0"
          />
        </div>
        <div>
          <label className="label" htmlFor="rate">
            Rate / litre
          </label>
          <input
            id="rate"
            name="rate"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            required
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            className="input-number"
            placeholder="0.00"
          />
        </div>
      </div>

      {showTotal ? (
        <p className="rounded-lg bg-ink-900 px-4 py-3 text-white">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-300">
            Invoice total
          </span>
          <span className="tabular mt-0.5 block text-xl font-bold">
            Rs {moneyFormat.format(totalCost)}
          </span>
        </p>
      ) : null}

      <div>
        <label className="label" htmlFor="supplier_name">
          Supplier / OMC
        </label>
        <input
          id="supplier_name"
          name="supplier_name"
          type="text"
          required
          className="input"
          placeholder="e.g. PSO"
        />
      </div>

      <div>
        <label className="label" htmlFor="invoice_number">
          Invoice number <span className="font-normal text-ink-400">(optional)</span>
        </label>
        <input id="invoice_number" name="invoice_number" type="text" className="input" />
      </div>

      <div>
        <label className="label" htmlFor="payment_status">
          Payment
        </label>
        <select id="payment_status" name="payment_status" defaultValue="pending" className="input">
          <option value="pending">Not paid yet</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <FormMessage state={state} />

      <SubmitButton className="btn-primary w-full">Save delivery</SubmitButton>
    </form>
  );
}
