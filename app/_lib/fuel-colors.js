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
 * more fragile signal. So one fuel is LIGHT and one is DARK.
 *
 * THE HUES ARE THE OWNER'S, THE LIGHTNESS IS THE RULE. He picked #FFD865 for
 * petrol and #FFBF00 for diesel - both his forecourt's yellows. As given, those
 * two sit 1.22x apart in luminance, which is no gap at all: the pair he had
 * already rejected as "they both look the same" was 1.10x. So diesel keeps his
 * hue (45deg, the same amber) and drops in lightness to #705400. Petrol stays
 * the light gold. That is a 7.3x gap, and both still carry text above AAA.
 *
 * The lesson for anyone changing these: take the hue the owner asks for, then
 * MAKE THE LIGHTNESS WORK. Refusing his colour is wrong; shipping two colours
 * of the same weight is also wrong. Darkening one is neither.
 *
 * Each pairing carries its own text well above AAA:
 *
 *     ink-900 on #FFD865    (petrol)   13.0:1
 *     white   on #705400    (diesel)    7.1:1
 *     white   on sky-800    (lubricant) 7.6:1
 *     white   on orange-800 (#9a3412)   7.3:1
 *
 * Lubricants get a third colour rather than sharing one: they appear in the
 * same purchase list as the two fuels, and a list where three things are told
 * apart only by their text is a list nobody scans. Theirs is NAVY, and the
 * reason is structural: the two fuels are now a warm pair (light gold, dark
 * amber), so the third thing should not be warm at all. Navy is the only cool
 * colour of the three, and blue against amber is the classic colour-blind-safe
 * axis - the one pairing that survives red-green deficiency intact.
 *
 * It was violet first ("girlish", says the owner - a perfectly good reason on
 * an app he uses every morning), then rust, which had to go once diesel became
 * a dark amber: two dark warm browns side by side is the same mistake again.
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
    /** Solid band or chip: the LIGHT half of the pair, so dark text on it. */
    solid: 'bg-[#FFD865] text-ink-900',
    /** Muted text on that solid band - captions, capacities. */
    solidMuted: 'text-ink-800',
    /** The card outline that goes round a solid band. */
    border: 'border-amber-500',
    /** A 4px rule along the top of a card - the quiet treatment. */
    accent: 'border-t-[#FFD865]',
    /** The fuel's own colour used as text on a white background. The gold
        itself is far too light to read as text, so this is its dark relative. */
    onWhite: 'text-amber-800',
    /** Charts, progress bars, anything that needs a raw value. */
    hex: '#FFD865',
  },
  diesel: {
    label: 'Diesel',
    /** The DARK half: the owner's #FFBF00 hue, dropped in lightness. */
    solid: 'bg-[#705400] text-white',
    solidMuted: 'text-amber-100',
    border: 'border-[#705400]',
    accent: 'border-t-[#705400]',
    onWhite: 'text-[#5C4400]',
    hex: '#705400',
  },
  lubricant: {
    label: 'Lubricant',
    solid: 'bg-sky-800 text-white',
    solidMuted: 'text-sky-100',
    border: 'border-sky-800',
    accent: 'border-t-sky-800',
    onWhite: 'text-sky-900',
    hex: '#075985',
  },
};

/** Anything unrecognised falls back to neutral rather than to a fuel's colour. */
export const NEUTRAL_FUEL = {
  label: '',
  solid: 'bg-ink-700 text-white',
  solidMuted: 'text-ink-100',
  border: 'border-ink-300',
  accent: 'border-t-ink-400',
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
