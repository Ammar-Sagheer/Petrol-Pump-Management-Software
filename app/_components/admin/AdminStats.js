import Icon from '@/app/_components/ui/Icon';

/**
 * What colour an icon ring wears, keyed by the icon's own name.
 *
 * FOUR COLOURS, AND EACH ONE MEANS SOMETHING. Green is money arriving,
 * amber is money owed or gone, red is something to look at, slate is
 * everything else. That is the whole vocabulary.
 *
 * It used to be seven hues - sky, cyan, violet, teal, indigo on top of these -
 * one per KIND of thing rather than per meaning: fuel blue, oil violet, stock
 * teal, banking indigo. It read as a rainbow rather than a palette, and the
 * colours were carrying nothing the icon and the label did not already say.
 * Worse, two of those hues were the fuels' own: a blue ring on "Litres sold"
 * and a violet one on "Oil sold" are exactly the colours petrol and lubricant
 * wear as identity elsewhere, so the ring quietly competed with the one cue
 * that has to stay unmistakable.
 *
 * The rule now: **colour a ring only when the colour adds meaning the icon
 * cannot.** A wallet icon already says "expenses"; the amber says "and this is
 * money leaving". A pump icon already says "fuel"; there is nothing left for a
 * colour to add, so it stays slate.
 *
 * `tone` remains a separate axis and still colours the figure itself and its
 * pill, so a bad month's profit is a red number in a green ring: the ring says
 * "this tile is about money coming in", the number says "and it went the wrong
 * way".
 */
const RING_COLORS = {
  // Money arriving.
  cash: 'bg-brand-50 text-brand-700',
  moneyIn: 'bg-brand-50 text-brand-700',
  profit: 'bg-brand-50 text-brand-700',
  sales: 'bg-brand-50 text-brand-700',
  // Money owed, or already gone.
  credit: 'bg-amber-50 text-amber-700',
  moneyOut: 'bg-amber-50 text-amber-700',
  expenses: 'bg-amber-50 text-amber-700',
  purchases: 'bg-amber-50 text-amber-700',
  list: 'bg-amber-50 text-amber-700',
  // Something to look at.
  warning: 'bg-red-50 text-red-700',
};

const RING_FALLBACK = 'bg-ink-100 text-ink-600';

/**
 * The headline figures at the top of a page.
 *
 * These are stat tiles rather than a chart on purpose: four single numbers with
 * no trend to show are read faster as text than as any plot.
 *
 * They stay WHITE. A dark slate strip was tried here to make the takings lead
 * the page - they are the first figure wanted each morning, and were the palest
 * thing on it - and the owner's verdict was that it looked bad. It did: a black
 * bar across the top of an otherwise light page reads as a toolbar or an error
 * state, not as a headline. Hierarchy on this page comes from the section order
 * and the size of the figures instead.
 *
 * Each tile is its OWN raised card, not a cell in a shared grid. Individually
 * shadowed, gapped tiles read as separate figures to check off one at a time -
 * a single slab with hairline dividers read as one fused block, which is the
 * opposite of "four things to verify against the drawer". `sub` renders as a
 * small pill rather than plain text when the tile has a direction (`tone`
 * `positive`/`negative`) - the same information, just legible at a glance the
 * way a coloured tag is and a sentence is not.
 *
 * `icon` is optional and switches the tile to a horizontal layout - an icon
 * in a tinted ring beside the label and figure, the shape used on the
 * Customers stat row. Left off (the default), the tile stays the plain
 * label-over-figure stack every other page uses; not every stat has an icon
 * that means anything, so this is opt-in rather than automatic. The ring's
 * colour comes from the icon's own meaning (see RING_COLORS), not from
 * `tone`; pass `ringTone` to override it.
 *
 * `iconNode` is the escape hatch for a one-off icon that isn't in the app's
 * own hand-drawn set (`Icon.js`) - currently only the Customers "Total
 * outstanding" tile, which uses a Material UI icon at the owner's request.
 * Pass a rendered node (already sized) instead of a name; `icon` is ignored
 * when this is set. Reach for `icon` first - this exists so one page can
 * differ without teaching the whole set about a package the rest of the app
 * does not use.
 */
