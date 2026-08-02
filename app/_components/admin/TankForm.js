'use client';

import { useActionState } from 'react';

import { updateTank } from '@/app/_lib/actions';
import SubmitButton from '@/app/_components/ui/SubmitButton';
import FormMessage from '@/app/_components/ui/FormMessage';
import FuelBadge from '@/app/_components/ui/FuelBadge';

export default function TankForm({ tank }) {
  const [state, formAction] = useActionState(updateTank, null);

  return (
    <form action={formAction} className="card space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink-900">{tank.name}</h3>
        <FuelBadge fuelType={tank.fuel_type} />
      </div>

      <input type="hidden" name="tank_id" value={tank.id} />

      <div>
        <label className="label" htmlFor={`capacity-${tank.id}`}>
          Capacity (litres)
        </label>
        <input
          id={`capacity-${tank.id}`}
          name="capacity_litres"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="1"
          required
          defaultValue={tank.capacity_litres}
          className="input-number"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor={`opening-${tank.id}`}>
            Opening stock
          </label>
          <input
            id={`opening-${tank.id}`}
            name="opening_stock_litres"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            defaultValue={tank.opening_stock_litres}
            className="input-number"
          />
        </div>
        <div>
          <label className="label" htmlFor={`opening-date-${tank.id}`}>
            From
          </label>
          <input
            id={`opening-date-${tank.id}`}
            name="opening_stock_date"
            type="date"
            required
            defaultValue={tank.opening_stock_date}
            className="input"
          />
        </div>
      </div>

      <p className="text-xs text-ink-500">
        Opening stock is only the starting point before the first dip is recorded. Once a physical
        dip exists, that measured figure becomes the baseline instead.
      </p>

      <FormMessage state={state} />

      <SubmitButton className="btn-secondary w-full">Save tank</SubmitButton>
    </form>
  );
}
