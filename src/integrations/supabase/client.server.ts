// Server-side Supabase client for admin-only operations.
// This module now soft-disables secret-dependent auth actions when the deployment
// does not provide a service-role key, instead of crashing the whole request.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getServerSupabaseEnvDebugInfo, readServerSupabaseEnv } from './server-env';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function createUnavailableAdminClient(): any {
  return {
    __unavailable: true,
    auth: {
      admin: {
        createUser: async () => ({ data: null, error: new Error("Supabase admin client is unavailable in this deployment.") }),
        updateUserById: async () => ({ data: null, error: new Error("Supabase admin client is unavailable in this deployment.") }),
        deleteUser: async () => ({ data: null, error: new Error("Supabase admin client is unavailable in this deployment.") }),
      },
    },
    from: () => ({
      insert: async () => ({ data: null, error: new Error("Supabase admin client is unavailable in this deployment.") }),
      update: async () => ({ data: null, error: new Error("Supabase admin client is unavailable in this deployment.") }),
      delete: async () => ({ data: null, error: new Error("Supabase admin client is unavailable in this deployment.") }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: new Error("Supabase admin client is unavailable in this deployment.") }) }) }),
    }),
  };
}

function createSupabaseAdminClient() {
  const SUPABASE_URL = readServerSupabaseEnv("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = readServerSupabaseEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[Supabase] Admin client unavailable:", getServerSupabaseEnvDebugInfo());
    return createUnavailableAdminClient();
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { fetch: createSupabaseFetch(SUPABASE_SERVICE_ROLE_KEY) },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
