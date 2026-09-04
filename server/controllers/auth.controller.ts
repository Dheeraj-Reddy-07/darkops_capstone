import { Request, Response, NextFunction } from 'express';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '../lib/supabase';
import { HTTPError } from '../middleware/errors';

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // req.auth is populated by the requireAuth middleware
    res.status(200).json({
      user: req.auth!.user,
      permissions: Array.from(req.auth!.permissions)
    });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { preferences } = req.body;
    const auth = (req as any).auth;
    const adminClient = createSupabaseServiceRoleClient();

    if (!preferences) {
      throw new HTTPError(400, 'BAD_REQUEST', 'Preferences payload is required');
    }

    const { data, error } = await adminClient
      .from('profiles')
      .update({ preferences })
      .eq('id', auth.user.id)
      .select()
      .single();

    if (error) {
      throw new HTTPError(500, 'DATABASE_ERROR', `Failed to update preferences: ${error.message}`);
    }

    res.status(200).json({ user: data });
  } catch (error) {
    next(error);
  }
};
