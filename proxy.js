/**
 * Auth gate for every request.
 *
 * Next.js 16 renamed middleware.js to proxy.js - same idea, new name.
 *
 * Two jobs:
 *   1. Refresh the Supabase session cookie. Server Components cannot write
 *      cookies, so if this did not run the session would silently expire.
 *   2. Keep signed-out visitors out of /admin, and signed-in ones off the
 *      login page.
 *
 * This is a coarse gate only - it checks that someone is signed in, not what
 * their role is. Role checks belong in the pages (requirePageRole), the Server
 * Actions (requireRole) and above all in the RLS policies.
 */
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export default async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Reads the verified JWT and refreshes it if it is close to expiring. Do not
  // put anything between creating the client and this call.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === '/admin/login';
  const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');

  if (isAdminArea && !isLoginPage && !isSignedIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    // Remember where they were headed so login can send them back.
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isLoginPage && isSignedIn) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next.js internals and static assets - matching those
     * would break the session refresh cookie on image requests for no reason.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
