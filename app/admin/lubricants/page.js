import {
  requirePageRole,
  ROLES,
  todayISO,
  shiftISODate,
  formatDate,
  formatLitres,
  formatPKR,
  formatRate,
} from '@/app/_lib/helpers';
import {
  getLubricantDay,
  getLubricantStock,
  getLubricants,
  getCustomers,
} from '@/app/_lib/data-service';
import PageHeader from '@/app/_components/ui/PageHeader';
import EmptyState from '@/app/_components/ui/EmptyState';
import PendingLink from '@/app/_components/ui/PendingLink';
import DateNav from '@/app/_components/admin/DateNav';
import LubricantSaleForm from '@/app/_components/admin/LubricantSaleForm';
import LubricantManager from '@/app/_components/admin/LubricantManager';
import DeleteLubricantSaleButton from '@/app/_components/admin/DeleteLubricantSaleButton';
import { StatTile, StatGrid } from '@/app/_components/admin/AdminStats';

export const metadata = { title: 'Lubricants' };

/**
 * The lubricant counter: what was sold today, and what is left to sell.
 *
 * Its own section rather than a corner of Readings, because the two are
 * recorded in completely different ways. A day of fuel is worked out once, from
 * six meters. Oil is sold one tin at a time all day, so each sale is its own
 * row - which is also what makes a customer's credit slip for a carton land on
 * the same ledger as their diesel.
 *
 * Everything on the page follows the date in the header, the same as Readings
 * and Stock, so yesterday can be finished off this morning.
 */
