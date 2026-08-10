import PendingLink from '@/app/_components/ui/PendingLink';
import { formatDateLong } from '@/app/_lib/date-helpers';

/**
 * The last seven days as small coloured circles, sitting at the end of the
 * day-controls row rather than in a band of their own.
 *
 * WHY IT LOOKS LIKE THIS. The first cut was a row of tiles carrying a weekday,
 * a day number and a "3/6" fraction each, on its own line under the controls.
 * It read as a second, competing set of date navigation - the heaviest thing
 * on a screen whose actual job is six nozzles - and it pushed the whole page
 * down by its own height plus a margin. The information it carries is worth
 * about a glance, so it gets about a glance's worth of room: one number, one
 * colour, in the empty space beside "Back to today" that was there anyway.
 *
 * COLOUR IS NOT THE ONLY SIGNAL, even at this size. The three states differ in
 * FILL as well as hue, which survives a red-green reader and a bad tablet
 * screen both:
 *
 *     solid           every nozzle entered
 *     plain outline   some entered, not all
 *     dashed outline  nothing entered at all - the one worth catching
 *
 * A dashed ring reads as "empty" on its own, which is the whole point: the day
 * this feature exists for is the one nobody opened. The exact figures are not
 * dropped, only moved - `aria-label` and `title` both carry "Sunday, 09 Aug
 * 2026 - 0 of 6 nozzles entered", so a screen reader gets the full sentence and
 * a hover gets it on a laptop.
 *
 * AND A PAST EMPTY DAY PULSES (`.flash-attention`). Movement is the one signal
 * that works when nobody is looking at that corner of the screen, and this is
 * the only state on the strip that earns it - see the class in globals.css for
 * why it is a box-shadow halo rather than a blink, and why it stops for
 * `prefers-reduced-motion`. Today is exempt: it is legitimately empty until the
 * evening, and a strip that flashes every morning is one nobody sees by noon.
 *
 * THE VIEWED DAY takes a dark border and keeps its status fill. An outline ring
 * offset from the circle floats beside the thing it is marking rather than
 * marking it; swapping the border colour says "you are here" without a halo and
 * without changing any tile's size.
 *
 * SEVEN, THEN FEWER WHEN THERE IS NO ROOM. The query always asks for seven -
 * `STRIP_DAYS` on the Readings page - and the oldest two are `hidden sm:flex`,
 * so a phone shows five rather than wrapping the row onto a second line. The
 * oldest go first because the gap banner below already names any missed day in
 * words; the strip is the glance, not the guarantee.
 */
export default function ReadingDayStrip({ days, activeDate, basePath, today }) {
  return (
    <div
      role="group"
      aria-label="Recent days, by how many nozzles were entered"
      /*
       * `flex-1` claims whatever the date banner and the Clear button leave
       * between them and `justify-center` puts the circles in the middle of
       * it, so the strip is centred in the gap rather than pinned to either
       * neighbour. `min-h-11` matches the banner's own height so the circles
       * sit on its centre line instead of its top edge.
       */
      className="flex min-h-11 flex-1 flex-wrap items-center justify-center gap-1.5"
    >
      {days.map((day, index) => {
        const total = day.total ?? 0;
        const entered = day.entered ?? 0;
        const isFull = total > 0 && entered === total;
        const isEmpty = entered === 0;
        const isActive = day.date === activeDate;
        const dayNumber = Number(String(day.date).slice(8, 10));

        /*
         * Only a PAST empty day pulses. Today is legitimately empty until the
         * evening's numbers go in, and a strip that flashes at its owner every
         * morning is one he stops seeing by the afternoon - which would cost
         * exactly the day this is meant to catch.
         */
        const isMissed = isEmpty && day.date < today;

        const fill = isFull
          ? 'bg-brand-600 text-white'
          : isEmpty
            ? 'border-dashed bg-red-50 text-red-800'
            : 'bg-amber-50 text-amber-900';

        const edge = isActive
          ? 'border-ink-900'
          : isFull
            ? 'border-brand-600'
            : isEmpty
              ? 'border-red-400'
              : 'border-amber-400';

        const description = `${formatDateLong(day.date)} — ${entered} of ${total} nozzles entered`;

        return (
          <PendingLink
            key={day.date}
            href={`${basePath}?date=${day.date}`}
            aria-label={description}
            title={description}
            aria-current={isActive ? 'date' : undefined}
            spinnerOnly
            className={[
              'tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition',
              fill,
              edge,
              isMissed ? 'flash-attention' : '',
              isActive ? '' : 'hover:brightness-95',
              /* The oldest step aside as the row runs out of width, rather
                 than wrapping the controls onto a second line. */
              index < 2 ? 'hidden xl:flex' : 'flex',
            ].join(' ')}
          >
            {dayNumber}
          </PendingLink>
        );
      })}
    </div>
  );
}
