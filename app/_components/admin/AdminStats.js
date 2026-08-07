/**
 * The headline figures at the top of the dashboard.
 *
 * These are stat tiles rather than a chart on purpose: four single numbers with
 * no trend to show are read faster as text than as any plot.
 */
export function StatTile({ label, value, sub, tone = 'default' }) {
  const valueTone =
    tone === 'positive' ? 'text-brand-700' : tone === 'negative' ? 'text-red-700' : 'text-ink-900';

  return (
    <div className="bg-white px-4 py-4">
      <p className="figure-label">{label}</p>
        {/* nowrap, and a step smaller on a phone. "Rs 4,386,211" in a
          half-width tile was breaking after the "Rs", which reads for a moment
          as two separate figures - the one thing a money tile must never do. */}
      <p className={`tabular mt-1 whitespace-nowrap text-xl font-bold sm:text-2xl ${valueTone}`}>
        {value}
      </p>
      {sub ? <p className="tabular mt-0.5 text-sm text-ink-600">{sub}</p> : null}
    </div>
  );
}

export function StatGrid({ children, columns = 4 }) {
  const columnClass = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4';

  /*
   * One tile per row on the narrowest phones. Two tiles across at 320-360px
   * leaves about 130px of usable width, and "Rs 4,386,211" does not fit that
   * at a readable size - it either broke after the "Rs" (two lines that read
   * as two figures) or, once held on one line, ran out of its own tile. Full
   * width below 380px, and the number fits whole either way.
   */
  return (
    <section
      className={`card grid grid-cols-1 gap-px overflow-hidden bg-ink-200 min-[380px]:grid-cols-2 ${columnClass}`}
    >
      {children}
    </section>
  );
}
