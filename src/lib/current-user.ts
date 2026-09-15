import { createSupabaseBrowserClient, getMockProfile, isMockAuthMode } from "@/lib/supabase/client";

/**
 * Resolve the current user's identity for UI gating.
 *
 * Priority: the REAL authenticated Supabase session always wins. The mock
 * (`darkops_mock_session`) identity is only a fallback for handoff customers and
 * local demo mode. Earlier code checked the mock session first / fell back to
 * `support@darkops.com` (the Support Lead) — so a lingering mock session made
 * every support agent look like the Lead under real Supabase auth. Never guess.
 */

/** Read the mock/handoff-session identity from localStorage, or null. */
export function readMockIdentity(): any | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("darkops_mock_session");
    if (!raw) return null;
    const mock = JSON.parse(raw);
    const email =
      mock?.user?.email ||
      (mock?.access_token ? String(mock.access_token).replace("mock-token-", "") : null);
    if (email) return getMockProfile(email);
  } catch {
    /* ignore malformed storage */
  }
  return null;
}

/**
 * Synchronous best-guess identity for TanStack Query `initialData` (avoids an
 * empty first render). Only trusts the mock session in local demo mode; under
 * real Supabase auth it returns undefined so the async fetch resolves the real
 * signed-in user instead of a possibly-stale mock identity.
 */
export function initialIdentity(): any | undefined {
  return isMockAuthMode() ? (readMockIdentity() ?? undefined) : undefined;
}

/**
 * TanStack Query queryFn for the shared ["current-user"] key. The real
 * authenticated Supabase profile takes precedence; the mock/handoff identity is
 * used only when there is no real session. Returns null if nothing resolves.
 */
export async function fetchCurrentUser(): Promise<any | null> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (profile) return profile as any;
  }
  // No real session (handoff customer / local demo) — fall back to mock identity.
  return readMockIdentity();
}

/** The single CUSTOMER_SUPPORT account designated as team lead (or a platform admin). */
export function isSupportLead(profile: any): boolean {
  if (!profile) return false;
  return (
    profile.email === "support@darkops.com" ||
    profile.id === "usr-supp-001" ||
    profile.role === "PLATFORM_ADMIN"
  );
}
