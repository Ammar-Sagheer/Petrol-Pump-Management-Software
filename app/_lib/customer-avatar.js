/**
 * The avatar bubble beside a customer's name on the Customers list, in the
 * style of the MUI "Minimal Dashboard" list this was adapted from: a
 * coloured circle carrying the customer's first initial.
 *
 * The colour is picked from the customer's id, not `Math.random()` - a name
 * that changed colour every time the page reloaded would look like a bug
 * rather than a feature, and a colour is one more thing the owner uses to
 * spot a regular in a long list. Deterministic per id is the "random" that
 * is actually wanted here: assigned once, stable forever after.
 */
const COLORS = [
  { bg: 'bg-brand-100', text: 'text-brand-700' },
  { bg: 'bg-sky-100', text: 'text-sky-700' },
  { bg: 'bg-violet-100', text: 'text-violet-700' },
  { bg: 'bg-amber-100', text: 'text-amber-700' },
  { bg: 'bg-rose-100', text: 'text-rose-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  { bg: 'bg-teal-100', text: 'text-teal-700' },
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
