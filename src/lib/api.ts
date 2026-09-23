import { createSupabaseBrowserClient } from "./supabase/client";

export const supabase = createSupabaseBrowserClient();

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  let token: string | null = null;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      token = session.access_token;
    }
  } catch {
    /* ignore session fetch error */
  }

  // Fall back to a mock/handoff token only when there is no real Supabase
  // session (handoff customers, local demo). A real session always wins, so a
  // stale mock token can never override a genuinely signed-in user.
  if (!token && typeof window !== "undefined") {
    try {
      const rawMock = localStorage.getItem("darkops_mock_session");
      if (rawMock) {
        const mock = JSON.parse(rawMock);
        if (mock?.access_token) {
          token = mock.access_token;
        }
      }
    } catch {
      /* ignore storage read error */
    }
  }

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Default to the relative path so requests go through the Vite dev proxy
  // (which targets the server's configured port). Set VITE_API_BASE_URL to an
  // absolute URL for production / mobile (Capacitor) builds that have no proxy.
  const apiBase = import.meta.env.VITE_API_BASE_URL || "";

  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/v1${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    // Fallback to relative proxy path if direct fetch fails
    response = await fetch(`/api/v1${endpoint}`, {
      ...options,
      headers,
    });
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.error?.message ||
        error.message ||
        (response.statusText
          ? `API Error (${response.status}: ${response.statusText})`
          : `API Error (${response.status})`),
    );
  }

  return response.json();
}
