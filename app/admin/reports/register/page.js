import { Fragment } from 'react';

import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';

import { requirePageRole, ROLES, todayISO, formatDate, formatPKR } from '@/app/_lib/helpers';
import { getStockRegister, getRangeSummary } from '@/app/_lib/data-service';
import { fuelColor, byFuelOrder } from '@/app/_lib/fuel-colors';
import PageHeader from '@/app/_components/ui/PageHeader';
import EmptyState from '@/app/_components/ui/EmptyState';
import RegisterRange from '@/app/_components/admin/RegisterRange';
import RegisterTable from '@/app/_components/admin/RegisterTable';
import { FuelCard, MoneyTile } from '@/app/_components/admin/RegisterSummary';

export const metadata = { title: 'Sale & stock register' };

/**
 * The Daily Sale & Stock Register.
 *
 * The owner keeps this as a spreadsheet - one row per trading day per tank,
 * with the running sales and the running gain/loss beside each other - and the
 * two cumulative columns are the whole point of it. A single day's variance is
 * a person squinting at a wet dipstick; ±30 L on a 5,000 L tank is the
 * measurement, not the fuel. A leak or a theft shows up as a cumulative
 * variance that walks in one direction and a percentage that will not come
 * back towards zero, and neither the Stock page (one day) nor Reports (one
 * whole month, one total) can show that.
 *
 * A PREVIEW, and it says so on the page. The owner asked for somewhere to
 * check the shape of this before it becomes a proper part of the app, so it is
 * reachable from Reports rather than from the sidebar, and the banner at the
 * top says what it is. Everything on it is real data through the same RLS and
 * the same role checks as every other page - "for testing" describes the
 * design, not the numbers.
 *
 * Rendered with Material UI at the owner's request. `RegisterTable` explains
 * why almost none of it is a Client Component despite that.
 */

/** The whole month is the default: the register's most common question. */
function resolveRange(params) {
  const today = todayISO();

  const month =
    typeof params?.month === 'string' && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : today.slice(0, 7);

  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  /*
   * Clamped to the month, never trusted. `?from=0` would ask Postgres for a
   * date of "2026-08-00" and `?from=400` for four hundred days of rows - the
   * same lesson TrendRange's note records about validating against the allowed
   * set rather than `Number() || 14`.
   */
  const clamp = (value, fallback) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > lastDay) return fallback;
    return n;
  };

  let fromDay = clamp(params?.from, 1);
  let toDay = clamp(params?.to, lastDay);

  // Entered backwards, they are swapped rather than refused. The reader asked
  // for the days between two numbers and that is unambiguous either way round.
  if (fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];

  const pad = (n) => String(n).padStart(2, '0');

  return {
    month,
    fromDay,
    toDay,
    from: `${month}-${pad(fromDay)}`,
    to: `${month}-${pad(toDay)}`,
    days: toDay - fromDay + 1,
  };
}

