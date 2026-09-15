/* eslint-disable @typescript-eslint/no-namespace */
import { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "../lib/supabase";
import { getPermissionsForRole } from "../lib/rbac";
import { AppRole, AuthContext, AppPermission } from "../../src/types/auth";
import { HTTPError } from "./errors";
import { randomUUID } from "crypto";

// Extend Express Request to hold our auth context
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      requestId: string;
    }
  }
}

/**
 * Generate a unique request ID for correlation and logging
 */
export const generateRequestId = (): string => {
  return randomUUID();
};

/**
 * Request correlation middleware - adds unique ID to each request
 */
export const addRequestId = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = (req.headers["x-request-id"] as string) || generateRequestId();
  res.setHeader("X-Request-ID", req.requestId);
  next();
};

interface CachedAuth {
  user: any;
  profile: any;
  expiresAt: number;
}
const tokenAuthCache = new Map<string, CachedAuth>();

const SERVER_MOCK_PROFILES: Record<
  string,
  {
    id: string;
    email: string;
    full_name: string;
    role: AppRole;
    is_active: boolean;
    store_id?: string;
  }
> = {
  "admin@darkops.com": {
    id: "usr-admin-001",
    email: "admin@darkops.com",
    full_name: "System Admin",
    role: "PLATFORM_ADMIN",
    is_active: true,
  },
  "exec@darkops.com": {
    id: "usr-exec-001",
    email: "exec@darkops.com",
    full_name: "Network Exec",
    role: "EXECUTIVE",
    is_active: true,
  },
  "manager@darkops.com": {
    id: "usr-mgr-001",
    email: "manager@darkops.com",
    full_name: "Ops Manager",
    role: "OPERATIONS",
    is_active: true,
  },
  "support@darkops.com": {
    id: "usr-supp-001",
    email: "support@darkops.com",
    full_name: "Customer Support",
    role: "CUSTOMER_SUPPORT",
    is_active: true,
  },
  "agent.a@darkops.com": {
    id: "usr-agent-a",
    email: "agent.a@darkops.com",
    full_name: "Priya Sharma",
    role: "CUSTOMER_SUPPORT",
    is_active: true,
  },
  "agent.b@darkops.com": {
    id: "usr-agent-b",
    email: "agent.b@darkops.com",
    full_name: "Rohan Mehta",
    role: "CUSTOMER_SUPPORT",
    is_active: true,
  },
  "storemanager@darkops.com": {
    id: "usr-sm-001",
    email: "storemanager@darkops.com",
    full_name: "Store Manager",
    role: "STORE_MANAGER",
    is_active: true,
    store_id: "DS-1462",
  },
  "customer@darkops.com": {
    id: "usr-cust-001",
    email: "customer@darkops.com",
    full_name: "Rajat Sharma",
    role: "CUSTOMER",
    is_active: true,
  },
  "normal@darkops.com": {
    id: "usr-norm-001",
    email: "normal@darkops.com",
    full_name: "Rajat Sharma",
    role: "CUSTOMER",
    is_active: true,
  },
  "suspicious@darkops.com": {
    id: "usr-susp-001",
    email: "suspicious@darkops.com",
    full_name: "Vikram Malhotra",
    role: "CUSTOMER",
    is_active: true,
  },
  "sla@darkops.com": {
    id: "usr-sla-001",
    email: "sla@darkops.com",
    full_name: "Ananya Desai",
    role: "CUSTOMER",
    is_active: true,
  },
  "fraud@darkops.com": {
    id: "usr-fraud-001",
    email: "fraud@darkops.com",
    full_name: "Fraud Analyst",
    role: "OPERATIONS",
    is_active: true,
  },
  "operations@darkops.com": {
    id: "usr-ops-001",
    email: "operations@darkops.com",
    full_name: "Operations Agent",
    role: "OPERATIONS",
    is_active: true,
  },
};

