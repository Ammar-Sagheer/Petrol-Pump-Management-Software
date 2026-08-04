import LoginForm from '@/app/_components/admin/LoginForm';
import BrandMark from '@/app/_components/ui/BrandMark';
import { BUSINESS_NAME } from '@/app/_lib/brand';

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
        <BrandMark className="h-12 w-12" />
        <div>
          <h1 className="text-lg font-bold text-ink-900">{BUSINESS_NAME}</h1>
          <p className="text-sm text-ink-500">Sign in to continue</p>
        </div>
      </div>

      <LoginForm next={next} />
    </div>
  );
}