export default async function RegisterPage({ searchParams }) {
  await requirePageRole(ROLES.SUPER_ADMIN);

  const params = await searchParams;
  const range = resolveRange(params);

  const [rows, summary] = await Promise.all([
    getStockRegister(range.from, range.to),
    getRangeSummary(range.from, range.to),
  ]);

  // Grouped by tank, in the order the app shows fuels everywhere else (diesel
  // first - see FUEL_ORDER). The RPC already returns each tank's rows in date
  // order, which the cumulative columns depend on, so nothing is re-sorted
  // inside a group.
  const tanks = [];
  for (const row of rows) {
    let tank = tanks.find((candidate) => candidate.tank_id === row.tank_id);
    if (!tank) {
      tank = {
        tank_id: row.tank_id,
        name: row.tank_name,
        fuel_type: row.fuel_type,
        rows: [],
      };
      tanks.push(tank);
    }
    tank.rows.push(row);
  }
  tanks.sort(byFuelOrder);

  const traded = tanks.some((tank) =>
    tank.rows.some((row) => Number(row.meter_sales) > 0 || Number(row.receipts) > 0),
  );

  const profit = Number(summary.profit ?? 0);
  const totalSales = Number(summary.total_sales ?? 0);
  const totalStockCost = Number(summary.total_stock_cost ?? 0);
  const expenses = Number(summary.expenses_total ?? 0);

  return (
    <>
      <PageHeader
        title="Sale & stock register"
        description="Petrol and diesel day by day, with the running sales and the running gain or loss."
      >
        <RegisterRange month={range.month} fromDay={range.fromDay} toDay={range.toDay} />
      </PageHeader>

      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
        A preview, for checking the shape of this page. The figures are real - the same readings,
        deliveries and dips as everywhere else.
      </Alert>

      {/* The range in words, once and loudly. A page whose every figure depends
          on a chosen span must state that span where the eye lands first -
          the same rule as "the day on screen is stated once, and loudly". */}
      <h2 className="section-heading">
        {formatDate(range.from)} – {formatDate(range.to)}{' '}
        <span className="font-semibold text-ink-600">
          · {range.days} {range.days === 1 ? 'day' : 'days'}
        </span>
      </h2>

      {!traded ? (
        <EmptyState
          title="Nothing was traded on these days"
          description="No readings and no deliveries fall in this range. Try another month, or a wider run of days."
        />
      ) : (
        <>
          {/* ---- what each fuel did ---- */}
          <div className="@container">
            <div className="grid grid-cols-1 gap-4 @[40rem]:grid-cols-2">
              {tanks.map((tank) => (
                <FuelCard key={tank.tank_id} fuelType={tank.fuel_type} rows={tank.rows} />
              ))}
            </div>
          </div>

          {/* ---- profit over the same days ---- */}
          <h2 className="section-heading">Profit over these days</h2>

          <div className="@container">
            <div className="grid grid-cols-1 gap-4 @[24rem]:grid-cols-2 @[50rem]:grid-cols-4">
              <MoneyTile label="Sales" value={formatPKR(totalSales)} />
              <MoneyTile label="Stock bought" value={formatPKR(totalStockCost)} />
              <MoneyTile label="Expenses" value={formatPKR(expenses)} />
              <MoneyTile
                label="Profit"
                value={formatPKR(profit)}
                tone={profit >= 0 ? 'positive' : 'negative'}
              />
            </div>
          </div>

          {/* The warning is louder here than on Reports, and deliberately so.
              Over a whole month a delivery lands somewhere in the middle and
              mostly averages out. Over four days one delivery IS the month -
              it can turn a good run of days into a loss on this tile with
              nothing wrong at all. */}
          <p className="mt-3 text-sm text-ink-600">
            Profit counts stock <span className="font-semibold">bought</span> in these days, not
            stock sold. Over a short run of days one delivery can swing this figure a long way — the
            register above is where the fuel itself is accounted for.
          </p>

          {/* ---- the register itself ---- */}
          {/* A Fragment, NOT a <section> per tank. `.section-heading` carries
              `first:mt-0` so that a heading opening a container has no gap
              above it - wrapped in a <section>, every one of these became its
              container's first child and lost the margin, leaving "Diesel
              tank" jammed against the paragraph above it. The grouping was
              decorative; the spacing is not. */}
          {tanks.map((tank) => (
            <Fragment key={tank.tank_id}>
              <h2 className="section-heading">
                <span className="inline-flex items-center gap-2">
                  <Chip
                    label={fuelColor(tank.fuel_type).label}
                    size="small"
                    className={fuelColor(tank.fuel_type).badge}
                    sx={{ fontWeight: 700 }}
                  />
                  {tank.name}
                </span>
              </h2>
              <RegisterTable rows={tank.rows} />
            </Fragment>
          ))}

          {/* The note names the columns exactly as the heading does - "Should
              be", "Dip", "Gain / loss" - so the reader can match a sentence to
              a column without translating. It said "Books" and "variance"
              while the table said something else, which is how a legend stops
              being read. */}
          <p className="mt-4 text-sm text-ink-600">
            <span className="font-semibold">Should be</span> is the opening stock plus what was
            delivered, less what the meters sold. <span className="font-semibold">Dip</span> is what
            the rod actually measured at the close of that day, and the{' '}
            <span className="font-semibold">gain / loss</span> is the difference between the two. A
            dip taken in the morning closes the day before — see the Stock page.
          </p>
        </>
      )}
    </>
  );
}