function resolveServerMockProfile(tokenOrEmail: string) {
  const norm = (tokenOrEmail || "").replace("mock-token-", "").toLowerCase().trim();
  const found = Object.values(SERVER_MOCK_PROFILES).find(
    (p) => p.email.toLowerCase() === norm || p.id === norm,
  );
  if (found) return found;

  const email = norm.includes("@") ? norm : `${norm}@darkops.com`;
  return {
    id: `usr-gen-${email.replace(/[^a-z0-9]/g, "")}`,
    email,
    full_name: email.split("@")[0] || "Demo User",
    role: "CUSTOMER" as AppRole,
    is_active: true,
  };
}

/**
 * Enhanced authentication middleware with better error handling and logging
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = req.requestId || "unknown";
    const authHeader = req.headers.authorization;

    // Check token cache or mock token
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token.startsWith("mock-token-")) {
        // Serve from cache when available to avoid a profile lookup per request.
        const cachedMock = tokenAuthCache.get(token);
        if (cachedMock && Date.now() < cachedMock.expiresAt) {
          req.auth = {
            user: cachedMock.user,
            permissions: getPermissionsForRole(cachedMock.profile.role as AppRole),
          };
          return next();
        }

        // Prefer the REAL profile row (real UUID, store_id, etc.) resolved by
        // email so that per-user data queries (e.g. assigned_to = user.id) match
        // the seeded data. Fall back to the synthetic mock profile only when the
        // real profile cannot be resolved (e.g. offline/fallback env).
        const email = token.replace("mock-token-", "").toLowerCase().trim();
        let profile: any = null;
        try {
          const admin = createSupabaseServiceRoleClient();
          const { data: realProfile } = await admin
            .from("profiles")
            .select("*")
            .eq("email", email)
            .maybeSingle();
          if (realProfile && realProfile.id) {
            profile = { ...realProfile, id: realProfile.id, email: realProfile.email || email };
          }
        } catch {
          /* fall back to synthetic mock profile below */
        }

        if (!profile) {
          profile = resolveServerMockProfile(token);
        }

        const role = profile.role as AppRole;
        req.auth = {
          user: profile,
          permissions: getPermissionsForRole(role),
        };
        tokenAuthCache.set(token, {
          user: profile,
          profile,
          expiresAt: Date.now() + 30000,
        });
        return next();
      }

      const cached = tokenAuthCache.get(token);
      if (cached && Date.now() < cached.expiresAt) {
        req.auth = {
          user: cached.user,
          permissions: getPermissionsForRole(cached.profile.role as AppRole),
        };
        return next();
      }
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const isFallbackEnv = !supabaseUrl || supabaseUrl.includes("placeholder");

    if (isFallbackEnv) {
      const isCustomerRoute =
        req.originalUrl.includes("/customers") || req.originalUrl.includes("/report-issue");
      const isSupportRoute = req.originalUrl.includes("/support");
      const defaultEmail = isCustomerRoute
        ? "customer@darkops.com"
        : isSupportRoute
          ? "support@darkops.com"
          : "exec@darkops.com";
      const defaultProfile = resolveServerMockProfile(defaultEmail);
      req.auth = {
        user: defaultProfile,
        permissions: getPermissionsForRole(defaultProfile.role as AppRole),
      };
      return next();
    }

    const supabase = createSupabaseServerClient(req, res);
    let user;
    let authError;

    // Try Bearer token first, then session cookie
    let bearerToken = "";
    if (authHeader && authHeader.startsWith("Bearer ")) {
      bearerToken = authHeader.split(" ")[1];
      const result = await supabase.auth.getUser(bearerToken);
      user = result.data?.user;
      authError = result.error;
    } else {
      const result = await supabase.auth.getUser();
      user = result.data?.user;
      authError = result.error;
    }

    if (authError || !user) {
      // Log authentication failure without exposing sensitive details
      console.log(
        `[AUTH_FAILED] RequestID: ${requestId}, IP: ${req.ip}, Error: ${authError?.message || "No user found"}`,
      );
      throw new HTTPError(401, "UNAUTHORIZED", "Valid session required.");
    }

    // Fetch profile with error handling
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.log(
        `[PROFILE_MISSING] RequestID: ${requestId}, UserID: ${user.id}, Error: ${profileError?.message || "Profile not found"}`,
      );
      throw new HTTPError(401, "PROFILE_MISSING", "User profile not found.");
    }

    // Check if account is active
    if (!profile.is_active) {
      console.log(
        `[ACCOUNT_DISABLED] RequestID: ${requestId}, UserID: ${user.id}, Email: ${profile.email}`,
      );
      throw new HTTPError(403, "ACCOUNT_DISABLED", "This account has been disabled.");
    }

    // Resolve permissions based on role
    const role = profile.role as AppRole;
    const permissions = getPermissionsForRole(role);

    // Set auth context - include both auth user ID and profile
    req.auth = {
      user: {
        ...profile,
        id: user.id, // Use auth user ID for customer resolution
        email: user.email,
      },
      permissions,
    };

    if (bearerToken) {
      tokenAuthCache.set(bearerToken, {
        user: req.auth.user,
        profile,
        expiresAt: Date.now() + 30000,
      });
    }

    // Log successful authentication (without sensitive data)
    console.log(
      `[AUTH_SUCCESS] RequestID: ${requestId}, UserID: ${user.id}, Role: ${role}, Permissions: ${Array.from(permissions).join(", ")}`,
    );

    next();
  } catch (error) {
    // Don't expose internal error details to client
    if (!(error instanceof HTTPError)) {
      console.error("[AUTH_ERROR] Unexpected error:", error);
      next(new HTTPError(500, "INTERNAL_ERROR", "Authentication failed."));
    } else {
      next(error);
    }
  }
};

