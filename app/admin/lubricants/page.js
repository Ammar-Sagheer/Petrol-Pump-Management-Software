import {
  requirePageRole,
  ROLES,
  todayISO,
  shiftISODate,
  formatDate,
  formatLitres,
  formatLitresFine,
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
import Pager, { pageFrom } from '@/app/_components/ui/Pager';

export const metadata = { title: 'Lubricants' };

/*
 * A day, not a history - so this is bounded by how much can be sold in one day
 * rather than growing forever. It is paged anyway: a busy Saturday can run to
 * dozens of sales, and the shelf table below them is the thing that then
 * becomes unreachable. Sliced from the day already fetched, because the RPC
 * returns the whole day in one round trip and the totals above are worked out
 * from all of it.
 */
const PER_PAGE = 20;

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
  const page = pageFrom(params);
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

  /*
   * This page is the SHELF. The drum has its own page, because a run of
   * rupee-priced pours reads nothing like a handful of carton sales and each
   * was burying the other in one table.
   *
   * The split is by product, not by how the row was typed: `sold_loose` lives
   * on the lubricant, so a sale can only ever belong to one of the two pages.
   * The shelf table at the bottom deliberately keeps BOTH - it is stock on
   * hand, and someone checking what is in the building wants the whole answer
   * in one place.
   */
  const packSales = (day.sales ?? []).filter((sale) => !sale.sold_loose);
  const sellable = stock.filter((row) => row.is_active && !row.sold_loose);
  const hasDrum = stock.some((row) => row.sold_loose);

  // The RPC totals the day and the drum; the shelf is the difference. Derived
  // here rather than added to the RPC as a third set of sums that could fall
  // out of step with the other two.
  const packAmount = Number(totals.pack_amount ?? 0);
  const packCash = Number(totals.cash_amount ?? 0) - Number(totals.loose_cash ?? 0);
  const packCredit = Number(totals.credit_amount ?? 0) - Number(totals.loose_credit ?? 0);
  const creditShare = packAmount > 0 ? Math.round((packCredit / packAmount) * 100) : 0;

  const pageSales = packSales.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const looseCount = Number(totals.loose_count ?? 0);
  const looseAmount = Number(totals.loose_amount ?? 0);

  return (
    <>
      <PageHeader
        title="Lubricants"
        description="Counter sales. Stock is kept in litres, packs and loose oil alike."
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

      {/* A pump that keeps only a drum is a real setup, and it must not land on
          "nothing here" - the drum's page is where its work happens, so send
          them there rather than telling them to add a carton they do not sell. */}
      {sellable.length === 0 && hasDrum ? (
        <EmptyState
          title="Nothing packed on the shelf"
          description="This pump sells loose oil only. Record those sales on the loose oil page."
        >
          <PendingLink href={`/admin/lubricants/loose?date=${date}`} className="btn-primary">
            Go to loose oil
          </PendingLink>
        </EmptyState>
      ) : sellable.length === 0 ? (
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
          <div className="mb-6" aria-label="Packed lubricant sales for the day">
            <StatGrid>
              <StatTile label="Sales" value={String(Number(totals.pack_count ?? 0))} />
              <StatTile label="Litres sold" value={formatLitres(totals.pack_litres)} />
              <StatTile label="Cash" value={formatPKR(packCash)} />
              <StatTile
                label="On credit"
                value={formatPKR(packCredit)}
                sub={packAmount > 0 ? `${creditShare}% of the shelf` : null}
              />
            </StatGrid>
          </div>

          {/* The drum's day, summarised with a way through to it. Here rather
              than only in the nav because someone standing on this page has
              just recorded a sale and is the person most likely to need the
              other kind next - and because a day is not finished until both
              halves are in. */}
          {hasDrum ? (
            <PendingLink
              href={`/admin/lubricants/loose?date=${date}`}
              className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-ink-200 bg-white px-4 py-3 hover:border-brand-600 hover:bg-brand-50"
            >
              <span>
                <span className="block text-sm font-bold text-ink-900">Loose oil</span>
                <span className="block text-sm text-ink-600">
                  Sold by the rupee, out of the drum
                </span>
              </span>
              <span className="flex items-center gap-6">
                <span className="text-right">
                  <span className="figure-label block">Sales</span>
                  <span className="figure-value block">{looseCount}</span>
                </span>
                <span className="text-right">
                  <span className="figure-label block">Taken</span>
                  <span className="figure-value block whitespace-nowrap">
                    {formatPKR(looseAmount)}
                  </span>
                </span>
                <span aria-hidden="true" className="text-lg font-bold text-brand-700">
                  →
                </span>
              </span>
            </PendingLink>
          ) : null}

          <h2 className="section-heading">
            Sold on {formatDate(date)}
          </h2>

          {packSales.length === 0 ? (
            <EmptyState
              title="Nothing sold yet on this date"
              description="Record a sale with the button above. A sealed carton or a bottle off the shelf — cash or credit."
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
                  {pageSales.map((sale) => (
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

          {packSales.length > 0 ? (
            <Pager
              page={page}
              perPage={PER_PAGE}
              total={packSales.length}
              hrefFor={(n) => `/admin/lubricants?date=${date}&page=${n}`}
              label="Sale pages"
            />
          ) : null}

          {/* The shelf, as at the date on screen. Here as well as on Stock
              because it is what someone recording a sale needs to know, and
              sending them to another tab to find it is how a sale gets typed
              against a product that ran out last week. */}
          <h2 className="section-heading">
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
                        {row.sold_loose ? (
                          <span className="badge ml-2 bg-amber-100 text-amber-900">loose</span>
                        ) : null}
                        {row.is_active ? null : (
                          <span className="badge ml-2 bg-ink-100 text-ink-600">retired</span>
                        )}
                      </td>
                      {/* A drum has no pack size worth printing, and its
                          quantities are fractions of a litre - so it gets the
                          finer formatter while the shelf keeps the plain one. */}
                      <td className="td-num text-ink-500">
                        {row.sold_loose ? '—' : formatLitres(row.pack_size_litres)}
                      </td>
                      <td className="td-num">{formatLitres(row.purchased_litres)}</td>
                      <td className="td-num">
                        {row.sold_loose
                          ? formatLitresFine(row.sold_litres)
                          : formatLitres(row.sold_litres)}
                      </td>
                      <td
                        className={[
                          'td-num font-bold',
                          left <= 0
                            ? 'text-red-700'
                            : left < (row.sold_loose ? 10 : Number(row.pack_size_litres))
                              ? 'text-amber-800'
                              : 'text-ink-900',
                        ].join(' ')}
                      >
                        {row.sold_loose ? formatLitresFine(left) : formatLitres(left)}
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

