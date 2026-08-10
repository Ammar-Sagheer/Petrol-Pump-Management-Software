import PendingLink from '@/app/_components/ui/PendingLink';
import Icon from '@/app/_components/ui/Icon';

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayParts(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const weekday = WEEKDAYS_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return { weekday, dayNumber: String(d).padStart(2, '0') };
}

/**
 * The last ten days, coloured by how much of that day was actually entered -
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
 * THE VIEWED DAY gets a ring rather than a fill colour of its own, because its
 * fill already means something (how complete it is) and a second meaning
 * layered onto the same colour would be the thing to misread in a hurry.
 */
export default function ReadingDayStrip({ days, activeDate, basePath }) {
  return (
    <div
      role="group"
      aria-label="Recent days, coloured by how much was entered"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
    >
      {days.map((day) => {
        const { weekday, dayNumber } = dayParts(day.date);
        const total = day.total ?? 0;
        const entered = day.entered ?? 0;
        const isFull = total > 0 && entered === total;
        const isEmpty = entered === 0;
        const isActive = day.date === activeDate;

        const tone = isFull
          ? 'border-brand-300 bg-brand-50 text-brand-900'
          : isEmpty
            ? 'border-red-300 bg-red-50 text-red-900'
            : 'border-amber-300 bg-amber-50 text-amber-900';

        return (
          <PendingLink
            key={day.date}
            href={`${basePath}?date=${day.date}`}
            aria-current={isActive ? 'date' : undefined}
            className={[
              'flex w-16 shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition',
              tone,
              isActive ? 'ring-2 ring-offset-1 ring-ink-900' : 'hover:brightness-95',
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
  );
}
