import {
  requirePageRole,
  ROLES,
  todayISO,
  shiftISODate,
  formatDate,
  formatLitresFine,
  formatPKR,
  formatRate,
} from '@/app/_lib/helpers';
import { getLubricantDay, getLubricantStock, getCustomers } from '@/app/_lib/data-service';
import PageHeader from '@/app/_components/ui/PageHeader';
import EmptyState from '@/app/_components/ui/EmptyState';
import PendingLink from '@/app/_components/ui/PendingLink';
import DateNav from '@/app/_components/admin/DateNav';
import LooseOilSaleForm from '@/app/_components/admin/LooseOilSaleForm';
import DeleteLubricantSaleButton from '@/app/_components/admin/DeleteLubricantSaleButton';
import { StatTile, StatGrid } from '@/app/_components/admin/AdminStats';
import Pager, { pageFrom } from '@/app/_components/ui/Pager';

export const metadata = { title: 'Loose oil' };

/*
 * Smaller pages than the shelf, because this is the table that gets long. Each
 * pour is its own row and they are small and frequent - the whole reason the
 * drum has a page of its own - so a busy day here is dozens of rows where the
 * shelf has four.
 */
const PER_PAGE = 20;

/**
 * The drum: oil bought by the barrel and sold across the counter in rupees.
 *
 * ITS OWN PAGE, UNDER LUBRICANTS. The stock is a lubricant like any other and
 * shares all the same machinery - the same table, the same ledger posting, the
 * same monthly report line. What is different is the shape of the WORK. The
 * shelf is a handful of sales a day, each one a named product and a quantity.
 * The drum is a long run of small cash amounts with no product to choose and no
 * quantity to type. Mixing the two into one screen meant a table where most
 * rows said "Loose Oil ... 0.034 L" and buried the four carton sales that
 * actually need reading.
 *
 * Everything follows the date in the header, the same as Readings, Stock and
 * Lubricants, so yesterday can be finished off this morning.
 */
