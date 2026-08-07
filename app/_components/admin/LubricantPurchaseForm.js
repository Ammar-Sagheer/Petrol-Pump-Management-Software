'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import { createLubricantPurchase } from '@/app/_lib/actions';
import SubmitButton from '@/app/_components/ui/SubmitButton';
import FormMessage from '@/app/_components/ui/FormMessage';
import Toast from '@/app/_components/ui/Toast';
import Dialog from '@/app/_components/ui/Dialog';
import NumberInput from '@/app/_components/ui/NumberInput';
import { todayISO } from '@/app/_lib/date-helpers';
import { formatRate } from '@/app/_lib/format-helpers';

const litreFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/**
 * Restocking the lubricant shelf.
 *
 * Deliberately the twin of PurchaseForm, down to the wording: it is the same
 * job - a delivery note with litres and an amount on it - so it should not feel
 * like a different task because the tin is smaller than a tanker. As there, the
 * invoice total is what gets typed and the rate per litre is worked out from
 * it, never the other way round.
 *
 * QUANTITY IS IN LITRES, NOT CARTONS. A delivery of twelve 4 L cartons is 48 L,
 * and typing 12 would put the shelf out by a factor of four. The hint under the
 * box does the multiplication in front of whoever is typing, so the mistake is
 * visible before it is saved rather than a month later when the stock figure
 * makes no sense.
 */
export default function LubricantPurchaseForm({ lubricants }) {
  const formRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showResult, setShowResult] = useState(false);

  const [state, formAction] = useActionState(createLubricantPurchase, null);

  const [lubricantId, setLubricantId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [totalCost, setTotalCost] = useState('');

  const handled = useRef(state);
  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;

    if (state?.ok) {
      setIsOpen(false);
      setNotice({ message: state.message });
      formRef.current?.reset();
      setLubricantId('');
      setQuantity('');
      setTotalCost('');
    }
  }, [state]);

  const selected = lubricants.find((row) => row.id === lubricantId) ?? null;
  const litresTyped = Number(quantity);
  const totalTyped = Number(totalCost);
  const hasLitres = Number.isFinite(litresTyped) && litresTyped > 0;
  const derivedRate = hasLitres ? totalTyped / litresTyped : null;
  const showRate = Number.isFinite(derivedRate) && derivedRate > 0;

  // How many cartons that many litres works out at, when it divides evenly.
  const packSize = selected ? Number(selected.pack_size_litres) : null;
  const packs = packSize && hasLitres ? litresTyped / packSize : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setShowResult(false);
          setIsOpen(true);
        }}
        className="btn-secondary"
        disabled={lubricants.length === 0}
      >
        <span aria-hidden="true" className="text-base leading-none">
          +
        </span>
        Record a lubricant purchase
      </button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} title="Record a lubricant purchase">
        <form
          ref={formRef}
          action={(formData) => {
            setShowResult(true);
            formAction(formData);
          }}
          className="space-y-4 p-4"
        >
          <div>
            <label className="label" htmlFor="purchase_lubricant_id">
              Lubricant
            </label>
            <select
              id="purchase_lubricant_id"
              name="lubricant_id"
              required
              value={lubricantId}
              onChange={(event) => setLubricantId(event.target.value)}
              className="input"
            >
              <option value="">Choose a lubricant…</option>
              {lubricants.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            {selected ? (
              <p className="mt-1 text-sm text-ink-600">
                Holds {litreFormat.format(selected.current_stock_litres ?? 0)} L today · sold in{' '}
                {litreFormat.format(selected.pack_size_litres)} L packs
              </p>
            ) : null}
          </div>

          <div>
            <label className="label" htmlFor="lubricant_purchase_date">
              Delivery date
            </label>
            <input
              id="lubricant_purchase_date"
              name="purchase_date"
              type="date"
              required
              defaultValue={todayISO()}
              className="input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="lubricant_quantity">
                Litres
              </label>
              <NumberInput
                id="lubricant_quantity"
                name="quantity_litres"
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
              <label className="label" htmlFor="lubricant_total_cost">
                Invoice total
              </label>
              <NumberInput
                id="lubricant_total_cost"
                name="total_cost"
                step="0.01"
                min="0.01"
                required
                value={totalCost}
                onChange={(event) => setTotalCost(event.target.value)}
                className="input-number"
                placeholder="0.00"
              />
            </div>
          </div>

          {packs ? (
            <p className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
              {litreFormat.format(litresTyped)} L is{' '}
              <span className="font-semibold">{litreFormat.format(packs)}</span> packs of{' '}
              {litreFormat.format(packSize)} L. Enter litres, not cartons.
            </p>
          ) : null}

          {showRate ? (
            <p className="rounded-lg bg-ink-900 px-4 py-3 text-white">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-300">
                Works out at
              </span>
              <span className="tabular mt-0.5 block text-xl font-bold">
                {formatRate(derivedRate)} <span className="text-base font-semibold">/ litre</span>
              </span>
            </p>
          ) : null}

          <div>
            <label className="label" htmlFor="lubricant_supplier">
              Supplier
            </label>
            <input
              id="lubricant_supplier"
              name="supplier_name"
              type="text"
              required
              className="input"
              placeholder="e.g. Shell distributor"
            />
          </div>

          <div>
            <label className="label" htmlFor="lubricant_invoice">
              Invoice number <span className="font-normal text-ink-500">(optional)</span>
            </label>
            <input id="lubricant_invoice" name="invoice_number" type="text" className="input" />
          </div>

          <div>
            <label className="label" htmlFor="lubricant_payment_status">
              Payment
            </label>
            <select
              id="lubricant_payment_status"
              name="payment_status"
              defaultValue="pending"
              className="input"
            >
              <option value="pending">Not paid yet</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          <FormMessage state={showResult ? state : null} />

          <div className="flex gap-2 border-t border-ink-200 pt-4">
            <SubmitButton className="btn-primary flex-1" pendingLabel="Saving…">
              Save purchase
            </SubmitButton>
            <button type="button" onClick={() => setIsOpen(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </Dialog>

      <Toast notice={notice} onDismiss={() => setNotice(null)} />
    </>
  );
}
