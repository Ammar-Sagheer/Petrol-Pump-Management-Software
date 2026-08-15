/**
 * "↗ 37.3%" — a figure's change against the span before it, on the cards that
 * have one.
 *
 * THE PILL AND NOTHING ELSE. It shipped with the comparison spelled out beside
 * it ("up from Rs 1,204,950 yesterday") and the owner had it removed. He is
 * right: on a tile that already carries a label, a figure and a sparkline, a
 * fourth line of prose is the one thing on the card nobody is reading, and it
 * pushed the tiles taller for it. The arrow says which way, the percentage
 * says how far, and the number it came from is on yesterday's screen - which
 * is one date-step away and not worth a permanent line on every card.
 *
 * `previous` is still REQUIRED, because the badge cannot be computed without
 * it. It is simply no longer printed.
 *
 * THE ARROW IS DIRECTION; THE COLOUR IS WHETHER IT IS GOOD NEWS. They are not
 * the same axis and this app has to keep them apart: expenses up is an up
 * arrow and a RED pill, sales up is an up arrow and a green one. Colouring by
 * direction alone would paint "expenses rose 40%" in the same green as "sales
 * rose 40%", which is the one mistake a money app cannot make. Callers say
 * which way is good with `higherIsBetter`.
 *
 * NEVER THE ONLY STATEMENT OF THE CHANGE, and this matters more now that the
 * words are gone. The pill summarises two figures the page shows in full
 * elsewhere, and the ARROW carries the direction independently of the colour -
 * so a reader who cannot tell the red pill from the green one still sees which
 * way the figure moved. Colour is the second cue here, never the only one.
 */
export default function DeltaBadge({ current, previous, higherIsBetter = true }) {
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
    return <span className="badge mt-1 w-fit bg-ink-100 text-xs text-ink-600">No change</span>;
  }

  const up = change > 0;
  const good = up === higherIsBetter;

  const pillClass = good ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700';

  return (
    <span className={`badge tabular mt-1 w-fit whitespace-nowrap px-2 py-0.5 text-xs ${pillClass}`}>
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
  );
}
