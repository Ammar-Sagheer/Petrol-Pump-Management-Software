'use client';

import { useActionState, useState } from 'react';

import { setStaffRole, setStaffActive, deleteStaffAccount } from '@/app/_lib/actions';
import SubmitButton from '@/app/_components/ui/SubmitButton';
import Dialog from '@/app/_components/ui/Dialog';

/**
 * The people who can sign in.
 *
 * Deactivating is the everyday tool: the account stops working but stays in the
 * list, and can be switched back on. Deleting is the permanent one, kept behind
 * the owner's own password.
 *
 * You cannot change your own role, switch yourself off, or delete yourself -
 * all three are enforced in the actions, not just hidden here.
 */
export default function StaffList({ staff, currentProfileId }) {
  if (staff.length === 0) {
    return <p className="card px-4 py-6 text-center text-sm text-ink-500">No logins yet.</p>;
  }

  return (
    <div className="card table-scroll">
      <table className="w-full min-w-[42rem]">
        <thead className="border-b border-ink-200 bg-ink-50">
          <tr>
            <th className="th">Name</th>
            <th className="th">Role</th>
            <th className="th">Status</th>
            <th className="th">
              <span className="sr-only">Delete</span>
            </th>
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
                <td className="td">
                  {isSelf ? (
                    <span className="text-xs text-ink-400">—</span>
                  ) : (
                    <DeleteAccount person={person} />
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
      {/* Was a plain button, which sat there looking untouched while the save
          was in flight - so it read as if nothing had happened. */}
      <SubmitButton
        className="btn-secondary px-2.5 py-1.5 text-xs"
        pendingLabel="Saving…"
      >
        Save
      </SubmitButton>
      {state?.ok === false ? (
        <span className="text-xs text-red-700">{state.message}</span>
      ) : null}
      {state?.ok ? <span className="text-xs text-brand-700">Saved</span> : null}
    </form>
  );
}

function ActiveForm({ person }) {
  const [state, formAction] = useActionState(setStaffActive, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="profile_id" value={person.id} />
      <input type="hidden" name="is_active" value={person.is_active ? 'false' : 'true'} />
      {/* min-w keeps the badge the same size while it says "…", so the row
          does not jump under the pointer mid-click. */}
      <SubmitButton
        title={person.is_active ? 'Deactivate this login' : 'Re-enable this login'}
        pendingLabel="…"
        className={`badge inline-flex min-w-[4.75rem] justify-center transition ${
          person.is_active
            ? 'bg-brand-100 text-brand-800 hover:bg-brand-200'
            : 'bg-ink-200 text-ink-700 hover:bg-ink-300'
        }`}
      >
        {person.is_active ? 'Active' : 'Disabled'}
      </SubmitButton>
      {state?.ok === false ? (
        <span className="mt-1 block text-xs text-red-700">{state.message}</span>
      ) : null}
    </form>
  );
}

/**
 * Deleting needs more room than a table cell, and it needs the owner to stop
 * and read - so it opens a dialog rather than turning into an inline
 * "are you sure?" the way the smaller deletes do.
 */
function DeleteAccount({ person }) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction] = useActionState(deleteStaffAccount, null);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs font-semibold text-red-700 hover:underline"
      >
        Delete
      </button>

      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        title={`Delete ${person.full_name}?`}
        subtitle={<span className="text-xs text-ink-500">This cannot be undone</span>}
      >
        <form action={formAction} className="space-y-4 p-4">
          <input type="hidden" name="profile_id" value={person.id} />

          <p className="text-sm text-ink-700">
            The login is removed for good. Everything {person.full_name} recorded — readings,
            deliveries, expenses, ledger entries — is <span className="font-semibold">kept</span>,
            but will no longer show their name against it.
          </p>

          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            If you only want to stop them signing in, close this and use the{' '}
            <span className="font-semibold">Active</span> switch instead. That can be undone.
          </p>

          <div>
            <label className="label" htmlFor={`owner-password-${person.id}`}>
              Your own password
            </label>
            <input
              id={`owner-password-${person.id}`}
              name="owner_password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
            />
            <p className="mt-1 text-xs text-ink-500">
              Asked for so that nobody who finds this screen open can delete a login.
            </p>
          </div>

          {state?.ok === false ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.message}
            </p>
          ) : null}

          <div className="flex gap-2">
            <SubmitButton className="btn-danger flex-1" pendingLabel="Deleting…">
              Delete this login
            </SubmitButton>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
