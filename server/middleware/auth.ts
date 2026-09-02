import { Request, Response, NextFunction } from 'express';
import { createSupabaseServerClient } from '../lib/supabase';
import { getPermissionsForRole } from '../lib/rbac';
import { AppRole, AuthContext, AppPermission } from '../../src/types/auth';
import { HTTPError } from './errors';

// Extend Express Request to hold our auth context
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createSupabaseServerClient(req, res);
    
    const authHeader = req.headers.authorization;
    let user;
    let authError;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const res = await supabase.auth.getUser(token);
      user = res.data?.user;
      authError = res.error;
    } else {
      const res = await supabase.auth.getUser();
      user = res.data?.user;
      authError = res.error;
    }
    
    if (authError || !user) {
      throw new HTTPError(401, "UNAUTHORIZED", "Valid session required.");
    }

    // 2. Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new HTTPError(401, "PROFILE_MISSING", "User profile not found.");
    }

    if (!profile.is_active) {
      throw new HTTPError(403, "ACCOUNT_DISABLED", "This account has been disabled.");
    }

    // 3. Resolve permissions
    const role = profile.role as AppRole;
    const permissions = getPermissionsForRole(role);

    req.auth = {
      user: profile,
      permissions
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requirePermission = (permission: AppPermission | AppPermission[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Ensure requireAuth has run
      if (!req.auth) {
        throw new HTTPError(500, "AUTH_NOT_INITIALIZED", "requireAuth must be called before requirePermission.");
      }

      const permissionsToCheck = Array.isArray(permission) ? permission : [permission];
      
      const hasPermission = permissionsToCheck.some(p => req.auth!.permissions.has(p));

      if (!hasPermission) {
        throw new HTTPError(403, "FORBIDDEN", `Missing required permission: ${permissionsToCheck.join(' or ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
