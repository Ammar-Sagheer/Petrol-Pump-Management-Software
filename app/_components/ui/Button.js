'use client';

import MuiButton from '@mui/material/Button';

/**
 * The app's buttons, rendered by Material UI at the owner's request.
 *
 * WHAT THIS REPLACED, AND WHAT THAT COSTS. The app used three CSS classes
 * (`.btn-primary` / `.btn-secondary` / `.btn-danger`) sized at `py-3`, giving
 * a tap target around 50px. That number was deliberate - this app is used on
 * a cheap tablet in a pump office, pressed with a thumb, sometimes in a hurry
 * - and MUI's default medium Button is around 36px. The owner asked for MUI's
 * default look as-is, so that is what this renders: MUI's own sizing, its
 * uppercase label, its palette and its elevation. If the smaller target ever
 * becomes a problem in the yard, `size="large"` here is the one-line fix, and
 * it is worth trying before anything more elaborate.
 *
 * THE THREE VARIANTS map onto MUI's own, so a call site names an intent
 * rather than a Material recipe:
 *
 *   primary    the one confirming action on a view   contained
 *   secondary  everything else                       outlined
 *   danger     destructive, or sign-out              outlined + error
 *
 * The rule about WHICH to use has not changed and still lives in
 * docs/UI_CONVENTIONS.md - one primary per view, `danger` for anything
 * destructive rather than a hand-rolled red.
 *
 * RENDERING AS A LINK. Several of these are navigation, not actions
 * ("Back to customers", "See all rates"). Pass `component={Link} href=...`
 * and MUI renders an `<a>` with the same styling, so a link that looks like
 * a button is still a real link - middle-click and open-in-new-tab keep
 * working, which they do not on a button with an onClick router push.
 */
const VARIANTS = {
  primary: { variant: 'contained', color: 'primary' },
  secondary: { variant: 'outlined', color: 'inherit' },
  danger: { variant: 'outlined', color: 'error' },
};

export default function Button({ variant = 'secondary', sx, ...props }) {
  const mui = VARIANTS[variant] ?? VARIANTS.secondary;

  /*
   * The gap is the one thing added on top of MUI's defaults, and it is
   * fixing a regression rather than restyling. Several buttons put a glyph
   * or an <Icon> beside their label as ordinary children ("+ Add an asset",
   * the guide's language switch). MUI only spaces its own `startIcon` /
   * `endIcon` props, so inline children render flush against the text -
   * "+Add an asset". The old `.btn` class carried `gap-2`; this is that,
   * and a caller passing `sx` can still override it.
   */
  return <MuiButton {...mui} sx={{ gap: 1, ...sx }} {...props} />;
}