export default async function LooseOilPage({ searchParams }) {
  const profile = await requirePageRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);
  const isOwner = profile.role === ROLES.SUPER_ADMIN;

  const params = await searchParams;
  const page = pageFrom(params);
  const date =
    typeof params?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : todayISO();

  const [day, stock, customers] = await Promise.all([
    getLubricantDay(date),
    getLubricantStock(date),
    getCustomers(),
  ]);

  const totals = day.totals ?? {};
  // Every drum, and the ones still sellable. A drum that has been retired but
  // still has oil in it belongs on the stock list and not on the sale form -
  // the same rule the shelf follows.
  const drums = stock.filter((row) => row.sold_loose);
  const sellable = drums.filter((row) => row.is_active);

  const sales = (day.sales ?? []).filter((sale) => sale.sold_loose);

  const pageSales = sales.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const looseAmount = Number(totals.loose_amount ?? 0);
  const looseCredit = Number(totals.loose_credit ?? 0);
  const looseCash = Number(totals.loose_cash ?? 0);

  return (
    <>
      <PageHeader
        title="Loose oil"
        description="Oil poured from the drum and sold by the rupee. The litres are worked out from the drum’s rate."
      />

      {/* Same arrangement as the Lubricants page: the day's controls and the
          day's actions get a row of their own, so the header cannot jump
          between one line and two as the date changes. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <DateNav
          date={date}
          basePath="/admin/lubricants/loose"
          previousDate={shiftISODate(date, -1)}
          nextDate={shiftISODate(date, 1)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <PendingLink href={`/admin/lubricants?date=${date}`} className="btn-secondary">
            Packed lubricants
          </PendingLink>
          <LooseOilSaleForm
            drums={sellable}
            customers={customers}
            date={date}
            dateLabel={formatDate(date)}
          />
        </div>
      </div>

      {drums.length === 0 ? (
        <EmptyState
          title="No drum set up yet"
          description={
            isOwner
              ? 'Open “Manage lubricants” on the Lubricants page, add the drum and choose “Loose oil” as the kind. Give it a selling rate per litre — that is what turns “Rs 20 of oil” into litres off the drum.'
              : 'Ask the owner to set the loose oil drum up. It will appear here once they have.'
          }
        />
      ) : (
        <>
          <div className="mb-6" aria-label="Loose oil sold on the day">
            <StatGrid>
              <StatTile label="Sales" value={String(Number(totals.loose_count ?? 0))} />
              <StatTile label="Taken" value={formatPKR(looseAmount)} />
              <StatTile
                label="Off the drum"
                value={formatLitresFine(totals.loose_litres)}
                sub="worked out from the rate"
              />
              <StatTile
                label="Cash"
                value={formatPKR(looseCash)}
                sub={looseCredit > 0 ? `${formatPKR(looseCredit)} on credit` : null}
              />
            </StatGrid>
          </div>

          <h2 className="section-heading">Sold on {formatDate(date)}</h2>

          {sales.length === 0 ? (
            <EmptyState
              title="Nothing off the drum yet on this date"
              description="Record a sale with the button above. Type what the customer paid — Rs 20, Rs 50 — and the litres follow from the rate."
            />
          ) : (
            <div className="card table-scroll">
              <table className="w-full min-w-[42rem]">
                <thead className="border-b border-ink-200 bg-ink-50">
                  <tr>
                    <th className="th">Amount</th>
                    <th className="th text-right">Off the drum</th>
                    <th className="th text-right">Rate</th>
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
                  {pageSales.map((sale) => (
                    <tr key={sale.id}>
                      {/* The money leads, because it is the number that was
                          typed and the one the owner is checking against the
                          cash in the drawer. */}
                      <td className="td">
                        {/* nowrap: the note underneath is free text and pulls
                            this column narrow, and at phone widths "Rs 1,160"
                            was breaking after the "Rs" - which reads for a
                            moment as two separate figures. The column may
                            widen and the table may scroll; the number may not
                            break. */}
                        <span className="tabular whitespace-nowrap text-lg font-bold text-ink-900">
                          {formatPKR(sale.amount)}
                        </span>
                        {sale.note ? (
                          <span className="block text-sm text-ink-600">{sale.note}</span>
                        ) : null}
                      </td>
                      <td className="td-num">{formatLitresFine(sale.litres)}</td>
                      <td className="td-num text-ink-500">{formatRate(sale.rate_per_litre)}</td>
                      <td className="td-num">{formatPKR(sale.cash_amount)}</td>
                      <td
                        className={`td-num ${
                          Number(sale.credit_amount) > 0
                            ? 'font-semibold text-amber-800'
                            : 'text-ink-400'
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
                            summary={`${formatPKR(sale.amount)} of ${sale.name}`}
                          />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {sales.length > 0 ? (
            <Pager
              page={page}
              perPage={PER_PAGE}
              total={sales.length}
              hrefFor={(n) => `/admin/lubricants/loose?date=${date}&page=${n}`}
              label="Sale pages"
            />
          ) : null}

          <h2 className="section-heading">In the drum</h2>
          <div className="card table-scroll">
            <table className="w-full min-w-[34rem]">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Drum</th>
                  <th className="th text-right">Rate a litre</th>
                  <th className="th text-right">Bought</th>
                  <th className="th text-right">Poured</th>
                  <th className="th text-right">Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {drums.map((row) => {
                  const left = Number(row.stock_litres ?? 0);
                  return (
                    <tr key={row.id}>
                      <td className="td font-medium">
                        {row.name}
                        {row.is_active ? null : (
                          <span className="badge ml-2 bg-ink-100 text-ink-600">retired</span>
                        )}
                      </td>
                      <td className="td-num text-ink-500">
                        {Number(row.sale_rate_per_litre) > 0
                          ? formatRate(row.sale_rate_per_litre)
                          : '—'}
                      </td>
                      <td className="td-num">{formatLitresFine(row.purchased_litres)}</td>
                      <td className="td-num">{formatLitresFine(row.sold_litres)}</td>
                      <td
                        className={[
                          'td-num font-bold',
                          left <= 0 ? 'text-red-700' : left < 10 ? 'text-amber-800' : 'text-ink-900',
                        ].join(' ')}
                      >
                        {formatLitresFine(left)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 rounded-lg border border-ink-200 bg-white px-4 py-3 text-xs text-ink-600">
            What comes off the drum is worked out from its rate, not measured — so if the level here
            drifts from the level in the shed, the rate is the first thing to check. A new drum is
            recorded from{' '}
            <PendingLink href="/admin/purchases" className="font-semibold text-brand-700 underline">
              Purchases
            </PendingLink>
            , alongside the fuel deliveries.
          </p>
        </>
      )}
    </>
  );
}
