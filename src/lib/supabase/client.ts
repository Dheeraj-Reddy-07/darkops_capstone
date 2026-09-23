import { createClient } from "@supabase/supabase-js";

/**
 * True only when there is no real Supabase project configured (local demo). In
 * that case the app uses a mock auth client that stores a `darkops_mock_session`
 * in localStorage. When a real Supabase project IS configured, that mock session
 * must be ignored entirely — a lingering one is stale junk that could otherwise
 * masquerade as another user (e.g. the Support Lead).
 */
export function isMockAuthMode(): boolean {
  const rawUrl = (import.meta.env["VITE_SUPABASE_URL"] as string) || "";
  const rawKey = (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string) || "";
  return !rawUrl || !rawKey || rawUrl.includes("placeholder");
}

export const MOCK_PROFILES: Record<
  string,
  { id: string; email: string; full_name: string; role: string; store_id?: string | null }
> = {
  "admin@darkops.com": {
    id: "usr-admin-001",
    email: "admin@darkops.com",
    full_name: "System Admin",
    role: "PLATFORM_ADMIN",
  },
  "exec@darkops.com": {
    id: "usr-exec-001",
    email: "exec@darkops.com",
    full_name: "Network Exec",
    role: "EXECUTIVE",
  },
  "manager@darkops.com": {
    id: "usr-mgr-001",
    email: "manager@darkops.com",
    full_name: "Ops Manager",
    role: "OPERATIONS",
  },
  "support@darkops.com": {
    id: "usr-supp-001",
    email: "support@darkops.com",
    full_name: "Customer Support",
    role: "CUSTOMER_SUPPORT",
  },
  "agent.a@darkops.com": {
    id: "usr-agent-a",
    email: "agent.a@darkops.com",
    full_name: "Priya Sharma",
    role: "CUSTOMER_SUPPORT",
  },
  "agent.b@darkops.com": {
    id: "usr-agent-b",
    email: "agent.b@darkops.com",
    full_name: "Rohan Mehta",
    role: "CUSTOMER_SUPPORT",
  },
  "storemanager@darkops.com": {
    id: "usr-sm-001",
    email: "storemanager@darkops.com",
    full_name: "Store Manager",
    role: "STORE_MANAGER",
    store_id: "DS-1462",
  },
  "customer@darkops.com": {
    id: "usr-cust-001",
    email: "customer@darkops.com",
    full_name: "Rajat Sharma",
    role: "CUSTOMER",
  },
  "normal@darkops.com": {
    id: "usr-norm-001",
    email: "normal@darkops.com",
    full_name: "Rajat Sharma",
    role: "CUSTOMER",
  },
  "suspicious@darkops.com": {
    id: "usr-susp-001",
    email: "suspicious@darkops.com",
    full_name: "Vikram Malhotra",
    role: "CUSTOMER",
  },
  "sla@darkops.com": {
    id: "usr-sla-001",
    email: "sla@darkops.com",
    full_name: "Ananya Desai",
    role: "CUSTOMER",
  },
  "fraud@darkops.com": {
    id: "usr-fraud-001",
    email: "fraud@darkops.com",
    full_name: "Fraud Analyst",
    role: "OPERATIONS",
  },
  "operations@darkops.com": {
    id: "usr-ops-001",
    email: "operations@darkops.com",
    full_name: "Operations Agent",
    role: "OPERATIONS",
  },
};

export function getMockProfile(emailOrId: string) {
  const norm = (emailOrId || "").toLowerCase().trim();
  const found = Object.values(MOCK_PROFILES).find(
    (p) => p.email.toLowerCase() === norm || p.id === emailOrId,
  );
  if (found) return found;

  const email = norm.includes("@") ? norm : `${norm}@darkops.com`;
  return {
    id: `usr-gen-${email.replace(/[^a-z0-9]/g, "")}`,
    email,
    full_name: email.split("@")[0] || "Demo User",
    role: "CUSTOMER",
    store_id: null,
  };
}

