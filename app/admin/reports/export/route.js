/**
 * Downloads the monthly report as an Excel workbook.
 *
 * A route handler rather than a Server Action, because the browser needs to
 * receive a file with download headers - an action can only return data.
 *
 * requireRole is the second line of defence as usual; the get_month_export RPC
 * refuses a data_entry caller on its own.
 */
import { requireRole, ROLES, formatDate, todayISO } from '@/app/_lib/helpers';
import { createClient } from '@/app/_lib/supabase-server';
import { buildMonthlyWorkbook, workbookFilename } from '@/app/_lib/excel-report';

export async function GET(request) {
  try {
    await requireRole(ROLES.SUPER_ADMIN);
  } catch (error) {
    return new Response(error.message, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month') ?? todayISO().slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return new Response('Expected a month in the form YYYY-MM.', { status: 400 });
  }

  const [year, monthNumber] = month.split('-').map(Number);
  if (monthNumber < 1 || monthNumber > 12) {
    return new Response('That is not a real month.', { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_month_export', {
    p_year: year,
    p_month: monthNumber,
  });

  if (error) {
    return new Response(`Could not build the report: ${error.message}`, { status: 500 });
  }

  const workbook = await buildMonthlyWorkbook(data, {
    generatedOn: formatDate(todayISO()),
  });

  return new Response(workbook, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${workbookFilename(data)}"`,
      'Content-Length': String(workbook.length),
      // A month's figures change as the month is being entered.
      'Cache-Control': 'no-store',
    },
  });
}
