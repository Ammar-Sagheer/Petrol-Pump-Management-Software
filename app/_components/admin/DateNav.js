import Link from 'next/link';

/**
 * Previous / next day arrows plus a date box.
 *
 * A plain GET form, so it still works if JavaScript has not loaded yet - which
 * on a slow connection in a pump office is a real scenario, not a hypothetical.
 */
export default function DateNav({ date, basePath, previousDate, nextDate, paramName = 'date' }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`${basePath}?${paramName}=${previousDate}`}
        className="btn-secondary px-3"
        aria-label="Previous day"
      >
        <span aria-hidden="true">‹</span>
      </Link>

      <form method="GET" action={basePath} className="flex items-center gap-2">
        <label className="sr-only" htmlFor="date-nav">
          Date
        </label>
        <input
          id="date-nav"
          type="date"
          name={paramName}
          defaultValue={date}
          className="input py-2"
        />
        <button type="submit" className="btn-secondary">
          Go
        </button>
      </form>

      <Link
        href={`${basePath}?${paramName}=${nextDate}`}
        className="btn-secondary px-3"
        aria-label="Next day"
      >
        <span aria-hidden="true">›</span>
      </Link>
    </div>
  );
}
