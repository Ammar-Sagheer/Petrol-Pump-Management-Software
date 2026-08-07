'use client';

import PendingLink from '@/app/_components/ui/PendingLink';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { signOut } from '@/app/_lib/actions';
import Icon from '@/app/_components/ui/Icon';
import { BUSINESS_NAME } from '@/app/_lib/brand';
import BrandMark from '@/app/_components/ui/BrandMark';

/**
 * The links a data_entry user cannot open are not rendered at all.
 *
 * This is presentation only. Hiding a link stops an honest mistake; it stops
 * nothing else. Typing the URL by hand still hits requirePageRole(), and the
 * RLS policies would refuse the data even then.
 *
 * Account is deliberately not in this list. It sits with Sign out instead, in
 * the row above - see the return below - because it is not a working section
 * of the app the way the rest of these are: nobody scans a nozzle reading and
 * then reaches for Account next, so it does not belong among the tabs someone
 * flicks between all day.
 *
 * Reports and Settings come last: they are looked at occasionally rather than
 * worked in all day. They used to be pinned to the far right of the row as
 * well, which the wrapping row below can no longer do - see the note there.
 *
 * Expenses sits with Banking rather than beside Reports: it is where money
 * going out is written down the day it is paid, which is daily work, not a
 * monthly read.
 *
 * Lubricants follows Readings for the same reason the two sit together in the
 * evening: they are the two halves of what the pump sold today, one read off
 * the meters and one written down over the counter.
 *
 * `icon` names a drawing in Icon.js. Ten tabs of identical-looking text is a
 * wall someone has to read word by word every time; a shape beside each label
 * is what turns the second visit into a glance. The word always stays - the
 * icon is the redundant cue, not a replacement for it.
 */
const LINKS = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard', roles: ['super_admin'] },
  { href: '/admin/readings', label: 'Readings', icon: 'readings', roles: ['super_admin', 'data_entry'] },
  { href: '/admin/lubricants', label: 'Lubricants', icon: 'lubricants', roles: ['super_admin', 'data_entry'] },
  { href: '/admin/purchases', label: 'Purchases', icon: 'purchases', roles: ['super_admin', 'data_entry'] },
  { href: '/admin/stock-checks', label: 'Stock', icon: 'stock', roles: ['super_admin', 'data_entry'] },
  { href: '/admin/customers', label: 'Customers', icon: 'customers', roles: ['super_admin', 'data_entry'] },
  { href: '/admin/banking', label: 'Banking', icon: 'banking', roles: ['super_admin'] },
  { href: '/admin/expenses', label: 'Expenses', icon: 'expenses', roles: ['super_admin'] },
  { href: '/admin/reports', label: 'Reports', icon: 'reports', roles: ['super_admin'] },
  { href: '/admin/settings', label: 'Settings', icon: 'settings', roles: ['super_admin'] },
];

export default function AdminNavbar({ profile }) {
  const pathname = usePathname();

  /*
   * The tab row scrolls sideways rather than wrapping (see the note on the
   * nav element below), which means on a phone some sections are simply off
   * the right-hand edge with nothing to say so. Someone who has never seen the
   * full row has no reason to suspect Banking or Settings exist at all.
   *
   * So: a fade on whichever edge still has tabs behind it. Measured rather
   * than assumed, because how many tabs fit depends on the width AND on the
   * role - a data-entry login has half as many - and a fade against a row that
   * is already fully visible is a lie about there being more.
   */
  const trackRef = useRef(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      setEdges({ left: el.scrollLeft > 4, right: max > 4 && el.scrollLeft < max - 4 });
    };

    measure();
    el.addEventListener('scroll', measure, { passive: true });

    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [profile.role]);
  const visibleLinks = LINKS.filter((link) => link.roles.includes(profile.role));

  function isActive(href) {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const onAccount = isActive('/admin/account');

  function tab(link) {
    const active = isActive(link.href);
    return (
      <li key={link.href}>
        <PendingLink
          href={link.href}
          aria-current={active ? 'page' : undefined}
          className={[
            'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3.5 text-base font-medium transition',
            active
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-ink-600 hover:border-ink-300 hover:text-ink-900',
          ].join(' ')}
        >
          <Icon name={link.icon} className="h-5 w-5" />
          {link.label}
        </PendingLink>
      </li>
    );
  }

  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-11" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink-900">{BUSINESS_NAME}</p>
              <p className="truncate text-sm text-ink-600">
                {profile.full_name}
                <span className="mx-1.5" aria-hidden="true">
                  ·
                </span>
                {profile.role === 'super_admin' ? 'Owner' : 'Data entry'}
              </p>
            </div>
          </div>

          {/* Account and Sign out, together: both are "about you", not a
              working section of the app, which is why Account is not in the
              tab row below - see the note on LINKS. */}
          <div className="flex shrink-0 items-center gap-2">
            <PendingLink
              href="/admin/account"
              aria-current={onAccount ? 'page' : undefined}
              className={[
                'btn-secondary px-3 py-2 text-sm',
                onAccount ? 'border-brand-300 bg-brand-50 text-brand-800' : '',
              ].join(' ')}
            >
              Account
            </PendingLink>

            <form action={signOut}>
              <button type="submit" className="btn-danger px-3 py-2 text-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>

        {/* Scrolls sideways on a PHONE rather than wrapping - ten tabs stacked
            four rows deep would push the day's work off the screen before it
            started. From sm up there is room to wrap, and wrapping is what the
            row does.

            WHY THIS CHANGED. With an icon and 16px labels the ten tabs need
            1347px and the page is capped at 1152, so the row no longer fits on
            one line at ANY width. Left scrolling, Reports and Settings sat off
            the right-hand edge on every laptop, and an owner still learning the
            app would have had no reason to think they existed.

            Reports and Settings used to be pinned to the far right from lg up,
            held apart from the tabs worked in all day. That pinning is gone,
            and deliberately: ml-auto inside a wrapping row throws them onto a
            line of their own, so at 1024px the header became three rows - eight
            tabs, then "Expenses" alone, then two pinned right. They are still
            last in reading order, which is what the grouping was for; being
            last on the second row separates them well enough without spending
            a whole line to say so. */}
        <div className="relative">
          <nav
            ref={trackRef}
            aria-label="Sections"
            className="-mx-4 overflow-x-auto px-4"
          >
            <ul className="flex min-w-max items-center gap-1 pb-px sm:min-w-0 sm:flex-wrap lg:gap-2">
              {visibleLinks.map(tab)}
            </ul>
          </nav>

          {/* Purely a hint that the row keeps going. pointer-events-none so it
              never eats a tap meant for the tab underneath it. */}
          {edges.left ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -left-4 w-8 bg-gradient-to-r from-white to-transparent"
            />
          ) : null}
          {edges.right ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -right-4 w-8 bg-gradient-to-l from-white to-transparent"
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
