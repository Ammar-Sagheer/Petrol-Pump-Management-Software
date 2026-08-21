import {
  requirePageRole,
  ROLES,
  formatDate,
  formatPKR,
  formatNumber,
} from '@/app/_lib/helpers';
import { getTreasuryOverview, getTreasuryLedgerPage } from '@/app/_lib/data-service';
import { treasuryCategoryLabel } from '@/app/_lib/treasury-categories';
import PageHeader from '@/app/_components/ui/PageHeader';
import EmptyState from '@/app/_components/ui/EmptyState';
import Icon from '@/app/_components/ui/Icon';
import Pager, { pageFrom } from '@/app/_components/ui/Pager';
import { StatTile, StatGrid } from '@/app/_components/admin/AdminStats';
import CategoryBreakdown from '@/app/_components/admin/CategoryBreakdown';
import TrendRange, { trendDaysFrom } from '@/app/_components/admin/TrendRange';
import TreasuryBalanceChart from '@/app/_components/admin/TreasuryBalanceChart';
import TreasuryEntryForm from '@/app/_components/admin/TreasuryEntryForm';
import DeleteTreasuryEntryButton from '@/app/_components/admin/DeleteTreasuryEntryButton';

export const metadata = { title: 'Treasury' };

/**
 * The cash in the safe on the pump site.
 *
 * WHAT THIS IS FOR. Money physically kept on site, in notes: the day's takings
 * before they are banked, cash lent to people and taken back, cash handed to a
 * supplier against a purchase code, and a working float for whatever the pump
 * needs paying for that hour. None of it is in the banking system, so nothing
 * else in this app knows about it - before this page the only record was an
 * Excel sheet called "Tajori" with five columns, and the balance in it was a
 * formula nobody could check without opening the file.
 *
 * IT IS THAT SHEET, IN THE SAME ORDER, WITH THE SAME RUNNING BALANCE. That is
 * deliberate down to the column headings: the owner has read this layout every
 * day for months and the app's job is to stop him needing the laptop, not to
 * teach him a new way to look at his own money. What it adds is the three
 * things the spreadsheet could not do - a balance he can trust because a
 * database computed it, a picture of the week, and a reason on every line that
 * can be added up.
 *
 * Owner only, like Banking and Expenses. This is his own cash.
 */
const PER_PAGE = 25;

/*
 * THE BALANCE COLUMN IS PINNED, AND THE DATE COLUMN IS NOT.
 *
 * `RegisterTable` established the pattern (see "A table too wide to read: pin
 * the ends, scroll the middle" in docs/UI_CONVENTIONS.md) and pins BOTH ends.
 * This table pins one, deliberately. The register's middle is eight columns
 * wide, so two pinned ends still leave something worth scrolling; this one's
 * middle is four, and at 400px a second pinned column would leave about 140px
 * of scrollport for a reason, an amount in and an amount out — which is the
 * "at 400px the pinned columns are very nearly the whole table" failure the
 * register wrote down, arrived at from the other direction.
 *
 * So the right-hand end is pinned and the date scrolls. The balance is what
 * this page exists to show — it is the column the owner kept the spreadsheet
 * for — and it was off the right-hand edge on a phone before this. The date is
 * the first thing on screen at rest, and the rows are tall and few.
 *
 * THE BALANCE AND THE DELETE BUTTON SHARE ONE CELL, and that is not tidiness.
 * As two pinned cells the outer one needs `right: <width of everything right
 * of it>`, which the convention warns about in as many words — and the number
 * was wrong: the action column is 3rem of button plus the `.td` padding, so it
 * renders at 68px, and offsetting the balance by 3rem painted the last 8px of
 * every figure underneath it. `Rs 1,781,910` lost its last digit on a phone
 * and the DOM check said nothing, because the text was not overflowing its own
 * box — another cell was simply on top of it. One cell at `right: 0` has no
 * offset to get wrong.
 *
 * It also keeps the delete button reachable. Pinned alone at `right: 0`, the
 * balance would sit over the action column at every scroll position and the
 * button could never be tapped.
 *
 * Opaque white — a pinned cell that is not lets the row slide through it — and
 * white rather than a tint because, unlike the register's cumulative block,
 * this is not a group of its own; it is the end of an ordinary table that
 * happens to stay put.
 */
const PIN_RIGHT = 'pinned pinned-right';
const BALANCE_PIN = {
  right: 0,
  width: '11rem',
  minWidth: '11rem',
  backgroundColor: '#fff',
};

