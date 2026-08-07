import PendingLink from '@/app/_components/ui/PendingLink';
import DateJump from '@/app/_components/admin/DateJump';
import Icon from '@/app/_components/ui/Icon';

import { todayISO, shiftISODate, formatDate } from '@/app/_lib/date-helpers';

/**
 * Previous / next day, a date box, and a way back to today.
 *
 * The date box lives in DateJump because it needs to be a Client Component to
 * navigate the moment a date is picked; everything else here stays on the
 * server. See that file for why picking a date is enough on its own and what
 * the old Go button was costing.
 *
 * Anything passed as children joins the end of the button row. A page-level
 * action for the day on screen belongs on the same line as the day's controls,
 * sharing their height and baseline, rather than floating beside the block and
 * centring itself against the date caption underneath.
 */
export default function DateNav({
  date,
  basePath,
  previousDate,
  nextDate,
  paramName = 'date',
  children,
}) {
  const today = todayISO();
  const isToday = date === today;
  const isYesterday = date === shiftISODate(today, -1);
  const isFuture = date > today;

  const relativeLabel = isToday
    ? 'Today'
    : isYesterday
      ? 'Yesterday'
      : isFuture
        ? 'Future date'
        : null;

  const labelStyle = isToday
    ? 'bg-brand-100 text-brand-800'
    : isFuture
      ? 'bg-amber-100 text-amber-900'
      : 'bg-ink-200 text-ink-700';

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <PendingLink
          href={`${basePath}?${paramName}=${previousDate}`}
          className="btn-secondary px-3"
          aria-label={`Go to ${formatDate(previousDate)}`}
          spinnerOnly
        >
          <Icon name="chevronRight" className="h-5 w-5 rotate-180" />
        </PendingLink>

        <DateJump date={date} basePath={basePath} paramName={paramName} />

        <PendingLink
          href={`${basePath}?${paramName}=${nextDate}`}
          className="btn-secondary px-3"
          aria-label={`Go to ${formatDate(nextDate)}`}
          spinnerOnly
        >
          <Icon name="chevronRight" className="h-5 w-5" />
        </PendingLink>

        {/* Only worth showing when it would actually do something. */}
        {!isToday ? (
          <PendingLink href={basePath} className="btn-primary py-2 text-sm">
            Back to today
          </PendingLink>
        ) : null}

        {children}
      </div>

      {/*
        Which day is on screen, in words, and deliberately the loudest thing in
        this block.

        A native date box is drawn by the browser in the BROWSER's locale, which
        no amount of markup can change: on an en-US browser the 7th of August
        renders "08/07/2026", which anyone reading dates day-first sees as the
        8th of July. That box therefore cannot be trusted to say which day is
        being worked on - so the written date carries it instead, at a size and
        weight that beats the numbers above it, with Today / Yesterday spelled
        out beside it. The box is left to be what it is good at: jumping to a
        date. Entering a reading against the wrong day is expensive - each
        opening comes from the day before - and this is the only guard the
        reader gets before they start typing.
      */}
      <p className="flex items-center gap-2 text-base font-semibold text-ink-800">
        {relativeLabel ? (
          <span className={`badge ${labelStyle}`}>{relativeLabel}</span>
        ) : null}
        <span>{formatDate(date)}</span>
      </p>
    </div>
  );
}
