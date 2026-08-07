'use client';

import { useActionState, useEffect, useRef, useState } from 'react';

import {
  createLubricant,
  updateLubricant,
  deleteLubricant,
  setLubricantActive,
} from '@/app/_lib/actions';
import SubmitButton from '@/app/_components/ui/SubmitButton';
import FormMessage from '@/app/_components/ui/FormMessage';
import Dialog from '@/app/_components/ui/Dialog';
import NumberInput from '@/app/_components/ui/NumberInput';
import { todayISO } from '@/app/_lib/date-helpers';

const litreFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/**
 * The product list: adding a lubricant, changing one, and taking one off.
 *
 * Owner only, and behind a dialog, because it is configuration - which brands
 * the pump stocks - rather than something touched during a shift. It sits on
 * the Lubricants page all the same, next to the sales it governs, so a new
 * brand can be added the moment the first carton is sold rather than sending
 * someone to Settings mid-sale.
 *
 * TAKING ONE OFF has two meanings and the database picks between them (see
 * delete_lubricant in migration 024): a product never bought or sold is
 * deleted, one with history is retired. Retired products stay listed here,
 * greyed out, so bringing a brand back is one tap rather than retyping it.
 */
export default function LubricantManager({ lubricants }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(null); // a product, or 'new', or null

  const active = lubricants.filter((row) => row.is_active);
  const retired = lubricants.filter((row) => !row.is_active);

  function close() {
    setIsOpen(false);
    setEditing(null);
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="btn-secondary">
        Manage lubricants
      </button>

      <Dialog
        open={isOpen}
        onClose={close}
        title={
          editing === 'new'
            ? 'Add a lubricant'
            : editing
              ? `Edit ${editing.name}`
              : 'Lubricants on the shelf'
        }
        size="lg"
      >
        {editing ? (
          <ProductForm
            lubricant={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        ) : (
          <div className="space-y-4 p-4">
            <button type="button" onClick={() => setEditing('new')} className="btn-primary w-full">
              <span aria-hidden="true" className="text-base leading-none">
                +
              </span>
              Add a lubricant
            </button>

            {active.length === 0 ? (
              <p className="rounded-lg border border-ink-200 bg-ink-50 px-4 py-6 text-center text-sm text-ink-600">
                No lubricants yet. Add the first one above and it can be sold and restocked from
                then on.
              </p>
            ) : (
              <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
                {active.map((row) => (
                  <ProductRow key={row.id} lubricant={row} onEdit={() => setEditing(row)} />
                ))}
              </ul>
            )}

            {retired.length > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">
                  Retired
                </h3>
                <p className="mb-2 text-sm text-ink-600">
                  Not offered on the sale form any more. Their past sales and purchases still count
                  towards every month they appear in.
                </p>
                <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
                  {retired.map((row) => (
                    <ProductRow key={row.id} lubricant={row} retired />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </Dialog>
    </>
  );
}

function ProductRow({ lubricant, retired = false, onEdit }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${retired ? 'text-ink-500' : 'text-ink-900'}`}>
          {lubricant.name}
        </p>
        <p className="text-sm text-ink-600">
          {litreFormat.format(lubricant.pack_size_litres)} L pack
          {Number(lubricant.sale_rate_per_litre) > 0
            ? ` · Rs ${litreFormat.format(lubricant.sale_rate_per_litre)} a litre`
            : ''}
          {retired ? '' : ` · ${litreFormat.format(lubricant.current_stock_litres ?? 0)} L in stock`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {retired ? (
          <RestoreButton lubricantId={lubricant.id} />
        ) : (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              Edit
            </button>
            <RemoveButton lubricantId={lubricant.id} name={lubricant.name} />
          </>
        )}
      </div>
    </li>
  );
}

/** Add or edit, one form. `lubricant` is null when adding. */
function ProductForm({ lubricant, onDone }) {
  const isEdit = Boolean(lubricant);
  const [state, formAction] = useActionState(isEdit ? updateLubricant : createLubricant, null);

  // Leave the dialog on the list once it has saved, so the change can be seen.
  const handled = useRef(state);
  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4 p-4">
      {isEdit ? <input type="hidden" name="lubricant_id" value={lubricant.id} /> : null}

      <div>
        <label className="label" htmlFor="lubricant_name">
          Name
        </label>
        <input
          id="lubricant_name"
          name="name"
          type="text"
          required
          defaultValue={lubricant?.name ?? ''}
          className="input"
          placeholder="e.g. Shell Helix HX5 20W-50"
        />
        <p className="mt-1 text-sm text-ink-600">
          Whatever is written on the carton — brand, grade and all. It is what staff will pick from
          when recording a sale.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="pack_size_litres">
            Pack size (litres)
          </label>
          <NumberInput
            id="pack_size_litres"
            name="pack_size_litres"
            step="0.01"
            min="0.01"
            required
            defaultValue={lubricant?.pack_size_litres ?? 4}
            className="input-number"
          />
          <p className="mt-1 text-sm text-ink-600">
            The usual carton — 4, 3 or 1. Only a shortcut on the sale form; loose oil is still sold
            by the quarter litre.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="sale_rate_per_litre">
            Selling rate a litre <span className="font-normal text-ink-500">(optional)</span>
          </label>
          <NumberInput
            id="sale_rate_per_litre"
            name="sale_rate_per_litre"
            step="0.01"
            min="0.01"
            defaultValue={lubricant?.sale_rate_per_litre ?? ''}
            className="input-number"
            placeholder="0"
          />
          <p className="mt-1 text-sm text-ink-600">
            Used to fill in the amount when a sale is typed. It can always be changed on the sale
            itself.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="opening_stock_litres">
            Stock on hand to begin with
          </label>
          <NumberInput
            id="opening_stock_litres"
            name="opening_stock_litres"
            step="0.01"
            min="0"
            required
            defaultValue={lubricant?.opening_stock_litres ?? 0}
            className="input-number"
          />
        </div>
        <div>
          <label className="label" htmlFor="opening_stock_date">
            Counting from
          </label>
          <input
            id="opening_stock_date"
            name="opening_stock_date"
            type="date"
            required
            defaultValue={lubricant?.opening_stock_date ?? todayISO()}
            className="input"
          />
        </div>
      </div>

      <p className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
        Stock is worked out from this figure forward: opening stock, plus everything bought since,
        minus everything sold. Purchases and sales dated before that day are not counted.
      </p>

      <FormMessage state={state} />

      <div className="flex gap-2 border-t border-ink-200 pt-4">
        <SubmitButton className="btn-primary flex-1">
          {isEdit ? 'Save changes' : 'Add lubricant'}
        </SubmitButton>
        <button type="button" onClick={onDone} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}

function RemoveButton({ lubricantId, name }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(deleteLubricant, null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-semibold text-red-700 hover:underline"
      >
        Remove
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="lubricant_id" value={lubricantId} />
      <p className="text-xs text-ink-600">Take {name} off the shelf?</p>
      <div className="flex gap-2">
        <button type="submit" className="btn-danger px-2 py-1 text-xs">
          Yes, remove
        </button>
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

function RestoreButton({ lubricantId }) {
  const [state, formAction] = useActionState(setLubricantActive, null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="lubricant_id" value={lubricantId} />
      <input type="hidden" name="is_active" value="true" />
      <button type="submit" className="text-xs font-semibold text-brand-700 hover:underline">
        Bring back
      </button>
      {state?.ok === false ? <span className="text-xs text-red-700">{state.message}</span> : null}
    </form>
  );
}
