import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createStorageAdapter(): Storage {
  // Use localStorage so PKCE code verifiers survive redirects and magic-link
  // callbacks opened in a new tab/window.
  return window.localStorage;
}

let cached: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("Supabase browser client can only be used in the browser");
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY (configure apps/web/.env.local)"
    );
  }
  if (cached) return cached;

  cached = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: createStorageAdapter(),
    },
  });
  return cached;
}
