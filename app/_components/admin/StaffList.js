'use client';

import { useActionState } from 'react';

import { setStaffRole, setStaffActive } from '@/app/_lib/actions';

/**
 * The people who can sign in.
 *
 * Accounts are deactivated rather than deleted, so the readings and ledger
 * entries they recorded keep their author. You cannot change your own role or
 * switch yourself off - that check is enforced in the action, not just here.
 */
export default function StaffList({ staff, currentProfileId }) {
  if (staff.length === 0) {
    return (
      <p className="card px-4 py-6 text-center text-sm text-ink-500">No logins yet.</p>
    );
  }

  return (
    <div className="card table-scroll">
      <table className="w-full min-w-[34rem]">
        <thead className="border-b border-ink-200 bg-ink-50">
          <tr>
            <th className="th">Name</th>
            <th className="th">Role</th>
            <th className="th">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {staff.map((person) => {
            const isSelf = person.id === currentProfileId;
            return (
              <tr key={person.id}>
                <td className="td">
                  <span className="font-medium">{person.full_name}</span>
                  {isSelf ? (
                    <span className="badge ml-2 bg-brand-100 text-brand-800">you</span>
                  ) : null}
                </td>
                <td className="td">
                  {isSelf ? (
                    <span className="text-ink-600">
                      {person.role === 'super_admin' ? 'Owner' : 'Data entry'}
                    </span>
                  ) : (
                    <RoleForm person={person} />
                  )}
                </td>
                <td className="td">
                  {isSelf ? (
                    <span className="badge bg-brand-100 text-brand-800">Active</span>
                  ) : (
                    <ActiveForm person={person} />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RoleForm({ person }) {
  const [state, formAction] = useActionState(setStaffRole, null);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="profile_id" value={person.id} />
      <label className="sr-only" htmlFor={`role-${person.id}`}>
        Role for {person.full_name}
      </label>
      <select
        id={`role-${person.id}`}
        name="role"
        defaultValue={person.role}
        className="input py-1.5 text-sm"
      >
        <option value="data_entry">Data entry</option>
        <option value="super_admin">Owner</option>
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

function ActiveForm({ person }) {
  const [state, formAction] = useActionState(setStaffActive, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="profile_id" value={person.id} />
      <input type="hidden" name="is_active" value={person.is_active ? 'false' : 'true'} />
      <button
        type="submit"
        title={person.is_active ? 'Deactivate this login' : 'Re-enable this login'}
        className={`badge transition ${
          person.is_active
            ? 'bg-brand-100 text-brand-800 hover:bg-brand-200'
            : 'bg-ink-200 text-ink-700 hover:bg-ink-300'
        }`}
      >
        {person.is_active ? 'Active' : 'Disabled'}
      </button>
      {state?.ok === false ? (
        <span className="mt-1 block text-xs text-red-700">{state.message}</span>
      ) : null}
    </form>
  );
}
