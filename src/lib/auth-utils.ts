import { AppRole } from "@/types/auth";

/**
 * Canonical role-based routing configuration
 * This is the single source of truth for role → landing route mapping
 */
export const ROLE_LANDING_ROUTES: Record<AppRole, string> = {
  PLATFORM_ADMIN: "/admin",
  EXECUTIVE: "/executive",
  OPERATIONS: "/operations",
  FRAUD_ANALYST: "/fraud",
  STORE_MANAGER: "/dark-stores",
  CUSTOMER_SUPPORT: "/support",
  CUSTOMER: "/customer",
};

/**
 * Additional role variants that map to canonical roles
 */
export const ROLE_ALIASES: Record<string, AppRole> = {
  ADMIN: "PLATFORM_ADMIN",
  OPERATIONS_AGENT: "OPERATIONS",
  OPERATIONS_MANAGER: "OPERATIONS",
};

/**
 * Normalize role to canonical AppRole
 */
export function normalizeRole(role: string | null | undefined): AppRole | null {
  if (!role) return null;
  const upperRole = role.toUpperCase();
  // Check if it's already a canonical role
  if (Object.values(ROLE_LANDING_ROUTES).includes(upperRole as AppRole)) {
    return upperRole as AppRole;
  }
  // Check if it's an alias
  return ROLE_ALIASES[upperRole] || null;
}

/**
 * Get landing route for a role
 * Returns null if role is invalid
 */
export function getLandingRoute(role: string | null | undefined): string | null {
  const normalized = normalizeRole(role);
  if (!normalized) return null;
  return ROLE_LANDING_ROUTES[normalized];
}

/**
 * Check if a route is public (doesn't require auth)
 */
export const PUBLIC_ROUTES = ["/", "/login"] as const;

/**
 * Check if a pathname is a public route
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname as any);
}
