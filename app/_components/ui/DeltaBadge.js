/**
 * "↗ 37.3%  up from Rs 1,204,950" — a figure's change against the span before
 * it, on the cards that have one.
 *
 * TWO PARTS ON PURPOSE, and the split is the whole design. The percentage goes
 * in a coloured pill because it is the part read at a glance; what it is
 * measured against goes beside it in plain muted text, because that is the
 * part read only when the pill is surprising. Putting the whole sentence in
 * the pill makes a long chip that competes with the figure above it; leaving
 * the percentage out of a pill makes it just another grey line.
 *
 * THE ARROW IS DIRECTION; THE COLOUR IS WHETHER IT IS GOOD NEWS. They are not
 * the same axis and this app has to keep them apart: expenses up is an up
 * arrow and a RED pill, sales up is an up arrow and a green one. Colouring by
 * direction alone would paint "expenses rose 40%" in the same green as "sales
 * rose 40%", which is the one mistake a money app cannot make. Callers say
 * which way is good with `higherIsBetter`.
 *
 * `from` is pre-formatted by the caller, for the same reason Sparkline's tips
 * are: `formatPKR` and `formatLitres` are the app's single answer to how a
 * number is written, and a component that re-implements either is how two
 * parts of one page start disagreeing.
 *
 * NEVER THE ONLY STATEMENT OF THE CHANGE. The pill is a summary of two figures
 * the page shows in full elsewhere; the arrow's meaning is also written in the
 * words beside it ("up from" / "down from"), so nothing here depends on
 * telling red from green.
 */
export default function DeltaBadge({ current, previous, from, higherIsBetter = true }) {
  const now = Number(current);
  const before = Number(previous);

  if (!Number.isFinite(now) || !Number.isFinite(before)) return null;

  /*
   * A PERCENTAGE OF ZERO IS NOT A PERCENTAGE. The first month of a new expense
   * category, or the day after a pump opens, has nothing to divide by -
   * "+∞%" or "+100%" would both be inventions. The badge says the direction in
   * words and drops the number instead, which is the honest version of the
   * same sentence.
   */
  const hasBase = before !== 0;
  const change = now - before;
  const pct = hasBase ? (change / Math.abs(before)) * 100 : null;

  if (change === 0) {
    return (
      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="badge bg-ink-100 text-xs text-ink-600">No change</span>
        {from ? <span className="text-xs text-ink-500">same as {from}</span> : null}
      </span>
    );
  }

  const up = change > 0;
  const good = up === higherIsBetter;

  const pillClass = good ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700';

  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className={`badge tabular whitespace-nowrap px-2 py-0.5 text-xs ${pillClass}`}>
        <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" aria-hidden="true">
          {up ? (
            <path
              d="M2 8.5 5 5.5l2 2L10 4M10 4H7.2M10 4v2.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <path
              d="M2 3.5 5 6.5l2-2L10 8M10 8H7.2M10 8V5.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
        {pct === null ? (up ? 'New' : 'Down') : `${Math.abs(pct).toFixed(1)}%`}
      </span>
      {from ? (
        <span className="whitespace-nowrap text-xs text-ink-500">
          {up ? 'up from' : 'down from'} {from}
        </span>
      ) : null}
    </span>
  );
}
