import LoginForm from '@/app/_components/admin/LoginForm';

/**
 * There is no signup link, and there never should be. Accounts are created by
 * the owner from Settings.
 */
export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const next = typeof params?.next === 'string' ? params.next : '';

  return (
    <div className="card p-6">
      <div className="mb-6 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white"
        >
          PM
        </span>
        <div>
          <h1 className="text-lg font-bold text-ink-900">Pump Manager</h1>
          <p className="text-sm text-ink-500">Sign in to continue</p>
        </div>
      </div>

      <LoginForm next={next} />
    </div>
  );
}
