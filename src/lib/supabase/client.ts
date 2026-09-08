import { createClient } from "@supabase/supabase-js";

// For a pure Vite SPA (no SSR), use the standard supabase-js client directly.
// @supabase/ssr's createBrowserClient is designed for SSR frameworks (Next.js, SvelteKit)
// and may interfere with cookie handling in a plain SPA.

let _client: ReturnType<typeof createClient> | null = null;

export function createSupabaseBrowserClient() {
  if (_client) return _client;

  const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] as string;
  const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables");
  }

  _client = createClient(supabaseUrl || "", supabaseAnonKey || "", {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return _client;
}
