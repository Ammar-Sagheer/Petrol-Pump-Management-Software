import {
  requirePageRole,
  ROLES,
  formatDate,
  formatRate,
  formatLitres,
  fullResetAllowed,
  todayISO,
} from '@/app/_lib/helpers';
import {
  getTanks,
  getNozzles,
  getRecentFuelPrices,
  getCurrentRates,
  getLastStockCheck,
} from '@/app/_lib/data-service';
import { fuelColor, FUEL_COLORS, FUEL_ORDER } from '@/app/_lib/fuel-colors';
import PageHeader from '@/app/_components/ui/PageHeader';
import Icon from '@/app/_components/ui/Icon';
import FuelPriceForm from '@/app/_components/admin/FuelPriceForm';
import TankForm from '@/app/_components/admin/TankForm';
import NozzleSettingsButton from '@/app/_components/admin/NozzleSettingsButton';
import ReplaceUnitButton from '@/app/_components/admin/ReplaceUnitButton';
import FullResetPanel from '@/app/_components/admin/FullResetPanel';
import BackupPanel from '@/app/_components/admin/BackupPanel';
import FuelPriceTable from '@/app/_components/admin/FuelPriceTable';
import PendingLink from '@/app/_components/ui/PendingLink';

export const metadata = { title: 'Settings' };

/* Five changes on this page, the rest behind "View all". The rate moves most
   days, so left unbounded this table grew by two rows a day and turned the
   pricing panel into a wall nobody read. Seven whole days was the first cut at
   that and still ran to fourteen rows and a scrollbar; five rows is a glance.
   getRecentFuelPrices() rounds up to the end of a date rather than splitting a
   day's petrol and diesel, so this can show six. */
const RECENT_ROWS = 5;

