'use client';

import { useActionState, useEffect, useId, useRef, useState } from 'react';

import { saveReading, deleteReading } from '@/app/_lib/actions';
import SubmitButton from '@/app/_components/ui/SubmitButton';
import FormMessage from '@/app/_components/ui/FormMessage';
import FuelBadge from '@/app/_components/ui/FuelBadge';
import NumberInput from '@/app/_components/ui/NumberInput';
import ReadingChainWarning from '@/app/_components/admin/ReadingChainWarning';
import { formatRate } from '@/app/_lib/format-helpers';
import { shiftISODate, formatDateLong } from '@/app/_lib/date-helpers';
import Icon from '@/app/_components/ui/Icon';
import { fuelColor } from '@/app/_lib/fuel-colors';
import Button from '@/app/_components/ui/Button';

/*
 * Formatting is done inline here rather than imported from helpers.js: that
 * module reaches into request cookies for the role checks, so it cannot be
 * pulled into a browser bundle. Anything the server needs to format the same
 * way lives in format-helpers.js instead - see formatRate above.
 */
const litreFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
/*
 * Meter readings always carry two decimals; litres sold do not.
 *
 * A pump meter is a physical dial with a tenths digit, so 1,987,128.80 and
 * 1,987,279.95 are the same shape of number. Formatted with a bare
 * maximumFractionDigits the first lost its trailing zero and rendered as
 * 1,987,128.8 - a digit shorter than the figure directly beside it, in a
 * tabular font whose whole job is to keep the columns aligned. On a screen
 * read in a hurry against cash in a drawer, that is how a digit gets misread.
 */
const meterFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const moneyFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const showLitres = (n) => `${litreFormat.format(n || 0)} L`;
const showMoney = (n) => `Rs ${moneyFormat.format(n || 0)}`;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * One nozzle, as a compact row that opens a dialog.
 *
 * Six full-height forms stacked on one page meant a lot of scrolling, and -
 * worse - six near-identical forms in view at once, which is exactly how a
 * closing reading ends up typed into the wrong nozzle. Collapsed to rows, the
 * whole day fits on one screen and entry happens with everything else out of
 * the way.
 *
 * A dialog rather than an expanding row: an accordion pushes the rows below it
 * down and yanks them back on collapse, so you lose your place after every
 * save, and the credit slip list makes the page reflow as it grows.
 */
