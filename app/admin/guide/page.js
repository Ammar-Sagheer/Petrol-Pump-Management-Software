import { requirePageRole, ROLES } from '@/app/_lib/helpers';
import { GUIDE, LANGUAGES } from '@/app/_lib/guide-content';
import PendingLink from '@/app/_components/ui/PendingLink';
import Icon from '@/app/_components/ui/Icon';
import {
  GuideStages,
  GuideSteps,
  GuideSectionMap,
  GuideRoles,
} from '@/app/_components/admin/GuideFlow';

export const metadata = { title: 'Guide' };

/**
 * How to run the pump on this app, for someone who has never opened it.
 *
 * Open to staff as well as the owner. The person most likely to need it is a
 * new attendant on their first evening, not the man who commissioned the app -
 * so it is a section of its own rather than a paragraph buried in Settings,
 * and it does not hide the owner-only parts, it labels them. Knowing that
 * Reports exists and is not yours to open is more use than not knowing.
 *
 * LANGUAGE IS A QUERY STRING (`?lang=ur`), the same trick the month filters on
 * Reports and Expenses use. No client component, no cookie, no stored
 * preference: the browser can follow a plain link, the page renders on the
 * server in one language, and the Urdu version can be sent to someone over
 * WhatsApp as a link that opens in Urdu. `dir` on the article is what turns
 * the whole layout around - see GuideFlow.js for why nothing inside it may
 * hard-code a left or a right.
 */
export default async function GuidePage({ searchParams }) {
  await requirePageRole(ROLES.SUPER_ADMIN, ROLES.DATA_ENTRY);

  const params = await searchParams;
  const lang = LANGUAGES.includes(params?.lang) ? params.lang : 'en';
  const other = lang === 'en' ? 'ur' : 'en';
  const t = GUIDE[lang];

  return (
    <article dir={t.dir} lang={lang}>
      {/* The switch sits above the title and in the same place in both
          languages, so someone who cannot read the one on screen does not
          have to hunt for the way out of it. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="figure-label">{t.labels.onThisPage}</p>

        <PendingLink
          href={`/admin/guide?lang=${other}`}
          className="btn-secondary"
          aria-label={t.switchAria}
          hrefLang={other}
        >
          <Icon name="guide" className="h-5 w-5" />
          {t.switchLabel}
        </PendingLink>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900">{t.title}</h1>
        <p className="mt-2 max-w-3xl text-base text-ink-700">{t.intro}</p>
      </header>

      <GuideStages stages={t.stages} />

      {/* Every heading below opens its own <section>, so section-heading's
          `first:mt-0` correctly gives it no margin of its own - which leaves
          the sections to space each other. */}
      <div className="mt-8 space-y-8">
        <section>
          <h2 className="section-heading">{t.startHere.heading}</h2>
          <p className="card px-4 py-3 text-base text-ink-700">{t.startHere.body}</p>
        </section>

        <section>
          <h2 className="section-heading">{t.setup.heading}</h2>
          <p className="mb-4 text-base text-ink-600">{t.setup.note}</p>
          <div className="card p-4 sm:p-6">
            <GuideSteps steps={t.setup.steps} labels={t.labels} />
          </div>
        </section>

        <section>
          <h2 className="section-heading">{t.daily.heading}</h2>
          <p className="mb-4 text-base text-ink-600">{t.daily.note}</p>
          <div className="card p-4 sm:p-6">
            <GuideSteps steps={t.daily.steps} labels={t.labels} />
          </div>
        </section>

        <section>
          <h2 className="section-heading">{t.occasional.heading}</h2>
          <GuideSectionMap items={t.occasional.items} />
        </section>

        <section>
          <h2 className="section-heading">{t.rules.heading}</h2>
          <p className="mb-4 text-base text-ink-600">{t.rules.note}</p>
          <ul className="card divide-y divide-ink-100">
            {t.rules.items.map((rule) => (
              <li key={rule} className="flex gap-3 px-4 py-3">
                <Icon name="warning" className="mt-0.5 h-5 w-5 text-amber-600" />
                <span className="text-base text-ink-700">{rule}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="section-heading">{t.fixing.heading}</h2>
          <p className="card px-4 py-3 text-base text-ink-700">{t.fixing.body}</p>
        </section>

        <section>
          <h2 className="section-heading">{t.roles.heading}</h2>
          <GuideRoles roles={t.roles} />
        </section>
      </div>
    </article>
  );
}
