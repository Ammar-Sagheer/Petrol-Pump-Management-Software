/**
 * The little trend line inside a stat tile.
 *
 * HAND-DRAWN SVG, NOT RECHARTS, and that is the whole point of the file. The
 * app already has three real charts (SalesTrendChart and friends) and they are
 * all `'use client'` Recharts components with axes, tooltips, legends and a
 * ResponsiveContainer that has to measure itself in the browser before it can
 * draw. Putting one of those in each of four stat tiles would send four more
 * client bundles and four measure-then-paint cycles to a tablet, so the tiles
 * would land empty and pop in a beat later - on the row that is the first
 * thing the owner looks at each morning.
 *
 * A sparkline needs none of that. It has no axes, no labels, no interaction
 * and a fixed size, so it is just a path: server-rendered, no JavaScript, no
 * layout shift, a few hundred bytes.
 *
 * IT IS DECORATION WITH A SHAPE, NOT A FIGURE TO READ. There is deliberately
 * no axis, no scale and no tooltip, so nothing here can be misread as a
 * quantity - it says "rising", "falling", "steady", and the number it belongs
 * to is right beside it at 24px. That is also why it is `aria-hidden` and the
 * tile carries the real text: a screen reader gets the figure and its
 * comparison, not a shrug of unlabelled geometry.
 *
 * `currentColor` throughout, so the caller sets the hue with a text class and
 * the fill and stroke follow together.
 */
export default function Sparkline({ data, className = '', width = 72, height = 34 }) {
  const points = (data ?? []).map(Number).filter((n) => Number.isFinite(n));

  /* Two points is the minimum that can show a direction; one is a dot that
     says nothing, and none is a tile whose page has no series behind it yet.
     Both render nothing rather than an empty box, so a tile without data is
     simply a tile without a sparkline. */
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);

  /* A flat series (every day identical, or a single value repeated) would
     divide by zero and then draw off the top of the box. Span of 1 puts the
     line through the middle instead, which is the honest picture of "no
     change". */
  const span = max - min || 1;
  const step = width / (points.length - 1);

  /* Inset by the stroke width top and bottom, or the peak and the trough are
     drawn with half the line hanging outside the viewBox and get clipped. */
  const pad = 2;
  const y = (value) => height - pad - ((value - min) / span) * (height - pad * 2);

  const line = points
    .map((value, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(2)},${y(value).toFixed(2)}`)
    .join(' ');

  const area = `${line} L${width.toFixed(2)},${height} L0,${height} Z`;

  return (
    /*
     * NO WIDTH OR HEIGHT ATTRIBUTE - the caller sizes it with a class, and the
     * viewBox scales to whatever it is given. An SVG carrying `width={72}` is
     * 72px wide whatever the box around it says, so in a flex row beside a
     * figure that cannot shrink it pushed straight out through the card's
     * right edge on narrow tiles. Sized by class it shrinks with its
     * container and stays inside the padding.
     *
     * `preserveAspectRatio="none"` lets it squash horizontally rather than
     * crop - a sparkline has no true aspect ratio to protect, only a shape -
     * and `vectorEffect` keeps the stroke 2px while that happens, instead of
     * thinning out as the box narrows.
     */
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={area} fill="currentColor" opacity="0.14" />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
