import {
  requirePageRole,
  ROLES,
  todayISO,
  formatDate,
  formatDateLong,
  formatLitres,
  formatPKR,
  shiftISODate,
} from '@/app/_lib/helpers';
import { getReadingSheet, getCustomers, getCreditSalesForReadings } from '@/app/_lib/data-service';
import PageHeader from '@/app/_components/ui/PageHeader';
import Icon from '@/app/_components/ui/Icon';
import { fuelColor, NEUTRAL_FUEL } from '@/app/_lib/fuel-colors';
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
  const date =
    typeof params?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : todayISO();

  const today = todayISO();

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

  /*
   * A GAP BEFORE THIS DAY. get_reading_sheet already gives every row the
   * nearest EARLIER reading for that nozzle (`previous_date`) - not
   * necessarily yesterday. When it isn't yesterday, one or more whole days in
   * between were never opened at all, which is exactly the mistake this page
   * is for: coming back after a break and typing the day's numbers in against
   * today without noticing the day before was left empty.
   *
   * This is deliberately a warning, not a block - migration 027 already
   * allows entering a day that leaves a genuine gap behind it, because the
   * honest repair (filling that gap later) looks the same on the wire as the
   * mistake. The strip and this banner are what make the difference visible
   * before it is saved instead of after.
   */
  const expectedPreviousDate = shiftISODate(date, -1);
  const gapRows = sheet.filter(
    (row) => row.previous_date && row.previous_date !== expectedPreviousDate,
  );
  const dayGap =
    gapRows.length === 0
      ? null
      : (() => {
          const earliestPrevious = gapRows.reduce(
            (min, row) => (row.previous_date < min ? row.previous_date : min),
            gapRows[0].previous_date,
          );
          return {
            from: shiftISODate(earliestPrevious, 1),
            to: expectedPreviousDate,
            partial: gapRows.length < sheet.length,
          };
        })();

  /*
   * Grouped by unit, because a unit is a physical thing standing on the
   * forecourt with two nozzles on it - and the flat list gave no sign of that.
   * Six evenly spaced cards read as six unrelated pumps, so "Unit 1 · Nozzle
   * A" and "Unit 1 · Nozzle B" only announced their relationship in words the
   * reader had to compare.
   *
   * get_reading_sheet already returns them ordered by unit then nozzle, so
   * this preserves that order rather than sorting again.
   */
  const units = [];
  for (const row of sheet) {
    const last = units[units.length - 1];
    if (last && last.unitNumber === row.unit_number) last.rows.push(row);
    else units.push({ unitNumber: row.unit_number, rows: [row] });
  }

  return (
    <>
      <PageHeader
        title="Daily readings"
        description="Opening figures carry over from the previous day. The day you are entering is shown below."
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

      {dayGap ? (
        <p className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span className="font-semibold">
            {dayGap.from === dayGap.to
              ? formatDateLong(dayGap.from)
              : `${formatDateLong(dayGap.from)} to ${formatDateLong(dayGap.to)}`}
          </span>{' '}
          {dayGap.from === dayGap.to ? 'has' : 'have'} no reading saved
          {dayGap.partial ? ' for one or more nozzles' : ' at all'} — check it wasn&apos;t missed by
          mistake before entering {date === today ? 'today' : formatDate(date)}.
        </p>
      ) : null}

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
          <StatTile icon="readings" label="Nozzles entered" value={`${done.length} of ${sheet.length}`} />
          <StatTile icon="fuelPump" label="Litres sold" value={formatLitres(totals.litres)} />
          <StatTile icon="cash" label="Cash" value={formatPKR(totals.cash)} />
          <StatTile icon="credit" label="Credit" value={formatPKR(totals.credit)} />
        </StatGrid>
      </div>

      {/* A list, not a grid of cards. Each row opens a dialog to enter that
          nozzle, so the whole day stays visible on one screen.

          THE CARD IS THE UNIT. A unit is a physical pump standing on the
          forecourt with two nozzles bolted to it, and the flat list of
          six identical full-width cards gave that nothing to be - "Unit 1"
          was a caption floating above two slabs. Wrapping each unit's
          nozzles in one card, with its own header and progress bar, means
          the page reads as three pumps to work through rather than six
          unrelated forms, and the rows inside it get shorter because they
          no longer each need to carry their own edge. */}
      <div className="space-y-8">
        {units.map((unit) => {
          const entered = unit.rows.filter((row) => row.reading_id).length;
          const allDone = entered === unit.rows.length;
          const percent = Math.round((entered / unit.rows.length) * 100);

          /*
           * THE HEADER WEARS THE UNIT'S FUEL, quietly until the pump is
           * finished and then filled. Hue says which fuel, lightness says
           * whether there is anything left to do - two questions, two cues,
           * neither borrowing the other's channel.
           *
           * A unit is normally plumbed to one tank, so its nozzles share a
           * fuel. The schema does not require that, though, and a unit
           * selling both would be mislabelled by either colour - so a mixed
           * one falls back to neutral rather than picking the first nozzle's
           * fuel and calling the whole pump diesel.
           */
          const fuels = new Set(unit.rows.map((row) => row.fuel_type));
          const unitColor = fuels.size === 1 ? fuelColor([...fuels][0]) : NEUTRAL_FUEL;
          const headerClass = allDone ? unitColor.strong : unitColor.soft;

          return (
            <section
              key={unit.unitNumber}
              aria-label={`Unit ${unit.unitNumber}`}
              className="card overflow-hidden"
            >
              {/* Everything inside the header takes its colour from the band
                  rather than being coloured on its own - `currentColor` for
                  the icon, white-alpha for the chip and the track. That is
                  what lets one pair of classes serve both a pale band with
                  dark text and a dark band with white text: nothing in here
                  has to know which it is sitting on. */}
              <div
                className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${headerClass}`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    allDone ? 'bg-white/20' : 'bg-white/70'
                  }`}
                  aria-hidden="true"
                >
                  <Icon name={allDone ? 'check' : 'readings'} className="h-5 w-5" />
                </span>

                <h2 className="text-base font-bold uppercase tracking-wide">
                  Unit {unit.unitNumber}
                </h2>

                {/* How far through this unit is, so a finished pump can be
                    skipped without reading both of its rows. The bar says the
                    same thing as the words beside it - it is the glanceable
                    half of the pair, not the only carrier. */}
                <span
                  className={`badge ${allDone ? 'bg-white/20' : 'bg-white/70'}`}
                >
                  {entered} of {unit.rows.length} entered
                </span>

                {/*
                 * ONLY WHILE THERE IS PROGRESS TO SHOW. A finished unit is by
                 * definition at 100%, and a full bar has no empty track left
                 * to contrast against - on the filled header it stopped
                 * reading as a bar at all and just looked like a white rule
                 * someone had left there. Nothing was lost by removing it:
                 * the filled band, the check and "2 of 2 entered" already say
                 * the pump is done, three times over.
                 */}
                {allDone ? null : (
                  <div className="ml-auto min-w-[6rem] flex-1 sm:max-w-[10rem]">
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-white/70"
                      role="img"
                      aria-label={`Unit ${unit.unitNumber} is ${percent} percent entered`}
                    >
                      <div
                        className="h-full rounded-full bg-brand-500 transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="divide-y divide-ink-100 border-t border-ink-200">
                {unit.rows.map((row) => (
                  <ReadingForm
                    key={row.nozzle_id}
                    row={row}
                    date={date}
                    customers={customers}
                    creditSales={creditSalesByReading[row.reading_id] ?? []}
                    canDelete={profile.role === ROLES.SUPER_ADMIN}
                    showUnit={false}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
