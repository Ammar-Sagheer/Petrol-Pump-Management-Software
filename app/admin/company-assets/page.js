import { requirePageRole, ROLES, formatDate, formatPKR } from '@/app/_lib/helpers';
import { daysBetween, todayISO } from '@/app/_lib/date-helpers';
import { getCompanyAssetsPage, getCompanyAssetsSummary } from '@/app/_lib/data-service';
import PageHeader from '@/app/_components/ui/PageHeader';
import EmptyState from '@/app/_components/ui/EmptyState';
import Icon from '@/app/_components/ui/Icon';
import Pager, { pageFrom } from '@/app/_components/ui/Pager';
import { StatTile, StatGrid } from '@/app/_components/admin/AdminStats';
import { AddAssetButton, EditAssetButton } from '@/app/_components/admin/CompanyAssetForm';
import { ASSET_CATEGORIES } from '@/app/_lib/asset-categories';
import DeleteCompanyAssetButton from '@/app/_components/admin/DeleteCompanyAssetButton';

export const metadata = { title: 'Company Assets' };

/*
 * Nine to a page - three rows of three on a laptop, matching the card grid's
 * own widest layout. A card carries more than a table row (an icon, a note, a
 * date, two actions), so it wants a smaller page than the eight-row tables
 * elsewhere; nine is the number that keeps a full page in view without a
 * mid-row scroll on a common laptop height.
 */
const PER_PAGE = 9;

/*
 * Colour and icon per category, kept beside the page rather than in
 * CompanyAssetForm.js - the form only needs the five values and labels for its
 * picker, this page is the only place a category becomes a tinted badge.
 * Reusing the app's own families (sky for a vehicle, amber for machinery,
 * brand green for property, violet for electronics - the same violet
 * CashCreditChart already uses for credit) rather than inventing a new
 * palette for one page.
 */
const CATEGORY_STYLE = {
  vehicle: { icon: 'vehicle', tile: 'bg-sky-100 text-sky-700', badge: 'bg-sky-50 text-sky-800' },
  machinery: {
    icon: 'machinery',
    tile: 'bg-amber-100 text-amber-700',
    badge: 'bg-amber-50 text-amber-900',
  },
  property: {
    icon: 'property',
    tile: 'bg-brand-100 text-brand-700',
    badge: 'bg-brand-50 text-brand-800',
  },
  electronics: {
    icon: 'electronics',
    tile: 'bg-violet-100 text-violet-700',
    badge: 'bg-violet-50 text-violet-800',
  },
  other: { icon: 'other', tile: 'bg-ink-200 text-ink-600', badge: 'bg-ink-100 text-ink-700' },
};

const CATEGORY_LABEL = Object.fromEntries(
  ASSET_CATEGORIES.map((category) => [category.value, category.label]),
);

/**
 * "2 days ago" / "6 months ago" / "3 years ago" - decoration, not a figure
 * anyone checks against anything, so a rounded word is right where an exact
 * count would be for a money or litre column. Never the only place the date
 * appears: it always sits beside the real date, not instead of it.
 */
