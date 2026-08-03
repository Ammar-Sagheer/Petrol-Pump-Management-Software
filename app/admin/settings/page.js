import { requirePageRole, ROLES, formatDate, formatPKR } from '@/app/_lib/helpers';
import {
  getTanks,
  getNozzles,
  getFuelPrices,
  getCurrentRates,
  getProfiles,
} from '@/app/_lib/data-service';
import PageHeader from '@/app/_components/ui/PageHeader';
import FuelBadge from '@/app/_components/ui/FuelBadge';
import FuelPriceForm from '@/app/_components/admin/FuelPriceForm';
import TankForm from '@/app/_components/admin/TankForm';
import NozzleTankForm from '@/app/_components/admin/NozzleTankForm';
import StaffAccountForm from '@/app/_components/admin/StaffAccountForm';
import StaffList from '@/app/_components/admin/StaffList';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const profile = await requirePageRole(ROLES.SUPER_ADMIN);

  const [tanks, nozzles, prices, rates, staff] = await Promise.all([
    getTanks(),
    getNozzles(),
    getFuelPrices(),
    getCurrentRates(),
    getProfiles(),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Prices, hardware and who can sign in. Owner access only."
      />

      {/* ---- pricing ---- */}
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-500">Fuel prices</h2>
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr] [&>*]:min-w-0">
        <FuelPriceForm currentRates={rates} />

        <div>
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            {['petrol', 'diesel'].map((fuelType) => (
              <div key={fuelType} className="card p-4">
                <div className="flex items-center justify-between">
                  <FuelBadge fuelType={fuelType} />
                  <span className="text-xs text-ink-500">current rate</span>
                </div>
                <p className="tabular mt-2 text-2xl font-bold text-ink-900">
                  {rates[fuelType] === null ? (
                    <span className="text-base font-semibold text-amber-700">Not set</span>
                  ) : (
                    `${formatPKR(rates[fuelType])} / L`
                  )}
                </p>
              </div>
            ))}
          </div>

          {prices.length > 0 ? (
            <div className="card table-scroll">
              <table className="w-full min-w-[26rem]">
                <thead className="border-b border-ink-200 bg-ink-50">
                  <tr>
                    <th className="th">Fuel</th>
                    <th className="th">In force from</th>
                    <th className="th text-right">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {prices.map((price) => (
                    <tr key={price.id}>
                      <td className="td">
                        <FuelBadge fuelType={price.fuel_type} />
                      </td>
                      <td className="td">{formatDate(price.effective_from)}</td>
                      <td className="td-num font-semibold">{formatPKR(price.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="card px-4 py-6 text-center text-sm text-ink-500">
              No rates set yet. Readings cannot be entered until a rate exists for each fuel.
            </p>
          )}
        </div>
      </div>

      {/* ---- tanks ---- */}
      <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wide text-ink-500">Tanks</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {tanks.map((tank) => (
          <TankForm key={tank.id} tank={tank} />
        ))}
      </div>

      {/* ---- nozzles ---- */}
      <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wide text-ink-500">Nozzles</h2>
      <p className="mb-3 text-sm text-ink-600">
        Which tank each nozzle draws from. Change this only if the plumbing at the pump actually
        differs — it decides which tank a sale is taken out of.
      </p>
      <div className="card table-scroll">
        <table className="w-full min-w-[30rem]">
          <thead className="border-b border-ink-200 bg-ink-50">
            <tr>
              <th className="th">Unit</th>
              <th className="th">Nozzle</th>
              <th className="th">Draws from</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {nozzles.map((nozzle) => (
              <tr key={nozzle.id}>
                <td className="td font-medium">Unit {nozzle.unit_number}</td>
                <td className="td">Nozzle {nozzle.nozzle_label}</td>
                <td className="td">
                  <NozzleTankForm nozzle={nozzle} tanks={tanks} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- staff ---- */}
      <h2 className="mb-3 mt-8 text-sm font-bold uppercase tracking-wide text-ink-500">
        Staff logins
      </h2>
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr] [&>*]:min-w-0">
        <StaffAccountForm />
        <StaffList staff={staff} currentProfileId={profile.id} />
      </div>
    </>
  );
}
