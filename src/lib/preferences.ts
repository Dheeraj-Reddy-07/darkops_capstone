// Typed user-preference model for DarkOps settings.
//
// Preferences are stored in the `profiles.preferences` JSONB column and are
// read/written for the authenticated user only, through the self-scoped
// `PATCH /api/v1/auth/me` endpoint. This file is the single source of truth for
// the shape of that object so preference values are never scattered as loose
// strings across the frontend.

export type TimeRange = "24h" | "7d" | "30d";
export type SupportQueue = "mine" | "team" | "unassigned";

export interface UserPreferences {
  /** Default analytics window applied to the executive dashboard. */
  defaultTimeRange?: TimeRange;
  /** Auto-refresh live data on the executive / operations dashboards. */
  autoRefresh?: boolean;
  /** Default queue tab opened in the support workspace. */
  supportDefaultQueue?: SupportQueue;
  /** Auto-refresh the support ticket queues. */
  supportAutoRefresh?: boolean;
  /**
   * Per-role notification preferences. Keys are defined per persona in
   * settings-config.ts. Values are booleans (opt-in / opt-out).
   */
  notifications?: Record<string, boolean>;
}

export const DEFAULT_TIME_RANGE: TimeRange = "30d";

/**
 * Safely read the preferences object off a profile record, tolerating missing
 * or malformed values.
 */
export function readPreferences(profile: unknown): UserPreferences {
  if (!profile || typeof profile !== "object") return {};
  const prefs = (profile as { preferences?: unknown }).preferences;
  if (!prefs || typeof prefs !== "object") return {};
  return prefs as UserPreferences;
}