const authListeners = new Set<(event: string, session: any) => void>();

function getStoredMockSession() {
  try {
    const raw = localStorage.getItem("darkops_mock_session");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setStoredMockSession(session: any) {
  try {
    if (!session) {
      localStorage.removeItem("darkops_mock_session");
    } else {
      localStorage.setItem("darkops_mock_session", JSON.stringify(session));
    }
  } catch {
    /* ignore storage unavailable */
  }
}

function createMockSessionForEmail(email: string) {
  const profile = getMockProfile(email);
  return {
    access_token: `mock-token-${profile.email}`,
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: `mock-refresh-${profile.email}`,
    user: {
      id: profile.id,
      aud: "authenticated",
      role: "authenticated",
      email: profile.email,
      user_metadata: { full_name: profile.full_name },
      created_at: new Date().toISOString(),
    },
  };
}

function createMockQueryBuilder(table: string) {
  let filterId: string | null = null;
  let filterEmail: string | null = null;

  const builder: any = {
    select() {
      return builder;
    },
    eq(field: string, value: any) {
      if (field === "id" || field === "profile_id") filterId = String(value);
      if (field === "email") filterEmail = String(value);
      return builder;
    },
    async single() {
      if (table === "profiles") {
        const session = getStoredMockSession();
        const target = filterId || filterEmail || session?.user?.id || "exec@darkops.com";
        const profile = getMockProfile(target);
        return { data: profile, error: null };
      }
      if (table === "customers") {
        const session = getStoredMockSession();
        const profile = getMockProfile(session?.user?.email || "customer@darkops.com");
        return {
          data: {
            id: "CU-NORMAL-001",
            full_name: profile.full_name,
            email: profile.email,
            profile_id: profile.id,
            city: "Bengaluru",
            prior_claims_90d: 1,
          },
          error: null,
        };
      }
      return { data: null, error: null };
    },
    async insert(rows: any[]) {
      return { data: rows, error: null };
    },
    async update() {
      return builder;
    },
    async upsert(rows: any[]) {
      return { data: rows, error: null };
    },
    then(resolve: any) {
      resolve(builder.single());
    },
  };

  return builder;
}

function createMockSupabaseClient() {
  return {
    auth: {
      async getSession() {
        const session = getStoredMockSession();
        return { data: { session }, error: null };
      },
      async getUser() {
        const session = getStoredMockSession();
        return { data: { user: session?.user || null }, error: null };
      },
      async signInWithPassword({ email }: { email: string }) {
        const session = createMockSessionForEmail(email);
        setStoredMockSession(session);
        authListeners.forEach((cb) => cb("SIGNED_IN", session));
        return { data: { user: session.user, session }, error: null };
      },
      async signUp({ email, options }: { email: string; options?: any }) {
        const session = createMockSessionForEmail(email);
        if (options?.data?.full_name) {
          session.user.user_metadata.full_name = options.data.full_name;
        }
        setStoredMockSession(session);
        authListeners.forEach((cb) => cb("SIGNED_IN", session));
        return { data: { user: session.user, session }, error: null };
      },
      async signOut() {
        setStoredMockSession(null);
        authListeners.forEach((cb) => cb("SIGNED_OUT", null));
        return { error: null };
      },
      onAuthStateChange(callback: (event: string, session: any) => void) {
        authListeners.add(callback);
        return {
          data: {
            subscription: {
              unsubscribe() {
                authListeners.delete(callback);
              },
            },
          },
        };
      },
    },
    from(table: string) {
      return createMockQueryBuilder(table);
    },
  } as any;
}

let _client: any = null;

export function createSupabaseBrowserClient() {
  if (_client) return _client;
  const rawUrl = (import.meta.env["VITE_SUPABASE_URL"] as string) || "";
  const rawKey = (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string) || "";

  if (isMockAuthMode()) {
    console.info("[DarkOps] Using local demo/mock authentication fallback client.");
    _client = createMockSupabaseClient();
  } else {
    _client = createClient(rawUrl, rawKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return _client;
}