/**
 * Permission checking middleware with enhanced error messages
 */
export const requirePermission = (permission: AppPermission | AppPermission[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ensure requireAuth has run
      if (!req.auth) {
        throw new HTTPError(
          500,
          "AUTH_NOT_INITIALIZED",
          "requireAuth must be called before requirePermission.",
        );
      }

      const permissionsToCheck = Array.isArray(permission) ? permission : [permission];
      const requestId = req.requestId || "unknown";
      const userRole = req.auth.user.role;
      const userPermissions = Array.from(req.auth!.permissions);

      console.log(
        `[PERMISSION_CHECK] RequestID: ${requestId}, UserID: ${req.auth.user.id}, Role: ${userRole}, Required: ${permissionsToCheck.join(" or ")}, UserPermissions: ${userPermissions.join(", ")}`,
      );

      const hasPermission = permissionsToCheck.some((p) => req.auth!.permissions.has(p));

      if (!hasPermission) {
        console.log(
          `[PERMISSION_DENIED] RequestID: ${requestId}, UserID: ${req.auth.user.id}, Role: ${userRole}, Required: ${permissionsToCheck.join(" or ")}`,
        );
        throw new HTTPError(
          403,
          "FORBIDDEN",
          `Missing required permission: ${permissionsToCheck.join(" or ")}`,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional authentication - doesn't fail if no session, but sets auth context if available
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);

    const authHeader = req.headers.authorization;
    let user;
    let authError;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const result = await supabase.auth.getUser(token);
      user = result.data?.user;
      authError = result.error;
    } else {
      const result = await supabase.auth.getUser();
      user = result.data?.user;
      authError = result.error;
    }

    if (!authError && user) {
      // Fetch profile if user is authenticated
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileError && profile && profile.is_active) {
        const role = profile.role as AppRole;
        const permissions = getPermissionsForRole(role);

        req.auth = {
          user: profile,
          permissions,
        };
      }
    }

    next();
  } catch (error) {
    // Don't fail the request for optional auth
    console.error("[OPTIONAL_AUTH_ERROR] Error during optional authentication:", error);
    next();
  }
};
