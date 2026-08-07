import { requirePageRole, ROLES } from '@/app/_lib/helpers';
import { getFuelPricesPage } from '@/app/_lib/data-service';
import PageHeader from '@/app/_components/ui/PageHeader';
import EmptyState from '@/app/_components/ui/EmptyState';
import PendingLink from '@/app/_components/ui/PendingLink';
import Icon from '@/app/_components/ui/Icon';
import FuelPriceTable from '@/app/_components/admin/FuelPriceTable';

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
  const requested = Number.parseInt(params?.page, 10);
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;

  const { rows, total } = await getFuelPricesPage({ page, perPage: PER_PAGE });

  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const first = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const last = Math.min(page * PER_PAGE, total);

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

          {/* The count sits outside the pager so it still reads as a sentence
              when there is only one page and the buttons are both dead. */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-600">
              Showing <span className="font-semibold text-ink-800">{first}</span> to{' '}
              <span className="font-semibold text-ink-800">{last}</span> of{' '}
              <span className="font-semibold text-ink-800">{total}</span>
            </p>

            {lastPage > 1 ? (
              <nav aria-label="Pages" className="flex items-center gap-2">
                <PagerLink
                  href={`/admin/settings/fuel-prices?page=${page - 1}`}
                  disabled={page <= 1}
                  label="Previous page"
                >
                  <Icon name="chevronRight" className="h-5 w-5 rotate-180" />
                  <span className="hidden sm:inline">Previous</span>
                </PagerLink>

                <span className="text-sm font-semibold text-ink-700">
                  Page {page} of {lastPage}
                </span>

                <PagerLink
                  href={`/admin/settings/fuel-prices?page=${page + 1}`}
                  disabled={page >= lastPage}
                  label="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <Icon name="chevronRight" className="h-5 w-5" />
                </PagerLink>
              </nav>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}

/**
 * A page button that is a real link when it goes somewhere and a disabled
 * button when it does not - rather than a link styled to look dead, which is
 * still focusable and still navigates.
 */
function PagerLink({ href, disabled, label, children }) {
  if (disabled) {
    return (
      <span className="btn-secondary cursor-not-allowed opacity-50" aria-disabled="true">
        {children}
      </span>
    );
  }

  return (
    <PendingLink href={href} className="btn-secondary" aria-label={label}>
      {children}
    </PendingLink>
  );
}