export default async function TreasuryPage({ searchParams }) {
  await requirePageRole(ROLES.SUPER_ADMIN);

  const params = await searchParams;
  const page = pageFrom(params);
  const days = trendDaysFrom(params);

  const [overview, ledger] = await Promise.all([
    getTreasuryOverview(days),
    getTreasuryLedgerPage({ page, perPage: PER_PAGE }),
  ]);

  const balance = Number(overview?.balance ?? 0);
  const daily = overview?.daily ?? [];
  const { entries, total } = ledger;

  /*
   * The sparkline is the safe's closing balance day by day - the same series
   * the chart's line draws, so the shape in the tile and the shape further
   * down the page are the same shape. Its readouts are formatted HERE, on the
   * server: Sparkline cannot format, deliberately, because a formatter does
   * not cross the server/client boundary and re-implementing PKR in there is
   * how two parts of one app start writing money two ways.
   */
  const spark = daily.map((row) => Number(row.closing ?? 0));
  const sparkTips = daily.map((row) => ({
    v: formatPKR(row.closing),
    d: formatDate(row.day),
  }));

  const outByCategory = (overview?.out_by_category ?? []).map((row) => [
    treasuryCategoryLabel('out', row.category),
    Number(row.amount ?? 0),
  ]);
  const inByCategory = (overview?.in_by_category ?? []).map((row) => [
    treasuryCategoryLabel('in', row.category),
    Number(row.amount ?? 0),
  ]);

  const windowIn = Number(overview?.window_in ?? 0);
  const windowOut = Number(overview?.window_out ?? 0);

  /*
   * "14 days to 21 Aug 2026", not "over the last 14 days".
   *
   * The window ends at the LAST ENTRY rather than at today (migration 046), so
   * on any day nothing has been written down yet the two are different dates -
   * and "the last 14 days" would be describing a window that had quietly
   * stopped moving. Naming the day it ends on costs four words and cannot go
   * stale. On a day the sheet is up to date it reads as today's date, which is
   * what it is.
   */
  const windowLabel = overview?.window_to
    ? `${days} days to ${formatDate(overview.window_to)}`
    : `Over the last ${days} days`;

  /* The window control and the pager share a URL, so each has to carry the
     other's parameter or pressing one would silently reset the other. */
  const hrefWith = (next) => {
    const query = new URLSearchParams({ page: String(page), days: String(days), ...next });
    return `/admin/treasury?${query.toString()}`;
  };

  const isEmpty = total === 0 && Number(overview?.entry_count ?? 0) === 0;

  return (
    <>
      <PageHeader
        title="Treasury"
        description="The cash kept in the safe on site — what came in, what went out, what is left."
      >
        {/* The one thing this page is opened to do, so it is the one button in
            the header rather than a form competing with the table for width -
            see TreasuryEntryForm on why it is not standing open beside it. */}
        {isEmpty ? null : <TreasuryEntryForm balance={balance} />}
      </PageHeader>

      {isEmpty ? (
        <EmptyState
          title="Nothing in the safe yet"
          description="Record what the safe already holds as “Already in the safe”, then add each movement as it happens. Every line after that carries the balance with it."
        >
          <TreasuryEntryForm balance={0} trigger="empty" />
        </EmptyState>
      ) : (
        <>
          <section aria-label="The safe at a glance" className="mb-6">
            <StatGrid columns={4}>
              <StatTile
                icon="treasury"
                label="In the safe now"
                value={formatPKR(balance)}
                tone={balance < 0 ? 'negative' : 'default'}
                spark={spark.length > 1 ? spark : undefined}
                sparkTips={spark.length > 1 ? sparkTips : undefined}
              />
              <StatTile
                icon="moneyIn"
                label="Cash in"
                value={formatPKR(windowIn)}
                sub={windowLabel}
              />
              <StatTile
                icon="moneyOut"
                label="Cash out"
                value={formatPKR(windowOut)}
                sub={windowLabel}
              />
              <StatTile
                icon="list"
                label="Entries recorded"
                value={formatNumber(overview?.entry_count ?? 0)}
                sub={
                  overview?.first_date
                    ? `Since ${formatDate(overview.first_date)}`
                    : undefined
                }
              />
            </StatGrid>
          </section>

          <div className="card mb-6 p-4">
            {/* The heading and the window control share a line, and the control
                keeps the reader where they are (`scroll={false}` inside
                TrendRange) - the only thing that changes is inside this card. */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-ink-900">Day by day</h2>
                <p className="text-sm text-ink-600">
                  What went in, what came out, and what the safe was left holding each evening.
                </p>
              </div>
              <TrendRange days={days} hrefFor={(window) => hrefWith({ days: String(window) })} />
            </div>

            <TreasuryBalanceChart daily={daily} />
          </div>

          {/* Two breakdowns rather than one, because the safe has two stories
              and only one of them is the usual "where did it go". Where the
              cash CAME FROM is the check on whether the day's takings are
              actually reaching the safe. */}
          {outByCategory.length > 0 || inByCategory.length > 0 ? (
            <div className="mb-2 grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
              {inByCategory.length > 0 ? (
                <CategoryBreakdown
                  title="Where it came from"
                  rows={inByCategory}
                  total={windowIn}
                />
              ) : null}
              {outByCategory.length > 0 ? (
                <CategoryBreakdown title="Where it went" rows={outByCategory} total={windowOut} />
              ) : null}
            </div>
          ) : null}

          {/* The table gets the whole page. Six columns, three of them money
              that must not wrap, is more than the 1fr track of a form-beside-a-
              table split can hold at this app's max-w-6xl cap. */}
          <div>
            <div>
              <h2 className="section-heading">Entries</h2>

              {entries.length === 0 ? (
                <EmptyState
                  title="Nothing on this page"
                  description="Go back a page, or record the first entry using the form."
                />
              ) : (
                <div className="card table-scroll has-pinned-columns">
                  <table className="w-full min-w-[46rem]">
                    <thead className="border-b border-ink-200 bg-ink-50">
                      <tr>
                        <th className="th">Date</th>
                        <th className="th">What for</th>
                        <th className="th text-right">In</th>
                        <th className="th text-right">Out</th>
                        <th className={`th text-right ${PIN_RIGHT}`} style={BALANCE_PIN}>
                          Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100">
                      {entries.map((entry) => {
                        const isIn = entry.direction === 'in';
                        const label = treasuryCategoryLabel(entry.direction, entry.category);
                        const balanceAfter = Number(entry.balance_after ?? 0);

                        return (
                          <tr key={entry.id}>
                            <td className="td whitespace-nowrap">{formatDate(entry.entry_date)}</td>
                            <td className="td">
                              <span>{label}</span>
                              {/* The owner's own words, under the reason he
                                  picked. Left to wrap - "Munir sb by Hamza
                                  saqib for sylage" is a real line and
                                  truncating it would lose the only part that
                                  says who is holding the money. */}
                              {entry.details ? (
                                <span className="block text-sm text-ink-600">{entry.details}</span>
                              ) : null}
                            </td>
                            {/* The arrow is the second cue beside the colour,
                                per the icons rule - the two columns are
                                otherwise identical in shape, and green-vs-amber
                                alone is what a colourblind reader cannot use. */}
                            <td className="td-num font-semibold text-brand-700">
                              {isIn ? (
                                <span className="inline-flex items-center justify-end gap-1.5">
                                  <Icon name="moneyIn" className="h-4 w-4" />
                                  {formatPKR(entry.amount)}
                                </span>
                              ) : (
                                ''
                              )}
                            </td>
                            <td className="td-num font-semibold text-amber-800">
                              {isIn ? (
                                ''
                              ) : (
                                <span className="inline-flex items-center justify-end gap-1.5">
                                  <Icon name="moneyOut" className="h-4 w-4" />
                                  {formatPKR(entry.amount)}
                                </span>
                              )}
                            </td>
                            {/* The column the sheet was really kept for. Set
                                in ink rather than in either movement colour:
                                it is not money arriving or leaving, it is
                                what was there afterwards. */}
                            <td className={`td-num ${PIN_RIGHT}`} style={BALANCE_PIN}>
                              <span className="flex items-center justify-end gap-1">
                                <span
                                  className={`font-bold ${
                                    balanceAfter < 0 ? 'text-red-700' : 'text-ink-900'
                                  }`}
                                >
                                  {formatPKR(balanceAfter)}
                                </span>
                                <DeleteTreasuryEntryButton
                                  entryId={entry.id}
                                  summary={`${formatPKR(entry.amount)} ${
                                    isIn ? 'in' : 'out'
                                  } on ${formatDate(entry.entry_date)}`}
                                />
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <Pager
                page={page}
                perPage={PER_PAGE}
                total={total}
                hrefFor={(n) => hrefWith({ page: String(n) })}
                label="Treasury pages"
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