export default function ReadingForm({
  row,
  date,
  customers,
  creditSales,
  canDelete,
  showUnit = true,
}) {
  const isSaved = Boolean(row.reading_id);
  const [isOpen, setIsOpen] = useState(false);

  // Close once the save has gone through and come back from the server.
  const savedRef = useRef(isSaved);
  useEffect(() => {
    if (isSaved && !savedRef.current) setIsOpen(false);
    savedRef.current = isSaved;
  }, [isSaved]);

  const num = (value) => (value === null || value === undefined ? null : Number(value));

  const previousClosing = num(row.previous_closing);
  const laterOpening = num(row.later_opening);
  const closing = num(row.closing_reading);
  const openingUsed = Number(row.opening_reading ?? 0);

  /*
   * WHAT COUNTS AS A BROKEN CHAIN.
   *
   * This used to be `Boolean(row.later_date) || openingDoesNotMatch`, and the
   * first half of that was wrong: later_date only means "a reading exists on
   * some later date", which is true of every nozzle on every past day the
   * moment you carry on entering. Opening any earlier date painted Check on
   * all six rows at once, and a warning that is always on is a warning nobody
   * reads - including on the one row where it mattered.
   *
   * A meter is continuous, so the chain is intact when each reading opens
   * exactly where the one before it closed. Three ways that fails:
   *
   *   1. this day's opening is not the previous day's closing
   *   2. this day IS saved, but the next reading does not open where this one
   *      closed - the two overlap or leave a hole
   *   3. this day is NOT saved and a later reading already exists, so saving
   *      here back-fills underneath it and risks counting the litres twice
   *
   * A later reading that opens exactly where this day closes is the chain
   * working, which is the case that used to shout.
   */
  const openingDoesNotFollow = previousClosing !== null && openingUsed !== previousClosing;
  const nextDoesNotFollow =
    isSaved && laterOpening !== null && closing !== null && laterOpening !== closing;
  const backFillingUnderALaterDay = !isSaved && Boolean(row.later_date);

  const hasChainProblem = openingDoesNotFollow || nextDoesNotFollow || backFillingUnderALaterDay;

  // Ties the trigger to the panel it opens, for anything reading the page
  // aloud. `useId` rather than the nozzle id so it is stable across a
  // re-render and unique even if two of these were ever shown for one nozzle.
  const panelId = useId();

  /*
   * The row drops "Unit 1 ·" when the list is already grouped under a Unit
   * heading - repeating it on both cards under that heading is the clutter the
   * grouping was meant to remove.
   *
   * The row now opens IN PLACE, so its unit heading stays on screen the whole
   * time it is being typed into - which is what makes the short name safe
   * here. When this was a dialog the full "Unit 1 · Nozzle A" was repeated
   * inside it, precisely because the dialog covered the heading over.
   */
  const rowTitle = showUnit
    ? `Unit ${row.unit_number} · Nozzle ${row.nozzle_label}`
    : `Nozzle ${row.nozzle_label}`;

  // A quiet accent, not a filled band - the same rationing as the Dashboard's
  // fuel cards. A row of six nozzles in solid colour would be louder than a
  // list is meant to be; the rule (see fuel-colors.js) is that the loud
  // treatment is earned only where typing into the wrong card corrupts
  // something, which is the Stock page's dip boxes, not this list.
  const color = fuelColor(row.fuel_type);

  return (
    <>
      {/*
       * A ROW INSIDE ITS UNIT'S CARD, not a card of its own.
       *
       * Six identically-shaped full-width cards stacked down the page had no
       * rhythm to them and gave the unit grouping nothing to be - "Unit 1"
       * was a caption floating above two slabs rather than the physical pump
       * those two nozzles are bolted to. The card is the unit now (see
       * readings/page.js) and this is one row in it, so the page reads as
       * three pumps rather than six unrelated forms.
       *
       * WHICH FUEL THIS IS, TWICE OVER. This row is the surface the owner
       * named when he asked for the two fuels to be unmistakable: a reading
       * typed against the wrong nozzle is the mistake being designed out. So
       * it carries the fuel in two independent ways - an 8px rail down the
       * left in the fuel's dark relative (blue against rust, a hue
       * difference), and the badge beside the name (dark blue with white
       * letters against light orange with dark letters, a lightness AND a
       * letter-colour difference). The rail uses `color.border`, not
       * `color.accent`, which is `border-t-*` and paints only a top rule; and
       * not `color.solid` either, because diesel's light orange is 1.6:1 on
       * white and would be an invisible rail. See fuel-colors.js.
       *
       * DONE IS THE TINTED ONE, and it used to be the other way round. An
       * amber wash on the rows still to enter was right when the fuels were
       * teal and yellow, but diesel is orange now and an amber row behind an
       * orange rail is mud - the colour budget on this row belongs to the
       * fuel. So state moved to the quieter cue: a finished row settles into
       * a faint green, matching the check in its unit header, and a row still
       * to enter stays plain white and stands out against them. The Enter
       * chip still carries the word.
       */}
      <div
        className={`border-l-8 ${color.border}
                   ${isSaved ? 'bg-brand-50/40' : isOpen ? 'bg-white' : 'bg-white'}`}
      >
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className={`block w-full px-4 py-3.5 text-left transition
                     focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600
                     ${isSaved ? 'hover:bg-brand-50' : 'hover:bg-ink-50'}`}
        >
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span className="text-lg font-bold text-ink-900">{rowTitle}</span>
              <FuelBadge fuelType={row.fuel_type} />
              {hasChainProblem ? (
                <span className="badge bg-red-100 text-red-800">
                  <Icon name="warning" className="h-4 w-4" />
                  Check
                </span>
              ) : null}
            </div>

            {/* Green for done, NEUTRAL for still-to-do. This chip was amber
                until diesel became orange; a pale amber chip sitting beside an
                orange fuel badge on the same row is two warm colours competing
                to be noticed, and the fuel has to win that. Slate says "not
                yet" without claiming any of the colour the fuels now own.

                The word changes with the panel, because the chip is now the
                disclosure's label rather than a link to somewhere else: an
                open row says "Close", so the way out is the same control as
                the way in. */}
            <span
              className={`badge shrink-0 ${
                isSaved ? 'bg-brand-100 text-brand-800' : 'bg-ink-200 text-ink-800'
              }`}
            >
              <Icon name={isSaved ? 'check' : 'pencil'} className="h-4 w-4" />
              {isSaved ? 'Entered' : isOpen ? 'Close' : 'Enter'}
            </span>

            {/* Down, not right. A chevron pointing right promises another
                screen; this one opens the row where it stands, and it turns to
                point at what it opened. */}
            <Icon
              name="chevronRight"
              className={`h-5 w-5 shrink-0 text-ink-500 transition-transform ${
                isOpen ? 'rotate-90' : ''
              }`}
            />
          </div>

          {/*
           * THE COLLAPSED ROW IS ONE LINE NOW, not a four-column grid.
           *
           * An unentered row used to spend two labelled columns on the opening
           * meter and the rate, and then a third of its width on the sentence
           * "Tap to enter the closing meter reading." - printed six times down
           * a page whose every row already carried an Enter chip and a
           * chevron saying the same thing. The instruction is gone because the
           * input it described is now in the row itself.
           *
           * The labels have NOT gone: "Meter starts at 1,988,181.70" reads as
           * a labelled figure inline. The convention that earned those labels
           * was written against a bare run of numbers - "100 L · Rs 30,000 ·
           * cash Rs 30,000" - which is a different thing entirely.
           *
           * AND IT DISAPPEARS WHEN THE ROW OPENS. The form directly beneath it
           * states both figures again and states them better - "Opening" over
           * the meter in a field of its own, and the rate on its own line - so
           * leaving the summary up made the open row say the opening meter
           * twice and the rate twice, three lines apart. A summary is for a
           * thing you cannot currently see.
           */}
          {isSaved ? (
            <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
              <RowFigure label="Fuel sold" value={showLitres(row.litres_sold)} strong />
              <RowFigure label="Total sale" value={showMoney(row.sale_amount)} strong />
              <RowFigure label="Cash in hand" value={showMoney(row.cash_amount)} />
              <RowFigure
                label="On credit"
                value={Number(row.credit_amount) > 0 ? showMoney(row.credit_amount) : '—'}
                tone={Number(row.credit_amount) > 0 ? 'credit' : 'muted'}
              />
            </dl>
          ) : isOpen ? null : (
            <p className="mt-1.5 text-base text-ink-600">
              Meter starts at{' '}
              <span className="tabular font-semibold text-ink-800">
                {meterFormat.format(openingUsed)}
              </span>
              {row.rate ? (
                <>
                  {' · '}
                  <span className="tabular font-semibold text-ink-800">
                    {formatRate(row.rate)}
                  </span>{' '}
                  a litre
                </>
              ) : (
                <>
                  {' · '}
                  <span className="font-semibold text-amber-800">rate not set</span>
                </>
              )}
            </p>
          )}
        </button>

        {/*
         * THE ENTRY OPENS IN THE ROW, WHERE IT USED TO OPEN IN A DIALOG.
         *
         * The job this screen exists for is six numbers, and in the dialog it
         * cost six open / type / save / close round trips - the page behind it
         * covered over each time by the thing it had just launched. A dialog
         * is the right shape for "set up once, not read constantly" (see
         * docs/UI_CONVENTIONS.md); the evening's meter readings are the
         * opposite of that, and were the one daily task wearing it.
         *
         * Inline is also more room, not less: this panel has the page's full
         * width where the dialog was capped, which is what lets the credit
         * slips and the running total sit side by side further down.
         *
         * Only the trigger is rendered when closed - the form is unmounted,
         * not hidden. That matters for more than weight: `EntryForm` keeps the
         * typed closing reading in component state, so unmounting is what
         * discards a half-typed number when the row is closed, rather than
         * leaving it to reappear later against a day the reader has since
         * navigated away from.
         */}
        {isOpen ? (
          <div id={panelId} className="border-t border-ink-200 bg-ink-50/60">
            {isSaved ? (
              <SavedReading row={row} date={date} creditSales={creditSales} canDelete={canDelete} />
            ) : (
              <EntryForm
                row={row}
                date={date}
                customers={customers}
                onCancel={() => setIsOpen(false)}
              />
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}

/**
 * One labelled figure in a nozzle row. The label is the point: it is what
 * turns "100 L" into "Fuel sold: 100 L".
 */
function RowFigure({ label, value, strong, tone }) {
  const valueTone =
    tone === 'muted'
      ? 'text-ink-500'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'credit'
          ? 'text-ink-900'
          : 'text-ink-900';

  return (
    <div className="min-w-0">
      <dt className="figure-label truncate">{label}</dt>
      <dd className={`figure-value truncate ${strong ? '' : 'font-semibold'} ${valueTone}`}>
        {value}
      </dd>
    </div>
  );
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatDayLabel(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(iso);
  return `${String(d).padStart(2, '0')} ${MONTH_NAMES[m - 1]} ${y}`;
}

// ---------------------------------------------------------------------------
// Already entered - show what was recorded
// ---------------------------------------------------------------------------

function SavedReading({ row, date, creditSales, canDelete }) {
  const [state, formAction] = useActionState(deleteReading, null);

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* A saved row can still be part of a broken chain - flag it here rather
          than leaving it to be found in a stock loss weeks later. */}
      <ReadingChainWarning row={row} date={date} openingUsed={row.opening_reading} />

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Figure label="Opening" value={meterFormat.format(row.opening_reading)} />
        <Figure label="Closing" value={meterFormat.format(row.closing_reading)} />
        <Figure label="Sold" value={showLitres(row.litres_sold)} strong />
        <Figure label="Total" value={showMoney(row.sale_amount)} strong />
        <Figure label="Cash" value={showMoney(row.cash_amount)} />
        <Figure label="Credit" value={showMoney(row.credit_amount)} />
      </dl>

      {creditSales.length > 0 ? (
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
            Credit slips
          </p>
          <ul className="space-y-1 text-sm">
            {creditSales.map((slip) => (
              <li key={slip.id} className="flex items-baseline justify-between gap-3">
                <span className="truncate text-ink-800">{slip.customer?.name ?? 'Unknown'}</span>
                <span className="tabular shrink-0 text-ink-600">
                  {showLitres(slip.litres)} · {showMoney(slip.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <FormMessage state={state} />

      {canDelete ? (
        <form action={formAction} className="pt-1">
          <input type="hidden" name="reading_id" value={row.reading_id} />
          <SubmitButton variant="danger" fullWidth className="text-xs" pendingLabel="Deleting…">
            Delete this reading
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}

function Figure({ label, value, strong }) {
  return (
    <div>
      <dt className="figure-label">{label}</dt>
      <dd
        className={[
          'tabular mt-0.5',
          strong ? 'text-base font-bold text-ink-900' : 'text-sm font-medium text-ink-800',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Not yet entered - the form
// ---------------------------------------------------------------------------

function EntryForm({ row, date, customers, onCancel }) {
  const [state, formAction] = useActionState(saveReading, null);

  const opening = Number(row.opening_reading ?? 0);
  const rate = Number(row.rate ?? 0);

  const [closing, setClosing] = useState('');
  const [lines, setLines] = useState([]);
  const [skipConfirmed, setSkipConfirmed] = useState(false);

  const closingValue = closing === '' ? null : Number(closing);
  const hasClosing = closingValue !== null && Number.isFinite(closingValue);

  const litres = hasClosing ? round2(closingValue - opening) : 0;
  const saleAmount = round2(litres * rate);
  const creditTotal = round2(lines.reduce((total, line) => total + (Number(line.amount) || 0), 0));
  const cashAmount = round2(saleAmount - creditTotal);

  const meterWentBackwards = hasClosing && closingValue < opening;
  const creditExceedsSale = hasClosing && cashAmount < 0;

  /*
   * OVERLAPPING THE NEXT DAY. A meter only moves forwards, so two readings for
   * one nozzle describe two separate spans of it. They overlap - and so count
   * the same litres twice - when the next reading starts before this one
   * finishes.
   *
   * This is the mistake that put about 1,678 litres and Rs 577,000 on the
   * books twice in August 2026: a day entered against the 7th, then the same
   * meter figures entered again against the 6th, with nothing removing the
   * first. There was a warning in this dialog at the time and it was correct;
   * it was also ignorable, so it was ignored.
   *
   * The rule that actually stops it is a trigger on nozzle_readings (migration
   * 026) - this check only stops the trip to the server and explains the
   * problem while the closing reading is still on screen. If the two ever
   * disagree, the database is right.
   */
  const nextOpening =
    row.later_opening === null || row.later_opening === undefined
      ? null
      : Number(row.later_opening);
  const overlapsNextDay = hasClosing && nextOpening !== null && nextOpening < closingValue;

  /*
   * A GAP BEHIND THIS DAY. `previous_date` is the nearest EARLIER reading for
   * this nozzle - not necessarily yesterday. When it isn't, one or more whole
   * days in between were never opened, which is exactly how a real evening
   * went wrong here: the day before this one was skipped, and this one was
   * saved without anyone noticing.
   *
   * Not a block - migration 027 allows entering a day that leaves a genuine
   * gap behind it, because backfilling that gap later is a legitimate repair
   * that looks identical on the wire. This is the deliberate-or-mistake fork:
   * saving is refused until the checkbox below is ticked, so it takes a
   * conscious action to skip a day rather than an unnoticed one.
   */
  const expectedPreviousDate = shiftISODate(date, -1);
  const hasDateGap = Boolean(row.previous_date) && row.previous_date !== expectedPreviousDate;
  const missingFrom = hasDateGap ? shiftISODate(row.previous_date, 1) : null;
  const missingDayLabel =
    missingFrom === expectedPreviousDate
      ? formatDateLong(missingFrom)
      : `${formatDateLong(missingFrom)} to ${formatDateLong(expectedPreviousDate)}`;

  const canSubmit =
    rate > 0 &&
    hasClosing &&
    !meterWentBackwards &&
    !creditExceedsSale &&
    !overlapsNextDay &&
    (!hasDateGap || skipConfirmed);

  function addLine() {
    setLines((current) => [
      ...current,
      { key: crypto.randomUUID(), customer_id: '', litres: '', amount: '' },
    ]);
  }

  function updateLine(key, patch) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  /* Typing litres fills the amount in at today's rate; the amount stays
     editable, because a slip is occasionally rounded off by hand. */
  function onLitresChange(key, value) {
    const asNumber = Number(value);
    updateLine(key, {
      litres: value,
      amount: Number.isFinite(asNumber) && value !== '' ? String(round2(asNumber * rate)) : '',
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 p-4">
      <input type="hidden" name="nozzle_id" value={row.nozzle_id} />
      <input type="hidden" name="reading_date" value={date} />
      <input type="hidden" name="opening_reading" value={opening} />
      <input type="hidden" name="rate_per_litre" value={rate} />
      <input
        type="hidden"
        name="credit_lines"
        value={JSON.stringify(
          lines.map(({ customer_id, litres: l, amount }) => ({
            customer_id,
            litres: Number(l),
            amount: Number(amount),
          })),
        )}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="label">Opening</span>
          <p className="tabular rounded-lg border border-ink-200 bg-ink-100 px-3 py-2.5 text-lg font-semibold text-ink-600">
            {meterFormat.format(opening)}
          </p>
        </div>
        <div>
          <label className="label" htmlFor={`closing-${row.nozzle_id}`}>
            Closing
          </label>
          <NumberInput
            id={`closing-${row.nozzle_id}`}
            // Without a name the field is not submitted at all, however it
            // looks on screen - the server would only ever see an empty value.
            name="closing_reading"
            step="0.01"
            min={opening}
            required
            value={closing}
            onChange={(event) => setClosing(event.target.value)}
            className="input-number"
            placeholder="0.00"
          />
        </div>
      </div>

      {meterWentBackwards ? (
        <p className="text-sm font-medium text-red-700">
          The closing reading is below the opening reading of {meterFormat.format(opening)}.
        </p>
      ) : null}

      {overlapsNextDay ? (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          The reading already saved for {formatDayLabel(row.later_date)} starts at{' '}
          {meterFormat.format(nextOpening)}, before this day would close at{' '}
          {meterFormat.format(closingValue)} — so{' '}
          {litreFormat.format(round2(closingValue - nextOpening))} litres would be counted on both
          days. Clear {formatDayLabel(row.later_date)} on Readings first, then enter this day again.
        </p>
      ) : null}

      {/* Says so before saving if this day does not join onto its neighbours. */}
      <ReadingChainWarning row={row} date={date} openingUsed={opening} />

      {hasDateGap ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-900">
          <p className="font-medium">
            {missingDayLabel} has no reading saved for this nozzle. Saving this day will jump
            straight over it.
          </p>
          <label className="mt-2 flex items-start gap-2 font-medium">
            <input
              type="checkbox"
              checked={skipConfirmed}
              onChange={(event) => setSkipConfirmed(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-red-400 text-red-700 focus:ring-red-600"
            />
            Yes, {missingDayLabel} was missed on purpose — save this day anyway.
          </label>
        </div>
      ) : null}

      {rate > 0 ? (
        <p className="text-sm text-ink-600">
          Rate: <span className="tabular font-semibold text-ink-700">{formatRate(rate)}</span> per
          litre
        </p>
      ) : (
        <p className="text-sm font-medium text-amber-800">
          No rate is set for {row.fuel_type} on this date, so this nozzle cannot be saved yet.
        </p>
      )}

      {/* Running total, so a mistyped digit is obvious before saving */}
      <div className="rounded-lg bg-ink-900 px-4 py-3 text-white">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-300">Sold</span>
          <span className="tabular text-xl font-bold">{showLitres(litres)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-300">Value</span>
          <span className="tabular text-xl font-bold">{showMoney(saleAmount)}</span>
        </div>
      </div>

      {/* ---- credit slips ---- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Credit slips
          </span>
          {/* The main action on this card once the meter is in, so it is given
              the brand colour rather than the pale secondary style - it was
              easy to miss against the rest of the form. */}
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300
                       bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 transition
                       hover:border-brand-500 hover:bg-brand-100
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <span aria-hidden="true" className="text-base leading-none">
              +
            </span>
            Add customer
          </button>
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-ink-600">
            None yet — the whole amount is treated as cash. Took fuel on credit? Add them above.
          </p>
        ) : (
          <ul className="space-y-2">
            {lines.map((line) => (
              <li key={line.key} className="rounded-lg border border-ink-200 bg-ink-50 p-2">
                <div className="flex gap-2">
                  <select
                    required
                    aria-label="Customer"
                    value={line.customer_id}
                    onChange={(event) => updateLine(line.key, { customer_id: event.target.value })}
                    className="input py-2 text-sm"
                  >
                    <option value="">Choose customer…</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                        {customer.vehicle_number ? ` (${customer.vehicle_number})` : ''}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    size="small"
                    type="button"
                    onClick={() => removeLine(line.key)}
                    aria-label="Remove this slip"
                    className="shrink-0"
                  >
                    ✕
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <NumberInput
                    step="0.01"
                    min="0"
                    required
                    aria-label="Litres"
                    placeholder="Litres"
                    value={line.litres}
                    onChange={(event) => onLitresChange(line.key, event.target.value)}
                    className="input tabular py-2 text-sm"
                  />
                  <NumberInput
                    step="0.01"
                    min="0"
                    required
                    aria-label="Amount"
                    placeholder="Amount"
                    value={line.amount}
                    onChange={(event) => updateLine(line.key, { amount: event.target.value })}
                    className="input tabular py-2 text-sm"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- the split ---- */}
      <div className="grid grid-cols-2 gap-3 rounded-lg border border-ink-200 p-3">
        <div>
          <p className="figure-label">Cash</p>
          <p
            className={[
              'tabular mt-0.5 text-lg font-bold',
              creditExceedsSale ? 'text-red-700' : 'text-ink-900',
            ].join(' ')}
          >
            {showMoney(cashAmount)}
          </p>
        </div>
        <div>
          <p className="figure-label">Credit</p>
          <p className="tabular mt-0.5 text-lg font-bold text-ink-900">{showMoney(creditTotal)}</p>
        </div>
      </div>

      {creditExceedsSale ? (
        <p className="text-sm font-medium text-red-700">
          The slips come to more than this nozzle sold. Check the litres and amounts.
        </p>
      ) : (
        <p className="text-sm text-ink-600">
          Cash is worked out for you. Check it against the notes in the drawer before saving.
        </p>
      )}

      <FormMessage state={state} />

      {/* Save leads and takes the width it needs; Close is beside it rather
          than under it, because in a panel this tall the chip that opened the
          row has often scrolled off the top by the time somebody wants out. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[12rem] flex-1">
          <SubmitButton fullWidth disabled={!canSubmit}>
            Save nozzle
          </SubmitButton>
        </div>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Close
          </Button>
        ) : null}
      </div>
    </form>
  );
}
