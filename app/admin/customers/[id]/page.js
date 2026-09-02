import { notFound } from 'next/navigation';

import { requirePageRole, ROLES, formatPKR, formatLitres } from '@/app/_lib/helpers';
import { getCustomerStatement, getLedgerEntriesPage } from '@/app/_lib/data-service';
import PageHeader from '@/app/_components/ui/PageHeader';
import PaymentForm from '@/app/_components/admin/PaymentForm';
import LedgerAdjustmentForm from '@/app/_components/admin/LedgerAdjustmentForm';
import CustomerLedgerTable from '@/app/_components/admin/CustomerLedgerTable';
import EditCustomerButton from '@/app/_components/admin/EditCustomerButton';
import Pager, { pageFrom } from '@/app/_components/ui/Pager';
import FuelBadge from '@/app/_components/ui/FuelBadge';
import { fuelColor } from '@/app/_lib/fuel-colors';
import Button from '@/app/_components/ui/Button';

export async function generateMetadata({ params }) {
  const { id } = await params;
  try {
    const statement = await getCustomerStatement(id);
    return { title: statement?.customer?.name ?? 'Customer' };
  } catch {
    return { title: 'Customer' };
  }
}

const PER_PAGE = 25;

export default async function CustomerDetailPage({ params, searchParams }) {
  const profile = await requirePageRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);
  const { id } = await params;
  const page = pageFrom(await searchParams);

  /*
   * The balance and the fuel breakdown come from the statement RPC, which sums
   * over the whole ledger in Postgres - so paging the ENTRIES here changes only
   * what is listed, never what is owed. That is what makes a database page safe
   * on this screen and not on Purchases.
   */
  const [statement, { rows: entries, total: entryCount, correctedIds }] = await Promise.all([
    getCustomerStatement(id),
    getLedgerEntriesPage(id, { page, perPage: PER_PAGE }),
  ]);

  const customer = statement?.customer;
  if (!customer) notFound();

  const balance = Number(statement.balance ?? 0);
  const limit = customer.credit_limit === null ? null : Number(customer.credit_limit);
  const isOverLimit = limit !== null && balance > limit;

  return (
    <>
      <PageHeader
        title={customer.name}
        description={[customer.vehicle_number, customer.phone].filter(Boolean).join(' · ') || null}
      >
        {/* THE ACTIONS THAT USED TO BE A COLUMN. Recording a payment is the
            reason someone opens this page with a customer standing in front of
            them, so it is the one primary button; the rest of the header is
            navigation. See PaymentForm's own note for why the panel went. */}
        <PaymentForm customerId={customer.id} balance={balance} />
        {profile.role === ROLES.SUPER_ADMIN ? (
          <LedgerAdjustmentForm customerId={customer.id} balance={balance} />
        ) : null}
        <EditCustomerButton customer={customer} />
        <Button variant="secondary" href="/admin/customers">
          Back to customers
        </Button>
      </PageHeader>

      <div className="space-y-6">
        {/* THE TWO SUMMARIES SIDE BY SIDE, so the ledger below gets the whole
            width. They are read once on arrival - what is owed, what has been
            taken - and then the eye goes to the table and stays there.

            `items-start` so each card is only as tall as what is in it. A grid
            stretches its children to the tallest by default, which gave a
            customer with one fuel a band at the top of the card and a hand's
            width of empty paper under it - the thing that reads as broken
            rather than merely uneven. Two cards of different heights is what a
            summary row normally looks like. */}
        <div className="grid items-start gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          {/* ---- balance ---- */}
          <section className="card p-5">
            <p className="figure-label">
              Currently owes
            </p>
            <p
              className={[
                'tabular mt-1 text-4xl font-bold',
                balance > 0 ? (isOverLimit ? 'text-red-700' : 'text-ink-900') : 'text-brand-700',
              ].join(' ')}
            >
              {formatPKR(balance)}
            </p>

            {limit !== null ? (
              <p className={`mt-2 text-sm ${isOverLimit ? 'text-red-700' : 'text-ink-600'}`}>
                Credit limit {formatPKR(limit)}
                {isOverLimit ? ` — over by ${formatPKR(balance - limit)}` : ''}
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-500">No credit limit set.</p>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-ink-200 pt-4">
              <div>
                <dt className="figure-label">
                  Fuel taken
                </dt>
                <dd className="tabular mt-0.5 text-lg font-semibold text-ink-900">
                  {formatPKR(statement.total_debits)}
                </dd>
              </div>
              <div>
                <dt className="figure-label">
                  Paid back
                </dt>
                <dd className="tabular mt-0.5 text-lg font-semibold text-ink-900">
                  {formatPKR(statement.total_credits)}
                </dd>
              </div>
            </dl>
          </section>

          {/* ---- lifetime fuel ---- */}
          {statement.fuel_taken?.length > 0 ? (
            <section className="card p-5">
              <h2 className="mb-3 text-sm font-bold text-ink-900">Fuel taken in total</h2>
              {/* These tiles used to hard-code `bg-sky-50` for petrol and
                  `bg-amber-50` for diesel, which is precisely the drift
                  fuel-colors.js exists to stop - the fuels changed to blue and
                  orange everywhere else and this corner stayed on the old
                  pair. It reads from the module now, and wears the badge
                  rather than its own hand-written label.

                  THE COLUMN COUNT FOLLOWS THE DATA, and this was a real bug
                  rather than a nicety. `sm:grid-cols-2` was unconditional, so a
                  customer who has only ever bought one fuel - most of them -
                  got one tile in the left half and a hole in the right, which
                  read as though the page were waiting for a diesel figure to
                  arrive. Widening the page to 1360px made a small oddity into
                  half an empty card. Only the fuels actually taken are ever in
                  `fuel_taken`, so the grid asks how many there are.

                  AND THE BAND IS HORIZONTAL, badge one side, figures the
                  other. Stacked, a full-width tile is a label with two numbers
                  under it and a stretch of empty paper to their right; spread
                  apart they read as one line - "Petrol ... 68.63 L, Rs 23,101"
                  - which is how the same pair reads on the Stock page. It also
                  survives the narrow case, where two bands sit side by side. */}
              <div
                className={`grid gap-3 ${
                  statement.fuel_taken.length > 1 ? 'sm:grid-cols-2' : ''
                }`}
              >
                {statement.fuel_taken.map((row) => {
                  const color = fuelColor(row.fuel_type);
                  return (
                    <div
                      key={row.fuel_type}
                      className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border-l-4 bg-ink-50 p-3 ${color.border}`}
                    >
                      <FuelBadge fuelType={row.fuel_type} />
                      <div className="text-right">
                        <p className="tabular text-xl font-bold text-ink-900">
                          {formatLitres(row.litres)}
                        </p>
                        <p className="tabular text-sm text-ink-600">{formatPKR(row.amount)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

        </div>

        {/* ---- history ---- */}
        <section>
          <h2 className="section-heading">Transaction history</h2>

          <p className="mb-3 max-w-[70ch] text-sm text-ink-600">
            Fuel taken on credit reaches this ledger by itself, from the readings screen. Nothing
            here is ever edited or deleted — a mistake is corrected with a new entry pointing the
            other way, so the history always adds up.
          </p>

          <CustomerLedgerTable
            entries={entries}
            correctedIds={correctedIds}
            customerId={customer.id}
            balance={balance}
            canCorrect={profile.role === ROLES.SUPER_ADMIN}
          />

          <Pager
            page={page}
            perPage={PER_PAGE}
            total={entryCount}
            hrefFor={(n) => `/admin/customers/${id}?page=${n}`}
            label="Ledger pages"
          />
        </section>
      </div>
    </>
  );
}
