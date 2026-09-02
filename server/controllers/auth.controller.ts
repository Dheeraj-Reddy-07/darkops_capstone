import { Request, Response, NextFunction } from 'express';

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