export function StatTile({ label, value, sub, tone = 'default', icon, iconNode, ringTone }) {
  const valueTone =
    tone === 'positive' ? 'text-brand-700' : tone === 'negative' ? 'text-red-700' : 'text-ink-900';

  const pillClass =
    tone === 'positive'
      ? 'bg-brand-50 text-brand-700'
      : tone === 'negative'
        ? 'bg-red-50 text-red-700'
        : 'bg-ink-100 text-ink-600';

  const sub_ = sub ? (
    <span
      className={`tabular inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${pillClass}`}
    >
      {tone === 'positive' ? (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0" aria-hidden="true">
          <path d="M6 2 10 8H2Z" fill="currentColor" />
        </svg>
      ) : tone === 'negative' ? (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0" aria-hidden="true">
          <path d="M6 10 2 4h8Z" fill="currentColor" />
        </svg>
      ) : null}
      {sub}
    </span>
  ) : null;

  if (icon || iconNode) {
    // Keyed by the icon, not by `tone` - see RING_COLORS above for why the
    // two are deliberately different axes. `ringTone` overrides both, for a
    // tile whose icon means something different than usual in context.
    const ringClass = ringTone ?? RING_COLORS[icon] ?? RING_FALLBACK;

    return (
      <div className="card flex flex-col gap-2 px-4 py-4 @[50rem]:px-5 @[50rem]:py-5">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${ringClass}`}
            aria-hidden="true"
          >
            {iconNode ?? <Icon name={icon} className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="figure-label">{label}</p>
            <p
              className={`tabular whitespace-nowrap text-xl font-bold @[50rem]:text-2xl ${valueTone}`}
            >
              {value}
            </p>
          </div>
        </div>
        {/* `sub` sits below the icon+figure row, spanning the full card width
            - not squeezed into the text column beside the ring. A long
            description ("sales - stock bought - expenses") wrapped to three
            cramped lines in that narrower column; the full width gives it
            room to wrap at most once. */}
        {sub_}
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-2 px-4 py-4 @[50rem]:px-5 @[50rem]:py-5">
      <p className="figure-label">{label}</p>
      {/* nowrap, and a step smaller on a phone. "Rs 4,386,211" in a
          half-width tile was breaking after the "Rs", which reads for a moment
          as two separate figures - the one thing a money tile must never do. */}
      <p className={`tabular whitespace-nowrap text-xl font-bold @[50rem]:text-2xl ${valueTone}`}>
        {value}
      </p>
      {sub_}
    </div>
  );
}

export function StatGrid({ children, columns = 4 }) {
  const columnClass =
    columns === 2 ? '' : columns === 3 ? '@[50rem]:grid-cols-3' : '@[50rem]:grid-cols-4';

  /*
   * The column count follows the WIDTH OF THIS GRID, not the width of the
   * window - hence @container and the @[..] variants rather than sm: and lg:.
   *
   * Those are not the same number any more. The sidebar takes 240px off the
   * left, so at a 1024px window this grid has about 768px to work in. Asked
   * for four columns at the `lg` viewport breakpoint it gave each tile 192px,
   * and "Rs 4,386,211" at 24px needs more than that - the figures ran into
   * their own dividers. Measured against the grid itself, four columns wait
   * until there is genuinely room for them.
   *
   * The bottom end is the same problem from the other side: two tiles across
   * a 320px phone leaves about 130px each, where the number either broke
   * after the "Rs" - two lines that read for a moment as two figures - or ran
   * out of its tile. One per row until 24rem.
   */
  return (
    <div className="@container">
      <div className={`grid grid-cols-1 gap-4 @[24rem]:grid-cols-2 ${columnClass}`}>{children}</div>
    </div>
  );
}
