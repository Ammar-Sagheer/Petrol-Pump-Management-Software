'use client';

import { useState } from 'react';

import { BUSINESS_INITIALS, LOGO_SRC } from '@/app/_lib/brand';

/**
 * The logo, with an initials tile behind it.
 *
 * Getting this right is fiddlier than it looks, because BOTH image events are
 * unreliable here. The browser starts fetching the logo while the
 * server-rendered HTML is still parsing, so by the time React hydrates and
 * attaches handlers the image has usually already settled - and a load or error
 * event that has already fired does not fire again. Relying on onError leaves a
 * broken-image icon in the header for good when the file is missing; relying on
 * onLoad leaves the initials showing for good when it is present. Both were
 * tried here, and both failed exactly that way.
 *
 * So the element is asked directly, on mount, once the browser has already had
 * its chance: `complete` says the attempt is settled, and naturalWidth says
 * whether it settled as a picture or as nothing. The two event handlers stay on
 * for the other case - an image still in flight when hydration happens, where
 * they do fire normally.
 *
 * The result is that a missing logo shows initials, a present one shows the
 * logo, and neither ever shows a broken picture.
 *
 * A plain <img> rather than next/image: one small fixed-size mark gives the
 * optimiser nothing to do, and next/image fails the build outright when the file
 * is absent - which is exactly the case this has to survive.
 *
 * Decorative throughout: the business name is written next to it every time it
 * is used, so alt is empty and the whole thing is hidden from screen readers.
 * Announcing "Mubeen Petroleum Service" twice would be worse than silence.
 */
export default function BrandMark({ className = 'h-9 w-9' }) {
  const [shown, setShown] = useState(false);

  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg
                  ${shown ? '' : 'bg-brand-600'} ${className}`}
    >
      {shown ? null : <span className="text-xs font-bold text-white">{BUSINESS_INITIALS}</span>}

      <img
        // Settled before hydration - the common case - so ask rather than wait.
        ref={(node) => {
          if (node?.complete) setShown(node.naturalWidth > 0);
        }}
        // Still loading at hydration; these fire normally.
        onLoad={(event) => setShown(event.currentTarget.naturalWidth > 0)}
        onError={() => setShown(false)}
        src={LOGO_SRC}
        alt=""
        // object-contain so a mark that is not square keeps its proportions
        // rather than being stretched. Kept at zero opacity until it is known to
        // be a real picture, so a broken file is invisible.
        className={`absolute inset-0 h-full w-full object-contain transition-opacity ${
          shown ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </span>
  );
}
