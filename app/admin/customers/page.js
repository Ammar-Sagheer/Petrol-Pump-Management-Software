import Link from 'next/link';

import { requirePageRole, ROLES, formatPKR } from '@/app/_lib/helpers';
import { getCustomerBalances, getRetiredCustomers } from '@/app/_lib/data-service';
import { customerAvatar } from '@/app/_lib/customer-avatar';
import PageHeader from '@/app/_components/ui/PageHeader';
import Icon from '@/app/_components/ui/Icon';
import { StatTile, StatGrid } from '@/app/_components/admin/AdminStats';
import EmptyState from '@/app/_components/ui/EmptyState';
import CustomerForm from '@/app/_components/admin/CustomerForm';
import RemoveCustomerButton, {
  RestoreCustomerButton,
  PurgeCustomerButton,
} from '@/app/_components/admin/RemoveCustomerButton';

export const metadata = { title: 'Customers' };

/**
 * The name cell, and the reason it is its own thing now.
 *
 * ONE CELL INSTEAD OF TWO COLUMNS. The vehicle used to be a column of its own,
 * which spent a whole column's width on a field that is blank for a good share
 * of customers and is only ever read as "which of the two Ahmads is this".
 * Sitting under the name it does that job better and gives the table one fewer
 * column to fit before it starts scrolling sideways - the same move the
 * Ramtabs reference makes with its vendor column.
 */
