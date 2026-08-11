/**
 * The one place petrol, diesel and lubricant are given a colour.
 *
 * Every badge, card band, chart series and progress bar reads from here, so the
 * pump's two fuels look the same on the Dashboard, the Readings sheet, the
 * Stock page, Purchases, the ledger and the reports. Before this existed the
 * colours were retyped in six files and had already drifted - the charts used
 * `#0284c7`/`#ca8a04` while the badges used the sky/amber 100s, so the same
 * fuel was one colour in a chart and another in the table under it.
 *
 * ---------------------------------------------------------------------------
 * ONE IS DARK AND ONE IS LIGHT. That is the whole design.
 * ---------------------------------------------------------------------------
 *
 * Learned by getting it wrong on the Stock page. Petrol and diesel were first
 * given two colours of the SAME weight - a dark navy and a dark amber - on the
 * reasoning that a matched pair would look like two fuels of equal standing.
 * The owner's verdict was immediate: "they both look the same, both are dark."
 *
 * Lightness is the cue the eye reads first, and the one that survives poor
 * light, a cheap tablet and any colour-vision deficiency. Hue is the weaker,
 * more fragile signal. So petrol is a DARK navy carrying white text and diesel
 * is a BRIGHT yellow carrying near-black text - a 6.5x gap in luminance, which
 * no amount of squinting collapses. Whichever surface they land on, keep that
 * relationship: if a change would make both light or both dark, it is wrong.
 *
 * Each pairing carries its own text well above AAA:
 *
 *     white   on sky-800    (#075985)   7.6:1
 *     ink-900 on amber-400  (#fbbf24)  10.7:1
 *     white   on violet-700 (#6d28d9)   7.1:1
 *
 * Lubricants get a third colour rather than sharing one: they appear in the
 * same purchase list as the two fuels, and a list where three things are told
 * apart only by their text is a list nobody scans.
 *
 * COLOUR IS NEVER THE ONLY CUE. Every surface that uses these also names the
 * fuel in words - the badge carries its label, the cards carry a heading, the
 * charts carry a legend. A screen that only works in colour does not work.
 *
 * A plain data module, not an export of a `'use client'` component, because
 * server-rendered pages and client charts both read it - same reason
 * `asset-categories.js` is separate from `CompanyAssetForm`.
 */
export const FUEL_COLORS = {
  petrol: {
    label: 'Petrol',
    /** Solid band or chip: the dark half of the pair. */
    solid: 'bg-sky-800 text-white',
    /** Muted text on that solid band - captions, capacities. */
    solidMuted: 'text-sky-100',
    /** The card outline that goes round a solid band. */
    border: 'border-sky-800',
    /** The fuel's own colour used as text on a white background. */
    onWhite: 'text-sky-900',
    /** Charts, progress bars, anything that needs a raw value. */
    hex: '#075985',
  },
  diesel: {
    label: 'Diesel',
    solid: 'bg-amber-400 text-ink-900',
    solidMuted: 'text-ink-800',
    border: 'border-amber-500',
    onWhite: 'text-amber-900',
    hex: '#fbbf24',
  },
  lubricant: {
    label: 'Lubricant',
    solid: 'bg-violet-700 text-white',
    solidMuted: 'text-violet-100',
    border: 'border-violet-700',
    onWhite: 'text-violet-800',
    hex: '#6d28d9',
  },
};

/** Anything unrecognised falls back to neutral rather than to a fuel's colour. */
export const NEUTRAL_FUEL = {
  label: '',
  solid: 'bg-ink-700 text-white',
  solidMuted: 'text-ink-100',
  border: 'border-ink-300',
  onWhite: 'text-ink-900',
  hex: '#475569',
};

export function fuelColor(fuelType) {
  return FUEL_COLORS[fuelType] ?? NEUTRAL_FUEL;
}
