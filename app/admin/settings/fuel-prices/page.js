import { requirePageRole, ROLES } from '@/app/_lib/helpers';
import { getFuelPricesPage } from '@/app/_lib/data-service';
import PageHeader from '@/app/_components/ui/PageHeader';
import EmptyState from '@/app/_components/ui/EmptyState';
import PendingLink from '@/app/_components/ui/PendingLink';
import Icon from '@/app/_components/ui/Icon';
import FuelPriceTable from '@/app/_components/admin/FuelPriceTable';
import Pager, { pageFrom } from '@/app/_components/ui/Pager';

export const metadata = { title: 'All fuel rates' };

/**
 * Every rate the pump has ever set, a page at a time.
 *
 * Settings shows the last week and links here for the rest. The rate moves
 * most days, so this list grows by about sixty rows a month and is the one
 * table in the app guaranteed to outgrow a screen - it is paged rather than
 * capped, because an old rate is what a disputed reading gets checked against
 * and there is no date beyond which it stops mattering.
 *
 * The page number is a query string, which means the browser's Back button
 * works through it and a particular page can be linked to or reloaded.
 */
const PER_PAGE = 25;

export default async function FuelPricesPage({ searchParams }) {
  await requirePageRole(ROLES.SUPER_ADMIN);

  const params = await searchParams;
  const page = pageFrom(params);

  const { rows, total } = await getFuelPricesPage({ page, perPage: PER_PAGE });

  return (
    <>
      <PendingLink
        href="/admin/settings"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"
      >
        <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
        Back to Settings
      </PendingLink>

      <PageHeader
        title="All fuel rates"
        description="Every rate that has been set, newest first. Removing one changes what past readings are worth, so it asks first."
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No rates set yet"
          description="Set a rate for each fuel under Settings. Readings cannot be entered until one exists."
        />
      ) : (
        <>
          <FuelPriceTable prices={rows} />

          <Pager
            page={page}
            perPage={PER_PAGE}
            total={total}
            hrefFor={(n) => `/admin/settings/fuel-prices?page=${n}`}
          />
        </>
      )}
    </>
  );
}
