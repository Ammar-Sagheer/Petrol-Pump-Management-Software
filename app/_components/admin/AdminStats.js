/**
 * The headline figures at the top of a page.
 *
 * These are stat tiles rather than a chart on purpose: four single numbers with
 * no trend to show are read faster as text than as any plot.
 *
 * DARK, because they are the headline. The strip was white like everything
 * else, which left the day's takings - the first figure the owner wants each
 * morning - as the palest thing on a page whose fuel cards had just been given
 * colour. Weight should follow importance, and it was inverted.
 *
 * It is a NEUTRAL dark rather than a colour, deliberately. Cash and credit are
 * not products and have no colour of their own; painting them blue or amber
 * would spend the fuel hues on something that is not a fuel, after which those
 * hues stop meaning "petrol" and "diesel". Slate can never collide with them.
 */
export function StatTile({ label, value, sub, tone = 'default' }) {
  // Light tints of the same two tones - brand-700 and red-700 are unreadable on
  // a dark tile.
  const valueTone =
    tone === 'positive' ? 'text-brand-300' : tone === 'negative' ? 'text-red-300' : 'text-white';

  return (
    <div className="bg-ink-900 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      {/* nowrap, and a step smaller on a phone. "Rs 4,386,211" in a
          half-width tile was breaking after the "Rs", which reads for a moment
          as two separate figures - the one thing a money tile must never do. */}
      <p
        className={`tabular mt-1 whitespace-nowrap text-xl font-bold @[50rem]:text-2xl ${valueTone}`}
      >
        {value}
      </p>
      {sub ? <p className="tabular mt-0.5 text-sm text-ink-300">{sub}</p> : null}
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
      <section
        className={`card grid grid-cols-1 gap-px overflow-hidden border-ink-900 bg-ink-700 @[24rem]:grid-cols-2 ${columnClass}`}
      >
        {children}
      </section>
    </div>
  );
}
