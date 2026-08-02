/**
 * Supabase ADMIN client - service role key, bypasses RLS completely.
 *
 * Only reason this exists: creating and deactivating staff logins needs the
 * Auth Admin API, which the normal client cannot do. There is no public signup,
 * so every account is created here by a super_admin.
 *
 * Rules for using it:
 *   - never import this into a Client Component (the `server-only` import below
 *     turns that into a build error rather than a leaked key)
 *   - always call requireRole('super_admin') BEFORE constructing it
 *   - never use it just to dodge an RLS policy that is getting in the way -
 *     fix the policy instead
 *
 * The append-only ledger is deliberately protected by a database trigger rather
 * than by RLS alone, precisely because this key would otherwise be able to
 * rewrite what customers owe.
 */
import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Managing staff logins needs it - ' +
        'add it to .env.local (and to the Vercel project settings).',
    );
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