function ageLabel(purchaseDate) {
  const days = daysBetween(purchaseDate, todayISO());
  if (days <= 1) return 'today';
  if (days < 60) return `${days} days ago`;
  const months = Math.round(days / 30.4);
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/**
 * What the pump owns outright, bought with its own money and kept rather than
 * sold: vehicles, machinery, equipment, property.
 *
 * A PRIVATE PAGE, NOT A REPORT. Nothing here feeds a sale, an expense, or the
 * month's profit - it is the owner's own record of what the business actually
 * owns, for his own reference. Owner only, the same treatment as Banking: RLS
 * refuses a data_entry login outright, and hiding the nav link is cosmetic on
 * top of that.
 *
 * CARDS, NOT A TABLE. Every other list in this app is a table because its
 * rows are short numbers read in columns - a rate, a litre count, a balance.
 * An asset is a name, a picture of a category, a value and a note, which reads
 * as a small record rather than a row; see docs/UI_CONVENTIONS.md → "When a
 * list should stop being a table" for the same reasoning applied to the
 * activity log.
 */
export default async function CompanyAssetsPage({ searchParams }) {
  await requirePageRole(ROLES.SUPER_ADMIN);

  const params = await searchParams;
  const page = pageFrom(params);

  const [{ rows, total }, summary] = await Promise.all([
    getCompanyAssetsPage({ page, perPage: PER_PAGE }),
    getCompanyAssetsSummary(),
  ]);

  const totalValue = Number(summary.total_value ?? 0);
  const topCategoryValue = Number(summary.top_category_value ?? 0);
  const topShare =
    totalValue > 0 && topCategoryValue > 0 ? Math.round((topCategoryValue / totalValue) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Company Assets"
        description="What the pump has bought and kept — vehicles, machinery, equipment. A private record for you; it does not touch sales, expenses or profit."
      >
        <AddAssetButton />
      </PageHeader>

      {total === 0 ? (
        <EmptyState
          title="Nothing recorded yet"
          description="Add what the pump owns outright — a delivery bike, a generator, a new dispensing pump. This list is yours alone; staff cannot see it."
        >
          <AddAssetButton />
        </EmptyState>
      ) : (
        <>
          {/* THE FOUR FIGURES THIS PAGE IS ACTUALLY FOR, worked out by the
              database across every asset there is - never a sum over the
              nine on screen, which would silently shrink the moment a
              second page existed. See getCompanyAssetsSummary(). */}
          <div className="mb-6">
            <StatGrid>
              <StatTile
                icon="assets"
                label="Total value"
                value={formatPKR(totalValue)}
                sub={`${summary.asset_count} asset${summary.asset_count === 1 ? '' : 's'}`}
              />
              <StatTile
                icon="inventory"
                label="Assets recorded"
                value={String(summary.asset_count ?? 0)}
              />
              <StatTile
                icon={summary.top_category ? CATEGORY_STYLE[summary.top_category].icon : 'assets'}
                label="Biggest holding"
                value={summary.top_category ? CATEGORY_LABEL[summary.top_category] : '—'}
                sub={summary.top_category ? `${topShare}% of total value` : null}
              />
              <StatTile
                icon="date"
                label="Newest addition"
                value={summary.newest_date ? formatDate(summary.newest_date) : '—'}
                sub={summary.newest_name}
              />
            </StatGrid>
          </div>

          <div className="@container">
            <div className="grid grid-cols-1 gap-4 @[40rem]:grid-cols-2 @[62rem]:grid-cols-3">
              {rows.map((asset) => {
                const style = CATEGORY_STYLE[asset.category] ?? CATEGORY_STYLE.other;
                return (
                  <div key={asset.id} className="card flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${style.tile}`}
                      >
                        <Icon name={style.icon} className="h-5 w-5" />
                      </span>
                      <span className={`badge shrink-0 ${style.badge}`}>
                        {CATEGORY_LABEL[asset.category] ?? 'Other'}
                      </span>
                    </div>

                    <div>
                      <p className="text-base font-bold text-ink-900">{asset.name}</p>
                      {asset.note ? (
                        <p className="mt-0.5 text-sm text-ink-600">{asset.note}</p>
                      ) : null}
                    </div>

                    <div className="mt-auto border-t border-ink-200 pt-3">
                      <p className="figure-label">Bought for</p>
                      <p className="tabular whitespace-nowrap text-xl font-bold text-ink-900">
                        {formatPKR(asset.purchase_value)}
                      </p>
                      <p className="mt-1 text-sm text-ink-600">
                        {formatDate(asset.purchase_date)} · {ageLabel(asset.purchase_date)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-ink-200 pt-3">
                      <EditAssetButton asset={asset} />
                      <DeleteCompanyAssetButton assetId={asset.id} name={asset.name} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Pager
            page={page}
            perPage={PER_PAGE}
            total={total}
            hrefFor={(n) => `/admin/company-assets?page=${n}`}
            label="Asset pages"
          />
        </>
      )}
    </>
  );
}