function CustomerCell({ customer, muted = false }) {
  const avatar = customerAvatar(customer);

  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          muted ? 'bg-ink-100 text-ink-400' : `${avatar.bg} ${avatar.text}`
        }`}
        aria-hidden="true"
      >
        <Icon name={avatar.icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <Link
          href={`/admin/customers/${customer.customer_id}`}
          className={`block truncate font-semibold hover:underline ${
            muted ? 'text-ink-600' : 'text-brand-700'
          }`}
        >
          {customer.name}
        </Link>
        {/* Never "—" here. A dash under a name reads as a missing value the
            reader should go and fix; a customer with no vehicle on file is
            simply a customer with no vehicle, so the line is absent instead. */}
        {customer.vehicle_number ? (
          <span className="tabular block truncate text-sm text-ink-500">
            {customer.vehicle_number}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default async function CustomersPage() {
  const profile = await requirePageRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);
  const isOwner = profile.role === ROLES.SUPER_ADMIN;

  // Removed customers are only fetched for the owner, who is the only one who
  // can act on them - staff would get a list they cannot use.
  const [customers, retired] = await Promise.all([
    getCustomerBalances(),
    isOwner ? getRetiredCustomers() : Promise.resolve([]),
  ]);

  const balances = customers.map((customer) => Math.max(0, Number(customer.balance)));
  const totalOwed = balances.reduce((total, balance) => total + balance, 0);
  const owingNow = balances.filter((balance) => balance > 0).length;
  const largest = balances.length > 0 ? Math.max(...balances) : 0;

  return (
    <>
      <PageHeader
        title="Customers"
        description="Credit accounts and what each one currently owes."
      >
        <CustomerForm />
      </PageHeader>

      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add the people who take fuel on credit. Once they exist you can attach them to credit slips on the readings screen."
        >
          <CustomerForm />
        </EmptyState>
      ) : (
        <>
          {/*
           * FOUR FIGURES, AND "OVER THEIR LIMIT" IS NOT ONE OF THEM ANY MORE -
           * the owner asked for it to go. What replaced it is the same question
           * asked in a way that does not depend on a limit being set at all:
           * how many owe anything right now, and how big the biggest single
           * debt is. Most accounts here have no credit limit on file, so a
           * count of who is over one was a figure about the minority of rows
           * that happened to have the field filled in.
           */}
          <div className="mb-6">
            <StatGrid>
              <StatTile
                icon="credit"
                label="Total outstanding"
                value={formatPKR(totalOwed)}
                sub={`across ${customers.length} account${customers.length === 1 ? '' : 's'}`}
              />
              <StatTile icon="customers" label="On the list" value={String(customers.length)} />
              <StatTile
                icon="account"
                label="Owing right now"
                value={String(owingNow)}
                sub={
                  customers.length > 0
                    ? `${Math.round((owingNow / customers.length) * 100)}% of accounts`
                    : null
                }
              />
              <StatTile icon="moneyOut" label="Largest balance" value={formatPKR(largest)} />
            </StatGrid>
          </div>

          <div className="card table-scroll">
            <table className="w-full min-w-[34rem]">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Customer</th>
                  <th className="th text-right">Credit limit</th>
                  <th className="th text-right">Owes</th>
                  {isOwner ? (
                    <th className="th">
                      <span className="sr-only">Actions</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {customers.map((customer) => {
                  const balance = Number(customer.balance);
                  const limit =
                    customer.credit_limit === null ? null : Number(customer.credit_limit);
                  const isOverLimit = limit !== null && balance > limit;
                  const used = limit !== null && limit > 0 ? (balance / limit) * 100 : null;

                  return (
                    <tr key={customer.customer_id} className="hover:bg-ink-50">
                      <td className="td">
                        <CustomerCell customer={customer} />
                      </td>

                      {/*
                       * A BAR UNDER THE LIMIT, not a percentage beside it. How
                       * close an account is to its ceiling is a proportion, and
                       * a proportion is read off a length faster than off a
                       * number - but only where a ceiling exists. Accounts with
                       * no limit get the dash and nothing else rather than an
                       * empty track, which would imply a limit of zero.
                       *
                       * Green under, red over, and nothing in between: amber
                       * would be a third state to learn, and "approaching the
                       * limit" is not a thing anyone acts on differently from
                       * "under it". The word in the badge is what actually
                       * carries "over" - the colour is the second cue, never
                       * the only one.
                       */}
                      <td className="td-num text-ink-600">
                        {limit === null ? (
                          '—'
                        ) : (
                          <div className="ml-auto w-24">
                            <span className="tabular block">{formatPKR(limit)}</span>
                            <span
                              className="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink-200"
                              aria-hidden="true"
                            >
                              <span
                                className={`block h-full rounded-full ${
                                  isOverLimit ? 'bg-red-600' : 'bg-brand-600'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, used ?? 0))}%` }}
                              />
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="td-num">
                        <span
                          className={[
                            'tabular block font-bold',
                            balance > 0
                              ? isOverLimit
                                ? 'text-red-700'
                                : 'text-ink-900'
                              : 'text-brand-700',
                          ].join(' ')}
                        >
                          {formatPKR(balance)}
                        </span>
                        {isOverLimit ? (
                          <span className="badge mt-1 bg-red-100 text-red-800">Over limit</span>
                        ) : null}
                      </td>

                      {isOwner ? (
                        <td className="td">
                          <RemoveCustomerButton
                            customerId={customer.customer_id}
                            name={customer.name}
                            balance={balance}
                          />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Removed accounts, and the way back. Without this, "removed" would be
          indistinguishable from "lost" - and one of the two things Remove can
          do is only a hide, so the owner has to be able to see what he hid. */}
      {retired.length > 0 ? (
        <>
          <h2 className="section-heading">Removed</h2>
          <p className="mb-3 text-sm text-ink-600">
            Off the customer list and off the credit-slip dropdown. Everything they ever took or
            paid still counts towards the months it belongs to. A name added by mistake can be
            deleted for good from here — only if it never actually traded, and the app will say so
            if it did.
          </p>
          <div className="card table-scroll">
            <table className="w-full min-w-[34rem]">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Customer</th>
                  <th className="th text-right">Owes</th>
                  <th className="th">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {retired.map((customer) => (
                  <tr key={customer.customer_id}>
                    <td className="td">
                      <CustomerCell customer={customer} muted />
                    </td>
                    <td className="td-num text-ink-600">{formatPKR(customer.balance)}</td>
                    {/* Bring back sits beside Delete for good on purpose: the
                        two opposite endings for a removed account, and the
                        recoverable one is named first and coloured as the
                        ordinary choice. */}
                    <td className="td">
                      <div className="flex flex-wrap items-start justify-end gap-x-4 gap-y-1">
                        <RestoreCustomerButton customerId={customer.customer_id} />
                        <PurgeCustomerButton
                          customerId={customer.customer_id}
                          name={customer.name}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
