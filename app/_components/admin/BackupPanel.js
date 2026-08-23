'use client';

import { useState } from 'react';

import Button from '@/app/_components/ui/Button';
import DownloadNotice from '@/app/_components/ui/DownloadNotice';

/**
 * The backup download, on Settings.
 *
 * UNDER ITS OWN HEADING THERE, not on Reports. It was on Reports first, beside the Excel
 * download, on the reasoning that both are files to take away. That was the
 * wrong grouping: Reports is where the owner goes to READ a figure, and a
 * control about losing the entire database does not belong under the month's
 * profit. Settings is where the things that are set up once and then left alone
 * live - the rates, the tanks, the nozzle wiring, the reset panel - and a
 * backup is one of those.
 *
 * WHY IT IS A PANEL WITH SENTENCES rather than a button on its own. The one
 * thing that must be understood about this file is that it is the only copy of
 * the books that is not inside Supabase - and a button marked "Back up" says
 * none of that. So the panel says what the file is for, says plainly that it is
 * not the Excel workbook, and says what restoring it involves. The same
 * reasoning as the reset panel below it: a control whose consequences are not
 * obvious explains itself where it stands, rather than in documentation nobody
 * has open.
 *
 * A plain link, and deliberately NO `download` attribute - the same trap the
 * Excel route hit. `download` saves whatever the URL returns, including the
 * redirect a failure produces, so an error would land in Downloads as a junk
 * file. The route's Content-Disposition downloads the file on its own and lets
 * a failure navigate back here.
 *
 * A CLIENT COMPONENT for one reason: the failure message has to be able to go
 * away. A download that works does not re-render the page, so a reason left in
 * the query string outlives the problem it describes - see `<DownloadNotice>`.
 * Pressing the button again clears it, because the answer to the old failure is
 * the attempt now in flight; if that fails too, the route sends back a fresh
 * one.
 */
export default function BackupPanel({ error }) {
  const [notice, setNotice] = useState(error ?? null);

  return (
    <section className="card p-4">
      {notice ? (
        <DownloadNotice param="backup_error">The backup did not download: {notice}</DownloadNotice>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink-900">Back up the whole book</h3>
          <p className="mt-1 max-w-prose text-xs text-ink-600">
            Every reading, credit slip, payment, delivery, dip, expense, bank movement, safe entry
            and asset — one file, saved to this device. Keep it somewhere that is not this account:
            if the Supabase project is ever lost, this file is what a new one is built from.
          </p>
        </div>
        <Button
          component="a"
          variant="secondary"
          href="/admin/settings/backup"
          onClick={() => setNotice(null)}
          className="shrink-0 whitespace-nowrap"
        >
          Download backup
        </Button>
      </div>

      <p className="mt-3 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
        <span className="font-semibold text-ink-900">It is not the Excel report.</span> The
        workbook on Reports is for reading a month; this is for putting the books back. Restoring it needs the recovery
        script in <code className="rounded bg-white px-1 py-0.5 font-mono">scripts/</code> — see{' '}
        <span className="font-semibold">Restoring from a backup</span> in the README. Logins are not
        in the file and are made again by hand; the activity log is not in it either.
      </p>
    </section>
  );
}
