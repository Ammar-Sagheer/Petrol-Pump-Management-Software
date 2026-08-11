import Icon from '@/app/_components/ui/Icon';

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
 * that means anything, so this is opt-in rather than automatic.
 */
export function StatTile({ label, value, sub, tone = 'default', icon }) {
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

  if (icon) {
    const ringClass =
      tone === 'positive'
        ? 'bg-brand-50 text-brand-600'
        : tone === 'negative'
          ? 'bg-red-50 text-red-600'
          : 'bg-ink-100 text-ink-600';

    return (
      <div className="card flex items-center gap-3 px-4 py-4 @[50rem]:px-5 @[50rem]:py-5">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${ringClass}`}
          aria-hidden="true"
        >
          <Icon name={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="figure-label">{label}</p>
          <p className={`tabular whitespace-nowrap text-xl font-bold @[50rem]:text-2xl ${valueTone}`}>
            {value}
          </p>
          {sub_}
        </div>
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
  const columnClass = columns === 2 ? '' : '@[50rem]:grid-cols-4';

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
