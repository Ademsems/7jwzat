import { createBrowserClient } from "@supabase/ssr";

// Lazy singleton — createBrowserClient() is only called on first property
// access (i.e. during an actual request), never at module evaluation time.
// This prevents the build from crashing when NEXT_PUBLIC_SUPABASE_* env
// vars aren't present in the build environment.
let _client: ReturnType<typeof createBrowserClient> | null = null;

function getClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}

export const supabase = new Proxy(
  {} as ReturnType<typeof createBrowserClient>,
  {
    get(_target, prop: string | symbol) {
      return Reflect.get(getClient(), prop);
    },
  }
);