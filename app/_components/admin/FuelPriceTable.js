import FuelBadge from '@/app/_components/ui/FuelBadge';
import DeleteFuelPriceButton from '@/app/_components/admin/DeleteFuelPriceButton';
import { formatRate } from '@/app/_lib/format-helpers';
import { formatDate } from '@/app/_lib/date-helpers';

/**
 * The rate history as a table, shared by the panel on Settings and the full
 * history page.
 *
 * One component rather than two copies: the rows carry a delete button whose
 * confirmation text has to name the rate and the date exactly, and that
 * sentence drifting between the two places is how someone ends up removing a
 * rate they meant to keep.
 */
export default function FuelPriceTable({ prices }) {
  return (
    <div className="card table-scroll">
      <table className="w-full min-w-[26rem]">
        <thead className="border-b border-ink-200 bg-ink-50">
          <tr>
            <th className="th">Fuel</th>
            <th className="th">In force from</th>
            <th className="th text-right">Rate</th>
            <th className="th">
              <span className="sr-only">Remove</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {prices.map((price) => (
            <tr key={price.id}>
              <td className="td">
                <FuelBadge fuelType={price.fuel_type} />
              </td>
              <td className="td whitespace-nowrap">{formatDate(price.effective_from)}</td>
              <td className="td-num font-semibold">{formatRate(price.rate)}</td>
              <td className="td text-right">
                <DeleteFuelPriceButton
                  priceId={price.id}
                  summary={`the ${price.fuel_type} rate of ${formatRate(price.rate)} from ${formatDate(price.effective_from)}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
