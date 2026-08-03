'use client';

import { useActionState } from 'react';

import { setNozzleTank } from '@/app/_lib/actions';
import SubmitButton from '@/app/_components/ui/SubmitButton';
import NumberInput from '@/app/_components/ui/NumberInput';

/**
 * Which tank a nozzle draws from, and where its meter started.
 *
 * Both on one row behind one Save, because they are set together - once, when
 * the pump is first put on the system - and then almost never touched again.
 */
export default function NozzleTankForm({ nozzle, tanks }) {
  const [state, formAction] = useActionState(setNozzleTank, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="nozzle_id" value={nozzle.id} />

      <label className="sr-only" htmlFor={`tank-${nozzle.id}`}>
        Tank for unit {nozzle.unit_number} nozzle {nozzle.nozzle_label}
      </label>
      <select
        id={`tank-${nozzle.id}`}
        name="tank_id"
        defaultValue={nozzle.tank_id}
        className="input w-auto py-1.5 text-sm"
      >
        {tanks.map((tank) => (
          <option key={tank.id} value={tank.id}>
            {tank.name}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor={`start-${nozzle.id}`}>
        Starting meter reading for unit {nozzle.unit_number} nozzle {nozzle.nozzle_label}
      </label>
      <NumberInput
        id={`start-${nozzle.id}`}
        name="starting_reading"
        defaultValue={nozzle.starting_reading ?? 0}
        min="0"
        step="0.01"
        className="input tabular w-32 py-1.5 text-sm"
      />

      <SubmitButton className="btn-secondary px-2.5 py-1.5 text-xs" pendingLabel="Saving…">
        Save
      </SubmitButton>

      {state?.ok === false ? (
        <span className="w-full text-xs text-red-700">{state.message}</span>
      ) : null}
      {state?.ok ? <span className="text-xs text-brand-700">Saved</span> : null}
    </form>
  );
}
