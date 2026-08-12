/**
 * The avatar bubble beside a customer's name on the Customers list, in the
 * style of the MUI "Minimal Dashboard" list this was adapted from: a circle
 * carrying the customer's first initial.
 *
 * The tint is picked from the customer's id, not `Math.random()` - a name that
 * changed colour on every reload would look like a bug rather than a feature,
 * and it is one more thing the owner uses to spot a regular in a long list.
 * Deterministic per id is the "random" that is actually wanted: assigned once,
 * stable forever after.
 *
 * FOUR TINTS OF THE APP'S OWN TWO FAMILIES, not seven hues. This started as
 * sky / violet / amber / rose / indigo / teal / green, which is most of the
 * colour wheel dropped into a list to tell one name from another - and two of
 * those hues are what petrol and lubricant wear as identity elsewhere. The
 * INITIAL is what actually distinguishes a customer; the tint only has to keep
 * the row from looking uniform, and slate and green at two steps each do that
 * without adding a hue to the app.
 */
const COLORS = [
  { bg: 'bg-brand-100', text: 'text-brand-800' },
  { bg: 'bg-ink-200', text: 'text-ink-700' },
  { bg: 'bg-brand-50', text: 'text-brand-700' },
  { bg: 'bg-ink-100', text: 'text-ink-600' },
];

function hashOf(seed) {
  const text = String(seed ?? '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function customerInitial(name) {
  const trimmed = String(name ?? '').trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

export function customerAvatarColor(seed) {
  return COLORS[hashOf(seed) % COLORS.length];
}
