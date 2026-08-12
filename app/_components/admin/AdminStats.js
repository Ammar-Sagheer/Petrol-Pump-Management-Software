import Icon from '@/app/_components/ui/Icon';

/**
 * What colour an icon ring wears, keyed by the icon's own name.
 *
 * The colour follows WHAT THE FIGURE IS, not whether it is good news -
 * cash and money-in are green because that is money arriving, credit and
 * money-out amber because it is money owed or gone, fuel blue, oil violet
 * (the colour lubricants already wear on their badge, see fuel-colors.js).
 * `tone` is a separate axis and still colours the figure itself and its
 * pill: a bad month's profit is a red number in a green ring, because the
 * ring is saying "this tile is about profit" and the number is saying "and
 * it is negative". Colouring both by tone would say the same thing twice
 * and leave the reader nothing to tell one tile from another at a glance,
 * which is the whole job of the ring.
 *
 * Anything not listed falls back to the neutral slate, so a new icon is
 * never accidentally loud.
 */
const RING_COLORS = {
  // money in
  cash: 'bg-brand-50 text-brand-600',
  moneyIn: 'bg-brand-50 text-brand-600',
  profit: 'bg-brand-50 text-brand-600',
  // money owed, or gone
  credit: 'bg-amber-50 text-amber-600',
  moneyOut: 'bg-amber-50 text-amber-600',
  expenses: 'bg-amber-50 text-amber-600',
  // the trades themselves
  fuelPump: 'bg-sky-50 text-sky-600',
  readings: 'bg-sky-50 text-sky-600',
  lubricants: 'bg-violet-50 text-violet-600',
  stock: 'bg-teal-50 text-teal-600',
  inventory: 'bg-teal-50 text-teal-600',
  purchases: 'bg-indigo-50 text-indigo-600',
  sales: 'bg-cyan-50 text-cyan-600',
  // people and places
  customers: 'bg-sky-50 text-sky-600',
  list: 'bg-cyan-50 text-cyan-600',
  banking: 'bg-indigo-50 text-indigo-600',
  assets: 'bg-violet-50 text-violet-600',
  // asset categories, matching the tinted badges on that page
  vehicle: 'bg-sky-50 text-sky-600',
  machinery: 'bg-amber-50 text-amber-600',
  property: 'bg-brand-50 text-brand-600',
  electronics: 'bg-violet-50 text-violet-600',
  other: 'bg-ink-100 text-ink-600',
  // alerts
  warning: 'bg-red-50 text-red-600',
  date: 'bg-ink-100 text-ink-600',
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
