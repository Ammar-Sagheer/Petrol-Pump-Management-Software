/**
 * The avatar beside a customer's name on the Customers list.
 *
 * AN ICON, NOT AN INITIAL, at the owner's request ("use some other icons for
 * customer names"). What that trades away is worth writing down, because the
 * initial was doing a job: in a list of forty names it was a second, faster
 * cue for "which Ahmad is this" than reading the word itself. The name is
 * still right beside the icon, so nothing is unidentifiable - but the bubble
 * no longer helps tell two rows apart, and the tint below is now carrying
 * more of that work than it used to.
 *
 * SO THE ICON IS NOT THE SAME FOR EVERYONE. A customer with a vehicle on file
 * gets the vehicle; one without gets the person. That is a real distinction
 * (fleet accounts and walk-up credit are different kinds of customer, and the
 * pump treats them differently) rather than a decoration picked from a hat,
 * and it means the column is not forty identical circles. It also puts the
 * registration number's presence into a glance, which is the field the owner
 * scans for when two accounts share a name.
 *
 * THE TINT IS PICKED FROM THE CUSTOMER'S ID, not `Math.random()` - a row that
 * changed colour on every reload would look like a bug rather than a feature.
 * Deterministic per id is the "random" that is actually wanted: assigned once,
 * stable forever after.
 *
 * FOUR TINTS OF THE APP'S OWN TWO FAMILIES, not seven hues. This started as
 * sky / violet / amber / rose / indigo / teal / green, which is most of the
 * colour wheel dropped into a list to tell one name from another - and two of
 * those hues are what petrol and lubricant wear as identity elsewhere. Slate
 * and green at two steps each keep the list from looking uniform without
 * adding a hue to the app.
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

/**
 * Everything the avatar needs in one call: the icon name for `Icon.js` and the
 * two tint classes.
 */
export function customerAvatar(customer) {
  const color = customerAvatarColor(customer?.customer_id);
  return {
    ...color,
    icon: customer?.vehicle_number ? 'vehicle' : 'account',
  };
}
