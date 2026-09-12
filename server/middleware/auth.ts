import { Request, Response, NextFunction } from "express";
import { createSupabaseServerClient } from "../lib/supabase";
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

/**
 * Enhanced authentication middleware with better error handling and logging
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requestId = req.requestId || "unknown";
    const authHeader = req.headers.authorization;

    // Check token cache first for fast response
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const cached = tokenAuthCache.get(token);
      if (cached && Date.now() < cached.expiresAt) {
        req.auth = {
          user: cached.user,
          permissions: getPermissionsForRole(cached.profile.role as AppRole),
        };
        return next();
      }
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
    console.log(`[AUTH_SUCCESS] RequestID: ${requestId}, UserID: ${user.id}, Role: ${role}, Permissions: ${Array.from(permissions).join(", ")}`);

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

      console.log(`[PERMISSION_CHECK] RequestID: ${requestId}, UserID: ${req.auth.user.id}, Role: ${userRole}, Required: ${permissionsToCheck.join(" or ")}, UserPermissions: ${userPermissions.join(", ")}`);

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
