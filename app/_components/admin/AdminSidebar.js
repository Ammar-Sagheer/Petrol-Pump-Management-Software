'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import PendingLink from '@/app/_components/ui/PendingLink';
import Icon from '@/app/_components/ui/Icon';
import BrandMark from '@/app/_components/ui/BrandMark';
import { signOut } from '@/app/_lib/actions';
import { BUSINESS_NAME } from '@/app/_lib/brand';

/**
 * The app's navigation: a column down the left on a laptop, a drawer behind a
 * burger on a phone.
 *
 * WHY A COLUMN RATHER THAN A ROW OF TABS. There are ten sections, and with an
 * icon and a readable label each they need about 1350px laid out sideways -
 * more than the page has. As a top bar they either scrolled, hiding Reports and
 * Settings off the right-hand edge of every laptop, or wrapped onto a second
 * row that ate the top of every screen. Vertically there is no such squeeze:
 * ten items fit down the side of even a short window with room left over, all
 * visible at once, which is what someone still learning where things live
 * needs. It also gives each one a full-width band to hit rather than a word.
 *
 * WHY IT COSTS SOMETHING. 240px off the left means the widest table in the app
 * - Purchases, eight columns - scrolls inside its own card at 1024px, where
 * before it just fitted. That is the trade: a nav that is always visible
 * against one table that scrolls at one width. It scrolls inside the card, not
 * the page, so nothing else moves.
 *
 * The links a data_entry user cannot open are not rendered. This is
 * presentation only - typing the URL still hits requirePageRole(), and RLS
 * would refuse the data even then.
 *
 * Account and Sign out sit at the bottom, apart from the sections: they are
 * "about you", not a part of the app someone works in. Reports and Settings
 * come last among the sections for the same reason, being looked at
 * occasionally rather than worked in all day.
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
  // Last, and open to both roles - the person most likely to need it is a new
  // member of staff on their first evening, not the owner.
  { href: '/admin/guide', label: 'Guide', icon: 'guide', roles: ['super_admin', 'data_entry'] },
];

export default function AdminSidebar({ profile }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef(null);

  const visibleLinks = LINKS.filter((link) => link.roles.includes(profile.role));

  function isActive(href) {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  /*
   * The drawer is a real <dialog> opened with showModal(), so focus trapping,
   * Escape and an inert page behind it all come from the browser already
   * correct - the same reasoning as ui/Dialog.js.
   */
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;

    if (isOpen && !drawer.open) drawer.showModal();
    else if (!isOpen && drawer.open) drawer.close();
  }, [isOpen]);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;

    const handleClose = () => setIsOpen(false);
    drawer.addEventListener('close', handleClose);
    return () => drawer.removeEventListener('close', handleClose);
  }, []);

  /*
   * Close once the navigation has actually landed. Closing on the click
   * instead would pull the drawer away while the new page is still loading,
   * leaving a blank screen and no sign anything is happening - the pending
   * spinner on the link someone just pressed is the only feedback there is.
   */
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const roleLabel = profile.role === 'super_admin' ? 'Owner' : 'Data entry';

  /*
   * Two shapes for the same information, because the space is different.
   *
   * In a 240px column, "Mubeen Petroleum Service" beside a logo does not fit
   * on one line - laid out like the top bar it truncated to "Mubeen Petr...",
   * which is the pump's own name, on its own screen, cut in half. Sat beside
   * the logo it wrapped one word to a line. So down the side everything
   * stacks and centres over the column's full width: the logo, then the name,
   * then the person and their role.
   *
   * Across the top of a phone there is room for one line each, and wrapping
   * there would push the day's work further down, so that one keeps the
   * truncating layout it always had.
   */
  const identityStacked = (
    <div className="min-w-0 text-center">
      <BrandMark className="mx-auto h-12" />
      <p className="mt-2 text-base font-semibold leading-tight text-ink-900">{BUSINESS_NAME}</p>
      <p className="mt-1 text-sm text-ink-600">
        {profile.full_name}
        <span className="mx-1.5" aria-hidden="true">
          ·
        </span>
        {roleLabel}
      </p>
    </div>
  );

  const identityInline = (
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark className="h-10" />
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-ink-900">{BUSINESS_NAME}</p>
        <p className="truncate text-sm text-ink-600">
          {profile.full_name}
          <span className="mx-1.5" aria-hidden="true">
            ·
          </span>
          {roleLabel}
        </p>
      </div>
    </div>
  );

  function sectionLink(link) {
    const active = isActive(link.href);

    return (
      <li key={link.href}>
        <PendingLink
          href={link.href}
          aria-current={active ? 'page' : undefined}
          className={[
            'flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition',
            active
              ? 'bg-brand-50 font-semibold text-brand-800'
              : 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
          ].join(' ')}
        >
          <Icon name={link.icon} className="h-5 w-5" />
          {link.label}
        </PendingLink>
      </li>
    );
  }

  const accountBlock = (
    <div className="space-y-1 border-t border-ink-200 pt-3">
      <PendingLink
        href="/admin/account"
        aria-current={isActive('/admin/account') ? 'page' : undefined}
        className={[
          'flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition',
          isActive('/admin/account')
            ? 'bg-brand-50 font-semibold text-brand-800'
            : 'text-ink-700 hover:bg-ink-100 hover:text-ink-900',
        ].join(' ')}
      >
        <Icon name="account" className="h-5 w-5" />
        Account
      </PendingLink>

      <form action={signOut}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium
                     text-red-700 transition hover:bg-red-50"
        >
          <Icon name="signOut" className="h-5 w-5" />
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* ---------- laptop: a fixed column ---------- */}
      <aside
        aria-label="Sections"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-ink-200
                   bg-white lg:flex"
      >
        <div className="border-b border-ink-200 px-4 py-4">{identityStacked}</div>

        {/* Scrolls on its own if the window is short, so Settings is always
            reachable without the page moving. */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-1">{visibleLinks.map(sectionLink)}</ul>
        </nav>

        <div className="px-3 pb-4">{accountBlock}</div>
      </aside>

      {/* ---------- phone and tablet: a bar with a burger ---------- */}
      <header
        className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200
                   bg-white px-4 lg:hidden"
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open the menu"
          aria-expanded={isOpen}
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg
                     text-ink-700 transition hover:bg-ink-100
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <Icon name="menu" className="h-6 w-6" />
        </button>

        {identityInline}
      </header>

      <dialog
        ref={drawerRef}
        aria-label="Sections"
        onClick={(event) => {
          // The backdrop is the dialog element itself, so this only fires when
          // the click missed the panel inside it.
          if (event.target === drawerRef.current) drawerRef.current.close();
        }}
        className="m-0 mr-auto h-dvh max-h-none w-[19rem] max-w-none bg-transparent p-0
                   backdrop:bg-ink-900/50 lg:hidden"
      >
        <div className="flex h-full flex-col bg-white">
          {/* The close button is taken out of the flow rather than sitting
              beside the name: in a panel this narrow, a 40px button in the
              same row squeezed "Mubeen Petroleum Service" onto three lines. */}
          <div className="relative border-b border-ink-200 px-4 py-4 pr-14">
            {identityStacked}
            <button
              type="button"
              onClick={() => drawerRef.current?.close()}
              aria-label="Close the menu"
              className="absolute right-2 top-3 flex h-10 w-10 items-center justify-center
                         rounded-lg text-ink-600 transition hover:bg-ink-100"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3">
            <ul className="space-y-1">{visibleLinks.map(sectionLink)}</ul>
          </nav>

          <div className="px-3 pb-4">{accountBlock}</div>
        </div>
      </dialog>
    </>
  );
}