export default async function LubricantsPage({ searchParams }) {
  const profile = await requirePageRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);
  const isOwner = profile.role === ROLES.SUPER_ADMIN;

  const params = await searchParams;
  const date =
    typeof params?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : todayISO();

  const [day, stock, products, customers] = await Promise.all([
    getLubricantDay(date),
    getLubricantStock(date),
    // The manager needs retired products too, so a brand can be brought back.
    isOwner ? getLubricants({ includeRetired: true }) : Promise.resolve([]),
    getCustomers(),
  ]);

  const totals = day.totals ?? {};
  const sales = day.sales ?? [];

  // Only what is still stocked can be sold. Retired products stay in `stock`
  // while they have something left on the shelf, but they are not offered.
  const sellable = stock.filter((row) => row.is_active);

  const amount = Number(totals.amount ?? 0);
  const creditAmount = Number(totals.credit_amount ?? 0);
  const creditShare = amount > 0 ? Math.round((creditAmount / amount) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Lubricants"
        description={`Counter sales for ${formatDate(date)}. Stock is kept in litres, packs and loose oil alike.`}
      />

      {/* The day's controls and the day's actions share a row of their own,
          rather than riding along in PageHeader's children the way a single
          button does.

          Why: this page carries more in that row than any other - two arrows,
          a date box, two actions - and "Back to today" appears only when the
          date is not today. Passed to PageHeader, that one conditional button
          was enough to tip the whole group over the wrap threshold, so the
          header jumped between one row and two as you stepped from today to
          yesterday and back. Given its own row the group cannot wrap against
          the title at all, and the controls stay exactly where they were on
          the previous day. Checked at 1440/1152/1024 and 400px, on today and
          on an older date. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <DateNav
          date={date}
          basePath="/admin/lubricants"
          previousDate={shiftISODate(date, -1)}
          nextDate={shiftISODate(date, 1)}
        />
        <div className="flex flex-wrap items-center gap-2">
          {isOwner ? <LubricantManager lubricants={products} /> : null}
          <LubricantSaleForm
            lubricants={sellable}
            customers={customers}
            date={date}
            dateLabel={formatDate(date)}
          />
        </div>
      </div>

      {sellable.length === 0 ? (
        <EmptyState
          title="No lubricants on the shelf yet"
          description={
            isOwner
              ? 'Add the brands the pump stocks with “Manage lubricants” above. Once a lubricant is on the list it can be sold here, restocked from Purchases, and it will show up in the month’s report.'
              : 'Ask the owner to add the lubricants the pump stocks. They will appear here once they have.'
          }
        />
      ) : (
        <>
          <div className="mb-6" aria-label="Lubricant sales for the day">
            <StatGrid>
              <StatTile label="Sales" value={String(Number(totals.sales_count ?? 0))} />
              <StatTile label="Litres sold" value={formatLitres(totals.litres)} />
              <StatTile label="Cash" value={formatPKR(totals.cash_amount)} />
              <StatTile
                label="On credit"
                value={formatPKR(creditAmount)}
                sub={amount > 0 ? `${creditShare}% of the day` : null}
              />
            </StatGrid>
          </div>

          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-600">
            Sold on {formatDate(date)}
          </h2>

          {sales.length === 0 ? (
            <EmptyState
              title="Nothing sold yet on this date"
              description="Record a sale with the button above. Cash or credit, a sealed pack or a loose pour — it all comes off the same stock."
            />
          ) : (
            <div className="card table-scroll">
              <table className="w-full min-w-[46rem]">
                <thead className="border-b border-ink-200 bg-ink-50">
                  <tr>
                    <th className="th">Lubricant</th>
                    <th className="th text-right">Litres</th>
                    <th className="th text-right">Rate</th>
                    <th className="th text-right">Amount</th>
                    <th className="th text-right">Cash</th>
                    <th className="th text-right">Credit</th>
                    <th className="th">Customer</th>
                    {isOwner ? (
                      <th className="th">
                        <span className="sr-only">Actions</span>
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="td">
                        <span className="font-medium">{sale.name}</span>
                        {sale.note ? (
                          <span className="block text-sm text-ink-600">{sale.note}</span>
                        ) : null}
                      </td>
                      <td className="td-num">{formatLitres(sale.litres)}</td>
                      <td className="td-num text-ink-500">{formatRate(sale.rate_per_litre)}</td>
                      <td className="td-num font-semibold">{formatPKR(sale.amount)}</td>
                      <td className="td-num">{formatPKR(sale.cash_amount)}</td>
                      <td
                        className={`td-num ${
                          Number(sale.credit_amount) > 0 ? 'font-semibold text-amber-800' : 'text-ink-400'
                        }`}
                      >
                        {Number(sale.credit_amount) > 0 ? formatPKR(sale.credit_amount) : '—'}
                      </td>
                      <td className="td">
                        {sale.customer_id ? (
                          <PendingLink
                            href={`/admin/customers/${sale.customer_id}`}
                            className="font-medium text-brand-700 underline"
                          >
                            {sale.customer_name}
                          </PendingLink>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      {isOwner ? (
                        <td className="td">
                          <DeleteLubricantSaleButton
                            saleId={sale.id}
                            summary={`${formatLitres(sale.litres)} of ${sale.name}`}
                          />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* The shelf, as at the date on screen. Here as well as on Stock
              because it is what someone recording a sale needs to know, and
              sending them to another tab to find it is how a sale gets typed
              against a product that ran out last week. */}
          <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wide text-ink-600">
            On the shelf
          </h2>
          <div className="card table-scroll">
            <table className="w-full min-w-[34rem]">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Lubricant</th>
                  <th className="th text-right">Pack</th>
                  <th className="th text-right">Bought</th>
                  <th className="th text-right">Sold</th>
                  <th className="th text-right">In stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {stock.map((row) => {
                  const left = Number(row.stock_litres ?? 0);
                  return (
                    <tr key={row.id}>
                      <td className="td font-medium">
                        {row.name}
                        {row.is_active ? null : (
                          <span className="badge ml-2 bg-ink-100 text-ink-600">retired</span>
                        )}
                      </td>
                      <td className="td-num text-ink-500">{formatLitres(row.pack_size_litres)}</td>
                      <td className="td-num">{formatLitres(row.purchased_litres)}</td>
                      <td className="td-num">{formatLitres(row.sold_litres)}</td>
                      <td
                        className={[
                          'td-num font-bold',
                          left <= 0 ? 'text-red-700' : left < Number(row.pack_size_litres) ? 'text-amber-800' : 'text-ink-900',
                        ].join(' ')}
                      >
                        {formatLitres(left)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 rounded-lg border border-ink-200 bg-white px-4 py-3 text-xs text-ink-600">
            Stock counts everything bought and sold up to {formatDate(date)}. Restock a lubricant
            from{' '}
            <PendingLink href="/admin/purchases" className="font-semibold text-brand-700 underline">
              Purchases
            </PendingLink>
            , where it sits alongside the fuel deliveries.
          </p>
        </>
      )}
    </>
  );
}

