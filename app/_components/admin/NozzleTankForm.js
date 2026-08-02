'use client';

import { useActionState } from 'react';

import { setNozzleTank } from '@/app/_lib/actions';

export default function NozzleTankForm({ nozzle, tanks }) {
  const [state, formAction] = useActionState(setNozzleTank, null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="nozzle_id" value={nozzle.id} />
      <label className="sr-only" htmlFor={`tank-${nozzle.id}`}>
        Tank for unit {nozzle.unit_number} nozzle {nozzle.nozzle_label}
      </label>
      <select
        id={`tank-${nozzle.id}`}
        name="tank_id"
        defaultValue={nozzle.tank_id}
        className="input py-1.5 text-sm"
      >
        {tanks.map((tank) => (
          <option key={tank.id} value={tank.id}>
            {tank.name}
          </option>
        ))}
      </select>
      <button type="submit" className="btn-secondary px-2.5 py-1.5 text-xs">
        Save
      </button>
      {state?.ok === false ? (
        <span className="text-xs text-red-700">{state.message}</span>
      ) : null}
    </form>
  );
}
