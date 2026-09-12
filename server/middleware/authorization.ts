import { Request, Response, NextFunction } from "express";
import { HTTPError } from "./errors";

/**
 * Scope-based authorization middleware
 * Ensures users can only access data within their scope (store, region, etc.)
 */

export interface ScopeContext {
  userId: string;
  role: string;
  storeId?: string | null;
  customerId?: string | null;
}

/**
 * Require user to have access to a specific store
 */
export const requireStoreAccess = (storeIdParam: string = "storeId") => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = (req as any).auth;
      if (!auth) {
        throw new HTTPError(500, "AUTH_NOT_INITIALIZED", "Authentication context not found");
      }

      const requestedStoreId = req.params[storeIdParam] || req.body[storeIdParam];
      const userStoreId = auth.user.store_id;

      // PLATFORM_ADMIN, EXECUTIVE, OPERATIONS can access all stores
      if (["PLATFORM_ADMIN", "EXECUTIVE", "OPERATIONS"].includes(auth.user.role)) {
        return next();
      }

      // STORE_MANAGER can only access their own store
      if (auth.user.role === "STORE_MANAGER") {
        if (!userStoreId) {
          throw new HTTPError(403, "FORBIDDEN", "Store manager not assigned to a store");
        }
        if (userStoreId !== requestedStoreId) {
          throw new HTTPError(403, "FORBIDDEN", "You can only access your assigned store");
        }
        return next();
      }

      // Other roles cannot access store-specific data
      throw new HTTPError(403, "FORBIDDEN", "You do not have permission to access this store");
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Require user to have access to a specific customer
 */
export const requireCustomerAccess = (customerIdParam: string = "customerId") => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = (req as any).auth;
      if (!auth) {
        throw new HTTPError(500, "AUTH_NOT_INITIALIZED", "Authentication context not found");
      }

      const requestedCustomerId = req.params[customerIdParam] || req.body[customerIdParam];

      // CUSTOMER can only access their own data
      if (auth.user.role === "CUSTOMER") {
        // We need to resolve the customer's ID from their profile
        // This is handled in the controller via resolveCustomer function
        // The middleware just ensures the role is correct
        return next();
      }

      // Internal roles can access customer data
      if (
        ["PLATFORM_ADMIN", "EXECUTIVE", "OPERATIONS", "CUSTOMER_SUPPORT"].includes(
          auth.user.role,
        )
      ) {
        return next();
      }

      // STORE_MANAGER cannot access customer data
      throw new HTTPError(403, "FORBIDDEN", "You do not have permission to access customer data");
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Require user to have access to a specific case (complaint)
 */
export const requireCaseAccess = (caseIdParam: string = "id") => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = (req as any).auth;
      if (!auth) {
        throw new HTTPError(500, "AUTH_NOT_INITIALIZED", "Authentication context not found");
      }

      // PLATFORM_ADMIN, EXECUTIVE can access all cases
      if (["PLATFORM_ADMIN", "EXECUTIVE"].includes(auth.user.role)) {
        return next();
      }

      // OPERATIONS, CUSTOMER_SUPPORT can access cases (assignment filtering done in controller)
      if (["OPERATIONS", "CUSTOMER_SUPPORT"].includes(auth.user.role)) {
        return next();
      }

      // CUSTOMER can only access their own cases (handled in controller)
      if (auth.user.role === "CUSTOMER") {
        return next();
      }

      // STORE_MANAGER cannot access cases
      throw new HTTPError(403, "FORBIDDEN", "You do not have permission to access case data");
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Require user to have access to fraud data
 */
export const requireFraudAccess = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = (req as any).auth;
      if (!auth) {
        throw new HTTPError(500, "AUTH_NOT_INITIALIZED", "Authentication context not found");
      }

      // Only these roles can access fraud data
      const allowedRoles = [
        "PLATFORM_ADMIN",
        "EXECUTIVE",
        "OPERATIONS",
        "CUSTOMER_SUPPORT",
      ];

      if (!allowedRoles.includes(auth.user.role)) {
        throw new HTTPError(403, "FORBIDDEN", "You do not have permission to access fraud data");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Require user to have access to audit logs
 */
export const requireAuditAccess = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = (req as any).auth;
      if (!auth) {
        throw new HTTPError(500, "AUTH_NOT_INITIALIZED", "Authentication context not found");
      }

      // Only PLATFORM_ADMIN can access audit logs
      if (auth.user.role !== "PLATFORM_ADMIN") {
        throw new HTTPError(403, "FORBIDDEN", "You do not have permission to access audit logs");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Require user to have admin security access
 */
export const requireSecurityAccess = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = (req as any).auth;
      if (!auth) {
        throw new HTTPError(500, "AUTH_NOT_INITIALIZED", "Authentication context not found");
      }

      // Only PLATFORM_ADMIN can access security functions
      if (auth.user.role !== "PLATFORM_ADMIN") {
        throw new HTTPError(
          403,
          "FORBIDDEN",
          "You do not have permission to access security functions",
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