export default async function SettingsPage({ searchParams }) {
  await requirePageRole(ROLES.SUPER_ADMIN);

  // Set by the backup route when the download could not be produced. Trimmed,
  // because it goes on screen and arrives from the query string.
  const params = await searchParams;
  const backupError =
    typeof params?.backup_error === 'string' ? params.backup_error.slice(0, 300) : null;

  const [tanks, nozzles, prices, rates] = await Promise.all([
    getTanks(),
    getNozzles(),
    getRecentFuelPrices(RECENT_ROWS),
    getCurrentRates(),
  ]);

  // One tank per call - see getLastStockCheck for why this is not a single
  // unbounded query filtered in JS. The date is formatted HERE, on the
  // server, because TankForm is a client component and formatDate lives in
  // helpers.js, which reaches into request cookies and can never enter a
  // browser bundle - same reason Sparkline's tips are pre-formatted by their
  // caller rather than inside the client component itself.
  const lastDips = await Promise.all(
    tanks.map(async (tank) => {
      const dip = await getLastStockCheck(tank.id);
      return dip ? { label: formatDate(dip.books_date), gainLoss: Number(dip.gain_loss) } : null;
    }),
  );

  /*
   * THE UNIT, NOT THE NOZZLE, IS WHAT THE OWNER REPLACES. A dispenser is one
   * object standing on the forecourt with two nozzles bolted to it, and it is
   * swapped as one object - so this page groups by unit the same way the
   * Readings page does.
   *
   * The group key is unit number AND commissioning date, not unit number
   * alone. Since migration 056 a unit number outlives the hardware wearing it:
   * a replaced Unit 1 and the Unit 1 that took its place share the number, and
   * grouping on that alone would draw them as one four-nozzle pump that never
   * existed.
   */
  const unitsByKey = new Map();
  for (const nozzle of nozzles) {
    const key = `${nozzle.unit_number}|${nozzle.commissioned_on ?? 'original'}`;
    if (!unitsByKey.has(key)) {
      unitsByKey.set(key, {
        key,
        unitNumber: nozzle.unit_number,
        commissionedOn: nozzle.commissioned_on,
        retiredOn: nozzle.retired_on,
        nozzles: [],
      });
    }
    unitsByKey.get(key).nozzles.push(nozzle);
  }

  const allUnits = [...unitsByKey.values()];
  const liveUnits = allUnits.filter((unit) => !unit.retiredOn);
  const retiredUnits = allUnits
    .filter((unit) => unit.retiredOn)
    .sort((a, b) => (a.retiredOn < b.retiredOn ? 1 : -1));

  const today = todayISO();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Prices, tanks and backups. Owner access only."
      >
        {/* Set up once and rarely touched again, same reasoning as adding a
            bank account: it does not deserve a form standing open on the page
            for the rest of this screen's life. */}
        {/* Every nozzle, replaced ones included. A replaced pump still holds
            its old position for the days it worked, so nothing can be moved
            into that position while it is not on the list to be moved out of
            it - see 058. Its tank and meter are still frozen; the dialog
            renders those two read-only rather than leaving the row out. */}
        <NozzleSettingsButton nozzles={nozzles} tanks={tanks} />
      </PageHeader>

      {/* ---- pricing ---- */}
      <div className="mb-6 mt-8 flex flex-wrap items-center justify-between gap-3 first:mt-0">
        <h2 className="text-lg font-bold text-ink-900">Fuel prices</h2>
        {/* Behind a dialog rather than standing open beside the cards - see
            FuelPriceForm. Freeing the width is also what lets the cards below
            be the headline rather than a caption next to a form. */}
        <FuelPriceForm currentRates={rates} />
      </div>

      {/*
       * THE PRICE ON THE BOARD OUTSIDE, IN THE APP. This is the one figure on
       * the whole page a tired attendant reads at a glance before typing a
       * reading, so it gets the loudest treatment `fuel-colors.js` has:
       * `solid` filled edge-to-edge rather than a header band over a white
       * body, the same `.fuel-band` sheen the Readings unit header and the
       * Stock dip cards wear, and the figure set at 4xl - bigger than any
       * other number on this page.
       *
       * Filling the WHOLE card rather than only a header band is a deliberate
       * departure from "the colour is on the header and border only" (see
       * "Two entry cards side by side" in docs/UI_CONVENTIONS.md) - and not a
       * contradiction of the reasoning behind it. That rule protects figures
       * being TYPED into a card from a colour wash that would cost their
       * contrast; there is no typing here any more, `solid`'s petrol/diesel
       * pairs are the ones already measured at 7.6:1 and 10.6:1 for exactly
       * this text-on-fill combination, and the figure IS the fill's own text,
       * not something layered on top that could lose contrast to it.
       *
       * A card missing its rate is deliberately NOT fuel-coloured - filling it
       * anyway would show confidence in a number that is not there. It stays
       * dashed and amber, the app's usual "needs attention" language, so the
       * one card that cannot be trusted yet does not look like the one that
       * can.
       */}
      <div className="mb-8 grid gap-8 sm:grid-cols-2">
        {/* Diesel first, petrol second - the pump's own layout, not
            alphabetical order. See FUEL_ORDER in fuel-colors.js; the
            Dashboard's tank cards and every other paired fuel list in the
            app already read this way. */}
        {FUEL_ORDER.filter((fuelType) => fuelType in rates).map((fuelType) => {
          const rate = rates[fuelType];
          const label = FUEL_COLORS[fuelType]?.label ?? fuelType;

          if (rate === null) {
            return (
              <div
                key={fuelType}
                className="card flex flex-col justify-center gap-2 border-2 border-dashed border-amber-300 bg-amber-50 px-5 py-5"
              >
                <div className="flex items-center gap-2 text-amber-800">
                  <Icon name="warning" className="h-5 w-5" />
                  <span className="text-base font-bold uppercase tracking-wide">{label}</span>
                </div>
                <p className="text-lg font-semibold text-amber-900">Rate not set</p>
                <p className="text-sm text-amber-700">
                  Readings cannot be entered for {label.toLowerCase()} until one is.
                </p>
              </div>
            );
          }

          const color = fuelColor(fuelType);

          /*
           * ONE ELEMENT, NOT A COLOURED DIV CLIPPED INSIDE A ROUNDED ONE. That
           * was the first version - `card unit-card overflow-hidden` outside,
           * `fuel-band ... solid` filling it as a child - and at full card
           * height rather than a header strip, the corner clip and the
           * child's own edge did not perfectly agree: a hairline of the
           * card's white showed through at the rounded bottom corners. `card`
           * and `fuel-band` here instead round and colour the SAME box, so
           * there is nothing left to clip and nothing for the two edges to
           * disagree about.
           */
          return (
            <div
              key={fuelType}
              className={`card rate-card fuel-band flex flex-col gap-3 px-5 py-5 @container ${color.solid}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/25 ring-1 ring-inset ring-black/10"
                  aria-hidden="true"
                >
                  <Icon name="fuelPump" className="h-5 w-5" />
                </span>
                <span className="text-base font-bold uppercase tracking-wide">{label}</span>
                <span
                  className={`ml-auto text-xs font-semibold uppercase tracking-wide ${color.solidMuted}`}
                >
                  current rate
                </span>
              </div>

              <p className="tabular whitespace-nowrap text-4xl font-extrabold @[16rem]:text-5xl">
                {formatRate(rate)}
                <span className={`ml-2 text-lg font-semibold ${color.solidMuted}`}>/ L</span>
              </p>
            </div>
          );
        })}
      </div>

      {prices.length > 0 ? (
        <>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-ink-600">The most recent changes</p>
            <PendingLink
              href="/admin/settings/fuel-prices"
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              View all rates
            </PendingLink>
          </div>

          <FuelPriceTable prices={prices} />
        </>
      ) : (
        <p className="card px-4 py-6 text-center text-base text-ink-600">
          No rates set yet. Readings cannot be entered until a rate exists for each fuel.
        </p>
      )}

      {/* ---- tanks ---- */}
      <h2 className="section-heading">Tanks</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {tanks.map((tank, index) => (
          <TankForm key={tank.id} tank={tank} lastDip={lastDips[index]} />
        ))}
      </div>

      {/* ---- dispensing units ---- */}
      {/*
       * WHY THIS SECTION EXISTS AT ALL, when the nozzle wiring dialog in the
       * header already lists every nozzle. Because the dialog answers "how is
       * the place plumbed", which is a standing fact, and this answers "what is
       * standing out there now, and what used to be" - which is a history. The
       * day a unit was damaged and swapped is a real event in the books, and
       * until now there was nowhere in the app it could be recorded or read.
       */}
      <h2 className="section-heading">Dispensing units</h2>

      <div className="mb-4 grid gap-4 @container sm:grid-cols-2">
        {liveUnits.map((unit) => {
          // A unit is normally plumbed to one tank. Where it is not, neither
          // fuel's colour would be honest about the pair - the same fallback
          // the Readings page unit header makes, for the same reason.
          const fuels = new Set(unit.nozzles.map((nozzle) => nozzle.tank?.fuel_type));
          const color = fuels.size === 1 ? fuelColor([...fuels][0]) : null;

          return (
            <div key={unit.key} className="card overflow-hidden">
              <div
                className={`fuel-band flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 ${
                  color ? color.solid : 'bg-ink-100 text-ink-900'
                }`}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/25 ring-1 ring-inset ring-black/10"
                  aria-hidden="true"
                >
                  <Icon name="fuelPump" className="h-4 w-4" />
                </span>
                <h3 className="text-base font-bold uppercase tracking-wide">
                  Unit {unit.unitNumber}
                </h3>
                <span className="badge ml-auto bg-white/25 ring-1 ring-inset ring-black/10">
                  {unit.nozzles.length} {unit.nozzles.length === 1 ? 'nozzle' : 'nozzles'}
                </span>
              </div>

              <div className="space-y-1 px-4 py-3">
                {unit.nozzles.map((nozzle) => (
                  <p key={nozzle.id} className="text-sm text-ink-700">
                    <span className="font-semibold text-ink-900">Nozzle {nozzle.nozzle_label}</span>{' '}
                    — {nozzle.tank?.name ?? 'no tank'}, meter started at{' '}
                    {/* nowrap, because at a phone width this line wraps and the
                        default break put "1,487,293.55" on one line and its "L"
                        on the next - a figure split from its unit, which is the
                        exact regression docs/CHANGELOG.md keeps catching. The
                        sentence may wrap; the number may not. */}
                    <span className="tabular whitespace-nowrap">
                      {formatLitres(nozzle.starting_reading)}
                    </span>
                  </p>
                ))}

                <p className="pt-1 text-xs text-ink-500">
                  {unit.commissionedOn
                    ? `Fitted ${formatDate(unit.commissionedOn)}`
                    : 'Here since the pump went onto the system'}
                </p>

                <div className="pt-2">
                  <ReplaceUnitButton unit={unit} tanks={tanks} today={today} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {retiredUnits.length > 0 ? (
        <div className="mb-8">
          <p className="mb-2 text-sm text-ink-600">Replaced units</p>
          <div className="card table-scroll">
            <table className="w-full min-w-[30rem]">
              <thead className="border-b border-ink-200 bg-ink-50">
                <tr>
                  <th className="th">Unit</th>
                  <th className="th">Nozzles</th>
                  <th className="th">Drew from</th>
                  <th className="th">Last day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {retiredUnits.map((unit) => (
                  <tr key={unit.key}>
                    <td className="td font-medium">Unit {unit.unitNumber}</td>
                    <td className="td">
                      {unit.nozzles.map((nozzle) => nozzle.nozzle_label).join(', ')}
                    </td>
                    <td className="td">
                      {[...new Set(unit.nozzles.map((nozzle) => nozzle.tank?.name ?? '—'))].join(
                        ', ',
                      )}
                    </td>
                    <td className="td tabular">{formatDate(unit.retiredOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Said once, here, rather than as a warning on every row: the reason
              these rows are read-only is not obvious, and it is the whole
              reason they are still in the database at all. */}
          <p className="mt-2 text-xs text-ink-500">
            Kept, and not editable. Every reading these nozzles ever took is still in the books and
            still drawing on the tank they were plumbed to — their days can be opened and corrected
            on Readings exactly as before.
          </p>
        </div>
      ) : null}

      {/* ---- backup ---- */}
      {/* Here rather than on Reports, where it was first put. A backup is not a
          report: it is not read, it is filed, and it belongs with the other
          things that are set up once and then left alone. Reports is where the
          owner goes for a figure - a control about losing the whole database
          sitting under the month's profit was answering a question nobody was
          asking at that moment. */}
      <h2 className="section-heading">Backup</h2>
      <BackupPanel error={backupError} />

      {/* Testing scaffolding. Gone the moment ALLOW_FULL_RESET is removed from
          the server, with no code change - see fullResetAllowed(). */}
      {fullResetAllowed() ? (
        <>
          <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wide text-red-700">
            While testing
          </h2>
          <FullResetPanel />
        </>
      ) : null}
    </>
  );
}
