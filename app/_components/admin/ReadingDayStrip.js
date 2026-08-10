import PendingLink from '@/app/_components/ui/PendingLink';
import Icon from '@/app/_components/ui/Icon';

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayParts(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const weekday = WEEKDAYS_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return { weekday, dayNumber: String(d).padStart(2, '0') };
}

/**
 * The last seven days, coloured by how much of that day was actually entered -
 * so a day nobody opened is a red tile on screen before anyone has to read a
 * warning about it.
 *
 * This exists because of one real evening: the previous day was skipped
 * entirely, and the next entry went in against today with nothing on the page
 * to say the day behind it was empty. `<DateNav>` only ever shows the one day
 * you are on; this is the strip of days around it that DateNav cannot be,
 * because every other page that reuses DateNav (Lubricants, Purchases, Stock
 * checks) has its own idea of what "done" means for a day, and baking
 * readings-shaped logic into a component six other pages share would be the
 * wrong place for it.
 *
 * COLOUR IS NEVER THE ONLY SIGNAL. The fraction ("0/6", "3/6", "6/6") says the
 * same thing in words, the same discipline as the litre and stock figures
 * elsewhere in the app - see docs/UI_CONVENTIONS.md. A full day also gets a
 * check mark and an empty past day a warning triangle, so the two ends of the
 * scale are readable even in black and white.
 *
 * THE VIEWED DAY gets a solid dark border rather than a fill colour of its
 * own, because its fill already means something (how complete it is) and a
 * second meaning layered onto the same colour would be the thing to misread
 * in a hurry. Every tile carries the same 2px border width regardless of
 * state, so becoming the active tile changes its colour, not its size.
 *
 * A FIXED TILE HEIGHT, and `spinnerOnly` on the link. Without either, tapping
 * a tile stacked a spinner above the weekday/number/fraction while the page
 * loaded, which grew the tile - and the whole strip under it - for the
 * fraction of a second the navigation took. `spinnerOnly` swaps the content
 * for the spinner instead of stacking it, and the fixed height keeps that
 * swap from changing the tile's size at all.
 *
 * CENTRED ONLY WHEN IT FITS WITHOUT SCROLLING. Seven tiles need about 30rem;
 * centred inside a wider container that reads as tidy, but centring a row
 * that has to scroll sideways leaves both ends hanging off screen with
 * nothing to say so - see "Responsive: measure the container" in
 * docs/UI_CONVENTIONS.md.
 */
export default function ReadingDayStrip({ days, activeDate, basePath }) {
  return (
    <div className="@container">
      <div
        role="group"
        aria-label="Recent days, coloured by how much was entered"
        className="-mx-1 flex justify-start gap-2 overflow-x-auto px-1 pb-1 @[32rem]:justify-center"
      >
        {days.map((day) => {
          const { weekday, dayNumber } = dayParts(day.date);
          const total = day.total ?? 0;
          const entered = day.entered ?? 0;
          const isFull = total > 0 && entered === total;
          const isEmpty = entered === 0;
          const isActive = day.date === activeDate;

          const tone = isActive
            ? 'border-ink-900 bg-ink-50 text-ink-900'
            : isFull
              ? 'border-brand-300 bg-brand-50 text-brand-900'
              : isEmpty
                ? 'border-red-300 bg-red-50 text-red-900'
                : 'border-amber-300 bg-amber-50 text-amber-900';

          return (
            <PendingLink
              key={day.date}
              href={`${basePath}?date=${day.date}`}
              aria-current={isActive ? 'date' : undefined}
              spinnerOnly
              className={[
                'flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 px-2 text-center transition',
                tone,
                isActive ? '' : 'hover:brightness-95',
              ].join(' ')}
            >
              <span className="text-xs font-semibold uppercase tracking-wide">{weekday}</span>
              <span className="text-lg font-bold leading-none">{dayNumber}</span>
              <span className="flex items-center gap-1 text-xs font-semibold">
                {isFull ? (
                  <Icon name="check" className="h-3.5 w-3.5" />
                ) : isEmpty ? (
                  <Icon name="warning" className="h-3.5 w-3.5" />
                ) : null}
                {entered}/{total}
              </span>
            </PendingLink>
          );
        })}
      </div>
    </div>
  );
}
