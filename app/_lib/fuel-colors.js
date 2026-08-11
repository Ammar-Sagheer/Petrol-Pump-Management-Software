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
 * THE HUES ARE THE OWNER'S. THE LIGHTNESS IS THE RULE.
 * ---------------------------------------------------------------------------
 *
 * He chose these three off his own forecourt: #54A2B3 petrol, #FFFF00 diesel,
 * #D4AF37 lubricant. They are used exactly as given wherever they are FILLED.
 *
 * What the code has to protect is the separation, and it was learned the hard
 * way. Petrol and diesel were once two colours of the same weight - a dark navy
 * and a dark amber - and the owner's verdict was immediate: "they both look the
 * same, both are dark." A later pair of his, #FFD865 and #FFBF00, sat 1.22x
 * apart, which is no gap either.
 *
 * Lightness is the cue the eye reads first and the one that survives poor
 * light, a cheap tablet and any colour-vision deficiency; hue is the weaker
 * signal. This set works because petrol and diesel - the pair that actually
 * gets confused - are 3.0x apart in luminance AND on opposite sides of the
 * colour wheel, teal against yellow. Keep that. If a change would leave the two
 * fuels the same weight, it is wrong however good the hues look.
 *
 * A LIGHT COLOUR CANNOT DO EVERY JOB. Pure yellow is 16.6:1 behind dark text
 * and superb as a filled band, but 1.07:1 against a white card - invisible as a
 * 4px rule, and hopeless as text. So each fuel carries a darker relative of the
 * SAME HUE for rules, borders, chart marks and text on white. The identity is
 * the hue; the lightness is chosen per job.
 *
 * Each filled band clears AAA on its own text: 6.1:1, 16.6:1 and 8.5:1.
 *
 * Lubricants get a third colour rather than sharing one: they appear in the
 * same purchase list as the two fuels, and a list where three things are told
 * apart only by their text is a list nobody scans. Theirs has been violet
 * ("girlish", said the owner - a perfectly good reason on an app he uses every
 * morning), then rust, then navy, and is now his gold.
 *
 * TWO WEIGHTS, AND THE LOUD ONE IS RATIONED.
 *
 * `solid` fills a header band; `accent` is a 4px rule along the top of an
 * otherwise plain card. The filled band is reserved for surfaces where TYPING
 * INTO THE WRONG ONE COSTS SOMETHING - the Stock page's dip boxes, where a
 * petrol reading in the diesel card corrupts the baseline every later day is
 * measured from. Everywhere the fuels are only being READ, the accent does the
 * job: it separates them just as reliably and leaves the page calm.
 *
 * The first version banded everything. Six saturated blocks down one dashboard
 * is colour-blocking rather than design, and the owner said so. Loud
 * everywhere is the same as loud nowhere - nothing stands out because
 * everything does.
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
    /** The exact colour, filled. Dark text on it - 6.1:1. */
    solid: 'bg-[#54A2B3] text-ink-900',
    /** Muted text on that band - captions, capacities. */
    solidMuted: 'text-ink-800',
    /** Outline round a filled band, and the 4px quiet rule. Same hue, dropped
        in lightness: the raw colour is only 2.9:1 against a white card, which
        is thin for a line you are meant to notice. */
    border: 'border-[#38727F]',
    accent: 'border-t-[#38727F]',
    /** As text on white. The raw colour fails badly there; this is 7.7:1. */
    /** A chosen option inside a form on this fuel's card. */
    selected: 'border-[#38727F] bg-[#54A2B3]/15 text-[#2C5963]',
    onWhite: 'text-[#2C5963]',
    /** Charts and progress bars - marks that sit on white or pale grey. */
    hex: '#38727F',
  },
  diesel: {
    label: 'Diesel',
    /** Pure yellow, filled. 16.6:1 with dark text - the best of the three. */
    solid: 'bg-[#FFFF00] text-ink-900',
    solidMuted: 'text-ink-800',
    border: 'border-[#B8B800]',
    accent: 'border-t-[#B8B800]',
    /** A chosen option inside a form on this fuel's card. */
    selected: 'border-[#B8B800] bg-[#FFFF00]/25 text-[#5C5C00]',
    onWhite: 'text-[#5C5C00]',
    hex: '#B8B800',
  },
  lubricant: {
    label: 'Lubricant',
    solid: 'bg-[#D4AF37] text-ink-900',
    solidMuted: 'text-ink-800',
    border: 'border-[#977B20]',
    accent: 'border-t-[#977B20]',
    /** A chosen option inside a form on this fuel's card. */
    selected: 'border-[#977B20] bg-[#D4AF37]/20 text-[#655216]',
    onWhite: 'text-[#655216]',
    hex: '#977B20',
  },
};
/** Anything unrecognised falls back to neutral rather than to a fuel's colour. */
export const NEUTRAL_FUEL = {
  label: '',
  solid: 'bg-ink-700 text-white',
  solidMuted: 'text-ink-100',
  border: 'border-ink-300',
  accent: 'border-t-ink-400',
  selected: 'border-ink-600 bg-ink-100 text-ink-900',
  onWhite: 'text-ink-900',
  hex: '#475569',
};

export function fuelColor(fuelType) {
  return FUEL_COLORS[fuelType] ?? NEUTRAL_FUEL;
}

/**
 * The order the fuels are shown in, left to right, wherever they appear as a
 * pair or a list.
 *
 * DIESEL FIRST. Not alphabetical and not the database's order - the `fuel_type`
 * enum was declared petrol-first in migration 001, so anything ordered by it
 * comes back that way. This matches the pump's own layout instead, which is
 * what the person reading the screen is holding in his head. Sorting here
 * rather than re-declaring the enum keeps a display choice out of the schema.
 */
export const FUEL_ORDER = ['diesel', 'petrol', 'lubricant'];

/** Comparator for anything with a `fuel_type`. Unknown types sort last. */
export function byFuelOrder(a, b) {
  const rank = (t) => {
    const i = FUEL_ORDER.indexOf(t);
    return i === -1 ? FUEL_ORDER.length : i;
  };
  return rank(a?.fuel_type) - rank(b?.fuel_type);
}
