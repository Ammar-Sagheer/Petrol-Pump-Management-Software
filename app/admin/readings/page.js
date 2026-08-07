import {
  requirePageRole,
  ROLES,
  todayISO,
  formatDate,
  formatLitres,
  formatPKR,
  shiftISODate,
} from '@/app/_lib/helpers';
import {
  getReadingSheet,
  getCustomers,
  getCreditSalesForReadings,
} from '@/app/_lib/data-service';
import PageHeader from '@/app/_components/ui/PageHeader';
import ReadingForm from '@/app/_components/admin/ReadingForm';
import DateNav from '@/app/_components/admin/DateNav';
import ClearDayButton from '@/app/_components/admin/ClearDayButton';
import { StatTile, StatGrid } from '@/app/_components/admin/AdminStats';

export const metadata = { title: 'Daily readings' };

/**
 * The daily entry screen - the one thing that gets used every evening.
 *
 * Each nozzle is its own small form, saved on its own. That way a mistake on
 * one nozzle never blocks the other five, and staff can work through the slip
 * book at their own pace.
 */
export default async function ReadingsPage({ searchParams }) {
  const profile = await requirePageRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);

  const params = await searchParams;
  const date = typeof params?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
    ? params.date
    : todayISO();

  const [sheet, customers] = await Promise.all([getReadingSheet(date), getCustomers()]);

  const savedReadingIds = sheet.filter((row) => row.reading_id).map((row) => row.reading_id);
  const creditSalesByReading = await getCreditSalesForReadings(savedReadingIds);

  const done = sheet.filter((row) => row.reading_id);
  const totals = done.reduce(
    (acc, row) => ({
      litres: acc.litres + Number(row.litres_sold ?? 0),
      sale: acc.sale + Number(row.sale_amount ?? 0),
      cash: acc.cash + Number(row.cash_amount ?? 0),
      credit: acc.credit + Number(row.credit_amount ?? 0),
    }),
    { litres: 0, sale: 0, cash: 0, credit: 0 },
  );

  const missingRate = sheet.some((row) => !row.rate);

  return (
    <>
      <PageHeader
        title="Daily readings"
        description={`Meter readings for ${formatDate(date)}. Opening figures carry over from the previous day.`}
      />

      {/* The day's controls on a row of their own, as on Lubricants - see
          docs/UI_CONVENTIONS.md. This row holds less than that one does and
          survives a laptop width either way, but it is the same latent
          problem: DateNav's "Back to today" appears only when the date is not
          today, so on a narrow enough screen the group wrapped under the title
          on one day and sat beside it on the next, moving the date box and the
          Clear button between one step and the next. Given its own row it
          cannot wrap against the title at all, and this is the screen someone
          works through every evening - the last place a control should move. */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <DateNav
          date={date}
          basePath="/admin/readings"
          previousDate={shiftISODate(date, -1)}
          nextDate={shiftISODate(date, 1)}
        />

        {/* Owner only. Entering a day against the wrong date is the mistake
            this exists for, and it poisons every day after it because each
            opening comes from the day before. */}
        {profile.role === ROLES.SUPER_ADMIN ? (
          <ClearDayButton date={date} dateLabel={formatDate(date)} entryCount={done.length} />
        ) : null}
      </div>

      {missingRate ? (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No rate is set for one of the fuels on this date.{' '}
          {profile.role === ROLES.SUPER_ADMIN
            ? 'Set it under Settings before entering readings.'
            : 'Ask the owner to set the price before entering readings.'}
        </p>
      ) : null}

      {/* The shared tiles rather than a local copy: they size their columns
          against their own width, which is what keeps a big day's cash figure
          from running out of its tile now the sidebar has taken 240px off
          every page. */}
      <div className="mb-6" aria-label="Progress for the day">
        <StatGrid>
          <StatTile label="Nozzles entered" value={`${done.length} of ${sheet.length}`} />
          <StatTile label="Litres sold" value={formatLitres(totals.litres)} />
          <StatTile label="Cash" value={formatPKR(totals.cash)} />
          <StatTile label="Credit" value={formatPKR(totals.credit)} />
        </StatGrid>
      </div>

      {/* A list, not a grid of cards. Each row opens a dialog to enter that
          nozzle, so the whole day stays visible on one screen. */}
      <div className="space-y-2">
        {sheet.map((row) => (
          <ReadingForm
            key={row.nozzle_id}
            row={row}
            date={date}
            customers={customers}
            creditSales={creditSalesByReading[row.reading_id] ?? []}
            canDelete={profile.role === ROLES.SUPER_ADMIN}
          />
        ))}
      </div>
    </>
  );
}

