import { fuelColor, FUEL_COLORS } from '@/app/_lib/fuel-colors';

/**
 * Petrol, diesel and lubricant keep the same colours everywhere in the app - on
 * the nozzles of the reading sheet, in badges, in table rows, on the dashboard
 * cards and in the charts - so the fuel can be recognised without reading the
 * label. The colours themselves live in `app/_lib/fuel-colors.js`; this is only
 * the chip that wears them.
 *
 * The chips are SOLID, not the pale tints they used to be. Two pale chips - one
 * faintly blue, one faintly amber - are the same chip to anyone glancing at a
 * row of nozzles on a tablet in poor light, which is the moment this badge
 * exists for. Petrol is now a dark navy chip with white text and diesel a
 * bright yellow chip with near-black text: they differ in LIGHTNESS first and
 * hue second, so they stay apart under any conditions. See the long note in
 * fuel-colors.js for how that lesson was learned.
 *
 * The word is always there beside the colour. This badge is never the only
 * thing saying which fuel something is.
 */
export default function FuelBadge({ fuelType }) {
  if (!fuelType) return null;

  const color = fuelColor(fuelType);
  const label = FUEL_COLORS[fuelType]?.label ?? fuelType;

  return <span className={`badge ${color.solid}`}>{label}</span>;
}
